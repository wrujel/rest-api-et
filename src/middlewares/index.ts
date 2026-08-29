import express from "express";

import { getUserById } from "../db/users";
import { getProductById } from "../db/product";
import { verifyAccessToken } from "../helpers";
import { AuthenticatedRequest } from "../types";

export const isAuthenticated = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) return res.sendStatus(401);

    const userId = verifyAccessToken(token);
    if (!userId) return res.sendStatus(401);

    const user = await getUserById(userId);
    if (!user) return res.sendStatus(401);

    (req as AuthenticatedRequest).identity = user;

    return next();
  } catch (error) {
    return res.sendStatus(400);
  }
};

export const isOwner = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const { id } = req.query;
    if (!id) return res.sendStatus(400);

    const product = await getProductById(id.toString());
    if (!product) return res.sendStatus(404);

    const { identity } = req as AuthenticatedRequest;
    if (product.user.toString() !== identity._id.toString())
      return res.sendStatus(403);

    return next();
  } catch (error) {
    return res.sendStatus(400);
  }
};
