#!/usr/bin/env bash
set -e

cd hotel-backend

npm install
npm run build

npx prisma migrate deploy
node dist/services/server.js
