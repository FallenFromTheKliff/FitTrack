from __future__ import annotations

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.errors import ServiceError


def create_app() -> FastAPI:
    app = FastAPI(title="FitTrack AI Microservice", version="0.1.0")
    app.include_router(router)

    @app.exception_handler(ServiceError)
    async def service_error_handler(_: object, exc: ServiceError) -> JSONResponse:
        return JSONResponse(status_code=exc.status, content=exc.to_payload())

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(
        _: object,
        exc: RequestValidationError,
    ) -> JSONResponse:
        detail = "; ".join(
            f"{'.'.join(str(item) for item in error['loc'])}: {error['msg']}"
            for error in exc.errors()
        )
        return JSONResponse(
            status_code=422,
            content={
                "type": "INVALID_REQUEST",
                "title": "Invalid Request",
                "status": 422,
                "detail": detail or "Request validation failed.",
            },
        )

    return app


app = create_app()
