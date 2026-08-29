// First import so every module below sees a populated `process.env`. On Vercel
// the variables come from the platform and there is no file to read, in which
// case this is a no-op; locally it makes `vercel dev` behave like `pnpm dev`.
import "dotenv/config";

import type express from "express";
import { createApp } from "./app";
import { connectDatabase } from "./db/connection";

/**
 * The app as a serverless function handler.
 *
 * The static Angular build is served by the CDN on Vercel rather than by
 * Express, so `FRONTEND_BUILD_PATH` is left unset there and `createApp` skips
 * mounting the SPA — this function only ever answers `/api/*`.
 */
export const createServerlessApp = (): express.Express => {
  try {
    // Kicked off at module scope so the connection is already warming while
    // the first request is routed; the promise is cached for later invocations.
    connectDatabase();
  } catch (error) {
    // A missing MONGO_URL must not take the whole function down: the API
    // banner and the OAuth provider probe still answer, and the db-backed
    // routes fail per request with their usual status codes.
    console.error(error);
  }

  return createApp();
};

export default createServerlessApp();
