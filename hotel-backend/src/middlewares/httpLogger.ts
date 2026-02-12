import morgan from "morgan";
import { logger } from "../services/logger";

/**
 * Here I connect morgan to my winston logger.
 * This gives me HTTP logs with requestId, duration, status, etc.
 *
 * NOTE ABOUT TYPES:
 * - Morgan types req as Node's IncomingMessage, which doesn't include Express fields
 *   like req.ip or req.path.
 * - In runtime (Express), those fields DO exist.
 * - To keep the build stable, I cast req to any in the token/skip callbacks.
 */

morgan.token("rid", (req: any) => String(req.requestId || "-"));

morgan.token("ip", (req: any) => {
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
  skip: (req: any) => req.path === "/health",
  stream: {
    write: (message: string) => {
      // Morgan adds a trailing newline; I trim it.
      logger.info(message.trim());
    },
  },
});
