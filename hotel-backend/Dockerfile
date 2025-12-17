FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY . .

RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
