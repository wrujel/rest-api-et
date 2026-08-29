import express from "express";
import {
  getUserByEmail,
  getUserById,
  createUser,
  setRefreshToken,
} from "../db/users";
import {
  hashPassword,
  verifyPassword,
  verifyLegacyPassword,
  isArgon2Hash,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TOKEN_TTL_MS,
} from "../helpers";

const REFRESH_COOKIE = "refreshToken";

type IResponse = {
  id: string;
  username: string;
  email: string;
  accessToken?: string;
};

const setRefreshCookie = (res: express.Response, token: string) => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.ENVIRONMENT === "production",
    path: "/api/auth",
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
};

const clearRefreshCookie = (res: express.Response) => {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
};

const issueTokens = async (
  res: express.Response,
  userId: string
): Promise<string> => {
  const accessToken = signAccessToken(userId);
  const refreshToken = signRefreshToken(userId);
  await setRefreshToken(userId, hashToken(refreshToken));
  setRefreshCookie(res, refreshToken);
  return accessToken;
};

export const login = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.sendStatus(400);

    const user = await getUserByEmail(email).select(
      "+authentication.password +authentication.salt"
    );
    if (!user) return res.sendStatus(401);

    const auth = user.authentication;
    // OAuth-only accounts have no password hash — they must use their provider.
    const storedHash = auth?.password;
    if (!auth || !storedHash) return res.sendStatus(401);

    let valid: boolean;
    if (isArgon2Hash(storedHash)) {
      valid = await verifyPassword(storedHash, password);
    } else {
      // Pre-JWT account: verify with the legacy scheme, then migrate to argon2.
      valid = auth.salt
        ? verifyLegacyPassword(auth.salt, password, storedHash)
        : false;
      if (valid) {
        auth.password = await hashPassword(password);
        auth.salt = undefined;
        await user.save();
      }
    }
    if (!valid) return res.sendStatus(401);

    const userId = user._id.toString();
    const accessToken = await issueTokens(res, userId);

    const body: IResponse = {
      id: userId,
      username: user.username,
      email: user.email,
      accessToken,
    };
    return res.status(200).json(body);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const register = async (req: express.Request, res: express.Response) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.sendStatus(400);

    const existingUser = await getUserByEmail(email);
    if (existingUser) return res.sendStatus(409);

    const user = await createUser({
      username,
      email,
      authentication: { password: await hashPassword(password) },
    });

    const body: IResponse = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
    };
    return res.status(201).json(body);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const refresh = async (req: express.Request, res: express.Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) return res.sendStatus(401);

    const userId = verifyRefreshToken(token);
    if (!userId) {
      clearRefreshCookie(res);
      return res.sendStatus(401);
    }

    const user = await getUserById(userId).select(
      "+authentication.refreshToken"
    );
    if (!user || user.authentication?.refreshToken !== hashToken(token)) {
      clearRefreshCookie(res);
      return res.sendStatus(401);
    }

    const accessToken = await issueTokens(res, userId);
    return res
      .status(200)
      .json({ accessToken, email: user.email, username: user.username });
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const logout = async (req: express.Request, res: express.Response) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (token) {
      const userId = verifyRefreshToken(token);
      if (userId) await setRefreshToken(userId, null);
    }
    clearRefreshCookie(res);
    return res.sendStatus(204);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};
