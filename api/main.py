"""Analysis API for the cell-count dashboard.

All computation lives here rather than in the frontend, so the dashboard is
one consumer of the API rather than the only place the analysis exists.
"""

import sqlite3

from fastapi import Depends, FastAPI, Query

from api.db import get_connection
from api.models import SummaryResponse, SummaryRow

app = FastAPI(
    title="Loblaw Bio cell-count analysis API",
    description=(
        "Relative frequencies of immune cell populations per sample, plus "
        "responder comparisons and cohort breakdowns."
    ),
    version="0.1.0",
)

# Relative frequency per population, with the per-sample total computed by a
# window function so the percentage and its denominator come from one pass.
SUMMARY_SQL = """
    SELECT
        sample_id AS sample,
        population,
        count,
        SUM(count) OVER (PARTITION BY sample_id) AS total_count,
        100.0 * count / SUM(count) OVER (PARTITION BY sample_id) AS percentage
    FROM sample_counts
    ORDER BY sample_id, population
"""


@app.get("/api/summary", response_model=SummaryResponse, tags=["Part 2"])
def get_summary(
    conn: sqlite3.Connection = Depends(get_connection),
    sample: str | None = Query(
        default=None, description="Restrict to a single sample id"
    ),
    limit: int | None = Query(
        default=None, ge=1, description="Page size; omit to return every row"
    ),
    offset: int = Query(default=0, ge=0),
) -> (
    SummaryResponse
):  # FastAPI will serialize the response from this endpoint according to the definition in models.py, actually very cool
    """Part 2: relative frequency of each population within each sample."""
    sql, params = SUMMARY_SQL, []

    if sample is not None:
        # to return a single sample id instead of the full summary, ie. if we put search by sample id on the summary table
        sql = f"SELECT * FROM ({sql}) WHERE sample = ?"
        params.append(sample)

    if limit is not None:
        sql = f"{sql} LIMIT ? OFFSET ?"
        params.extend([limit, offset])

    rows = [SummaryRow(**dict(r)) for r in conn.execute(sql, params)]

    # get the other two fields required by the summary response model for frontend pagination, extremely cheap
    populations = [
        r["population"]
        for r in conn.execute(
            "SELECT DISTINCT population FROM sample_counts ORDER BY population"
        )
    ]
    n_samples = conn.execute("SELECT COUNT(*) AS n FROM samples").fetchone()["n"]

    return SummaryResponse(rows=rows, n_samples=n_samples, populations=populations)
