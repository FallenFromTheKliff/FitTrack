# FitTrack - Python Microservice Shared Contracts
_Always include `../00-global-contracts.md` alongside this file._

---

# Purpose

Shared contracts for the Python microservice domain. This file defines the Python stack, service boundaries, internal Nest-to-Python conventions, timeout and health rules, and model-provider abstractions used by `S15`, `S16`, and `S17`.

---

## Tech Stack Reference

| Layer | Technology |
|-------|------------|
| API Framework | FastAPI |
| ASGI Server | Uvicorn |
| Validation | Pydantic v2 |
| Vision Detection | Ultralytics YOLO |
| Landmark Tracking | MediaPipe |
| Numeric Processing | NumPy |
| HTTP Client | httpx |
| Test Runner | pytest |
| Contract Tests | pytest + FastAPI TestClient |
| LLM Access | Provider adapter interface |
| Default External LLM Provider | OpenRouter |
| Default LLM Mode | OpenRouter first via OpenAI-compatible API |
| Optional Future Mode | Direct provider adapter or local OSS model adapter |
| Deployment | Docker |

## Service Ownership Boundaries

| Concern | NestJS Backend | Python Microservice |
|--------|----------------|--------------------|
| JWT auth and guards | Owns | Never owns |
| RBAC and rate limiting | Owns | Never owns |
| WebSocket auth and session ownership | Owns | Never owns |
| Prisma and PostgreSQL writes | Owns | Never writes directly |
| Redis locks and pub/sub | Owns | Optional read-only cache only |
| File upload and storage | Owns | Never owns |
| Pose inference | Orchestrates | Owns |
| Chat generation | Orchestrates and grounds | Owns response generation |
| Business insight generation | Builds KPI payloads | Owns narrative insight generation |
| Public API response envelope | Owns | Never returns public envelope |

## Nest To Python Request Rules

- Nest calls Python over internal HTTP only.
- Nest sends normalized JSON payloads only - no multipart uploads, no direct client passthrough.
- Nest validates all external requests before forwarding to Python.
- Python trusts only service-to-service requests from Nest and never performs public-user authorization.
- Python success responses are endpoint-specific JSON objects. Nest maps them into the public API envelope from `00-global-contracts.md`.
- Python error responses follow the same RFC 7807 style used globally.

### Python Error Shape

```typescript
interface PythonServiceError {
  type: string
  title: string
  status: number
  detail: string
}
```

## Health, Timeout, And Retry Rules

| Endpoint | Default Timeout | Retry Rule | Notes |
|----------|-----------------|------------|-------|
| GET /health | 1000ms | 1 retry on network failure only | Used by Nest startup and readiness checks |
| POST /pose/session/bootstrap | 2000ms | 1 retry on network timeout only | Safe because request is idempotent for a session |
| POST /pose/analyze | 1500ms | No retry | Latest-frame-wins; never queue retries |
| POST /pose/session/finalize | 3000ms | 1 retry on network timeout only | Safe if keyed by pose_session_id |
| POST /chat/gym | 8000ms | No retry | Avoid duplicate assistant replies |
| POST /analytics/insights | 10000ms | No retry | Operator request, not latency critical like pose |

### Health Rules

- Nest checks `GET /health` before enabling AI-dependent features.
- If Python health fails, Nest returns `503 SERVICE_UNAVAILABLE` for Python-backed features and leaves non-AI features unaffected.
- Health is green only if the service booted successfully, required models are loaded, and OpenRouter configuration is valid when LLM-backed features are enabled.

## Performance Rules

- Pose processing is CPU-first and capstone-sized.
- Pose frame analysis uses latest-frame-wins handling - stale frames are dropped instead of queued.
- LLMs are never called per video frame.
- Chat and analytics LLM usage must pass through a provider abstraction so the transport can change without changing Nest contracts.
- OpenRouter is the default external adapter for chat, analytics, and unknown-exercise final classification only.

## OpenRouter Configuration

| Env Var | Required | Default | Purpose |
|---------|----------|---------|---------|
| `OPENROUTER_API_KEY` | Yes | - | Primary OpenRouter API key |
| `OPENROUTER_BASE_URL` | No | `https://openrouter.ai/api/v1` | OpenAI-compatible base URL |
| `OPENROUTER_CHAT_MODEL` | Yes | - | Default gym chatbot model |
| `OPENROUTER_INSIGHT_MODEL` | Yes | - | Default business insight model |
| `OPENROUTER_REASONING_MODEL` | Yes | - | Unknown-exercise fallback model |
| `OPENROUTER_HTTP_REFERER` | No | - | Optional app URL for ranking and attribution |
| `OPENROUTER_APP_TITLE` | No | - | Optional app name header |

### OpenRouter Request Defaults

| Setting | Default | Notes |
|---------|---------|-------|
| Provider sort | `latency` | Default for chat and analytics requests |
| Allow fallbacks | `true` | Keep enabled for capstone resiliency |
| `require_parameters` | `true` | Required when using structured outputs |
| `data_collection` | `deny` | Default for grounded gym and business prompts |
| `zdr` | `true` when supported | Only enable when chosen provider path supports it |

### OpenRouter Reliability Rules

- Use OpenRouter's OpenAI-compatible request format instead of a custom provider payload.
- Favor low-latency instruct-capable models for `S16`.
- Favor consistency and structured-output reliability for `S17`, even if latency is slightly higher.
- `S15` may call OpenRouter only during unknown-exercise final classification after session finalize, never during live frame analysis.

## Model Provider Abstraction

```typescript
interface ChatModelProvider {
  generateGymReply(input: {
    message: string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    grounding: Record<string, unknown>
  }): Promise<{
    reply: string
    out_of_scope: boolean
    sources: string[]
    follow_up_suggestions: string[]
    model_used: string | null
    token_count: number | null
  }>

  generateBusinessInsight(input: {
    focus: string
    grounding: Record<string, unknown>
  }): Promise<{
    summary: string
    highlights: string[]
    risks: string[]
    opportunities: string[]
    recommended_actions: string[]
    model_used: string | null
    token_count: number | null
  }>

  classifyUnknownExercise(input: {
    pose_summary: Record<string, unknown>
    starter_catalog: string[]
  }): Promise<{
    canonical_name: string
    confidence: number
    reasoning_summary: string
  }>
}
```

### Provider Rules

- V1 uses OpenRouter as the default external provider adapter.
- Local OSS support is optional and must implement the same interface.
- Direct Groq or direct OpenAI adapters remain valid future options behind the same interface.
- Provider failures must never corrupt backend state - Nest persists only validated structured outputs.

## OpenRouter Adapter Contract

```typescript
interface OpenRouterChatModelProvider extends ChatModelProvider {
  generateGymReply(input: {
    message: string
    history: Array<{ role: 'user' | 'assistant'; content: string }>
    grounding: Record<string, unknown>
  }): Promise<{
    reply: string
    out_of_scope: boolean
    sources: string[]
    follow_up_suggestions: string[]
    model_used: string | null
    token_count: number | null
  }>

  generateBusinessInsight(input: {
    focus: string
    grounding: Record<string, unknown>
  }): Promise<{
    summary: string
    highlights: string[]
    risks: string[]
    opportunities: string[]
    recommended_actions: string[]
    model_used: string | null
    token_count: number | null
  }>

  classifyUnknownExercise(input: {
    pose_summary: Record<string, unknown>
    starter_catalog: string[]
  }): Promise<{
    canonical_name: string
    confidence: number
    reasoning_summary: string
  }>
}
```

## Structured Output Rules

- `S16` chatbot responses must be requested as strict JSON with: `reply`, `out_of_scope`, `sources`, `follow_up_suggestions`.
- `S17` insight responses must be requested as strict JSON with: `summary`, `highlights`, `risks`, `opportunities`, `anomaly_flags`, `recommended_actions`.
- `S15` unknown-exercise fallback must request strict JSON only during finalize-time classification and never in the live pose frame loop.

## Internal Naming Rules

- Python routes use nouns and action-specific subpaths only where session lifecycle requires them.
- Session identifiers are always generated by Nest and passed into Python.
- Python never invents its own persistent record IDs for backend-owned entities.

## Observability Rules

- Nest records latency, payload summaries, and failures in backend-owned logs/tables.
- Python logs inference timings and provider failures, but does not own business audit trails.
- Debug payloads must be opt-in and must not include raw image frames in persistent storage.
