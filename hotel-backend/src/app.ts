import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";

import router from "./routes/index";
import userRoutes from "./routes/user.routes";
import authRoutes from "./routes/auth.routes"; //  Importación agregada

const app = express();

//  Middlewares globales
app.use(cors());

//  Asegurar que Express procese y envíe JSON en UTF-8
app.use(express.json({ limit: "10mb", type: "application/json; charset=utf-8" }));

//  Forzar todas las respuestas a usar UTF-8
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

app.use(morgan("dev"));

//   Rutas principales
app.use("/api/auth", authRoutes); // ← agregado
app.use("/api/users", userRoutes);
app.use("/api", router);

export default app;
