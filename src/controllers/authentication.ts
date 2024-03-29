import express from "express";
import { getUserByEmail, createUser } from "../db/users";
import { authentication, random } from "../helpers";

const ENVIRONMENT = process.env.ENVIRONMENT || "development";

type IResponse = {
  id: string;
  username: string;
  email: string;
  sessionToken?: string;
};

export const login = async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.sendStatus(400);

    const user = await getUserByEmail(email).select(
      "+authentication.salt +authentication.password"
    );
    if (!user) return res.sendStatus(400);

    const expectedHash = authentication(user.authentication.salt, password);
    if (expectedHash !== user.authentication.password)
      return res.sendStatus(403);

    const salt = random();
    user.authentication.sessionToken = authentication(
      salt,
      user._id.toString()
    );
    await user.save();

    res.cookie("sessionToken", user.authentication.sessionToken, {
      domain: "localhost",
      path: "/",
    });

    let body: IResponse = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
    };

    if (ENVIRONMENT === "development") {
      body.sessionToken = user.authentication.sessionToken;
    }

    return res.status(200).json(body).end();
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
    if (existingUser) return res.sendStatus(400);

    const salt = random();
    const user = await createUser({
      username,
      email,
      authentication: { password: authentication(salt, password), salt },
    });

    return res.status(201).json(user).end();
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};
