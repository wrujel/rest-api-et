import mongoose, { HydratedDocument, InferSchemaType } from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  authentication: {
    // Optional: accounts created via OAuth providers have no password.
    password: { type: String, select: false },
    salt: { type: String, select: false },
    refreshToken: { type: String, select: false },
  },
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
});

export type UserDocument = HydratedDocument<InferSchemaType<typeof UserSchema>>;

export const UserModel = mongoose.model("User", UserSchema);

export const getUsers = () => UserModel.find();
export const getUserByEmail = (email: string) => UserModel.findOne({ email });
export const getUserById = (id: string) => UserModel.findById(id);
export const createUser = (values: Record<string, any>) =>
  new UserModel(values).save().then((user) => user.toObject());
export const deleteUserById = (id: string) =>
  UserModel.findOneAndDelete({ _id: id });
export const updateUserById = (id: string, values: Record<string, any>) =>
  UserModel.findByIdAndUpdate(id, values);
export const setRefreshToken = (id: string, refreshToken: string | null) =>
  UserModel.findByIdAndUpdate(id, {
    "authentication.refreshToken": refreshToken,
  });
