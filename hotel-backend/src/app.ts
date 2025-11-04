import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import morgan from "morgan";

import router from "./routes/index";
import userRoutes from "./routes/user.routes";
 // Rutas de usuario

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Rutas principales
app.use("/api/users", userRoutes); // primero las rutas de usuarios
app.use("/api", router); // luego el resto de rutas

export default app;
