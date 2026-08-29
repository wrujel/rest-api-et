import { afterEach, describe, expect, it, vi } from "vitest";

import {
  UserModel,
  createUser,
  deleteUserById,
  getUserByEmail,
  getUserById,
  getUsers,
  setRefreshToken,
  updateUserById,
} from "../../src/db/users";

// Every helper here is a thin wrapper over a Mongoose static. The value under
// test is the query it builds, so the statics are spied rather than a database
// being stood up.
afterEach(() => vi.restoreAllMocks());

describe("the user schema", () => {
  it("hides the credential fields from ordinary reads", () => {
    const paths = UserModel.schema.paths;
    expect(paths["authentication.password"].options.select).toBe(false);
    expect(paths["authentication.salt"].options.select).toBe(false);
    expect(paths["authentication.refreshToken"].options.select).toBe(false);
  });

  it("requires a unique username and email", () => {
    const paths = UserModel.schema.paths;
    expect(paths["username"].options).toMatchObject({
      required: true,
      unique: true,
    });
    expect(paths["email"].options).toMatchObject({
      required: true,
      unique: true,
    });
  });
});

describe("query helpers", () => {
  it("getUsers lists every user", () => {
    const find = vi.spyOn(UserModel, "find").mockReturnValue("q" as never);

    expect(getUsers()).toBe("q");
    expect(find).toHaveBeenCalledWith();
  });

  it("getUserByEmail filters on the email", () => {
    const findOne = vi
      .spyOn(UserModel, "findOne")
      .mockReturnValue("q" as never);

    expect(getUserByEmail("ada@example.com")).toBe("q");
    expect(findOne).toHaveBeenCalledWith({ email: "ada@example.com" });
  });

  it("getUserById looks up by primary key", () => {
    const findById = vi
      .spyOn(UserModel, "findById")
      .mockReturnValue("q" as never);

    expect(getUserById("u1")).toBe("q");
    expect(findById).toHaveBeenCalledWith("u1");
  });

  it("deleteUserById deletes the matching document", () => {
    const findOneAndDelete = vi
      .spyOn(UserModel, "findOneAndDelete")
      .mockReturnValue("q" as never);

    expect(deleteUserById("u1")).toBe("q");
    expect(findOneAndDelete).toHaveBeenCalledWith({ _id: "u1" });
  });

  it("updateUserById applies the given values", () => {
    const findByIdAndUpdate = vi
      .spyOn(UserModel, "findByIdAndUpdate")
      .mockReturnValue("q" as never);

    expect(updateUserById("u1", { username: "grace" })).toBe("q");
    expect(findByIdAndUpdate).toHaveBeenCalledWith("u1", {
      username: "grace",
    });
  });

  it("setRefreshToken writes the hashed token onto the nested path", () => {
    const findByIdAndUpdate = vi
      .spyOn(UserModel, "findByIdAndUpdate")
      .mockReturnValue("q" as never);

    setRefreshToken("u1", "hashed");
    expect(findByIdAndUpdate).toHaveBeenCalledWith("u1", {
      "authentication.refreshToken": "hashed",
    });
  });

  it("setRefreshToken clears the stored token on logout", () => {
    const findByIdAndUpdate = vi
      .spyOn(UserModel, "findByIdAndUpdate")
      .mockReturnValue("q" as never);

    setRefreshToken("u1", null);
    expect(findByIdAndUpdate).toHaveBeenCalledWith("u1", {
      "authentication.refreshToken": null,
    });
  });
});

describe("createUser", () => {
  it("saves a new document and resolves it as a plain object", async () => {
    const saved = { toObject: () => ({ _id: "u9", username: "ada" }) };
    vi.spyOn(UserModel.prototype, "save").mockResolvedValue(saved as never);

    await expect(
      createUser({ username: "ada", email: "ada@example.com" }),
    ).resolves.toEqual({ _id: "u9", username: "ada" });
  });
});
