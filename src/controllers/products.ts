import express from "express";
import {
  getProducts,
  getProductById as findProductById,
  createProduct as insertProduct,
  deleteProductById,
  updateProductById,
} from "../db/product";
import { AuthenticatedRequest } from "../types";

export const getAllProducts = async (
  _req: express.Request,
  res: express.Response
) => {
  try {
    // `user` is populated, so it carries the owner document rather than an id.
    const products: any[] = await getProducts();
    const response = products.map((product) => {
      return {
        id: product._id,
        name: product.name,
        description: product.description,
        price: product.price,
        username: product.user.username,
        email: product.user.email,
      };
    });
    return res.status(200).json(response);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const getProductById = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const product = await findProductById(String(req.params["id"]));

    if (!product) {
      return res.sendStatus(404);
    }

    return res.status(200).json(product);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const createProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { identity } = req as AuthenticatedRequest;
    const product = await insertProduct({
      ...req.body,
      user: identity._id.toString(),
    });
    return res.status(201).json({ id: product._id });
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const deleteProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.query;
    if (!id) return res.sendStatus(400);

    await deleteProductById(String(id));

    return res.sendStatus(204);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const updateProduct = async (
  req: express.Request,
  res: express.Response
) => {
  try {
    const { id } = req.query;
    if (!id) return res.sendStatus(400);

    await updateProductById(String(id), req.body);

    return res.status(200).end();
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};
