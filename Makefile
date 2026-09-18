# Make runs each recipe in /bin/sh unless we override it. The dashboard trap
# uses %1, which is bash-speak for "the first background job" (uvicorn).
# That is not portable: Codespaces /bin/sh is dash, which has no %1, and
# macOS /bin/sh is bash in POSIX mode, which can drop job-control features.
SHELL := /bin/bash

PY := .venv/bin/python
PIP := .venv/bin/pip

.PHONY: setup pipeline dashboard

setup:
	python3 -m venv .venv
	$(PIP) install -r requirements.txt
	npm --prefix web ci

pipeline:
	$(PY) load_data.py

# uvicorn in the background, Next in the foreground. The trap kills uvicorn
# when this shell exits (Ctrl-C, crash, or Next stopping) so port 8000 is not
# left occupied. Backslashes keep the recipe in one shell; otherwise trap
# would run in a new shell that does not know about job 1.
dashboard:
	$(PY) -m uvicorn api.main:app --host 127.0.0.1 --port 8000 & \
	trap 'kill %1' EXIT; \
	cd web && npm run dev -- --hostname 0.0.0.0 --port 3000
