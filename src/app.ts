import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import passport from "passport";
import router from "./router";
import { setupOAuthStrategies } from "./controllers/oauth";

/**
 * Builds the Express app without touching the network: no `listen`, no Mongo
 * connect. `src/index.ts` wires those in for the long-running server and
 * `api/index.ts` re-exports the same app as a Vercel function.
 */
export const createApp = (): express.Express => {
  const app = express();
  const frontendPath = process.env.FRONTEND_BUILD_PATH;

  app.use(cors({ credentials: true, origin: process.env.CORS_ORIGIN ?? true }));
  app.use(compression());
  app.use(cookieParser());
  app.use(express.json());

  setupOAuthStrategies();
  app.use(passport.initialize());

  app.use("/api", router());

  // Serving the SPA is optional: on Vercel the static build is handled by the
  // platform, and in tests there is no build directory at all.
  if (frontendPath) {
    app.use(express.static(frontendPath));

    // SPA fallback: client-side routes (e.g. /login, /home) get index.html.
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
      res.sendFile(path.resolve(frontendPath, "index.html"));
    });
  }

  return app;
};

export default createApp;
