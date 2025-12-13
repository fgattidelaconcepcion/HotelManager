#!/usr/bin/env bash
set -e

npm run build
npx prisma migrate deploy
node dist/server.js
