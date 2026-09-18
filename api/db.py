"""SQLite access for the analysis API.

Read-only: the database is built once by `load_data.py` (`make pipeline`) and
this process only queries it. A fresh connection per request keeps things
thread-safe under uvicorn without needing `check_same_thread=False`.
"""

import os
import sqlite3
from collections.abc import Iterator
from pathlib import Path

from fastapi import HTTPException

# api/ lives one level below the repo root, where the .db is written.
REPO_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(os.environ.get("DB_PATH", REPO_ROOT / "teiknical.db"))


def get_connection() -> Iterator[sqlite3.Connection]:
    """FastAPI dependency yielding a row-keyed connection."""
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Database not found at {DB_PATH}. Run `make pipeline` first.",
        )

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
