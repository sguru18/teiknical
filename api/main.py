"""Analysis API for the cell-count dashboard.

All computation lives here rather than in the frontend, so the dashboard is
one consumer of the API rather than the only place the analysis exists.
"""

import sqlite3

from fastapi import Depends, FastAPI, Query

from api.analysis import (
    AGGREGATION_NOTES,
    apply_aggregation,
    compare_populations,
    load_frequencies,
)
from api.db import get_connection
from api.models import (
    Aggregation,
    CohortFilters,
    CompareResponse,
    FilterOptions,
    FrequencyPoint,
    SampleType,
    SummaryResponse,
    SummaryRow,
)

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


@app.get("/api/filters", response_model=FilterOptions, tags=["Shared"])
def get_filters(
    conn: sqlite3.Connection = Depends(get_connection),
) -> FilterOptions:
    """Distinct filter values, so the dashboard's dropdowns follow the data."""

    def distinct(column: str, table: str) -> list:
        sql = f"SELECT DISTINCT {column} AS v FROM {table} ORDER BY {column}"
        return [row["v"] for row in conn.execute(sql)]

    return FilterOptions(
        conditions=distinct("condition", "subjects"),
        treatments=distinct("treatment", "subjects"),
        sample_types=distinct("sample_type", "samples"),
        timepoints=distinct("time_from_treatment_start", "samples"),
    )


@app.get("/api/compare", response_model=CompareResponse, tags=["Part 3"])
def get_compare(
    conn: sqlite3.Connection = Depends(get_connection),
    condition: str = Query(default="melanoma"),
    treatment: str = Query(default="miraclib"),
    sample_type: SampleType = Query(default="PBMC"),
    aggregation: Aggregation = Query(
        default="baseline",
        description="How to collapse each subject's repeated measures",
    ),
    alpha: float = Query(default=0.05, gt=0, lt=1),
) -> CompareResponse:
    """Part 3: population frequencies in responders vs non-responders.

    The assignment's cohort (melanoma, miraclib, PBMC) is the default rather
    than a hardcoded constant, so the same comparison can be run against any
    other indication or treatment without a code change.
    """
    frame = load_frequencies(conn, condition, treatment, sample_type)
    frame = apply_aggregation(frame, aggregation)

    points = [
        FrequencyPoint(
            sample=row.sample,
            subject=row.subject,
            population=row.population,
            percentage=row.percentage,
            response=row.response,
            time_from_treatment_start=row.time_from_treatment_start,
        )
        for row in frame.itertuples()
    ]

    return CompareResponse(
        filters=CohortFilters(
            condition=condition,
            treatment=treatment,
            sample_type=sample_type,
            time_from_treatment_start=0 if aggregation == "baseline" else None,
        ),
        n_samples=int(frame["sample"].nunique()),
        n_subjects=int(frame["subject"].nunique()),
        test="Mann-Whitney U (two-sided)",
        correction="Benjamini-Hochberg FDR",
        alpha=alpha,
        aggregation=aggregation,
        aggregation_note=AGGREGATION_NOTES[aggregation],
        points=points,
        tests=compare_populations(frame, alpha),
    )
