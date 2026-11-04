#!/usr/bin/env bash
# Run on the server from the project folder:  bash deploy.sh
# Pulls the latest code from git, updates dependencies and the database, rebuilds the site and restarts the API.
set -euo pipefail
cd "$(dirname "$0")"

echo "== Pulling latest code"
git pull --ff-only

echo "== Server: dependencies and database"
(cd server && npm ci --omit=dev && npm run db:migrate)

# aaPanel locks files such as .user.ini inside the website folder, so build elsewhere and copy across.
echo "== Client: build"
(
  cd client
  npm ci
  npx vite build --outDir dist-build --emptyOutDir
  mkdir -p dist
  rsync -a --delete --exclude=.user.ini --exclude=.htaccess dist-build/ dist/
  rm -rf dist-build
)

echo "== Restarting the API"
pm2 restart finora-api --update-env

echo "== Health check"
sleep 3
curl -fsS http://127.0.0.1:5000/api/health/ready
echo
echo "Deployed commit: $(git rev-parse --short HEAD)"
