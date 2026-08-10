import express from "express";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { UserModel, getUserByEmail, createUser, setRefreshToken } from "../db/users";
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../helpers";

const API_PUBLIC_URL = process.env.API_PUBLIC_URL || "http://localhost:8080";
const REFRESH_COOKIE = "refreshToken";

export const oauthConfig = {
  github: !!(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET),
  google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
};

type OAuthProfile = {
  email: string | null;
  username: string;
};

async function findOrCreateUser(profile: OAuthProfile) {
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

export function setupOAuthStrategies() {
  if (oauthConfig.github) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          callbackURL: `${API_PUBLIC_URL}/api/auth/github/callback`,
          scope: ["user:email"],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: any,
          done: (err: any, user?: any) => void
        ) => {
          try {
            const email =
              profile.emails?.find((e: any) => e.primary)?.value ??
              profile.emails?.[0]?.value ??
              null;
            const user = await findOrCreateUser({
              email,
              username: profile.username || profile.displayName || "github",
            });
            done(null, user);
          } catch (error) {
            done(error);
          }
        }
      )
    );
  }

  if (oauthConfig.google) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          callbackURL: `${API_PUBLIC_URL}/api/auth/google/callback`,
          scope: ["profile", "email"],
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: any,
          done: (err: any, user?: any) => void
        ) => {
          try {
            const email = profile.emails?.[0]?.value ?? null;
            const user = await findOrCreateUser({
              email,
              username: profile.displayName || "google",
            });
            done(null, user);
          } catch (error) {
            done(error);
          }
        }
      )
    );
  }
}

export const providers = (_req: express.Request, res: express.Response) => {
  return res.status(200).json(oauthConfig).end();
};

export const oauthEntry = (provider: "github" | "google") => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!oauthConfig[provider]) {
      return res
        .status(501)
        .json({ message: `${provider} sign-in is not configured on this server.` });
    }
    return passport.authenticate(provider, { session: false })(req, res, next);
  };
};

export const oauthCallback = (provider: "github" | "google") => {
  return (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (!oauthConfig[provider]) {
      return res
        .status(501)
        .json({ message: `${provider} sign-in is not configured on this server.` });
    }
    passport.authenticate(provider, { session: false }, async (err: any, user: any) => {
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
    })(req, res, next);
  };
};
