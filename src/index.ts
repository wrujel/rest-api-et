import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import router from "./router";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const FRONTEND = process.env.FRONTEND_BUILD_PATH;

app.use(cors({ credentials: true }));
app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json());

app.use("/api", router());
app.use(express.static(FRONTEND));

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});

mongoose.Promise = Promise;
mongoose.connect(process.env.MONGO_URL);
mongoose.connection.on("error", (error: Error) => console.log(error));

module.exports = app;
