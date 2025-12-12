// prisma.config.ts
import "dotenv/config";
import path from "path";
import type { PrismaConfig } from "prisma";

export default {
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "ts-node prisma/seed.ts",
  },
} satisfies PrismaConfig;
