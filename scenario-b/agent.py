"""BNH System 5: PM compliance monitoring agent.

Usage:
    python db.py                                   # seed demo data
    python agent.py run --as-of 2026-10-09         # run the agent
    python agent.py findings                       # list findings and actions
    python agent.py override <finding_id> --reason "..." --by "Chief of Staff"
"""
import argparse
import json
import os
from datetime import date

import rules
from db import connect

MODEL = os.getenv("BNH_AGENT_MODEL", "gemini-flash-latest")
MAX_STEPS = 25
COS_EMAIL = "chief.of.staff@bnh.example"

SYSTEM_PROMPT = """You are the BNH PM Compliance Agent (System 5) for Brendan Nicholas Holdings.
Your job: review monthly Portfolio Manager reporting compliance and take proportionate action.

How you work:
1. Call get_compliance_report first. Its status values come from deterministic rules and are
   authoritative. Never recalculate dates or statuses yourself.
   
2. For each portfolio decide what, if anything, to do:
   - compliant or not_yet_due: no action.
   - late_within_tolerance or overdue_within_tolerance: a short reminder to the PM (notify_pm). No escalation.
   - breach_late or breach_missing: call get_portfolio_history first. Then notify the PM and
     escalate to the Chief of Staff. Mention any relevant history (e.g. a previous late month).
   - A finding in state "overridden" means a human has corrected the assessment. Take no action on it.
   - consecutive_red_months of 2 or more: call flag_for_review. RAG is self-reported, so this is a
     pattern for human judgement, never grounds for escalation on its own.
3. If a tool returns BLOCKED, accept it and move on. Do not retry with different wording.

Messages: formal, third person where possible, short, factual. State the reporting month, due date
and status. No threats, no speculation about causes, no em dashes.

When finished, reply with a brief summary of every portfolio and the action taken."""

TOOLS = [
    {
        "name": "get_compliance_report",
        "description": "Deterministic compliance status for every portfolio for the current reporting "
                       "month, with any existing finding and actions already taken.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "get_portfolio_history",
        "description": "Past submissions (month, submitted date, RAG, blocker) and past findings for one portfolio.",
        "input_schema": {
            "type": "object",
            "properties": {"portfolio_id": {"type": "integer"}},
            "required": ["portfolio_id"],
        },
    },
    {
        "name": "notify_pm",
        "description": "Send a simulated email to the portfolio's PM about this month's reporting.",
        "input_schema": {
            "type": "object",
            "properties": {
                "portfolio_id": {"type": "integer"},
                "subject": {"type": "string"},
                "message": {"type": "string"},
            },
            "required": ["portfolio_id", "subject", "message"],
        },
    },
    {
        "name": "escalate_to_cos",
        "description": "Send a simulated escalation email to the Chief of Staff. Only permitted for breaches.",
        "input_schema": {
            "type": "object",
            "properties": {
                "portfolio_id": {"type": "integer"},
                "subject": {"type": "string"},
                "message": {"type": "string"},
            },
            "required": ["portfolio_id", "subject", "message"],
        },
    },
    {
        "name": "flag_for_review",
        "description": "Add a portfolio to the Chief of Staff's review queue for a pattern needing human judgement.",
        "input_schema": {
            "type": "object",
            "properties": {
                "portfolio_id": {"type": "integer"},
                "reason": {"type": "string"},
            },
            "required": ["portfolio_id", "reason"],
        },
    },
]


class ComplianceTools:
    """Tool implementations. Policy is enforced here in code, not left to the model."""

    def __init__(self, conn, month: str, as_of: date):
        self.conn, self.month, self.as_of = conn, month, as_of

    # ---------- read tools ----------
    def get_compliance_report(self) -> dict:
        report = rules.assess_all(self.conn, self.month, self.as_of)
        for row in report:
            f = self._finding(row["portfolio_id"])
            row["finding"] = None if f is None else {
                "id": f["id"], "state": f["state"], "override_reason": f["override_reason"],
                "actions_taken": [a["action"] for a in self._actions(f["id"])],
            }
        return {"reporting_month": self.month, "as_of": self.as_of.isoformat(), "portfolios": report}

    def get_portfolio_history(self, portfolio_id: int) -> dict:
        subs = self.conn.execute(
            "SELECT reporting_month, submitted_at, rag, blocker FROM submissions "
            "WHERE portfolio_id = ? ORDER BY reporting_month", (portfolio_id,)
        ).fetchall()
        history = []
        for s in subs:
            status = rules.assess(self.conn, portfolio_id, s["reporting_month"], self.as_of)["status"]
            history.append({**dict(s), "status": status})
        findings = self.conn.execute(
            "SELECT reporting_month, assessed_status, state, override_reason FROM findings "
            "WHERE portfolio_id = ? ORDER BY reporting_month", (portfolio_id,)
        ).fetchall()
        return {"submissions": history, "findings": [dict(f) for f in findings]}

    # ---------- action tools (guarded) ----------
    def notify_pm(self, portfolio_id: int, subject: str, message: str) -> str:
        a = rules.assess(self.conn, portfolio_id, self.month, self.as_of)
        if a["status"] not in rules.NEEDS_ATTENTION:
            return f"BLOCKED: status is {a['status']}; no PM notification is permitted."
        pm_email = self.conn.execute("SELECT pm_email FROM portfolios WHERE id = ?", (portfolio_id,)).fetchone()[0]
        return self._act(a, "notify_pm", pm_email, subject, message)

    def escalate_to_cos(self, portfolio_id: int, subject: str, message: str) -> str:
        a = rules.assess(self.conn, portfolio_id, self.month, self.as_of)
        if a["status"] not in rules.BREACHES:
            return f"BLOCKED: status is {a['status']}; escalation is only permitted for breaches."
        return self._act(a, "escalate_to_cos", COS_EMAIL, subject, message)

    def flag_for_review(self, portfolio_id: int, reason: str) -> str:
        a = rules.assess(self.conn, portfolio_id, self.month, self.as_of)
        return self._act(a, "flag_for_review", "CoS review queue", "Review flag", reason, send_email=False)

    # ---------- internals ----------
    def _finding(self, portfolio_id: int):
        return self.conn.execute(
            "SELECT * FROM findings WHERE portfolio_id = ? AND reporting_month = ?", (portfolio_id, self.month)
        ).fetchone()

    def _actions(self, finding_id: int):
        return self.conn.execute("SELECT * FROM actions WHERE finding_id = ?", (finding_id,)).fetchall()

    def _act(self, assessment: dict, action: str, recipient: str, subject: str, message: str,
             send_email: bool = True) -> str:
        pid = assessment["portfolio_id"]
        finding = self._finding(pid)
        if finding and finding["state"] == "overridden":
            return f"BLOCKED: finding {finding['id']} was overridden by {finding['overridden_by']}: {finding['override_reason']}"
        if finding is None:
            self.conn.execute(
                "INSERT INTO findings (portfolio_id, reporting_month, assessed_status) VALUES (?, ?, ?)",
                (pid, self.month, assessment["status"]),
            )
            finding = self._finding(pid)
        if any(a["action"] == action for a in self._actions(finding["id"])):
            return f"BLOCKED: {action} already taken for finding {finding['id']}; not repeating."

        self.conn.execute(
            "INSERT INTO actions (finding_id, action, recipient, message) VALUES (?, ?, ?, ?)",
            (finding["id"], action, recipient, f"{subject}\n\n{message}"),
        )
        self.conn.commit()
        if send_email:
            print(f"\n----- SIMULATED EMAIL -----\nTo: {recipient}\nSubject: {subject}\n\n{message}\n---------------------------")
        else:
            print(f"\n[REVIEW QUEUE] {assessment['portfolio']}: {message}")
        return f"OK: {action} recorded on finding {finding['id']}."

    def dispatch(self, name: str, args: dict) -> str:
        fn = getattr(self, name, None)
        if name.startswith("_") or fn is None or name == "dispatch":
            return f"ERROR: unknown tool {name}"
        if "portfolio_id" in args:  # Gemini may return numbers as floats
            args["portfolio_id"] = int(args["portfolio_id"])
        result = fn(**args)
        return result if isinstance(result, str) else json.dumps(result, default=str)


def run_agent(as_of: date) -> None:
    month = rules.prev_month(f"{as_of.year}-{as_of.month:02d}")
    conn = connect()
    tools = ComplianceTools(conn, month, as_of)
    print(f"BNH PM Compliance Agent | reporting month {month} | as of {as_of}")

    try:
        from google import genai
        from google.genai import types

        client = genai.Client()  # reads GEMINI_API_KEY from the environment
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=[types.Tool(function_declarations=[
                types.FunctionDeclaration(
                    name=t["name"], description=t["description"], parameters_json_schema=t["input_schema"]
                ) for t in TOOLS
            ])],
            # We run the loop ourselves so every tool call passes through our guards and logging.
            automatic_function_calling=types.AutomaticFunctionCallingConfig(disable=True),
        )
        contents = [types.Content(role="user", parts=[types.Part.from_text(
            text=f"Run the compliance check for reporting month {month} as of {as_of}."
        )])]

        for _ in range(MAX_STEPS):
            response = client.models.generate_content(model=MODEL, contents=contents, config=config)
            contents.append(response.candidates[0].content)

            calls = response.function_calls or []
            if not calls:
                print("\n===== AGENT SUMMARY =====")
                print(response.text or "")
                return

            parts = []
            for call in calls:
                args = dict(call.args or {})
                try:
                    output = tools.dispatch(call.name, args)
                except Exception as exc:  # a tool failure is reported to the model, not swallowed
                    output = f"ERROR: {exc}"
                print(f"\n[tool] {call.name} {json.dumps(args, default=str)[:90]} -> {output[:100]}")
                parts.append(types.Part.from_function_response(name=call.name, response={"result": output}))
            contents.append(types.Content(role="user", parts=parts))

        print("\nStopped: step limit reached. Remaining items need manual review.")

    except Exception as exc:
        # Safe failure: if the model is unavailable, no messages are sent.
        # The deterministic report is printed for manual review instead.
        print(f"\nAgent unavailable ({exc.__class__.__name__}: {exc}). No notifications sent.")
        print("Deterministic report for manual review:")
        for row in tools.get_compliance_report()["portfolios"]:
            state = row["finding"]["state"] if row["finding"] else "-"
            print(f"  {row['portfolio']:<26} {row['status']:<26} days_late={row['days_late']} finding={state}")
    finally:
        conn.close()


def list_findings() -> None:
    conn = connect()
    rows = conn.execute(
        "SELECT f.*, p.name FROM findings f JOIN portfolios p ON p.id = f.portfolio_id ORDER BY f.id"
    ).fetchall()
    for f in rows:
        print(f"#{f['id']} {f['name']} {f['reporting_month']} {f['assessed_status']} [{f['state']}]"
              + (f" override: {f['override_reason']}" if f["override_reason"] else ""))
        for a in conn.execute("SELECT action, recipient FROM actions WHERE finding_id = ?", (f["id"],)):
            print(f"    - {a['action']} -> {a['recipient']}")
    conn.close()


def override(finding_id: int, reason: str, by: str) -> None:
    conn = connect()
    cur = conn.execute(
        "UPDATE findings SET state = 'overridden', override_reason = ?, overridden_by = ? WHERE id = ?",
        (reason, by, finding_id),
    )
    conn.commit()
    conn.close()
    print(f"Finding {finding_id} overridden." if cur.rowcount else f"No finding with id {finding_id}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BNH PM compliance agent")
    sub = parser.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--as-of", default="2026-10-09", help="simulated current date (YYYY-MM-DD)")
    sub.add_parser("findings")
    o = sub.add_parser("override")
    o.add_argument("finding_id", type=int)
    o.add_argument("--reason", required=True)
    o.add_argument("--by", default="Chief of Staff")
    args = parser.parse_args()

    if args.cmd == "run":
        run_agent(date.fromisoformat(args.as_of))
    elif args.cmd == "findings":
        list_findings()
    else:
        override(args.finding_id, args.reason, args.by)