import { beforeEach, describe, expect, it, vi } from "vitest";

// Captured by the strategy doubles below so the specs can invoke the verify
// callbacks the real passport runtime would have called after a redirect.
const { strategyCalls } = vi.hoisted(() => ({
  strategyCalls: [] as Array<{
    provider: string;
    options: Record<string, unknown>;
    verify: (
      accessToken: string,
      refreshToken: string,
      profile: unknown,
      done: (err: unknown, user?: unknown) => void,
    ) => Promise<void>;
  }>,
}));

vi.mock("passport-github2", () => ({
  Strategy: class {
    constructor(options: Record<string, unknown>, verify: never) {
      strategyCalls.push({ provider: "github", options, verify });
    }
  },
}));

vi.mock("passport-google-oauth20", () => ({
  Strategy: class {
    constructor(options: Record<string, unknown>, verify: never) {
      strategyCalls.push({ provider: "google", options, verify });
    }
  },
}));

vi.mock("passport", () => ({
  default: { use: vi.fn(), authenticate: vi.fn() },
}));

vi.mock("../../src/db/users", () => ({
  UserModel: { findOne: vi.fn() },
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
  setRefreshToken: vi.fn(),
}));

import passport from "passport";

import {
  findOrCreateUser,
  oauthCallback,
  oauthConfig,
  oauthEntry,
  providers,
  setupOAuthStrategies,
} from "../../src/controllers/oauth";
import {
  UserModel,
  createUser,
  getUserByEmail,
  setRefreshToken,
} from "../../src/db/users";
import { hashToken, verifyRefreshToken } from "../../src/helpers";
import { createRequest, createResponse } from "../support/http";
import { queryDouble } from "../support/query";

const mockedUse = vi.mocked(passport.use);
const mockedAuthenticate = vi.mocked(passport.authenticate);
const mockedFindOne = vi.mocked(UserModel.findOne);
const mockedGetUserByEmail = vi.mocked(getUserByEmail);
const mockedCreateUser = vi.mocked(createUser);
const mockedSetRefreshToken = vi.mocked(setRefreshToken);

const OAUTH_ENV = [
  "GITHUB_CLIENT_ID",
  "GITHUB_CLIENT_SECRET",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "API_PUBLIC_URL",
  "ENVIRONMENT",
] as const;

const configureBothProviders = () => {
  process.env.GITHUB_CLIENT_ID = "gh-id";
  process.env.GITHUB_CLIENT_SECRET = "gh-secret";
  process.env.GOOGLE_CLIENT_ID = "goo-id";
  process.env.GOOGLE_CLIENT_SECRET = "goo-secret";
};

let consoleLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  strategyCalls.length = 0;
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
  for (const key of OAUTH_ENV) delete process.env[key];
  mockedSetRefreshToken.mockResolvedValue(null as never);
});

describe("oauthConfig", () => {
  it("reports a provider as configured only once both halves of the pair exist", () => {
    expect(oauthConfig.github).toBe(false);
    expect(oauthConfig.google).toBe(false);

    process.env.GITHUB_CLIENT_ID = "gh-id";
    process.env.GOOGLE_CLIENT_ID = "goo-id";
    expect(oauthConfig.github).toBe(false);
    expect(oauthConfig.google).toBe(false);

    process.env.GITHUB_CLIENT_SECRET = "gh-secret";
    process.env.GOOGLE_CLIENT_SECRET = "goo-secret";
    expect(oauthConfig.github).toBe(true);
    expect(oauthConfig.google).toBe(true);
  });
});

describe("providers", () => {
  it("serializes the live config rather than a snapshot from import time", () => {
    const res = createResponse();
    providers(createRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(JSON.stringify(res.body))).toEqual({
      github: false,
      google: false,
    });

    configureBothProviders();
    const second = createResponse();
    providers(createRequest(), second);

    expect(JSON.parse(JSON.stringify(second.body))).toEqual({
      github: true,
      google: true,
    });
  });
});

describe("setupOAuthStrategies", () => {
  it("registers nothing when neither provider is configured", () => {
    setupOAuthStrategies();

    expect(mockedUse).not.toHaveBeenCalled();
    expect(strategyCalls).toHaveLength(0);
  });

  it("registers both strategies with callback URLs off API_PUBLIC_URL", () => {
    configureBothProviders();
    process.env.API_PUBLIC_URL = "https://api.example.com";

    setupOAuthStrategies();

    expect(mockedUse).toHaveBeenCalledTimes(2);
    expect(strategyCalls.map((call) => call.provider)).toEqual([
      "github",
      "google",
    ]);
    expect(strategyCalls[0].options["callbackURL"]).toBe(
      "https://api.example.com/api/auth/github/callback",
    );
    expect(strategyCalls[1].options["callbackURL"]).toBe(
      "https://api.example.com/api/auth/google/callback",
    );
  });

  it("falls back to localhost when API_PUBLIC_URL is unset", () => {
    configureBothProviders();

    setupOAuthStrategies();

    expect(strategyCalls[0].options["callbackURL"]).toBe(
      "http://localhost:8080/api/auth/github/callback",
    );
  });

  it("registers only the configured half of the pair", () => {
    process.env.GOOGLE_CLIENT_ID = "goo-id";
    process.env.GOOGLE_CLIENT_SECRET = "goo-secret";

    setupOAuthStrategies();

    expect(strategyCalls.map((call) => call.provider)).toEqual(["google"]);
  });

  describe("the GitHub verify callback", () => {
    const verify = () => {
      configureBothProviders();
      setupOAuthStrategies();
      return strategyCalls[0].verify;
    };

    it("prefers the primary email and the login handle", async () => {
      mockedGetUserByEmail.mockReturnValue(queryDouble({ _id: "u1" }) as never);
      const done = vi.fn();

      await verify()(
        "at",
        "rt",
        {
          username: "ada",
          emails: [
            { value: "secondary@example.com" },
            { value: "primary@example.com", primary: true },
          ],
        },
        done,
      );

      expect(mockedGetUserByEmail).toHaveBeenCalledWith("primary@example.com");
      expect(done).toHaveBeenCalledWith(null, { _id: "u1" });
    });

    it("falls back to the first email and the display name", async () => {
      mockedGetUserByEmail.mockReturnValue(queryDouble({ _id: "u1" }) as never);
      const done = vi.fn();

      await verify()(
        "at",
        "rt",
        {
          displayName: "Ada Lovelace",
          emails: [{ value: "first@example.com" }],
        },
        done,
      );

      expect(mockedGetUserByEmail).toHaveBeenCalledWith("first@example.com");
    });

    it("reports the error when the provider shares no email", async () => {
      const done = vi.fn();

      await verify()("at", "rt", {}, done);

      expect(done).toHaveBeenCalledWith(expect.any(Error));
      expect((done.mock.calls[0][0] as Error).message).toMatch(
        /did not share an email/,
      );
    });
  });

  describe("the Google verify callback", () => {
    const verify = () => {
      configureBothProviders();
      setupOAuthStrategies();
      return strategyCalls[1].verify;
    };

    it("uses the first email and the display name", async () => {
      mockedGetUserByEmail.mockReturnValue(queryDouble({ _id: "u2" }) as never);
      const done = vi.fn();

      await verify()(
        "at",
        "rt",
        {
          displayName: "Ada Lovelace",
          emails: [{ value: "ada@example.com" }],
        },
        done,
      );

      expect(mockedGetUserByEmail).toHaveBeenCalledWith("ada@example.com");
      expect(done).toHaveBeenCalledWith(null, { _id: "u2" });
    });

    it("reports the error when the provider shares no email", async () => {
      const done = vi.fn();

      await verify()("at", "rt", { emails: [] }, done);

      expect(done).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});

describe("findOrCreateUser", () => {
  it("rejects a profile with no email", async () => {
    await expect(
      findOrCreateUser({ email: null, username: "ada" }),
    ).rejects.toThrow(/did not share an email/);
  });

  it("returns the existing account untouched", async () => {
    const existing = { _id: "u1" };
    mockedGetUserByEmail.mockReturnValue(queryDouble(existing) as never);

    await expect(
      findOrCreateUser({ email: "ada@example.com", username: "ada" }),
    ).resolves.toBe(existing);
    expect(mockedCreateUser).not.toHaveBeenCalled();
  });

  it("creates an account with a sanitized username", async () => {
    mockedGetUserByEmail.mockReturnValue(queryDouble(null) as never);
    mockedFindOne.mockReturnValue(queryDouble(null) as never);
    mockedCreateUser.mockResolvedValue({ _id: "u9" } as never);

    await findOrCreateUser({
      email: "ada@example.com",
      username: "Ada Lovelace!!",
    });

    expect(mockedCreateUser).toHaveBeenCalledWith({
      username: "AdaLovelace",
      email: "ada@example.com",
      authentication: {},
    });
  });

  it("truncates a very long handle to twenty characters", async () => {
    mockedGetUserByEmail.mockReturnValue(queryDouble(null) as never);
    mockedFindOne.mockReturnValue(queryDouble(null) as never);
    mockedCreateUser.mockResolvedValue({ _id: "u9" } as never);

    await findOrCreateUser({
      email: "ada@example.com",
      username: "a".repeat(40),
    });

    expect(
      (mockedCreateUser.mock.calls[0][0] as { username: string }).username,
    ).toBe("a".repeat(20));
  });

  it("falls back to the email local part when the handle sanitizes to nothing", async () => {
    mockedGetUserByEmail.mockReturnValue(queryDouble(null) as never);
    mockedFindOne.mockReturnValue(queryDouble(null) as never);
    mockedCreateUser.mockResolvedValue({ _id: "u9" } as never);

    await findOrCreateUser({ email: "ada@example.com", username: "!!!" });

    expect(
      (mockedCreateUser.mock.calls[0][0] as { username: string }).username,
    ).toBe("ada");
  });

  it("suffixes the handle until it stops colliding", async () => {
    mockedGetUserByEmail.mockReturnValue(queryDouble(null) as never);
    mockedFindOne
      .mockReturnValueOnce(queryDouble({ _id: "taken" }) as never)
      .mockReturnValueOnce(queryDouble({ _id: "taken" }) as never)
      .mockReturnValue(queryDouble(null) as never);
    mockedCreateUser.mockResolvedValue({ _id: "u9" } as never);

    await findOrCreateUser({ email: "ada@example.com", username: "ada" });

    expect(mockedFindOne).toHaveBeenCalledTimes(3);
    expect(
      (mockedCreateUser.mock.calls[0][0] as { username: string }).username,
    ).toMatch(/^ada-[a-z0-9]{1,4}$/);
  });
});

describe("oauthEntry", () => {
  it("501s when the provider is not configured", () => {
    const res = createResponse();
    oauthEntry("github")(createRequest(), res, vi.fn());

    expect(res.statusCode).toBe(501);
    expect(res.body).toEqual({
      message: "github sign-in is not configured on this server.",
    });
    expect(mockedAuthenticate).not.toHaveBeenCalled();
  });

  it("delegates to passport when the provider is configured", () => {
    configureBothProviders();
    const handler = vi.fn();
    mockedAuthenticate.mockReturnValue(handler as never);

    const req = createRequest();
    const res = createResponse();
    const next = vi.fn();
    oauthEntry("google")(req, res, next);

    expect(mockedAuthenticate).toHaveBeenCalledWith("google", {
      session: false,
    });
    expect(handler).toHaveBeenCalledWith(req, res, next);
  });
});

describe("oauthCallback", () => {
  /** Runs the callback and hands back the verify callback passport was given. */
  const invoke = async () => {
    let captured!: (err: unknown, user?: unknown) => Promise<void>;
    mockedAuthenticate.mockImplementation(((
      _provider: string,
      _options: unknown,
      cb: (err: unknown, user?: unknown) => Promise<void>,
    ) => {
      captured = cb;
      return vi.fn();
    }) as never);

    const res = createResponse();
    oauthCallback("github")(createRequest(), res, vi.fn());
    return { res, captured };
  };

  it("501s when the provider is not configured", () => {
    const res = createResponse();
    oauthCallback("google")(createRequest(), res, vi.fn());

    expect(res.statusCode).toBe(501);
    expect(mockedAuthenticate).not.toHaveBeenCalled();
  });

  it("stores a hashed refresh token, sets the cookie and redirects to the SPA", async () => {
    configureBothProviders();
    const { res, captured } = await invoke();

    await captured(null, { _id: "user-1" });

    const cookie = res.cookies["refreshToken"];
    expect(verifyRefreshToken(cookie.value)).toBe("user-1");
    expect(mockedSetRefreshToken).toHaveBeenCalledWith(
      "user-1",
      hashToken(cookie.value),
    );
    expect(cookie.options).toMatchObject({
      httpOnly: true,
      secure: false,
      path: "/api/auth",
    });
    expect(res.redirectedTo).toBe("/auth/callback");
  });

  it("marks the cookie secure in production", async () => {
    configureBothProviders();
    process.env.ENVIRONMENT = "production";
    const { res, captured } = await invoke();

    await captured(null, { _id: "user-1" });

    expect(res.cookies["refreshToken"].options).toMatchObject({ secure: true });
  });

  it("redirects to the login page when passport reports an error", async () => {
    configureBothProviders();
    const { res, captured } = await invoke();

    await captured(new Error("denied"));

    expect(res.redirectedTo).toBe("/login?error=oauth");
    expect(consoleLog).toHaveBeenCalled();
  });

  it("redirects to the login page when passport produced no user", async () => {
    configureBothProviders();
    const { res, captured } = await invoke();

    await captured(null, null);

    expect(res.redirectedTo).toBe("/login?error=oauth");
    expect(consoleLog).toHaveBeenCalledWith("OAuth callback: no user");
  });

  it("redirects to the login page when persisting the token fails", async () => {
    configureBothProviders();
    mockedSetRefreshToken.mockRejectedValue(new Error("db down") as never);
    const { res, captured } = await invoke();

    await captured(null, { _id: "user-1" });

    expect(res.redirectedTo).toBe("/login?error=oauth");
    expect(consoleLog).toHaveBeenCalled();
  });
});
