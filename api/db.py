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

    # check_same_thread=False: FastAPI runs sync dependencies/endpoints on a
    # threadpool worker, so the connection is often created on a different
    # thread than the one that executes queries. Safe here because each request
    # gets its own connection and we close it in the finally below — we are not
    # sharing one Connection across concurrent requests.
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = (
        sqlite3.Row
    )  # makes each row a sqlite3.Row object, meaning we can access columns by name. this will allow easy conversion to a dict via keyword arg unpacking
    try:
        yield conn
    finally:
        conn.close()
