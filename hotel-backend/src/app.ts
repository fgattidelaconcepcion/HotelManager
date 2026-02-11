import dotenv from "dotenv";
dotenv.config();

import express, { NextFunction, Request, Response } from "express";
import cors, { CorsOptions } from "cors";

// Hardening middlewares
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

import { httpLogger } from "./middlewares/httpLogger";
import { logger } from "./services/logger";

import mainRouter from "./routes/index";
import dashboardRoutes from "./routes/dashboard.routes";

const app = express();

/* =========================
   Core settings
========================= */

// Here I enable "trust proxy" because in production I may sit behind a proxy
// (Railway/Render/NGINX). This is important for correct IP detection and secure cookies.
app.set("trust proxy", 1);

/* =========================
   Security / hardening
========================= */

/**
 * Here I apply secure HTTP headers.
 * - It's a safe baseline hardening for production.
 * - I keep it enabled in dev too (it usually doesn't break APIs).
 */
app.use(
  helmet({
    // If later you add a frontend served from the same domain and need CSP,
    // we can configure it explicitly. For an API, the default is fine.
    contentSecurityPolicy: false,
  })
);

/**
 * Here I compress responses to improve performance (especially JSON payloads).
 */
app.use(compression());

/**
 * Here I parse cookies.
 * Even if I don't use cookies yet, I will need it for refresh tokens later.
 */
app.use(cookieParser());

/**
 * Here I attach a request id to every request so logs are traceable.
 * This helps a lot in real operation when users report issues.
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

/**
 * Here I define allowed origins for browsers.
 * - In dev I allow localhost.
 * - In production I REQUIRE FRONTEND_URL to be set, otherwise I fail closed.
 */
const allowedOrigins = [
  process.env.FRONTEND_URL, // e.g. https://your-frontend.vercel.app
  "http://localhost:5173",
  "http://localhost:3000",
].filter(Boolean) as string[];

const corsOptions: CorsOptions = {
  origin: (origin, cb) => {
    // Allow server-to-server / curl / Postman (no origin header)
    if (!origin) return cb(null, true);

    const isProd = process.env.NODE_ENV === "production";

    // Fail-closed in production if FRONTEND_URL is missing
    if (isProd && !process.env.FRONTEND_URL) {
      return cb(new Error("CORS misconfigured: FRONTEND_URL is not set"));
    }

    // In dev, allow any origin if FRONTEND_URL is not set
    if (!isProd && !process.env.FRONTEND_URL) return cb(null, true);

    if (allowedOrigins.includes(origin)) return cb(null, true);

    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
};

app.use(cors(corsOptions));

/* =========================
   Body parsing
========================= */

// Here I parse JSON bodies with a sane limit.
app.use(express.json({ limit: "10mb" }));

/* =========================
   Logging (HTTP)
========================= */

// Here I log every request with requestId (rid).
app.use(httpLogger);

/* =========================
   Global API rate limit
========================= */

/**
 * Here I add a global API rate limiter.
 * This is not the brute-force limiter (that one is auth-specific).
 * This protects the API from accidental abuse and simple DoS.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 600, // 600 requests / 15 min / IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: "RATE_LIMITED",
    error: "Too many requests. Please try again later.",
  },
});

// Here I apply the limiter only to API routes, not to /health.
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

// Here I mount dashboard routes first.
app.use("/api/dashboard", dashboardRoutes);

// Here I mount the rest of the API routes.
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
  // If headers already sent, Express default handler will finish it
  if (res.headersSent) return;

  const status = err.statusCode && Number.isInteger(err.statusCode) ? err.statusCode : 500;

  const isProd = process.env.NODE_ENV === "production";

  // Here I log the request id so I can trace this exact failure in logs.
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
    // In prod avoid leaking internal messages
    error: isProd && status === 500 ? "Internal server error" : err.message || "Internal server error",
    requestId: (req as any).requestId,
  });
});

export default app;
