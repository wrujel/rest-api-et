import crypto from "crypto";
import argon2 from "argon2";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || "dev-access-secret";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh-secret";

export const ACCESS_TOKEN_TTL = "15m";
export const REFRESH_TOKEN_TTL = "7d";
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const hashPassword = (password: string) => argon2.hash(password);

export const verifyPassword = (hash: string, password: string) =>
  argon2.verify(hash, password).catch(() => false);

export const isArgon2Hash = (hash: string) => hash.startsWith("$argon2");

// Legacy HMAC-SHA256 scheme, kept only to migrate pre-JWT accounts on login.
export const verifyLegacyPassword = (
  salt: string,
  password: string,
  expectedHash: string
) => {
  const hash = crypto
    .createHmac("sha256", [salt, password].join("/"))
    .update(process.env.SECRET)
    .digest("hex");
  return hash === expectedHash;
};

export const hashToken = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");

export const signAccessToken = (userId: string) =>
  jwt.sign({ sub: userId }, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_TTL });

export const signRefreshToken = (userId: string) =>
  jwt.sign({ sub: userId, jti: crypto.randomUUID() }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });

export const verifyAccessToken = (token: string): string | null => {
  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET) as jwt.JwtPayload;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
};

export const verifyRefreshToken = (token: string): string | null => {
  try {
    const payload = jwt.verify(token, JWT_REFRESH_SECRET) as jwt.JwtPayload;
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
};
