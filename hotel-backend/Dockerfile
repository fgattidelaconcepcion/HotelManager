FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY . .

RUN npm run build

EXPOSE 8080

RUN chmod +x ./start.sh

CMD ["./start.sh"]
