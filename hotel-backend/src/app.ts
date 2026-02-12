import express, { NextFunction, Request, Response } from "express";
import cors, { CorsOptions } from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import { httpLogger } from "./middlewares/httpLogger";
import { logger } from "./services/logger";
import mainRouter from "./routes/index";
import dashboardRoutes from "./routes/dashboard.routes";
import { env } from "./config/env";

const app = express();

/* =========================
   Core settings
========================= */

app.set("trust proxy", 1);

/* =========================
   Security / hardening
========================= */

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(compression());
app.use(cookieParser());

/**
 * Add a request id so logs and user-reported errors can be correlated.
 */
app.use((req, res, next) => {
  const id = req.header("x-request-id") || crypto.randomUUID();
  (req as any).requestId = id;
  res.setHeader("x-request-id", id);
  next();
});

/* =========================
   CORS
========================= */




const devOrigins = ["http://localhost:5173", "http://localhost:3000"];

const allowedOrigins = [
  ...(env.NODE_ENV === "production" ? [env.FRONTEND_URL!] : []),
  ...devOrigins,
].filter(Boolean) as string[];

const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);

    const isAllowed = allowedOrigins.includes(origin);

    if (!isAllowed) {
      logger.warn("CORS blocked origin", { origin, allowedOrigins });
      return cb(null, false);
    }

    return cb(null, true);
  },

  credentials: false,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

/* =========================
   Body parsing
========================= */

app.use(express.json({ limit: "10mb" }));

/* =========================
   Logging
========================= */

app.use(httpLogger);

/* =========================
   Global API rate limit
========================= */

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMITED",
    error: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

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

app.use("/api/dashboard", dashboardRoutes);
app.use("/api", mainRouter);

/* =========================
   404
========================= */

app.use((req, res) => {
  return res.status(404).json({
    success: false,
    code: "NOT_FOUND",
    error: "Route not found",
    path: req.originalUrl,
    requestId: (req as any).requestId,
  });
});

/* =========================
   Global error handler
========================= */

type AppError = Error & {
  statusCode?: number;
  code?: string;
};

app.use((err: AppError, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;

  const status =
    err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  const isProd = env.NODE_ENV === "production";

  logger.error("Unhandled error", {
    requestId: (req as any).requestId,
    message: err.message,
    code: (err as any).code,
    stack: err.stack,
    path: req.originalUrl,
    method: req.method,
  });

  return res.status(status).json({
    success: false,
    code: err.code ?? (status === 500 ? "INTERNAL_ERROR" : "ERROR"),
    error:
      isProd && status === 500
        ? "Internal server error"
        : err.message || "Internal server error",
    requestId: (req as any).requestId,
  });
});

export default app;
