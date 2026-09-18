"""Statistics for the responder vs non-responder comparison.

Kept separate from the route handlers so the analysis can be run, tested, or
reused without going through HTTP.
"""

import sqlite3

import pandas as pd
from scipy import stats

from api.models import Aggregation, PopulationTest

# Relative frequencies joined to the subject metadata the comparison filters on.
# Percentages come from the same window function as /api/summary so the two
# endpoints can never disagree.
FREQUENCIES_SQL = """
    SELECT
        s.sample_id AS sample,
        s.sbj_id AS subject,
        s.time_from_treatment_start,
        sub.condition,
        sub.treatment,
        s.sample_type,
        sub.response,
        sc.population,
        100.0 * sc.count / SUM(sc.count) OVER (PARTITION BY sc.sample_id) AS percentage
    FROM sample_counts sc
    JOIN samples s ON s.sample_id = sc.sample_id
    JOIN subjects sub ON sub.sbj_id = s.sbj_id
"""

AGGREGATION_NOTES: dict[Aggregation, str] = {
    "baseline": (
        "Pre-treatment samples only (time_from_treatment_start = 0), one per "
        "subject. Each point is one subject."
    ),
    "subject_mean": (
        "Each subject's percentages averaged across all timepoints, one per "
        "subject. Each point is one subject."
    ),
    "all_samples": (
        "Every sample, so subjects measured at several timepoints contribute "
        "more than one point. This overstates the sample size and the tests "
        "below should be read with that in mind."
    ),
}


def load_frequencies(
    conn: sqlite3.Connection,
    condition: str | None = None,
    treatment: str | None = None,
    sample_type: str | None = None,
) -> pd.DataFrame:
    """Long-format percentages for the filtered cohort, responders only.

    The filters are applied outside the window function so `percentage` always
    reflects the full sample, not the filtered subset.
    """
    clauses = ["response IS NOT NULL"]
    params: list[str] = []

    for column, value in (
        ("condition", condition),
        ("treatment", treatment),
        ("sample_type", sample_type),
    ):
        if value is not None:
            clauses.append(f"{column} = ?")
            params.append(value)

    sql = f"SELECT * FROM ({FREQUENCIES_SQL}) WHERE {' AND '.join(clauses)}"
    return pd.read_sql_query(sql, conn, params=params)


def apply_aggregation(df: pd.DataFrame, aggregation: Aggregation) -> pd.DataFrame:
    """Collapse repeated measures so each row is an independent observation."""
    if aggregation == "baseline":
        return df[df["time_from_treatment_start"] == 0].copy()

    if aggregation == "subject_mean":
        collapsed = (
            df.groupby(["subject", "response", "population"], as_index=False)[
                "percentage"
            ]
            .mean()
            .assign(time_from_treatment_start=-1)
        )
        # One synthetic row per subject; sample id is no longer meaningful.
        collapsed["sample"] = collapsed["subject"] + " (mean)"
        return collapsed

    return df.copy()


def compare_populations(
    df: pd.DataFrame, alpha: float = 0.05
) -> list[PopulationTest]:
    """Mann-Whitney U per population, Benjamini-Hochberg corrected across them.

    Mann-Whitney rather than a t-test because the percentages are not normally
    distributed (Shapiro-Wilk rejects for every population) and it makes no
    distributional assumption. Welch's t-test is reported alongside so a reader
    can see the conclusion does not hinge on that choice.
    """
    results = []

    for population in sorted(df["population"].unique()):
        subset = df[df["population"] == population]
        responders = subset.loc[subset["response"] == "yes", "percentage"]
        non_responders = subset.loc[subset["response"] == "no", "percentage"]

        if responders.empty or non_responders.empty:
            continue

        u_statistic, p_value = stats.mannwhitneyu(
            responders, non_responders, alternative="two-sided"
        )
        _, p_welch = stats.ttest_ind(responders, non_responders, equal_var=False)

        # Rank-biserial correlation: U rescaled to -1..1, a measure of how much
        # the two distributions actually separate.
        effect_size = 2 * u_statistic / (len(responders) * len(non_responders)) - 1

        results.append(
            PopulationTest(
                population=population,
                n_responders=len(responders),
                n_non_responders=len(non_responders),
                median_responders=float(responders.median()),
                median_non_responders=float(non_responders.median()),
                median_difference=float(responders.median() - non_responders.median()),
                statistic=float(u_statistic),
                p_value=float(p_value),
                # Placeholder; corrected below once every population is tested.
                p_value_adjusted=float(p_value),
                significant=False,
                effect_size=float(effect_size),
                p_value_welch=float(p_welch),
            )
        )

    if not results:
        return results

    # Five tests means five chances at a false positive, so control the false
    # discovery rate across the family rather than testing each in isolation.
    adjusted = stats.false_discovery_control([r.p_value for r in results])
    for result, q_value in zip(results, adjusted, strict=True):
        result.p_value_adjusted = float(q_value)
        result.significant = bool(q_value < alpha)

    return results
