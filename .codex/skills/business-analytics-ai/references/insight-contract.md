# Business Insight Contract

## Preserve these boundaries

- Nest owns KPI computation and payload assembly.
- Python owns narrative phrasing and structured insight output.
- The model should interpret supplied data, not calculate source metrics.

## Required output fields

- `summary`
- `highlights`
- `risks`
- `opportunities`
- `anomaly_flags`
- `recommended_actions`
- `model_used`
- `token_count`

## Behavioral rules

- Tie every narrative point back to the supplied KPI payload.
- Prefer concise, actionable recommendations over vague executive language.
- When evidence is mixed or weak, use cautious wording instead of certainty theater.
