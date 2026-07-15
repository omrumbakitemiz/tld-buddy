#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

BRANCH="${DEPLOY_BRANCH:-main}"

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and set APP_PASSWORD (and COOKIE_SECURE=false for HTTP)."
  exit 1
fi

if ! grep -qE '^APP_PASSWORD=.+' .env; then
  echo "APP_PASSWORD is not set in .env"
  exit 1
fi

echo "==> Fetching latest code (branch: ${BRANCH})"
git fetch origin "${BRANCH}"
git pull --ff-only origin "${BRANCH}"

echo "==> Building and restarting containers"
docker compose up -d --build --remove-orphans

echo "==> Cleaning unused images"
docker image prune -f

echo "==> Done. Status:"
docker compose ps
