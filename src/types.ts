import type express from "express";
import type { UserDocument } from "./db/users";

/**
 * A request that has already passed `isAuthenticated`, which is the only place
 * `identity` is ever set. Handlers behind that middleware take this type so
 * they can read `req.identity` without falling back to `any`.
 */
export interface AuthenticatedRequest extends express.Request {
  identity: UserDocument;
}
