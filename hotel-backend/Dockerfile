FROM node:22-alpine

WORKDIR /app

# instalar dependencias primero (mejor cache)
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# copiar el resto y buildear
COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh","-c","npm run migrate && npm start"]
