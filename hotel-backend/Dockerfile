# Here I use a lightweight Node image suitable for production containers
FROM node:20-alpine

# Here I set the working directory inside the container
WORKDIR /app

# ----------------------------
# 1) Install dependencies
# ----------------------------
# IMPORTANT:
# During "npm ci", the "postinstall" script runs (prisma generate).
# Prisma needs the schema at ./prisma/schema.prisma, so we must copy
# the prisma folder BEFORE running npm ci.
COPY package*.json ./
COPY prisma ./prisma

# Here I install dependencies with a clean, reproducible install
RUN npm ci

# ----------------------------
# 2) Copy the rest of the source and build
# ----------------------------
# Here I copy the remaining project files (src, tsconfig, etc.)
COPY . .

# Here I build TypeScript into /dist
RUN npm run build

# NOTE:
# EXPOSE is only informational. Railway will inject PORT anyway.
EXPOSE 8080

# Here I start the app (your start script runs migrations + node dist/server.js)
CMD ["npm", "start"]
