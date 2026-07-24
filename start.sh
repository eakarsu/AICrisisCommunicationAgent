#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$root"
[[ -f .env ]] || { echo "Missing .env; copy .env.example." >&2; exit 1; }
[[ -d backend/node_modules && -d frontend/node_modules ]] || { echo "Run ./scripts/bootstrap.sh first." >&2; exit 1; }
set -a
source .env
set +a
backend_port="${BACKEND_PORT:-${SERVER_PORT:-${PORT:-3001}}}"
frontend_port="${FRONTEND_PORT:-${CLIENT_PORT:-3000}}"
(cd backend && PORT="$backend_port" npm start) & backend_pid=$!
(cd frontend && BROWSER=none PORT="$frontend_port" REACT_APP_API_BASE="http://127.0.0.1:$backend_port/api" npm start) & frontend_pid=$!
cleanup() { kill "$backend_pid" "$frontend_pid" 2>/dev/null || true; }
trap cleanup EXIT INT TERM
wait "$backend_pid" "$frontend_pid"
