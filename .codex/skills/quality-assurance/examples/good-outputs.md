# Good Quality Assurance Outputs

## 1. Targeted but honest verification

Good shape:

- the QA pass chooses package-level commands that match the touched area
- it still reaches direct API, Swagger, and Playwright when the change requires them

Why it is good:

- it keeps the pass efficient without skipping truth-bearing checks

## 2. Findings-first report

Good shape:

- confirmed failures, blockers, and residual risks are listed before any summary
- the report states which phases ran and which were skipped

Why it is good:

- it makes the outcome actionable for the owning skill immediately

## 3. Browser and contract evidence together

Good shape:

- a QA pass on an integrated surface includes direct API notes, Swagger confirmation, and Playwright artifacts

Why it is good:

- it proves both the backend contract and the visible user flow
