"""Case and session schemas."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CaseCreate(BaseModel):
    dispute_category: str | None = None


class CaseResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    case_number: str
    status: str
    mediator_id: UUID | None
    dispute_category: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class SessionCreate(BaseModel):
    case_id: UUID
    scheduled_at: datetime | None = None


class SessionResponse(BaseModel):
    id: UUID
    case_id: UUID
    scheduled_at: datetime | None
    started_at: datetime | None
    ended_at: datetime | None
    jitsi_room_name: str | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class JitsiRoomResponse(BaseModel):
    room_name: str
    jitsi_domain: str
    jwt: str | None = None  # JaaS JWT when JITSI_APP_ID/SECRET configured
