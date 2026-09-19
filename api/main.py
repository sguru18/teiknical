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
    CategoryCount,
    CohortResponse,
    CompareResponse,
    CrossTabRow,
    FilterOptions,
    FrequencyPoint,
    SampleType,
    SummaryRequest,
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


def build_summary(
    conn: sqlite3.Connection,
    sample: list[str] | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> SummaryResponse:
    """Relative frequencies, optionally restricted to a list of sample ids."""
    sql, params = SUMMARY_SQL, []

    populations = [
        r["population"]
        for r in conn.execute(
            "SELECT DISTINCT population FROM sample_counts ORDER BY population"
        )
    ]

    # Deduplicate while preserving order so a long cohort list is safe to pass.
    sample_ids = list(dict.fromkeys(sample)) if sample else []

    if sample_ids:
        placeholders = ",".join("?" * len(sample_ids))
        n_samples = conn.execute(
            f"SELECT COUNT(*) AS n FROM samples WHERE sample_id IN ({placeholders})",
            sample_ids,
        ).fetchone()["n"]
        if limit is not None:
            # Page by sample within the filtered set, same as the unfiltered path,
            # so a sample's five population rows stay on one page.
            n_pops = max(len(populations), 1)
            sql = f"""
                WITH page AS (
                    SELECT sample_id FROM samples
                    WHERE sample_id IN ({placeholders})
                    ORDER BY sample_id
                    LIMIT ? OFFSET ?
                )
                SELECT
                    sc.sample_id AS sample,
                    sc.population,
                    sc.count,
                    SUM(sc.count) OVER (PARTITION BY sc.sample_id) AS total_count,
                    100.0 * sc.count / SUM(sc.count) OVER (PARTITION BY sc.sample_id)
                        AS percentage
                FROM sample_counts sc
                JOIN page ON page.sample_id = sc.sample_id
                ORDER BY sc.sample_id, sc.population
            """
            params = [
                *sample_ids,
                (limit + n_pops - 1) // n_pops,
                offset // n_pops,
            ]
        else:
            # Filter outside the window so total_count stays the full sample total.
            sql = f"SELECT * FROM ({sql}) WHERE sample IN ({placeholders})"
            params.extend(sample_ids)
    else:
        n_samples = conn.execute("SELECT COUNT(*) AS n FROM samples").fetchone()["n"]
        if limit is not None:
            # Page by sample first so the window function only runs on this page,
            # not all 52,500 count rows. Five populations per sample, and the
            # client always asks for a multiple of that, so row offset maps cleanly.
            n_pops = max(len(populations), 1)
            sql = """
                WITH page AS (
                    SELECT sample_id FROM samples
                    ORDER BY sample_id
                    LIMIT ? OFFSET ?
                )
                SELECT
                    sc.sample_id AS sample,
                    sc.population,
                    sc.count,
                    SUM(sc.count) OVER (PARTITION BY sc.sample_id) AS total_count,
                    100.0 * sc.count / SUM(sc.count) OVER (PARTITION BY sc.sample_id)
                        AS percentage
                FROM sample_counts sc
                JOIN page ON page.sample_id = sc.sample_id
                ORDER BY sc.sample_id, sc.population
            """
            params = [(limit + n_pops - 1) // n_pops, offset // n_pops]

    rows = [SummaryRow(**dict(r)) for r in conn.execute(sql, params)]
    return SummaryResponse(rows=rows, n_samples=n_samples, populations=populations)


@app.get("/api/summary", response_model=SummaryResponse, tags=["Part 2"])
def get_summary(
    conn: sqlite3.Connection = Depends(get_connection),
    sample: list[str] | None = Query(
        default=None,
        description=(
            "Restrict to these sample ids. Repeat the query param "
            "(?sample=a&sample=b). A single id is still a one-element list."
        ),
    ),
    limit: int | None = Query(
        default=None, ge=1, description="Page size; omit to return every row"
    ),
    offset: int = Query(default=0, ge=0),
) -> SummaryResponse:
    """Part 2: relative frequency of each population within each sample."""
    return build_summary(conn, sample=sample, limit=limit, offset=offset)


@app.post("/api/summary", response_model=SummaryResponse, tags=["Part 2"])
def post_summary(
    body: SummaryRequest,
    conn: sqlite3.Connection = Depends(get_connection),
) -> SummaryResponse:
    """Same as GET /api/summary, but sample ids go in the JSON body.

    Use this for large cohorts (hundreds of ids) where a query string would
    exceed typical URL length limits.
    """
    return build_summary(conn, sample=body.sample, limit=body.limit, offset=body.offset)


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
        projects=distinct("proj_id", "subjects"),
    )


@app.get("/api/compare", response_model=CompareResponse, tags=["Part 3"])
def get_compare(
    conn: sqlite3.Connection = Depends(get_connection),
    condition: str = Query(default="melanoma"),
    treatment: str = Query(default="miraclib"),
    sample_type: SampleType = Query(default="PBMC"),
    aggregation: Aggregation = Query(
        default="baseline",
        description="Which timepoint to use (baseline=day 0, day7, day14)",
    ),
    sex: str | None = Query(default=None, description="Filter to M or F subjects only"),
    proj_id: str | None = Query(default=None, description="Filter to a single project"),
    alpha: float = Query(default=0.05, gt=0, lt=1),
) -> CompareResponse:
    """Part 3: population frequencies in responders vs non-responders.

    The assignment's cohort (melanoma, miraclib, PBMC) is the default rather
    than a hardcoded constant, so the same comparison can be run against any
    other indication or treatment without a code change.
    sex and proj_id narrow the cohort further for subset analysis.
    """
    frame = load_frequencies(conn, condition, treatment, sample_type, sex, proj_id)
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
            time_from_treatment_start={"baseline": 0, "day7": 7, "day14": 14}[aggregation],
            sex=sex,
            proj_id=proj_id,
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


# The cohort itself: one row per matching sample, joined to its subject.
COHORT_SQL = """
    SELECT s.sample_id, s.sbj_id, sub.proj_id, sub.response, sub.sex
    FROM samples s
    JOIN subjects sub ON sub.sbj_id = s.sbj_id
    WHERE sub.condition = ?
      AND sub.treatment = ?
      AND s.sample_type = ?
      AND s.time_from_treatment_start = ?
"""

# LEFT JOIN from projects so a project contributing no samples reports zero
# rather than vanishing. Melanoma PBMC samples only exist in two of the three
# projects, and a missing row reads like a bug.
SAMPLES_BY_PROJECT_SQL = f"""
    SELECT p.proj_id AS label, COUNT(c.sample_id) AS count
    FROM projects p
    LEFT JOIN ({COHORT_SQL}) c ON c.proj_id = p.proj_id
    GROUP BY p.proj_id
    ORDER BY p.proj_id
"""


@app.get("/api/cohort", response_model=CohortResponse, tags=["Part 4"])
def get_cohort(
    conn: sqlite3.Connection = Depends(get_connection),
    condition: str = Query(default="melanoma"),
    treatment: str = Query(default="miraclib"),
    sample_type: SampleType = Query(default="PBMC"),
    time_from_treatment_start: int = Query(default=0, ge=0),
) -> CohortResponse:
    """Part 4: baseline samples for one treatment arm, broken down by project,
    response and sex.

    Counts are per subject for response and sex, because those are properties
    of a person rather than of a specimen. Project counts are per sample, as
    the question asks how many samples each project contributed.
    """
    params = (condition, treatment, sample_type, time_from_treatment_start)

    rows = conn.execute(COHORT_SQL, params).fetchall()
    subjects = {row["sbj_id"]: row for row in rows}

    def subject_counts(column: str) -> list[CategoryCount]:
        tally: dict[str, int] = {}
        for row in subjects.values():
            # Untreated healthy controls have no recorded response, which is a
            # real category rather than missing data.
            label = row[column] if row[column] is not None else "not recorded"
            tally[label] = tally.get(label, 0) + 1
        return [
            CategoryCount(label=label, count=count)
            for label, count in sorted(tally.items())
        ]

    def cross_tab(group_column: str, all_labels: list[str] | None = None) -> list[CrossTabRow]:
        """Cross-tabulate subjects by group_column × response.

        all_labels: if provided, every label in the list appears in the result
        even if no subjects fall into it (count = 0). This ensures e.g. prj2
        shows up as a zero row rather than being absent.
        """
        empty: dict[str, int] = {"yes": 0, "no": 0, "not_recorded": 0}
        tally: dict[str, dict[str, int]] = {
            lbl: dict(empty) for lbl in (all_labels or [])
        }
        for row in subjects.values():
            group = row[group_column] if row[group_column] is not None else "not recorded"
            if group not in tally:
                tally[group] = dict(empty)
            resp = row["response"]
            if resp == "yes":
                tally[group]["yes"] += 1
            elif resp == "no":
                tally[group]["no"] += 1
            else:
                tally[group]["not_recorded"] += 1
        return [
            CrossTabRow(
                label=group,
                responders=counts["yes"],
                non_responders=counts["no"],
                not_recorded=counts["not_recorded"],
                total=counts["yes"] + counts["no"] + counts["not_recorded"],
            )
            for group, counts in sorted(tally.items())
        ]

    all_projects = [
        row["proj_id"]
        for row in conn.execute("SELECT proj_id FROM projects ORDER BY proj_id")
    ]

    by_project = [
        CategoryCount(label=row["label"], count=row["count"])
        for row in conn.execute(SAMPLES_BY_PROJECT_SQL, params)
    ]

    return CohortResponse(
        filters=CohortFilters(
            condition=condition,
            treatment=treatment,
            sample_type=sample_type,
            time_from_treatment_start=time_from_treatment_start,
        ),
        sample_ids=[row["sample_id"] for row in rows],
        n_samples=len(rows),
        n_subjects=len(subjects),
        samples_by_project=by_project,
        subjects_by_response=subject_counts("response"),
        subjects_by_sex=subject_counts("sex"),
        response_by_sex=cross_tab("sex", ["F", "M"]),
        response_by_project=cross_tab("proj_id", all_projects),
    )


FINAL_QUESTION_SQL = f"""
    SELECT AVG(sc.count) as "avg_b_cells"
    FROM subjects sub
    INNER JOIN samples s on s.sbj_id = sub.sbj_id
    INNER JOIN sample_counts sc on sc.sample_id = s.sample_id
    WHERE sub.sex = "M" and sub.condition = "melanoma" and s.time_from_treatment_start = 0 and sub.response = "yes" and sc.population = "b_cell"

"""
