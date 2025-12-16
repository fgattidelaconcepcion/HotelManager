// src/server.ts
import dotenv from "dotenv";
dotenv.config();

import app from "../app";
import prisma from "../services/prisma";

const PORT = Number(process.env.PORT) || 3000;
const HOST = "0.0.0.0";

async function startServer() {
  try {
    await prisma.$connect();
    console.log("✅ Conectado a la base de datos con Prisma");

    app.listen(PORT, HOST, () => {
      console.log(`✅ Server listening on http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("❌ Error al iniciar el servidor:", error);
    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("✅ Conexión con Prisma cerrada");
  process.exit(0);
});

startServer();
