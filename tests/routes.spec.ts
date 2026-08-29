import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { getUserById, getUsers } from "../src/db/users";
import { getProductById, getProducts } from "../src/db/product";
import { signAccessToken } from "../src/helpers";
import { queryDouble } from "./support/query";

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

const mockedGetUsers = vi.mocked(getUsers);
const mockedGetUserById = vi.mocked(getUserById);
const mockedGetProducts = vi.mocked(getProducts);
const mockedGetProductById = vi.mocked(getProductById);

const IDENTITY = { _id: "user-1", username: "ada", email: "ada@example.com" };
const authHeader = () => `Bearer ${signAccessToken("user-1")}`;

let app: ReturnType<typeof createApp>;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.FRONTEND_BUILD_PATH;
  delete process.env.GITHUB_CLIENT_ID;
  delete process.env.GITHUB_CLIENT_SECRET;
  delete process.env.GOOGLE_CLIENT_ID;
  delete process.env.GOOGLE_CLIENT_SECRET;
  // `isAuthenticated` resolves the bearer subject through this lookup.
  mockedGetUserById.mockReturnValue(queryDouble(IDENTITY) as never);
  app = createApp();
});

describe("auth routes", () => {
  it("exposes the OAuth provider report", async () => {
    const response = await request(app).get("/api/auth/providers");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ github: false, google: false });
  });

  it("501s on the GitHub entry point while it is unconfigured", async () => {
    const response = await request(app).get("/api/auth/github");

    expect(response.status).toBe(501);
  });

  it("501s on the GitHub callback while it is unconfigured", async () => {
    const response = await request(app).get("/api/auth/github/callback");

    expect(response.status).toBe(501);
  });

  it("501s on the Google entry point while it is unconfigured", async () => {
    const response = await request(app).get("/api/auth/google");

    expect(response.status).toBe(501);
  });

  it("501s on the Google callback while it is unconfigured", async () => {
    const response = await request(app).get("/api/auth/google/callback");

    expect(response.status).toBe(501);
  });

  it("routes logout even with no cookie present", async () => {
    const response = await request(app).post("/api/auth/logout");

    expect(response.status).toBe(204);
  });

  it("routes refresh and rejects a missing cookie", async () => {
    const response = await request(app).post("/api/auth/refresh");

    expect(response.status).toBe(401);
  });

  it("rate-limits repeated credential attempts", async () => {
    // The limiter allows 10 attempts per window across register and login;
    // the 11th must be turned away rather than reaching the handler.
    const attempts = [];
    for (let i = 0; i < 11; i += 1) {
      attempts.push(await request(app).post("/api/auth/login").send({}));
    }

    expect(attempts.slice(0, 10).every((r) => r.status === 400)).toBe(true);
    expect(attempts[10].status).toBe(429);
  });
});

describe("user routes", () => {
  it("requires a bearer token", async () => {
    const response = await request(app).get("/api/users");

    expect(response.status).toBe(401);
    expect(mockedGetUsers).not.toHaveBeenCalled();
  });

  it("lists users for an authenticated caller", async () => {
    mockedGetUsers.mockReturnValue(queryDouble([IDENTITY]) as never);

    const response = await request(app)
      .get("/api/users")
      .set("Authorization", authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([IDENTITY]);
  });

  it("puts DELETE /users/:id behind the ownership check", async () => {
    const response = await request(app)
      .delete("/api/users/user-1")
      .set("Authorization", authHeader());

    // `isOwner` reads the id off the query string, which this route never
    // supplies — so ownership fails before the handler runs.
    expect(response.status).toBe(400);
  });

  it("puts PATCH /users/:id behind the ownership check", async () => {
    const response = await request(app)
      .patch("/api/users/user-1")
      .set("Authorization", authHeader())
      .send({ username: "grace" });

    expect(response.status).toBe(400);
  });
});

describe("product routes", () => {
  it("requires a bearer token to list products", async () => {
    const response = await request(app).get("/api/products");

    expect(response.status).toBe(401);
  });

  it("lists products for an authenticated caller", async () => {
    mockedGetProducts.mockReturnValue(queryDouble([]) as never);

    const response = await request(app)
      .get("/api/products")
      .set("Authorization", authHeader());

    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  it("404s an update for a product that does not exist", async () => {
    mockedGetProductById.mockReturnValue(queryDouble(null) as never);

    const response = await request(app)
      .put("/api/products?id=p1")
      .set("Authorization", authHeader())
      .send({ price: 12 });

    expect(response.status).toBe(404);
  });

  it("403s a delete for a product owned by somebody else", async () => {
    mockedGetProductById.mockReturnValue(
      queryDouble({ user: "user-2" }) as never,
    );

    const response = await request(app)
      .delete("/api/products?id=p1")
      .set("Authorization", authHeader());

    expect(response.status).toBe(403);
  });
});
