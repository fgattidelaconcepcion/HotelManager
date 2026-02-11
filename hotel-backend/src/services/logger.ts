import fs from "fs";
import path from "path";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

/**
 * Here I ensure the logs folder exists in local/dev environments.
 * In many cloud platforms, logs should go to stdout, but this is still useful locally.
 */
const LOG_DIR = process.env.LOG_DIR || "logs";
const logDirPath = path.resolve(process.cwd(), LOG_DIR);

try {
  if (!fs.existsSync(logDirPath)) fs.mkdirSync(logDirPath, { recursive: true });
} catch {
  // Here I do not crash if the filesystem is read-only in production.
}

const isProd = process.env.NODE_ENV === "production";

/**
 * Here I define my base log format.
 * - In production I prefer JSON logs (best for log aggregators).
 * - In development I prefer a readable colored output.
 */
const baseFormat = isProd
  ? winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  : winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: "HH:mm:ss" }),
      winston.format.errors({ stack: true }),
      winston.format.printf((info) => {
        const { timestamp, level, message, ...meta } = info;
        const rest = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
        return `${timestamp} ${level}: ${message}${rest}`;
      })
    );

/**
 * Here I configure rotating file transports.
 * I keep separate files for combined logs and error logs.
 */
const rotateCombined = new DailyRotateFile({
  filename: path.join(logDirPath, "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "14d",
  level: "info",
});

const rotateError = new DailyRotateFile({
  filename: path.join(logDirPath, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  zippedArchive: true,
  maxSize: "20m",
  maxFiles: "30d",
  level: "error",
});

/**
 * Here I build the logger.
 * - Console: always (prod platforms capture stdout)
 * - Files: best effort (local/dev)
 */
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProd ? "info" : "debug"),
  format: baseFormat,
  transports: [
    new winston.transports.Console(),
    // Here I add file transports. If filesystem is not writable, they may fail silently.
    rotateCombined,
    rotateError,
  ],
  exceptionHandlers: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: path.join(logDirPath, "exceptions-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
    }),
  ],
  rejectionHandlers: [
    new winston.transports.Console(),
    new DailyRotateFile({
      filename: path.join(logDirPath, "rejections-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "30d",
    }),
  ],
});
