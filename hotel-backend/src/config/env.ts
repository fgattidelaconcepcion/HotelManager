import "dotenv/config";
import { z } from "zod";

/**
 * Validate and normalize environment variables in one place.
 * Goal: fail fast with a clear error when something is misconfigured.
 *
 * Production notes:
 * - FRONTEND_URL must be the exact deployed origin (no trailing slash),
 *   e.g. https://hotelsmanagment.netlify.app
 * - Railway injects PORT automatically.
 */

const nodeEnv = process.env.NODE_ENV ?? "development";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database connection (supports SQLite in dev and Postgres in prod)
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    .refine(
      (v) =>
        v.startsWith("file:") ||
        v.startsWith("postgresql://") ||
        v.startsWith("postgres://"),
      'DATABASE_URL must start with "file:", "postgresql://" or "postgres://"'
    ),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),

  /**
   * HOST:
   * - In production you typically bind to 0.0.0.0 (or omit HOST in listen()).
   * - Your server.ts already avoids passing HOST in production, which is correct.
   */
  HOST: z.string().default("0.0.0.0"),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),

  /**
   * Frontend URL:
   * - Optional in development
   * - Required in production (strict CORS)
   */
  FRONTEND_URL: z.string().url().optional(),

  // Logging
  LOG_LEVEL: z
    .enum(["error", "warn", "info", "http", "verbose", "debug", "silly"])
    .optional(),
  LOG_DIR: z.string().optional(),
});

const parsed = EnvSchema.safeParse({
  NODE_ENV: nodeEnv,
  DATABASE_URL: process.env.DATABASE_URL,
  PORT: process.env.PORT,
  HOST: process.env.HOST,
  JWT_SECRET: process.env.JWT_SECRET,
  FRONTEND_URL: process.env.FRONTEND_URL,
  LOG_LEVEL: process.env.LOG_LEVEL,
  LOG_DIR: process.env.LOG_DIR,
});

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Extra production rules (fail closed).
 */
if (env.NODE_ENV === "production") {
  // Prevent deploying with an obviously weak dev secret
  if (env.JWT_SECRET.includes("dev_secret")) {
    console.error(
      "❌ JWT_SECRET looks like a dev secret. Set a strong secret in production."
    );
    process.exit(1);
  }

  // Strict CORS requires this value
  if (!env.FRONTEND_URL) {
    console.error("❌ FRONTEND_URL is required in production for strict CORS.");
    process.exit(1);
  }
}
