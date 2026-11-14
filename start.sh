#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -f .server.pid ]] && kill -0 "$(cat .server.pid)" 2>/dev/null; then
  echo "Fable Surfers is already running (PID $(cat .server.pid))."
  exit 0
fi
nohup node server.cjs > .server.log 2>&1 &
echo $! > .server.pid
sleep 1
if kill -0 "$(cat .server.pid)" 2>/dev/null; then
  echo "Fable Surfers started. Open http://127.0.0.1:${PORT:-43827}"
else
  cat .server.log
  exit 1
fi
