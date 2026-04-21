---
name: ai-chatbot-systems
description: "Use for FitTrack grounded chatbot systems when the task touches gym-chat prompt behavior, grounding boundaries, out-of-scope refusal, follow-up suggestions, session-aware response shaping, or strict response schemas. Use with `ai-contract-core` when the chatbot path needs stronger prompt contracts or lower-model reliability."
---

# FitTrack AI Chatbot Systems

Use this skill for the FitTrack gym-chat domain and related grounded assistant flows.

## First pass

- Use Serena before broad repo scans.
- Read only what is needed:
  - `context/python/s16-ai-chatbot.md`
  - `context/python/00-python-microservice-contracts.md`
  - `references/chat-contract.md`
  - the touched Nest grounding or Python generation files
- Confirm the current boundary:
  - Nest owns sessions, history, grounding payloads, and policy assembly
  - Python owns response generation

## Scope boundaries

- Own grounded response behavior, out-of-scope refusal, follow-up suggestion policy, session-aware phrasing behavior, and strict chatbot response schemas.
- Do not move FAQ retrieval, schedule resolution, or session persistence into prompts.
- Keep the domain gym-only unless product requirements explicitly widen it.

## MCP routing

- Serena is required.
- Prisma Local is required when chat-session persistence, interaction logs, or knowledge tables are part of the task.
- Swagger is allowed only after direct API checks or contract reads establish the actual runtime path.
- Playwright is allowed only when the browser-visible chatbot UI changed and runtime verification is required.

## Workflow

1. Confirm the grounding boundary and ownership split.
2. Define or repair the strict chatbot response contract.
3. Tune refusal and out-of-scope behavior.
4. Tune follow-up suggestion behavior and safe conversational continuity.
5. Verify grounded, out-of-scope, and under-grounded examples.

## Chatbot rules

- Every answer should be grounded in supplied data or the clearly permitted knowledge scope.
- Out-of-scope questions should be refused explicitly and briefly.
- Follow-up suggestions should help the gym user continue the conversation without inventing new facts.
- Low-confidence cases should degrade safely instead of sounding authoritative.

## Output defaults

- Return the grounding boundary, response schema, refusal behavior, follow-up rules, and verification cases.
- State which parts are owned by Nest, Python, and the model.
