import express from "express";
import {
  getProducts,
  getProductById as getProductById_,
  createProduct as createProduct_,
  deleteProductById,
  updateProductById,
} from "../db/product";

export const getAllProducts = async (
  req: express.Request,
  res: express.Response
) => {
  try {
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
    return res.status(200).json(response).end();
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
    const { id } = req.params;
    const product = await getProductById_(id);

    if (!product) {
      return res.sendStatus(404);
    }

    return res.status(200).json(product).end();
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const createProduct = async (req: any, res: express.Response) => {
  try {
    await createProduct_({
      ...req.body,
      user: req.identity._id.toString(),
    });
    return res.status(201).end();
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

    await deleteProductById(id.toString());

    return res.sendStatus(204);
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};

export const updateProduct = async (req: any, res: express.Response) => {
  try {
    const { id } = req.query;

    await updateProductById(id.toString(), req.body);

    return res.status(200).end();
  } catch (error) {
    console.log(error);
    return res.sendStatus(400);
  }
};
