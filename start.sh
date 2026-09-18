#!/usr/bin/env bash
# Production boot: rebuild the SQLite file (it is gitignored), then run the
# same two-process layout as `make dashboard`. Render exposes a single $PORT;
# Next binds to that, uvicorn stays private on 8000.
set -euo pipefail

python load_data.py

python -m uvicorn api.main:app --host 127.0.0.1 --port 8000 --timeout-keep-alive 65 &
trap 'kill %1' EXIT

cd web && npm run start -- --hostname 0.0.0.0 --port "${PORT:-3000}"
