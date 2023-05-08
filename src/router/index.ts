import express from "express";
import authentication from "./authentication";
import users from "./users";

const router = express.Router();

export default (): express.Router => {
  router.get("/", (req, res) => {
    res.send({
      message: "REST API with Express and Typescript",
      version: "1.0.0",
      author: "W. Rujel",
    });
  });
  authentication(router);
  users(router);
  return router;
};
