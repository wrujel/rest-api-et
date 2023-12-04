import express from "express";
import {
  getAllProducts,
  createProduct,
  deleteProduct,
  updateProduct,
} from "../controllers/products";
import { isAuthenticated, isOwner } from "../middlewares";

export default (router: express.Router) => {
  router.get("/products", isAuthenticated, getAllProducts);
  router.post("/products", isAuthenticated, createProduct);
  router.put("/products", isAuthenticated, isOwner, updateProduct);
  router.delete("/products", isAuthenticated, isOwner, deleteProduct);
};
