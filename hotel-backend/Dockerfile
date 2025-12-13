FROM node:22-alpine

WORKDIR /app

# Copiamos package para cache
COPY package*.json ./

# Instalamos deps
RUN npm ci

# Copiamos prisma (si existe) y el resto del proyecto
COPY ./prisma ./prisma

# Copiamos el resto de los archivos del backend
COPY . .

# Build (incluye prisma generate)
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh","-c","npm run migrate && npm start"]
