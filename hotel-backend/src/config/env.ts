import "dotenv/config";
import { z } from "zod";

/**
 * Here I validate and normalize environment variables in ONE place.
 * My goal: fail fast with a clear error when something is misconfigured.
 */

const nodeEnv = process.env.NODE_ENV ?? "development";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL is required")
    // Accept sqlite file url in dev (file:./dev.db) and allow postgres urls later
    .refine(
      (v) => v.startsWith("file:") || v.startsWith("postgresql://") || v.startsWith("postgres://"),
      'DATABASE_URL must start with "file:", "postgresql://" or "postgres://"'
    ),

  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().default("0.0.0.0"),

  // Auth
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),

  // Frontend URL (optional in dev; required in prod if you want strict CORS)
  FRONTEND_URL: z.string().url().optional(),

  // Logging
  LOG_LEVEL: z.enum(["error", "warn", "info", "http", "verbose", "debug", "silly"]).optional(),
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
  // Here I print a readable list of env issues and crash early
  // so I never run the server in a broken configuration.
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * Here I enforce stricter rules in production.
 */
if (env.NODE_ENV === "production") {
  // I strongly recommend never allowing a short secret in prod.
  if (env.JWT_SECRET.includes("dev_secret")) {
    console.error("❌ JWT_SECRET looks like a dev secret. Set a strong secret in production.");
    process.exit(1);
  }
}
