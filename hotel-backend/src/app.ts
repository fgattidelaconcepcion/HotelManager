import dotenv from "dotenv";
dotenv.config();

import express, { NextFunction, Request, Response } from "express";
import cors, { CorsOptions } from "cors";
import morgan from "morgan";

import mainRouter from "./routes/index";
import dashboardRoutes from "./routes/dashboard.routes";

const app = express();

/* =========================
   Core settings
========================= */

// Recommended when deploying behind Railway/Render/NGINX, etc.
app.set("trust proxy", 1);

/* =========================
   Middlewares
========================= */

const allowedOrigins = [
  process.env.FRONTEND_URL, // e.g. https://your-frontend.netlify.app
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean) as string[];

const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    // Allow server-to-server / curl / Postman (no origin header)
    if (!origin) return cb(null, true);

    // If FRONTEND_URL not set, we are likely in dev → allow all
    if (!process.env.FRONTEND_URL) return cb(null, true);

    if (allowedOrigins.includes(origin)) return cb(null, true);

    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: "10mb" }));

// Logging
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

/* =========================
   Healthcheck
========================= */

app.get("/health", (_req, res) => {
  return res.status(200).json({
    success: true,
    status: "ok",
    serverNow: new Date().toISOString(),
  });
});

/* =========================
   Routes
========================= */

// First dashboard
app.use("/api/dashboard", dashboardRoutes);

// Then the rest
app.use("/api", mainRouter);

/* =========================
   404 handler
========================= */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    error: "Route not found",
    path: req.originalUrl,
  });
});

/* =========================
   Global error handler
========================= */

type AppError = Error & {
  statusCode?: number;
  code?: string;
};

app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  // If headers already sent, Express default handler will finish it
  if (res.headersSent) return;

  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  const isProd = process.env.NODE_ENV === "production";

  console.error("Unhandled error:", err);

  return res.status(status).json({
    success: false,
    code: err.code ?? (status === 500 ? "INTERNAL_ERROR" : "ERROR"),
    // In prod avoid leaking internal messages
    error: isProd && status === 500 ? "Internal server error" : err.message || "Internal server error",
  });
});

export default app;
