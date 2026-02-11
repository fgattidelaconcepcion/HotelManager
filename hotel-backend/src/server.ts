import "dotenv/config";

import http from "http";
import app from "./app";
import prisma from "./services/prisma";
import { logger } from "./services/logger";
import { env } from "./config/env";

/**
 * Here I read PORT/HOST from the validated env object.
 * This ensures the server never starts with a broken config.
 *
 * IMPORTANT FOR RAILWAY:
 * - Railway exposes your service via a proxy and injects PORT.
 * - Binding to a specific HOST can cause issues depending on the platform.
 * - The safest approach is to listen on PORT only in production.
 */
const PORT = env.PORT;
const HOST = env.HOST;

let server: http.Server | null = null;

async function startServer() {
  try {
    await prisma.$connect();
    logger.info("✅ Prisma connected");

    /**
     * In production I avoid passing HOST to listen().
     * This makes the server bind correctly in containerized environments.
     *
     * Locally, binding to HOST is fine and can help with debugging.
     */
    if (env.NODE_ENV === "production") {
      server = app.listen(PORT, () => {
        logger.info(`✅ Server listening on port ${PORT} (production)`);
      });
    } else {
      server = app.listen(PORT, HOST, () => {
        logger.info(`✅ Server listening on http://${HOST}:${PORT} (${env.NODE_ENV})`);
      });
    }
  } catch (error) {
    logger.error("❌ Failed to start server", { error });
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  logger.warn(`🛑 Received ${signal}. Shutting down gracefully...`);

  try {
    if (server) {
      await new Promise<void>((resolve) => server!.close(() => resolve()));
      logger.info("✅ HTTP server closed");
    }
  } catch (err) {
    logger.error("⚠️ Error closing HTTP server", { err });
  }

  try {
    await prisma.$disconnect();
    logger.info("✅ Prisma disconnected");
  } catch (err) {
    logger.error("⚠️ Error disconnecting Prisma", { err });
  }

  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error("❌ Unhandled Rejection", { reason });
});
process.on("uncaughtException", (err) => {
  logger.error("❌ Uncaught Exception", { err });
});

startServer();
