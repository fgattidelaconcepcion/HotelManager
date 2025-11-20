// src/server.ts
import dotenv from "dotenv";
dotenv.config();

import app from "../app";
import prisma from "../services/prisma";

const PORT = process.env.PORT || 8000;

async function startServer() {
  try {
    // Conexión a la base de datos
    await prisma.$connect();
    console.log(" Conectado a la base de datos con Prisma");

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(` Servidor corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(" Error al iniciar el servidor:", error);
    process.exit(1);
  }
}

// Cerrar conexión correctamente
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Conexión con Prisma cerrada");
  process.exit(0);
});

startServer();
