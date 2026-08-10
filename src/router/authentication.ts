import express from "express";
import rateLimit from "express-rate-limit";
import { login, register, refresh, logout } from "../controllers/authentication";
import {
  providers,
  oauthEntry,
  oauthCallback,
} from "../controllers/oauth";

const credentialsLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

const refreshLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

export default (router: express.Router) => {
  router.post("/auth/register", credentialsLimiter, register);
  router.post("/auth/login", credentialsLimiter, login);
  router.post("/auth/refresh", refreshLimiter, refresh);
  router.post("/auth/logout", logout);

  router.get("/auth/providers", providers);
  router.get("/auth/github", oauthEntry("github"));
  router.get("/auth/github/callback", oauthCallback("github"));
  router.get("/auth/google", oauthEntry("google"));
  router.get("/auth/google/callback", oauthCallback("google"));
};
