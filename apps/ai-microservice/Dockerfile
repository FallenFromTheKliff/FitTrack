FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV UV_LINK_MODE=copy
ENV UV_PROJECT_ENVIRONMENT=/app/.venv
ENV PATH=/app/.venv/bin:$PATH

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:0.8.17 /uv /uvx /bin/

RUN addgroup --system --gid 1001 python \
    && adduser --system --uid 1001 aiuser --ingroup python

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY --chown=aiuser:python app ./app

USER aiuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
