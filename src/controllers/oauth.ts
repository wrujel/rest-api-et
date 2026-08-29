import express from "express";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import {
  UserModel,
  getUserByEmail,
  createUser,
  setRefreshToken,
} from "../db/users";
import {
  hashToken,
  signRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../helpers";

const REFRESH_COOKIE = "refreshToken";

export type OAuthProvider = "github" | "google";

/**
 * Read from the environment on every access rather than captured at import
 * time: the app is built before `dotenv` has necessarily run under some
 * entrypoints, and `GET /api/auth/providers` must reflect the live config.
 * Literal getters stay enumerable, so `res.json(oauthConfig)` still serializes.
 */
export const oauthConfig = {
  get github() {
    return !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  },
  get google() {
    return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  },
};

type OAuthProfile = {
  email: string | null;
  username: string;
};

export async function findOrCreateUser(profile: OAuthProfile) {
  if (!profile.email) {
    throw new Error("The provider did not share an email address.");
  }

  const existing = await getUserByEmail(profile.email);
  if (existing) return existing;

  const base =
    profile.username.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20) ||
    profile.email.split("@")[0];
  let username = base;
  while (await UserModel.findOne({ username })) {
    username = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  return createUser({
    username,
    email: profile.email,
    authentication: {},
  });
}

// `any` on purpose: passport typings vary per strategy package, and a narrower
// signature fails to match any of their overloads.
type VerifyCallback = (err: any, user?: any) => void;

/** Shared verify step for both providers — they differ only in how the
 *  profile exposes an email and a display name. */
const verifyOAuthProfile =
  (toProfile: (profile: any) => OAuthProfile) =>
  async (
    _accessToken: string,
    _refreshToken: string,
    profile: any,
    done: VerifyCallback
  ) => {
    try {
      done(null, await findOrCreateUser(toProfile(profile)));
    } catch (error) {
      done(error);
    }
  };

export function setupOAuthStrategies() {
  const apiPublicUrl = process.env.API_PUBLIC_URL || "http://localhost:8080";

  if (oauthConfig.github) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          callbackURL: `${apiPublicUrl}/api/auth/github/callback`,
          scope: ["user:email"],
        },
        verifyOAuthProfile((profile) => ({
          email:
            profile.emails?.find((e: any) => e.primary)?.value ??
            profile.emails?.[0]?.value ??
            null,
          username: profile.username || profile.displayName || "github",
        }))
      )
    );
  }

  if (oauthConfig.google) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: `${apiPublicUrl}/api/auth/google/callback`,
          scope: ["profile", "email"],
        },
        verifyOAuthProfile((profile) => ({
          email: profile.emails?.[0]?.value ?? null,
          username: profile.displayName || "google",
        }))
      )
    );
  }
}

export const providers = (_req: express.Request, res: express.Response) => {
  return res.status(200).json(oauthConfig);
};

const notConfigured = (res: express.Response, provider: OAuthProvider) =>
  res
    .status(501)
    .json({ message: `${provider} sign-in is not configured on this server.` });

export const oauthEntry = (provider: OAuthProvider) => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!oauthConfig[provider]) return notConfigured(res, provider);
    return passport.authenticate(provider, { session: false })(req, res, next);
  };
};

export const oauthCallback = (provider: OAuthProvider) => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!oauthConfig[provider]) return notConfigured(res, provider);

    return passport.authenticate(
      provider,
      { session: false },
      async (err: unknown, user: any) => {
        if (err || !user) {
          console.log(err || "OAuth callback: no user");
          return res.redirect("/login?error=oauth");
        }
        try {
          const userId = user._id.toString();
          const refreshToken = signRefreshToken(userId);
          await setRefreshToken(userId, hashToken(refreshToken));
          res.cookie(REFRESH_COOKIE, refreshToken, {
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.ENVIRONMENT === "production",
            path: "/api/auth",
            maxAge: REFRESH_TOKEN_TTL_MS,
          });
          // The SPA's /auth/callback page exchanges the cookie for an access token.
          return res.redirect("/auth/callback");
        } catch (error) {
          console.log(error);
          return res.redirect("/login?error=oauth");
        }
      }
    )(req, res, next);
  };
};
