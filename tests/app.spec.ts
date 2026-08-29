import fs from "fs";
import os from "os";
import path from "path";
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";

vi.mock("../src/db/users", () => ({
  UserModel: { findOne: vi.fn() },
  getUsers: vi.fn(),
  getUserById: vi.fn(),
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  deleteUserById: vi.fn(),
  setRefreshToken: vi.fn(),
}));

vi.mock("../src/db/product", () => ({
  getProducts: vi.fn(),
  getProductById: vi.fn(),
  createProduct: vi.fn(),
  deleteProductById: vi.fn(),
  updateProductById: vi.fn(),
}));

/** A stand-in for the Angular build output the API serves in production. */
const frontendDir = fs.mkdtempSync(path.join(os.tmpdir(), "rest-api-et-spa-"));
fs.writeFileSync(path.join(frontendDir, "index.html"), "<!doctype html>spa");
fs.writeFileSync(path.join(frontendDir, "favicon.txt"), "icon");

afterAll(() => fs.rmSync(frontendDir, { recursive: true, force: true }));

beforeEach(() => {
  delete process.env.FRONTEND_BUILD_PATH;
  delete process.env.CORS_ORIGIN;
});

describe("createApp", () => {
  it("serves the API banner under /api", async () => {
    const response = await request(createApp()).get("/api");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "REST API with Express and Typescript",
      version: "1.0.0",
      author: "W. Rujel",
    });
  });

  it("reflects the configured CORS origin", async () => {
    process.env.CORS_ORIGIN = "https://app.example.com";

    const response = await request(createApp())
      .get("/api")
      .set("Origin", "https://app.example.com");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://app.example.com",
    );
    expect(response.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("echoes the request origin back when none is configured", async () => {
    const response = await request(createApp())
      .get("/api")
      .set("Origin", "https://anything.example.com");

    expect(response.headers["access-control-allow-origin"]).toBe(
      "https://anything.example.com",
    );
  });

  it("parses a JSON body", async () => {
    const response = await request(createApp())
      .post("/api/auth/register")
      .send({ username: "ada" });

    // Only `username` arrived, so the handler rejects it — which is proof the
    // body was parsed at all rather than arriving as a raw stream.
    expect(response.status).toBe(400);
  });

  it("404s on an unknown route when no SPA build is configured", async () => {
    const response = await request(createApp()).get("/home");

    expect(response.status).toBe(404);
  });

  describe("with a frontend build configured", () => {
    const appWithSpa = () => {
      process.env.FRONTEND_BUILD_PATH = frontendDir;
      return createApp();
    };

    it("serves static files straight out of the build", async () => {
      const response = await request(appWithSpa()).get("/favicon.txt");

      expect(response.status).toBe(200);
      expect(response.text).toBe("icon");
    });

    it("falls back to index.html for a client-side route", async () => {
      const response = await request(appWithSpa()).get("/home");

      expect(response.status).toBe(200);
      expect(response.text).toContain("spa");
    });

    it("does not hand index.html to an unmatched /api path", async () => {
      const response = await request(appWithSpa()).get("/api/does-not-exist");

      expect(response.status).toBe(404);
      expect(response.text).not.toContain("spa");
    });

    it("does not hand index.html to a non-GET request", async () => {
      const response = await request(appWithSpa()).post("/home").send({});

      expect(response.status).toBe(404);
      expect(response.text).not.toContain("spa");
    });
  });
});
