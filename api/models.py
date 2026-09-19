"""Response models for the analysis API.

`population` is typed as a plain `str` rather than an enum on purpose. The
sample_counts table stores populations as rows, so adding a sixth cell type
is an INSERT; hardcoding the five names here would reintroduce the schema
coupling that design was meant to avoid.



these let the server enforce data structure at runtime. data that comes out of the DB is checked against these models,
and a server side error is raised if anything doesn't match, preventing client side crashes

these also permit automatic generation of typescript types, so a rename from percentage to pct in the DB for whatever reason
would make row.percentage become a compiler error in typescript, again preventing client side crash at runtime

this is however somewhat problematic during frequent schema changes, kinda obviously.

"""

from typing import Literal

from pydantic import BaseModel, Field

SampleType = Literal["PBMC", "WB"]
Response = Literal["yes", "no"]
Sex = Literal["M", "F"]

# Each subject contributes three samples (day 0, 7, 14). The comparison selects
# one timepoint so every row is an independent observation (one subject = one point).
#   baseline - pre-treatment (day 0); predicts who will respond before dosing
#   day7     - one week on-treatment; shows early immune response to the drug
#   day14    - two weeks on-treatment; shows whether the immune shift is sustained
Aggregation = Literal["baseline", "day7", "day14"]


class FilterOptions(BaseModel):
    """Distinct values available for each filter, read from the database so the
    UI never offers a combination the data cannot describe."""

    conditions: list[str]
    treatments: list[str]
    sample_types: list[str]
    timepoints: list[int]


class CohortFilters(BaseModel):
    """The filters that produced a result set, echoed back so the client can
    label charts without re-deriving what it asked for."""

    condition: str | None = None
    treatment: str | None = None
    sample_type: SampleType | None = None
    time_from_treatment_start: int | None = None


# --- Part 2: frequency summary -------------------------------------------------


class SummaryRow(BaseModel):
    """One population from one sample. Column names match the assignment spec."""

    sample: str
    total_count: int = Field(description="Sum across all populations in this sample")
    population: str
    count: int
    percentage: float = Field(description="count / total_count * 100")


class SummaryResponse(BaseModel):
    rows: list[SummaryRow]
    n_samples: int
    populations: list[str]


class SummaryRequest(BaseModel):
    """POST body for fetching many sample ids at once.

    Prefer this over repeating ?sample= on GET when the cohort is large —
    hundreds of ids blow past typical URL length limits.
    """

    sample: list[str] = Field(default_factory=list)
    limit: int | None = Field(default=None, ge=1)
    offset: int = Field(default=0, ge=0)


# --- Part 3: responder vs non-responder ---------------------------------------


class FrequencyPoint(BaseModel):
    """A single observation feeding the boxplots. Carries subject so the client
    can show that samples are repeated measures rather than independent."""

    sample: str
    subject: str
    population: str
    percentage: float
    response: Response
    time_from_treatment_start: int


class PopulationTest(BaseModel):
    """Result of one test, for one population, between responders and non-responders."""

    population: str
    n_responders: int
    n_non_responders: int
    median_responders: float
    median_non_responders: float
    median_difference: float = Field(description="responders minus non-responders")
    statistic: float = Field(description="Mann-Whitney U statistic")
    p_value: float
    p_value_adjusted: float = Field(
        description="Corrected across all populations tested"
    )
    significant: bool = Field(description="p_value_adjusted < alpha")
    effect_size: float = Field(
        description=(
            "Rank-biserial correlation, -1 to 1. Near zero means the groups "
            "overlap almost entirely, regardless of the p-value."
        )
    )
    shapiro_p_responders: float = Field(
        description=(
            "Shapiro-Wilk p-value for the responder group. "
            "p < 0.05 means normality is rejected for that group."
        )
    )
    shapiro_p_non_responders: float = Field(
        description=(
            "Shapiro-Wilk p-value for the non-responder group. "
            "p < 0.05 means normality is rejected for that group."
        )
    )
    normality_rejected: bool = Field(
        description=(
            "True if Shapiro-Wilk rejects normality (p < 0.05) in either group. "
            "When true, MWU is the appropriate test over a t-test."
        )
    )
    p_value_welch: float | None = Field(
        default=None,
        description=(
            "Welch t-test p-value. Only computed when normality_rejected is False — "
            "Welch requires normality but not equal variance, so it is the correct "
            "parametric comparison for populations where Shapiro-Wilk does not reject. "
            "None when normality is rejected."
        )
    )


class CompareResponse(BaseModel):
    filters: CohortFilters
    n_samples: int
    n_subjects: int
    test: str = Field(description="Name of the statistical test applied")
    correction: str = Field(description="Multiple-comparison correction method")
    alpha: float
    aggregation: Aggregation
    aggregation_note: str = Field(
        description=(
            "Plain-language statement of how repeated measures per subject were "
            "handled, so a reader of the chart knows what each point represents."
        )
    )
    points: list[FrequencyPoint]
    tests: list[PopulationTest]


# --- Part 4: baseline cohort breakdown ----------------------------------------


class CategoryCount(BaseModel):
    """A labelled count. Used for the per-project, per-response and per-sex
    breakdowns so the client can render them all with one component."""

    label: str
    count: int


class CohortResponse(BaseModel):
    filters: CohortFilters
    sample_ids: list[str]
    n_samples: int
    n_subjects: int
    samples_by_project: list[CategoryCount]
    subjects_by_response: list[CategoryCount]
    subjects_by_sex: list[CategoryCount]
