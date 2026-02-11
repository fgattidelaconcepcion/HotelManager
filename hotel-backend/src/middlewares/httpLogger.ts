import morgan from "morgan";
import { logger } from "../services/logger";

/**
 * Here I connect morgan to my winston logger.
 * This gives me HTTP logs with requestId, duration, status, etc.
 */

morgan.token("rid", (req) => String((req as any).requestId || "-"));
morgan.token("ip", (req) => {
  const xf = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return xf || req.ip || "-";
});

const format =
  process.env.NODE_ENV === "production"
    ? ":method :url :status :res[content-length] - :response-time ms rid=:rid ip=:ip"
    : ":method :url :status :response-time ms rid=:rid";

/**
 * Here I write HTTP logs at info level.
 * - I skip noisy healthchecks to keep logs clean.
 */
export const httpLogger = morgan(format, {
  skip: (req) => req.path === "/health",
  stream: {
    write: (message) => {
      // morgan adds a trailing newline; I trim it.
      logger.info(message.trim());
    },
  },
});
