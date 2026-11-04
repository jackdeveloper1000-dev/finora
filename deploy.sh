#!/usr/bin/env bash
# Run on the server from the project folder:  bash deploy.sh
# Pulls the latest code from git, updates dependencies and the database, rebuilds the site and restarts the API.
set -euo pipefail
cd "$(dirname "$0")"

echo "== Pulling latest code"
git pull --ff-only

echo "== Server: dependencies and database"
(cd server && npm ci --omit=dev && npm run db:migrate)

echo "== Client: build"
(cd client && npm ci && npm run build)

echo "== Restarting the API"
pm2 restart finora-api --update-env

echo "== Health check"
sleep 3
curl -fsS http://127.0.0.1:5000/api/health/ready
echo
echo "Deployed commit: $(git rev-parse --short HEAD)"
