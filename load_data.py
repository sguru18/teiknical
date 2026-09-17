"""

Initializes the database with your schema.
Loads all rows from cell-count.csv.
Should create a SQLite database file (`.db` extension) in the repository root
Executable directly without command-line arguments or module-style execution (`python -m`)

Projects
 - proj_id (PK)

Subjects (couples a subject to an enrollment in a project, think this assumption is fundamentally true tho)
 - sbj_id (PK)
 - proj_id (FK)
 - age
 - sex
 - condition
 - treatment
 - response

Samples
 - sample_id (PK)
 - sbj_id (FK)
 - sample_type
 - time_from_treatment_start

Sample Counts (weak entity, can easily measure more things if wanted without schema change)
 - sample_id (FK)
 - population (b_cell, cd8_t_cell, cd4_t_cell, nk_cell, monocyte) (composite PK with sample_id)
 - count

"""

import csv
import sqlite3

CSV_PATH = "cell-count.csv"

CELL_POPULATIONS = ("b_cell", "cd8_t_cell", "cd4_t_cell", "nk_cell", "monocyte")

# Translate the schema above into sql create table statements
SQL_STATEMENTS = [
    """CREATE TABLE IF NOT EXISTS projects (
            proj_id TEXT PRIMARY KEY
        );""",
    """CREATE TABLE IF NOT EXISTS subjects (
            sbj_id    TEXT PRIMARY KEY,
            proj_id   TEXT    NOT NULL REFERENCES projects (proj_id),
            age       INTEGER NOT NULL CHECK (age >= 0),
            sex       TEXT    NOT NULL CHECK (sex IN ('M', 'F')),
            condition TEXT    NOT NULL,
            treatment TEXT    NOT NULL,
            response  TEXT    CHECK (response IN ('yes', 'no'))
        );""",
    """CREATE TABLE IF NOT EXISTS samples (
            sample_id                 TEXT PRIMARY KEY,
            sbj_id                    TEXT    NOT NULL REFERENCES subjects (sbj_id),
            sample_type               TEXT    NOT NULL CHECK (sample_type IN ('PBMC', 'WB')),
            time_from_treatment_start INTEGER NOT NULL CHECK (time_from_treatment_start >= 0)
        );""",
    """CREATE TABLE IF NOT EXISTS sample_counts (
            sample_id  TEXT    NOT NULL REFERENCES samples (sample_id) ON DELETE CASCADE,
            population TEXT    NOT NULL,
            count      INTEGER NOT NULL CHECK (count >= 0),
            PRIMARY KEY (sample_id, population)
        );""",
    # straight out of 411 lmao
    "CREATE INDEX IF NOT EXISTS idx_subjects_proj ON subjects (proj_id);",
    "CREATE INDEX IF NOT EXISTS idx_samples_sbj ON samples (sbj_id);",
    "CREATE INDEX IF NOT EXISTS idx_sample_counts_population ON sample_counts (population);",
]


# Initializes a sqlite db with the given name using the list of statements above
def initialize_db(db_name) -> None:
    try:
        with sqlite3.connect(f"{db_name}.db") as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys = ON;")
            for statement in SQL_STATEMENTS:
                cursor.execute(statement)
            conn.commit()
    except Exception as e:
        print(f"Error in database initialization, rolling back. {e}")
    finally:
        conn.close()


# Reads the csv into the four tables. Subjects get collapsed on sbj_id before insert. Wipes existing rows so reruns are clean.
def load_csv(db_name, csv_path=CSV_PATH) -> None:
    projects = {}
    subjects = {}
    samples = []
    counts = []

    # read csv once and create all relevant table entries from a row instead of creating one table at a time
    with open(csv_path, newline="") as f:
        for row in csv.DictReader(f):
            projects[row["project"]] = (row["project"],)

            subjects[row["subject"]] = (
                row["subject"],
                row["project"],
                int(row["age"]),
                row["sex"],
                row["condition"],
                row["treatment"],
                # healthy controls are untreated and have no response recorded
                row["response"] or None,
            )

            samples.append(
                (
                    row["sample"],
                    row["subject"],
                    row["sample_type"],
                    int(row["time_from_treatment_start"]),
                )
            )

            for population in CELL_POPULATIONS:
                counts.append((row["sample"], population, int(row[population])))

    try:
        with sqlite3.connect(f"{db_name}.db") as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA foreign_keys = ON;")

            for table in ("sample_counts", "samples", "subjects", "projects"):
                cursor.execute(f"DELETE FROM {table};")

            cursor.executemany("INSERT INTO projects VALUES (?);", projects.values())
            cursor.executemany(
                "INSERT INTO subjects VALUES (?, ?, ?, ?, ?, ?, ?);", subjects.values()
            )
            cursor.executemany("INSERT INTO samples VALUES (?, ?, ?, ?);", samples)
            cursor.executemany("INSERT INTO sample_counts VALUES (?, ?, ?);", counts)
            conn.commit()

            print(
                f"Loaded {len(projects)} projects, {len(subjects)} subjects, "
                f"{len(samples)} samples, {len(counts)} counts."
            )
    except Exception as e:
        print(f"Error loading csv, rolling back. {e}")
    finally:
        conn.close()


if __name__ == "__main__":

    print("Initializing db...")
    initialize_db("teiknical")
    print("Success!")
    print("Filling db...")
    load_csv("teiknical")
    print("Success!")
