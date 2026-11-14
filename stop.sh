#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -f .server.pid ]]; then
  echo "No saved PID. If running in the foreground, press Ctrl+C in that terminal."
  exit 0
fi
pid="$(cat .server.pid)"
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  echo "Fable Surfers server stopped."
else
  echo "The saved process is not running."
fi
rm -f .server.pid
