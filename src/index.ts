import express from "express";
import path from "path";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import compression from "compression";
import cors from "cors";
import mongoose from "mongoose";
import passport from "passport";
import dotenv from "dotenv";
import router from "./router";
import { setupOAuthStrategies } from "./controllers/oauth";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;
const FRONTEND = process.env.FRONTEND_BUILD_PATH;

app.use(cors({ credentials: true, origin: process.env.CORS_ORIGIN ?? true }));
app.use(compression());
app.use(cookieParser());
app.use(bodyParser.json());

setupOAuthStrategies();
app.use(passport.initialize());

app.use("/api", router());
app.use(express.static(FRONTEND));

// SPA fallback: client-side routes (e.g. /login, /home) get index.html.
app.use((req, res, next) => {
  if (req.method !== "GET" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.resolve(FRONTEND, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is listening on http://localhost:${PORT}`);
});

mongoose.Promise = Promise;
mongoose.connect(process.env.MONGO_URL);
mongoose.connection.on("error", (error: Error) => console.log(error));

module.exports = app;
