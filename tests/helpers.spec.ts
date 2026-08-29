import { beforeEach, describe, expect, it, vi } from "vitest";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import {
  ACCESS_TOKEN_TTL,
  REFRESH_TOKEN_TTL,
  REFRESH_TOKEN_TTL_MS,
  hashPassword,
  hashToken,
  isArgon2Hash,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyLegacyPassword,
  verifyPassword,
  verifyRefreshToken,
} from "../src/helpers";

describe("helpers", () => {
  beforeEach(() => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.SECRET;
  });

  describe("token lifetimes", () => {
    it("exposes matching string and millisecond refresh TTLs", () => {
      expect(ACCESS_TOKEN_TTL).toBe("15m");
      expect(REFRESH_TOKEN_TTL).toBe("7d");
      expect(REFRESH_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000);
    });
  });

  describe("password hashing", () => {
    it("round-trips a password through argon2", async () => {
      const hash = await hashPassword("correct horse");
      expect(isArgon2Hash(hash)).toBe(true);
      await expect(verifyPassword(hash, "correct horse")).resolves.toBe(true);
    });

    it("rejects a wrong password", async () => {
      const hash = await hashPassword("correct horse");
      await expect(verifyPassword(hash, "battery staple")).resolves.toBe(false);
    });

    it("resolves false instead of throwing on a malformed hash", async () => {
      await expect(verifyPassword("not-a-hash", "anything")).resolves.toBe(
        false
      );
    });

    it("does not mistake a legacy hex digest for argon2", () => {
      expect(isArgon2Hash("a".repeat(64))).toBe(false);
    });
  });

  describe("verifyLegacyPassword", () => {
    const legacyHash = (salt: string, password: string, secret: string) =>
      crypto
        .createHmac("sha256", [salt, password].join("/"))
        .update(secret)
        .digest("hex");

    it("accepts a digest produced by the legacy scheme", () => {
      process.env.SECRET = "legacy-secret";
      const expected = legacyHash("salty", "hunter2", "legacy-secret");
      expect(verifyLegacyPassword("salty", "hunter2", expected)).toBe(true);
    });

    it("rejects a digest for a different password", () => {
      process.env.SECRET = "legacy-secret";
      const expected = legacyHash("salty", "hunter2", "legacy-secret");
      expect(verifyLegacyPassword("salty", "wrong", expected)).toBe(false);
    });

    it("refuses to verify when SECRET is unset", () => {
      expect(verifyLegacyPassword("salty", "hunter2", "whatever")).toBe(false);
    });
  });

  describe("hashToken", () => {
    it("is a stable sha256 digest", () => {
      expect(hashToken("token")).toBe(
        crypto.createHash("sha256").update("token").digest("hex")
      );
      expect(hashToken("token")).toBe(hashToken("token"));
      expect(hashToken("token")).not.toBe(hashToken("other"));
    });
  });

  describe("access tokens", () => {
    it("signs a token the verifier accepts", () => {
      expect(verifyAccessToken(signAccessToken("user-1"))).toBe("user-1");
    });

    it("reads the secret at call time rather than at import time", () => {
      process.env.JWT_ACCESS_SECRET = "first-secret";
      const token = signAccessToken("user-1");

      process.env.JWT_ACCESS_SECRET = "rotated-secret";
      expect(verifyAccessToken(token)).toBeNull();
    });

    it("returns null for a garbage token", () => {
      expect(verifyAccessToken("not.a.token")).toBeNull();
    });

    it("returns null when the payload carries no string subject", () => {
      const token = jwt.sign({ sub: { id: 1 } }, "dev-access-secret");
      expect(verifyAccessToken(token)).toBeNull();
    });

    it("returns null for an expired token", () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
        const token = signAccessToken("user-1");
        vi.setSystemTime(new Date("2026-01-01T01:00:00Z"));
        expect(verifyAccessToken(token)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("refresh tokens", () => {
    it("signs a token the verifier accepts", () => {
      expect(verifyRefreshToken(signRefreshToken("user-2"))).toBe("user-2");
    });

    it("gives every token a distinct jti so replays are detectable", () => {
      const first = jwt.decode(signRefreshToken("user-2")) as jwt.JwtPayload;
      const second = jwt.decode(signRefreshToken("user-2")) as jwt.JwtPayload;
      expect(first["jti"]).not.toBe(second["jti"]);
    });

    it("reads the secret at call time rather than at import time", () => {
      process.env.JWT_REFRESH_SECRET = "first-secret";
      const token = signRefreshToken("user-2");

      process.env.JWT_REFRESH_SECRET = "rotated-secret";
      expect(verifyRefreshToken(token)).toBeNull();
    });

    it("returns null for a garbage token", () => {
      expect(verifyRefreshToken("nope")).toBeNull();
    });

    it("returns null when the payload carries no string subject", () => {
      const token = jwt.sign({ sub: 42 }, "dev-refresh-secret");
      expect(verifyRefreshToken(token)).toBeNull();
    });
  });
});
