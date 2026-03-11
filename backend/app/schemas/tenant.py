"""Tenant schemas."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TenantResponse(BaseModel):
    id: UUID
    name: str
    data_residency_region: str
    isolation_level: str
    commercial_config: dict
    created_at: datetime

    class Config:
        from_attributes = True
