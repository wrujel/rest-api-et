import crypto from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  login,
  logout,
  refresh,
  register,
} from "../../src/controllers/authentication";
import {
  createUser,
  getUserByEmail,
  getUserById,
  setRefreshToken,
} from "../../src/db/users";
import { hashPassword, hashToken, signRefreshToken } from "../../src/helpers";
import { createRequest, createResponse } from "../support/http";
import { failingQuery, queryDouble } from "../support/query";

vi.mock("../../src/db/users", () => ({
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  createUser: vi.fn(),
  setRefreshToken: vi.fn(),
}));

const mockedGetUserByEmail = vi.mocked(getUserByEmail);
const mockedGetUserById = vi.mocked(getUserById);
const mockedCreateUser = vi.mocked(createUser);
const mockedSetRefreshToken = vi.mocked(setRefreshToken);

// Re-created per test: `restoreMocks` in vitest.config.ts detaches spies
// before every test, so a module-scope spy would only work for the first one.
let consoleLog: ReturnType<typeof vi.spyOn>;

const legacyHash = (salt: string, password: string, secret: string) =>
  crypto
    .createHmac("sha256", [salt, password].join("/"))
    .update(secret)
    .digest("hex");

beforeEach(() => {
  vi.clearAllMocks();
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
  mockedSetRefreshToken.mockResolvedValue(null as never);
  process.env.SECRET = "legacy-secret";
  delete process.env.ENVIRONMENT;
});

describe("login", () => {
  it("issues an access token and a refresh cookie for a valid argon2 password", async () => {
    const user = {
      _id: "user-1",
      username: "ada",
      email: "ada@example.com",
      authentication: { password: await hashPassword("hunter2") },
      save: vi.fn(),
    };
    mockedGetUserByEmail.mockReturnValue(queryDouble(user) as never);

    const res = createResponse();
    await login(
      createRequest({
        body: { email: "ada@example.com", password: "hunter2" },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      id: "user-1",
      username: "ada",
      email: "ada@example.com",
    });
    expect((res.body as { accessToken: string }).accessToken).toBeTypeOf(
      "string",
    );
    expect(res.cookies["refreshToken"]).toBeDefined();
    expect(mockedSetRefreshToken).toHaveBeenCalledWith(
      "user-1",
      expect.any(String),
    );
    expect(user.save).not.toHaveBeenCalled();
  });

  it("marks the refresh cookie secure only in production", async () => {
    process.env.ENVIRONMENT = "production";
    mockedGetUserByEmail.mockReturnValue(
      queryDouble({
        _id: "user-1",
        username: "ada",
        email: "ada@example.com",
        authentication: { password: await hashPassword("hunter2") },
      }) as never,
    );

    const res = createResponse();
    await login(
      createRequest({
        body: { email: "ada@example.com", password: "hunter2" },
      }),
      res,
    );

    expect(res.cookies["refreshToken"].options).toMatchObject({
      httpOnly: true,
      secure: true,
      path: "/api/auth",
    });
  });

  it("400s when credentials are incomplete", async () => {
    const res = createResponse();
    await login(createRequest({ body: { email: "ada@example.com" } }), res);

    expect(res.sentStatus).toBe(400);
    expect(mockedGetUserByEmail).not.toHaveBeenCalled();
  });

  it("401s when no account matches the email", async () => {
    mockedGetUserByEmail.mockReturnValue(queryDouble(null) as never);

    const res = createResponse();
    await login(
      createRequest({ body: { email: "nobody@example.com", password: "x" } }),
      res,
    );

    expect(res.sentStatus).toBe(401);
  });

  it("401s for an OAuth-only account that has no password hash", async () => {
    mockedGetUserByEmail.mockReturnValue(
      queryDouble({ _id: "user-1", authentication: {} }) as never,
    );

    const res = createResponse();
    await login(
      createRequest({ body: { email: "ada@example.com", password: "x" } }),
      res,
    );

    expect(res.sentStatus).toBe(401);
  });

  it("401s when the account has no authentication sub-document at all", async () => {
    mockedGetUserByEmail.mockReturnValue(
      queryDouble({ _id: "user-1" }) as never,
    );

    const res = createResponse();
    await login(
      createRequest({ body: { email: "ada@example.com", password: "x" } }),
      res,
    );

    expect(res.sentStatus).toBe(401);
  });

  it("401s on a wrong argon2 password", async () => {
    mockedGetUserByEmail.mockReturnValue(
      queryDouble({
        _id: "user-1",
        authentication: { password: await hashPassword("hunter2") },
      }) as never,
    );

    const res = createResponse();
    await login(
      createRequest({ body: { email: "ada@example.com", password: "wrong" } }),
      res,
    );

    expect(res.sentStatus).toBe(401);
  });

  it("migrates a verified legacy password to argon2 and drops the salt", async () => {
    const user = {
      _id: "user-1",
      username: "ada",
      email: "ada@example.com",
      authentication: {
        password: legacyHash("salty", "hunter2", "legacy-secret"),
        salt: "salty" as string | undefined,
      },
      save: vi.fn().mockResolvedValue(undefined),
    };
    mockedGetUserByEmail.mockReturnValue(queryDouble(user) as never);

    const res = createResponse();
    await login(
      createRequest({
        body: { email: "ada@example.com", password: "hunter2" },
      }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(user.authentication.password.startsWith("$argon2")).toBe(true);
    expect(user.authentication.salt).toBeUndefined();
    expect(user.save).toHaveBeenCalledOnce();
  });

  it("401s and leaves the record alone on a wrong legacy password", async () => {
    const user = {
      _id: "user-1",
      authentication: {
        password: legacyHash("salty", "hunter2", "legacy-secret"),
        salt: "salty",
      },
      save: vi.fn(),
    };
    mockedGetUserByEmail.mockReturnValue(queryDouble(user) as never);

    const res = createResponse();
    await login(
      createRequest({ body: { email: "ada@example.com", password: "nope" } }),
      res,
    );

    expect(res.sentStatus).toBe(401);
    expect(user.save).not.toHaveBeenCalled();
  });

  it("401s when a legacy hash has lost its salt", async () => {
    mockedGetUserByEmail.mockReturnValue(
      queryDouble({
        _id: "user-1",
        authentication: { password: "deadbeef" },
      }) as never,
    );

    const res = createResponse();
    await login(
      createRequest({
        body: { email: "ada@example.com", password: "hunter2" },
      }),
      res,
    );

    expect(res.sentStatus).toBe(401);
  });

  it("400s and logs when the lookup blows up", async () => {
    mockedGetUserByEmail.mockReturnValue(
      failingQuery(new Error("db down")) as never,
    );

    const res = createResponse();
    await login(
      createRequest({ body: { email: "ada@example.com", password: "x" } }),
      res,
    );

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("register", () => {
  it("creates the account and returns it without a token", async () => {
    mockedGetUserByEmail.mockReturnValue(queryDouble(null) as never);
    mockedCreateUser.mockResolvedValue({
      _id: "user-9",
      username: "ada",
      email: "ada@example.com",
    } as never);

    const res = createResponse();
    await register(
      createRequest({
        body: {
          username: "ada",
          email: "ada@example.com",
          password: "hunter2",
        },
      }),
      res,
    );

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      id: "user-9",
      username: "ada",
      email: "ada@example.com",
    });
    const created = mockedCreateUser.mock.calls[0][0] as {
      authentication: { password: string };
    };
    expect(created.authentication.password.startsWith("$argon2")).toBe(true);
  });

  it("400s when a field is missing", async () => {
    const res = createResponse();
    await register(
      createRequest({ body: { username: "ada", email: "ada@example.com" } }),
      res,
    );

    expect(res.sentStatus).toBe(400);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("409s when the email is already taken", async () => {
    mockedGetUserByEmail.mockReturnValue(
      queryDouble({ _id: "user-1" }) as never,
    );

    const res = createResponse();
    await register(
      createRequest({
        body: { username: "ada", email: "ada@example.com", password: "x" },
      }),
      res,
    );

    expect(res.sentStatus).toBe(409);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("400s and logs when the insert blows up", async () => {
    mockedGetUserByEmail.mockReturnValue(queryDouble(null) as never);
    mockedCreateUser.mockRejectedValue(new Error("duplicate key"));

    const res = createResponse();
    await register(
      createRequest({
        body: { username: "ada", email: "ada@example.com", password: "x" },
      }),
      res,
    );

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("refresh", () => {
  it("rotates the tokens for a cookie that matches the stored hash", async () => {
    const token = signRefreshToken("user-1");
    mockedGetUserById.mockReturnValue(
      queryDouble({
        _id: "user-1",
        username: "ada",
        email: "ada@example.com",
        authentication: { refreshToken: hashToken(token) },
      }) as never,
    );

    const res = createResponse();
    await refresh(createRequest({ cookies: { refreshToken: token } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      email: "ada@example.com",
      username: "ada",
    });
    expect(res.cookies["refreshToken"].value).not.toBe(token);
  });

  it("401s when the cookie is absent", async () => {
    const res = createResponse();
    await refresh(createRequest(), res);

    expect(res.sentStatus).toBe(401);
    expect(res.clearedCookies).toEqual([]);
  });

  it("401s and clears the cookie when the token does not verify", async () => {
    const res = createResponse();
    await refresh(createRequest({ cookies: { refreshToken: "bogus" } }), res);

    expect(res.sentStatus).toBe(401);
    expect(res.clearedCookies).toEqual(["refreshToken"]);
  });

  it("401s and clears the cookie when the user is gone", async () => {
    mockedGetUserById.mockReturnValue(queryDouble(null) as never);

    const res = createResponse();
    await refresh(
      createRequest({ cookies: { refreshToken: signRefreshToken("ghost") } }),
      res,
    );

    expect(res.sentStatus).toBe(401);
    expect(res.clearedCookies).toEqual(["refreshToken"]);
  });

  it("401s when the stored hash belongs to an older token", async () => {
    mockedGetUserById.mockReturnValue(
      queryDouble({
        _id: "user-1",
        authentication: { refreshToken: hashToken("some-other-token") },
      }) as never,
    );

    const res = createResponse();
    await refresh(
      createRequest({ cookies: { refreshToken: signRefreshToken("user-1") } }),
      res,
    );

    expect(res.sentStatus).toBe(401);
    expect(res.clearedCookies).toEqual(["refreshToken"]);
  });

  it("400s and logs when the lookup blows up", async () => {
    mockedGetUserById.mockReturnValue(
      failingQuery(new Error("db down")) as never,
    );

    const res = createResponse();
    await refresh(
      createRequest({ cookies: { refreshToken: signRefreshToken("user-1") } }),
      res,
    );

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("logout", () => {
  it("clears the stored refresh token and the cookie", async () => {
    const token = signRefreshToken("user-1");

    const res = createResponse();
    await logout(createRequest({ cookies: { refreshToken: token } }), res);

    expect(mockedSetRefreshToken).toHaveBeenCalledWith("user-1", null);
    expect(res.clearedCookies).toEqual(["refreshToken"]);
    expect(res.sentStatus).toBe(204);
  });

  it("still succeeds with no cookie at all", async () => {
    const res = createResponse();
    await logout(createRequest(), res);

    expect(mockedSetRefreshToken).not.toHaveBeenCalled();
    expect(res.sentStatus).toBe(204);
  });

  it("skips the db write when the cookie does not verify", async () => {
    const res = createResponse();
    await logout(createRequest({ cookies: { refreshToken: "bogus" } }), res);

    expect(mockedSetRefreshToken).not.toHaveBeenCalled();
    expect(res.sentStatus).toBe(204);
  });

  it("400s and logs when clearing the stored token blows up", async () => {
    mockedSetRefreshToken.mockRejectedValue(new Error("db down") as never);

    const res = createResponse();
    await logout(
      createRequest({ cookies: { refreshToken: signRefreshToken("user-1") } }),
      res,
    );

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});
