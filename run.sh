#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$ROOT_DIR/.env"

if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$ENV_FILE"
    set +a
fi

cleanup() {
    kill "$backend_pid" "$frontend_pid" 2>/dev/null
    wait "$backend_pid" "$frontend_pid" 2>/dev/null
}
trap cleanup EXIT INT TERM

cd "$ROOT_DIR/backend"
uv run --project . uvicorn lmparlor.main:app --reload --port 8001 &
backend_pid=$!

cd "$ROOT_DIR/frontend"
pnpm dev &
frontend_pid=$!

wait "$backend_pid" "$frontend_pid"
