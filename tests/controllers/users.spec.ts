import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteUser,
  getAllUsers,
  updateUser,
} from "../../src/controllers/users";
import { deleteUserById, getUserById, getUsers } from "../../src/db/users";
import { createRequest, createResponse } from "../support/http";
import { failingQuery, queryDouble } from "../support/query";

vi.mock("../../src/db/users", () => ({
  getUsers: vi.fn(),
  getUserById: vi.fn(),
  deleteUserById: vi.fn(),
}));

const mockedGetUsers = vi.mocked(getUsers);
const mockedGetUserById = vi.mocked(getUserById);
const mockedDeleteUserById = vi.mocked(deleteUserById);

let consoleLog: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
});

describe("getAllUsers", () => {
  it("returns every user", async () => {
    const users = [{ _id: "u1" }, { _id: "u2" }];
    mockedGetUsers.mockReturnValue(queryDouble(users) as never);

    const res = createResponse();
    await getAllUsers(createRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(users);
  });

  it("400s and logs when the query blows up", async () => {
    mockedGetUsers.mockReturnValue(failingQuery(new Error("db down")) as never);

    const res = createResponse();
    await getAllUsers(createRequest(), res);

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("deleteUser", () => {
  it("returns the deleted document", async () => {
    const deleted = { _id: "u1" };
    mockedDeleteUserById.mockReturnValue(queryDouble(deleted) as never);

    const res = createResponse();
    await deleteUser(createRequest({ params: { id: "u1" } }), res);

    expect(mockedDeleteUserById).toHaveBeenCalledWith("u1");
    expect(res.body).toBe(deleted);
  });

  it("400s and logs when the delete blows up", async () => {
    mockedDeleteUserById.mockReturnValue(
      failingQuery(new Error("db down")) as never,
    );

    const res = createResponse();
    await deleteUser(createRequest({ params: { id: "u1" } }), res);

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});

describe("updateUser", () => {
  it("renames the user and returns the saved document", async () => {
    const user = { _id: "u1", username: "ada", save: vi.fn() };
    mockedGetUserById.mockReturnValue(queryDouble(user) as never);

    const res = createResponse();
    await updateUser(
      createRequest({ params: { id: "u1" }, body: { username: "grace" } }),
      res,
    );

    expect(user.username).toBe("grace");
    expect(user.save).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(user);
  });

  it("400s when the body carries no username", async () => {
    const res = createResponse();
    await updateUser(createRequest({ params: { id: "u1" }, body: {} }), res);

    expect(res.sentStatus).toBe(400);
    expect(mockedGetUserById).not.toHaveBeenCalled();
  });

  it("404s when the user does not exist", async () => {
    mockedGetUserById.mockReturnValue(queryDouble(null) as never);

    const res = createResponse();
    await updateUser(
      createRequest({ params: { id: "ghost" }, body: { username: "grace" } }),
      res,
    );

    expect(res.sentStatus).toBe(404);
  });

  it("400s and logs when the save blows up", async () => {
    mockedGetUserById.mockReturnValue(
      queryDouble({
        _id: "u1",
        username: "ada",
        save: vi.fn().mockRejectedValue(new Error("db down")),
      }) as never,
    );

    const res = createResponse();
    await updateUser(
      createRequest({ params: { id: "u1" }, body: { username: "grace" } }),
      res,
    );

    expect(res.sentStatus).toBe(400);
    expect(consoleLog).toHaveBeenCalled();
  });
});
