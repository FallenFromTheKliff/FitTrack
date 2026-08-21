from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ServiceError(Exception):
    type: str
    title: str
    status: int
    detail: str

    def to_payload(self) -> dict[str, object]:
        return {
            "type": self.type,
            "title": self.title,
            "status": self.status,
            "detail": self.detail,
        }
