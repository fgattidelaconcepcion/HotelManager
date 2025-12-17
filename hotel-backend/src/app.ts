// src/app.ts
import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";

import mainRouter from "./routes/index";
import dashboardRoutes from "./routes/dashboard.routes";

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));

// Forzar codificación UTF-8
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

// Rutas principales
app.use("/api", mainRouter);


app.use("/api/dashboard", dashboardRoutes);

export default app;
