import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String },
  price: { type: Number, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
});

export const ProductModel = mongoose.model("Product", ProductSchema);

export const getProducts = () => ProductModel.find().populate("user");
export const getProductById = (id: string) => ProductModel.findById(id);
export const createProduct = (values: Record<string, any>) =>
  new ProductModel(values).save().then((product) => product.toObject());
export const deleteProductById = (id: string) =>
  ProductModel.findOneAndDelete({ _id: id });
export const updateProductById = (id: string, values: Record<string, any>) =>
  ProductModel.findByIdAndUpdate(id, values);
