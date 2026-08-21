# Good Outputs

## Example: new admin analytics endpoint

- Risk: the endpoint is admin-only in the UI but the controller lacks the admin guard.
- Hardening: add the correct guard and verify the response DTO still excludes internal-only fields.
- Residual risk: none after the guard and DTO exposure check pass.

## Example: chatbot interaction logging

- Risk: the log path stores the full raw grounding payload including unnecessary user profile details.
- Hardening: reduce the persisted payload to the minimal diagnostic fields needed for support and debugging.
