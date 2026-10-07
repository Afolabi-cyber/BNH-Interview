"""SQLite data layer: schema and seeded demo data for the PM compliance agent."""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "compliance.db"

SCHEMA = """
CREATE TABLE portfolios (
    id        INTEGER PRIMARY KEY,
    name      TEXT NOT NULL,
    pm_name   TEXT NOT NULL,
    pm_email  TEXT NOT NULL
);

-- One monthly update per portfolio. RAG is self-reported by the PM.
CREATE TABLE submissions (
    id               INTEGER PRIMARY KEY,
    portfolio_id     INTEGER NOT NULL REFERENCES portfolios(id),
    reporting_month  TEXT NOT NULL,            -- 'YYYY-MM'
    submitted_at     TEXT NOT NULL,            -- 'YYYY-MM-DD'
    cash_ngn         INTEGER NOT NULL,
    rag              TEXT NOT NULL CHECK (rag IN ('Green', 'Amber', 'Red')),
    blocker          TEXT,
    UNIQUE (portfolio_id, reporting_month)
);

-- Deadline extensions approved by a human. They move the due date.
CREATE TABLE extensions (
    id               INTEGER PRIMARY KEY,
    portfolio_id     INTEGER NOT NULL REFERENCES portfolios(id),
    reporting_month  TEXT NOT NULL,
    new_due_date     TEXT NOT NULL,
    approved_by      TEXT NOT NULL,
    reason           TEXT,
    UNIQUE (portfolio_id, reporting_month)
);

-- One finding per portfolio per month. Humans override findings here.
CREATE TABLE findings (
    id               INTEGER PRIMARY KEY,
    portfolio_id     INTEGER NOT NULL REFERENCES portfolios(id),
    reporting_month  TEXT NOT NULL,
    assessed_status  TEXT NOT NULL,
    state            TEXT NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'overridden')),
    override_reason  TEXT,
    overridden_by    TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (portfolio_id, reporting_month)
);

-- Every action the agent takes, for audit and de-duplication.
CREATE TABLE actions (
    id          INTEGER PRIMARY KEY,
    finding_id  INTEGER NOT NULL REFERENCES findings(id),
    action      TEXT NOT NULL,                 -- notify_pm | escalate_to_cos | flag_for_review
    recipient   TEXT NOT NULL,
    message     TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
"""

PORTFOLIOS = [
    (1, "Lagos Agro Holdings", "Adaeze Okafor"),
    (2, "Abuja Real Estate Fund", "Tunde Bakare"),
    (3, "Northern Energy Ltd", "Ibrahim Musa"),
    (4, "Delta Manufacturing", "Efe Omoregie"),
    (5, "Kano Agri-Processing", "Halima Sani"),
    (6, "Port Harcourt Logistics", "Chidi Nwosu"),
]

# (portfolio_id, reporting_month, submitted_at, cash_ngn, rag, blocker)
SUBMISSIONS = [
    # July 2026 (history)
    (1, "2026-07", "2026-08-04", 1_180_000_000, "Green", None),
    (2, "2026-07", "2026-08-05", 640_000_000, "Green", None),
    (3, "2026-07", "2026-08-03", 410_000_000, "Amber", "Grid connection approval pending"),
    (4, "2026-07", "2026-08-05", 295_000_000, "Green", None),
    (5, "2026-07", "2026-08-02", 520_000_000, "Green", None),
    (6, "2026-07", "2026-08-04", 360_000_000, "Amber", "Port congestion at Onne"),
    # August 2026 (history)
    (1, "2026-08", "2026-09-03", 1_210_000_000, "Green", None),
    (2, "2026-08", "2026-09-04", 615_000_000, "Amber", "Tenant onboarding delayed at Wuse II site"),
    (3, "2026-08", "2026-09-05", 362_000_000, "Red", "Grid connection approval outstanding"),
    (4, "2026-08", "2026-09-07", 288_000_000, "Amber", "Raw material import delay"),
    (5, "2026-08", "2026-09-04", 534_000_000, "Green", None),
    (6, "2026-08", "2026-09-05", 371_000_000, "Green", None),
    # September 2026 (current reporting month, due 2026-10-05)
    (1, "2026-09", "2026-10-03", 1_250_000_000, "Green", None),                                      # on time
    (2, "2026-09", "2026-10-06", 602_000_000, "Amber", "Tenant onboarding delayed at Wuse II site"), # late within tolerance
    (3, "2026-09", "2026-10-09", 318_000_000, "Red", "Grid connection approval outstanding"),        # breach (late), 2nd Red month
    # 4 Delta Manufacturing: missing -> breach
    # 5 Kano Agri-Processing: missing, but extension approved -> not yet due
    # 6 Port Harcourt Logistics: missing, but a human has overridden the finding
]

EXTENSIONS = [
    (5, "2026-09", "2026-10-12", "Chief of Staff", "Year-end audit fieldwork"),
]


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def seed() -> None:
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = connect()
    conn.executescript(SCHEMA)
    conn.executemany(
        "INSERT INTO portfolios VALUES (?, ?, ?, ?)",
        [(i, n, pm, pm.lower().replace(" ", ".") + "@bnh.example") for i, n, pm in PORTFOLIOS],
    )
    conn.executemany(
        "INSERT INTO submissions (portfolio_id, reporting_month, submitted_at, cash_ngn, rag, blocker) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        SUBMISSIONS,
    )
    conn.executemany(
        "INSERT INTO extensions (portfolio_id, reporting_month, new_due_date, approved_by, reason) "
        "VALUES (?, ?, ?, ?, ?)",
        EXTENSIONS,
    )
    # A human has already corrected a wrong assessment for Port Harcourt Logistics.
    conn.execute(
        "INSERT INTO findings (portfolio_id, reporting_month, assessed_status, state, override_reason, overridden_by) "
        "VALUES (6, '2026-09', 'breach_missing', 'overridden', "
        "'Update received by email on 2026-10-04 during dashboard outage; recorded manually.', 'Chief of Staff')"
    )
    conn.commit()
    conn.close()


if __name__ == "__main__":
    seed()
    print(f"Seeded {DB_PATH.name}")
