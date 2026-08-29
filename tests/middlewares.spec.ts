import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAuthenticated, isOwner } from "../src/middlewares";
import { getUserById } from "../src/db/users";
import { getProductById } from "../src/db/product";
import { signAccessToken } from "../src/helpers";
import { createRequest, createResponse } from "./support/http";
import { failingQuery, queryDouble } from "./support/query";

vi.mock("../src/db/users", () => ({ getUserById: vi.fn() }));
vi.mock("../src/db/product", () => ({ getProductById: vi.fn() }));

const mockedGetUserById = vi.mocked(getUserById);
const mockedGetProductById = vi.mocked(getProductById);

describe("isAuthenticated", () => {
  const user = { _id: "user-1", username: "ada" };

  beforeEach(() => {
    mockedGetUserById.mockReset();
  });

  it("attaches the identity and continues for a valid bearer token", async () => {
    mockedGetUserById.mockReturnValue(queryDouble(user) as never);
    const req = createRequest({
      headers: { authorization: `Bearer ${signAccessToken("user-1")}` },
    });
    const res = createResponse();
    const next = vi.fn();

    await isAuthenticated(req, res, next);

    expect(mockedGetUserById).toHaveBeenCalledWith("user-1");
    expect((req as unknown as { identity: unknown }).identity).toBe(user);
    expect(next).toHaveBeenCalledOnce();
  });

  it("401s when the Authorization header is missing", async () => {
    const res = createResponse();
    const next = vi.fn();

    await isAuthenticated(createRequest(), res, next);

    expect(res.sentStatus).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the header is not a Bearer scheme", async () => {
    const res = createResponse();
    const req = createRequest({ headers: { authorization: "Basic abc" } });

    await isAuthenticated(req, res, vi.fn());

    expect(res.sentStatus).toBe(401);
  });

  it("401s when the token does not verify", async () => {
    const res = createResponse();
    const req = createRequest({ headers: { authorization: "Bearer bogus" } });

    await isAuthenticated(req, res, vi.fn());

    expect(res.sentStatus).toBe(401);
    expect(mockedGetUserById).not.toHaveBeenCalled();
  });

  it("401s when the token is valid but the user is gone", async () => {
    mockedGetUserById.mockReturnValue(queryDouble(null) as never);
    const res = createResponse();
    const req = createRequest({
      headers: { authorization: `Bearer ${signAccessToken("ghost")}` },
    });

    await isAuthenticated(req, res, vi.fn());

    expect(res.sentStatus).toBe(401);
  });

  it("400s when the lookup blows up", async () => {
    mockedGetUserById.mockReturnValue(failingQuery(new Error("db down")) as never);
    const res = createResponse();
    const req = createRequest({
      headers: { authorization: `Bearer ${signAccessToken("user-1")}` },
    });

    await isAuthenticated(req, res, vi.fn());

    expect(res.sentStatus).toBe(400);
  });
});

describe("isOwner", () => {
  const identity = { _id: "user-1" };

  const ownerRequest = (query: Record<string, string>) =>
    Object.assign(createRequest({ query }), { identity });

  beforeEach(() => {
    mockedGetProductById.mockReset();
  });

  it("continues when the caller owns the product", async () => {
    mockedGetProductById.mockReturnValue(
      queryDouble({ user: "user-1" }) as never
    );
    const res = createResponse();
    const next = vi.fn();

    await isOwner(ownerRequest({ id: "product-1" }), res, next);

    expect(mockedGetProductById).toHaveBeenCalledWith("product-1");
    expect(next).toHaveBeenCalledOnce();
  });

  it("400s when no id is supplied", async () => {
    const res = createResponse();
    const next = vi.fn();

    await isOwner(ownerRequest({}), res, next);

    expect(res.sentStatus).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("404s when the product does not exist", async () => {
    mockedGetProductById.mockReturnValue(queryDouble(null) as never);
    const res = createResponse();

    await isOwner(ownerRequest({ id: "missing" }), res, vi.fn());

    expect(res.sentStatus).toBe(404);
  });

  it("403s when the product belongs to somebody else", async () => {
    mockedGetProductById.mockReturnValue(
      queryDouble({ user: "user-2" }) as never
    );
    const res = createResponse();
    const next = vi.fn();

    await isOwner(ownerRequest({ id: "product-1" }), res, next);

    expect(res.sentStatus).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("400s when the lookup blows up", async () => {
    mockedGetProductById.mockReturnValue(
      failingQuery(new Error("db down")) as never
    );
    const res = createResponse();

    await isOwner(ownerRequest({ id: "product-1" }), res, vi.fn());

    expect(res.sentStatus).toBe(400);
  });
});
