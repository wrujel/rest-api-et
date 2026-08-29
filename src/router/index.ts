import express from "express";
import authentication from "./authentication";
import users from "./users";
import products from "./products";

export default (): express.Router => {
  // A fresh Router per call — a module-level one would collect a duplicate set
  // of handlers every time an app is built (tests build several).
  const router = express.Router();

  router.get("/", (_req, res) => {
    res.send({
      message: "REST API with Express and Typescript",
      version: "1.0.0",
      author: "W. Rujel",
    });
  });

  authentication(router);
  users(router);
  products(router);
  return router;
};
