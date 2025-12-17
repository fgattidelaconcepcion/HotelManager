FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY . .

RUN npm run build

ENV NODE_ENV=production

CMD ["sh","-c","npx prisma migrate deploy && npm start"]
