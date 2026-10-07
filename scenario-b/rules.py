"""Deterministic compliance rules. The LLM never computes compliance status.

Assumptions (stated in design.md):
- Updates for month M are due on day 5 of month M+1.
- A 2-day grace period follows the due date.
- An approved extension replaces the due date; the grace period still applies.
"""
from datetime import date, timedelta

DUE_DAY = 5
GRACE_DAYS = 2

COMPLIANT = "compliant"
NOT_YET_DUE = "not_yet_due"
LATE_WITHIN_TOLERANCE = "late_within_tolerance"        # submitted during grace period
OVERDUE_WITHIN_TOLERANCE = "overdue_within_tolerance"  # not submitted, still in grace period
BREACH_LATE = "breach_late"                            # submitted after grace period
BREACH_MISSING = "breach_missing"                      # not submitted, grace period over

BREACHES = {BREACH_LATE, BREACH_MISSING}
NEEDS_ATTENTION = {LATE_WITHIN_TOLERANCE, OVERDUE_WITHIN_TOLERANCE} | BREACHES


def prev_month(month: str) -> str:
    y, m = map(int, month.split("-"))
    return f"{y - 1}-12" if m == 1 else f"{y}-{m - 1:02d}"


def default_due_date(month: str) -> date:
    y, m = map(int, month.split("-"))
    y, m = (y + 1, 1) if m == 12 else (y, m + 1)
    return date(y, m, DUE_DAY)


def classify(due: date, submitted: date | None, as_of: date) -> str:
    grace_end = due + timedelta(days=GRACE_DAYS)
    if submitted is not None:
        if submitted <= due:
            return COMPLIANT
        if submitted <= grace_end:
            return LATE_WITHIN_TOLERANCE
        return BREACH_LATE
    if as_of <= due:
        return NOT_YET_DUE
    if as_of <= grace_end:
        return OVERDUE_WITHIN_TOLERANCE
    return BREACH_MISSING


def consecutive_red(conn, portfolio_id: int, month: str) -> int:
    rows = conn.execute(
        "SELECT reporting_month, rag FROM submissions "
        "WHERE portfolio_id = ? AND reporting_month <= ? ORDER BY reporting_month DESC",
        (portfolio_id, month),
    ).fetchall()
    count, expected = 0, month
    for r in rows:
        if r["reporting_month"] != expected or r["rag"] != "Red":
            break
        count += 1
        expected = prev_month(expected)
    return count


def assess(conn, portfolio_id: int, month: str, as_of: date) -> dict:
    p = conn.execute("SELECT * FROM portfolios WHERE id = ?", (portfolio_id,)).fetchone()
    sub = conn.execute(
        "SELECT * FROM submissions WHERE portfolio_id = ? AND reporting_month = ?", (portfolio_id, month)
    ).fetchone()
    ext = conn.execute(
        "SELECT * FROM extensions WHERE portfolio_id = ? AND reporting_month = ?", (portfolio_id, month)
    ).fetchone()

    due = date.fromisoformat(ext["new_due_date"]) if ext else default_due_date(month)
    submitted = date.fromisoformat(sub["submitted_at"]) if sub else None
    status = classify(due, submitted, as_of)
    days_late = max(0, ((submitted or as_of) - due).days) if status != NOT_YET_DUE else 0

    return {
        "portfolio_id": p["id"],
        "portfolio": p["name"],
        "pm_name": p["pm_name"],
        "reporting_month": month,
        "due_date": due.isoformat(),
        "grace_end": (due + timedelta(days=GRACE_DAYS)).isoformat(),
        "extension": dict(ext) if ext else None,
        "submitted_at": sub["submitted_at"] if sub else None,
        "status": status,
        "days_late": days_late,
        "rag": sub["rag"] if sub else None,
        "consecutive_red_months": consecutive_red(conn, portfolio_id, month),
    }


def assess_all(conn, month: str, as_of: date) -> list[dict]:
    ids = [r["id"] for r in conn.execute("SELECT id FROM portfolios ORDER BY id")]
    return [assess(conn, pid, month, as_of) for pid in ids]
