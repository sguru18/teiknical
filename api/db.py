"""SQLite access for the analysis API.

creates a new connection per request, ensuring thread safety for tools like uvicorn

yield used so we can return cleanup, this function owns the connection lifecycle, instead of
making the caller responsible for that

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
    conn.row_factory = (
        sqlite3.Row
    )  # makes each row a sqlite3.Row object, meaning we can access columns by name. this will allow easy conversion to a dict via keyword arg unpacking
    try:
        yield conn
    finally:
        conn.close()
