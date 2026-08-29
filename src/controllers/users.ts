import express from "express";

import { deleteUserById, getUserById, getUsers } from "../db/users";

export const getAllUsers = async (
  _req: express.Request,
  res: express.Response
) => {
  try {
    const users = await getUsers();

    return res.status(200).json(users);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const deleteUser = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const deletedUser = await deleteUserById(String(req.params["id"]));

    return res.json(deletedUser);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const updateUser = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { username } = req.body;
    if (!username) return res.sendStatus(400);

    const updatedUser = await getUserById(String(req.params["id"]));
    if (!updatedUser) return res.sendStatus(404);

    updatedUser.username = username;
    await updatedUser.save();

    return res.status(200).json(updatedUser);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};
