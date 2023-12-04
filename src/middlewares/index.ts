import express from "express";
import { get, merge } from "lodash";

import { getUserBySessionToken } from "../db/users";
import { getProductById } from "../db/product";

const ENVIRONMENT = process.env.ENVIRONMENT || "development";

export const isAuthenticated = async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    let sessionToken =
      get(req, "cookies.sessionToken") ||
      (ENVIRONMENT === "development" ? get(req, "headers.sessiontoken") : null);
    if (!sessionToken) return res.sendStatus(403);

    const user = await getUserBySessionToken(sessionToken);
    if (!user) return res.sendStatus(403);

    merge(req, { identity: user });

    return next();
  } catch (error) {
    return res.sendStatus(400);
  }
};

export const isOwner = async (
  req: any,
  res: express.Response,
  next: express.NextFunction
) => {
  try {
    const { id } = req.query;
    if (!id) return res.sendStatus(400);

    const product = await getProductById(id.toString());
    if (!product) return res.sendStatus(404);

    if (product.user.toString() !== req.identity._id.toString())
      return res.sendStatus(403);

    next();
  } catch (error) {
    return res.sendStatus(400);
  }
};
