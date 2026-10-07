# Scenario B: PM Compliance Monitoring Agent (System 5)

**Purpose.** Monitor whether Portfolio Managers submit monthly updates on time and take proportionate action: a reminder, an escalation to the Chief of Staff (CoS), or a flag for human review.

**Assumptions.** Updates for month M are due on day 5 of month M+1, followed by a 2-day grace period. An approved extension replaces the due date. RAG status is self-reported by PMs. Only the CoS can override a finding.

**Stack.** Python, SQLite (simulated data source), Gemini API with function calling (google-genai SDK). Emails are simulated as console output and logged to the database.

**Trigger.** Run daily by a scheduler (`python agent.py run`). The schedule only wakes the agent. What it does on each run depends on the data, its own past actions and human overrides.

**Tools.** `get_compliance_report`, `get_portfolio_history` (read). `notify_pm`, `escalate_to_cos`, `flag_for_review` (act).

**Core loop.** The agent reads the compliance report, gathers history for any breach, decides on actions, calls tools, reads each result and continues until it has handled every portfolio, then writes a summary.

**Breach vs late within tolerance.** Decided by deterministic code in `rules.py`, never by the model. Submitted by the due date is compliant. Submitted within the grace period is `late_within_tolerance`. After the grace period, or still missing once it has passed, is a breach. Date arithmetic on a compliance obligation should never depend on a language model.

**Agent, not a script.** A script maps each status to a fixed email. This agent chooses which tools to call and in what order, gathers context before acting (history, extensions, existing findings), writes messages that reflect that context, and reads its own record of past actions so it does not repeat itself. It also handles cases a fixed rule would get wrong, such as treating repeated Red RAG status as a pattern for review, not a breach.

**Failure modes designed against.**
- Wrong assessment from bad data (e.g. update sent outside the system): every finding is reviewable and overridable; extensions are checked first.
- Model choosing an excessive action: policy is enforced in tool code. `escalate_to_cos` is refused unless the rules engine reports a breach; `notify_pm` is refused for compliant portfolios.
- Alert spam: one finding per portfolio per month; repeated actions are refused.
- Acting on self-reported RAG: RAG patterns only go to the review queue.
- Model unavailable: no messages are sent; the deterministic report is printed for manual review.
- Runaway loop: hard limit of 25 steps.
- Prompt injection via PM text fields: actions are restricted to a fixed tool set and nothing is irreversible.

**Incorrect assessments and human override.** Every action is attached to a finding with its evidence (dates, status, days late) and logged in `actions`. The CoS overrides a finding with a reason (`python agent.py override <id> --reason "..."`). The override is stored on the finding, and the tool layer refuses any further action on it, so the correction holds on every future run regardless of what the model decides. The seed data includes an overridden finding to demonstrate this.