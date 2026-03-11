"""Billing and usage schemas."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UsageSummary(BaseModel):
    sessions: int = 0
    recording_minutes: float = 0
    ai_queries: int = 0
    ai_tokens: int = 0
    storage_gb: float = 0
    period_start: datetime | None = None
    period_end: datetime | None = None
