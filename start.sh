#!/bin/bash
# GraphTeam one-command starter - run this on your office PC or here after a reset
set -e
cd "$(dirname "$0")"
echo "Checking backend..."
if [ ! -d "apps/api/node_modules" ]; then
  echo "Installing backend..."
  (cd apps/api && npm install --silent)
fi
echo "Checking frontend..."
if [ ! -d "apps/web/node_modules" ]; then
  echo "Installing frontend..."
  (cd apps/web && npm install --silent)
fi
if [ ! -d "apps/web/dist" ]; then
  echo "Building frontend..."
  (cd apps/web && npm run build)
fi
echo "Starting GraphTeam on http://localhost:3001 ..."
(cd apps/api && node src/server.js)
