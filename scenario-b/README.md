# Scenario B: PM Compliance Monitoring Agent

Design document: [design.md](design.md)

## Run

```bash
pip install -r requirements.txt
export GEMINI_API_KEY=your_key
python db.py                                  # seed demo data
python agent.py run --as-of 2026-10-09        # run the agent
python agent.py findings                      # see findings and actions
python agent.py override 2 --reason "..."     # CoS overrides a finding
```

The default model is `gemini-flash-latest`. Set `BNH_AGENT_MODEL` to use a different Gemini model (e.g. `gemini-2.5-pro`).

## Seeded cases (reporting month September 2026, due 5 October)

| Portfolio | Situation | Expected outcome |
|---|---|---|
| Lagos Agro Holdings | Submitted 3 Oct | No action |
| Abuja Real Estate Fund | Submitted 6 Oct | Reminder only |
| Northern Energy Ltd | Submitted 9 Oct, Red for 2 months | Breach: PM notified, CoS escalated, flagged for review |
| Delta Manufacturing | Not submitted | Breach: PM notified, CoS escalated |
| Kano Agri-Processing | Not submitted, extension to 12 Oct | No action |
| Port Harcourt Logistics | Not submitted, finding overridden by CoS | No action |

## Files

- `rules.py`: deterministic compliance rules (due date, grace period, breach)
- `agent.py`: tools with policy guards, agent loop, CLI
- `db.py`: SQLite schema and demo data