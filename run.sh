#!/usr/bin/env bash
set -e

cleanup() {
    kill "$backend_pid" "$frontend_pid" 2>/dev/null
    wait "$backend_pid" "$frontend_pid" 2>/dev/null
}
trap cleanup EXIT INT TERM

cd backend
uv run uvicorn lmparlor.main:app --reload --port 8001 &
backend_pid=$!
cd ..

cd frontend
pnpm dev &
frontend_pid=$!
cd ..

wait "$backend_pid" "$frontend_pid"
