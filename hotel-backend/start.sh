#!/bin/sh
set -e

npm install
npm run build

npx prisma migrate deploy
node dist/services/server.js
