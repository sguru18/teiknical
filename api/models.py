"""Response models for the analysis API.

These double as the source of truth for the frontend: `openapi-typescript`
turns the generated schema into TypeScript types, so a rename here surfaces
as a compile error in the React app.

`population` is typed as a plain `str` rather than an enum on purpose. The
sample_counts table stores populations as rows, so adding a sixth cell type
is an INSERT; hardcoding the five names here would reintroduce the schema
coupling that design was meant to avoid.
"""

from typing import Literal

from pydantic import BaseModel, Field

SampleType = Literal["PBMC", "WB"]
Response = Literal["yes", "no"]
Sex = Literal["M", "F"]


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
    statistic: float
    p_value: float
    p_value_adjusted: float = Field(description="Corrected across all populations tested")
    significant: bool = Field(description="p_value_adjusted < alpha")


class CompareResponse(BaseModel):
    filters: CohortFilters
    n_samples: int
    n_subjects: int
    test: str = Field(description="Name of the statistical test applied")
    correction: str = Field(description="Multiple-comparison correction method")
    alpha: float
    aggregation: str = Field(
        description=(
            "How repeated measures per subject were handled before testing, e.g. "
            "restricted to a single timepoint or averaged within subject."
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
