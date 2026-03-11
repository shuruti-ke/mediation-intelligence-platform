"""Case and session schemas."""
from datetime import datetime, date
from uuid import UUID

from pydantic import BaseModel, Field


class CaseTimelineEventCreate(BaseModel):
    event_date: date
    description: str = Field(..., max_length=500)


class CasePartyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200)
    role: str  # complainant, respondent, witness, legal_rep, support_person
    phone: str | None = None
    email: str | None = None
    whatsapp: str | None = None
    country_location: str | None = None
    language_preference: str | None = None
    user_id: UUID | None = None
    relationship_to_case: str | None = None
    relationship_notes: str | None = None
    accessibility_flags: list[str] | None = None


class CaseExternalLinkCreate(BaseModel):
    url: str = Field(..., max_length=500)
    label: str | None = None


class CaseCreateRich(BaseModel):
    """Rich case creation. All optional for draft-first."""
    dispute_category: str | None = None  # legacy alias
    internal_reference: str | None = None
    title: str | None = Field(None, min_length=5, max_length=200)
    short_description: str | None = Field(None, min_length=10, max_length=500)
    case_type: str | None = None
    case_type_other: str | None = None
    priority_level: str | None = None
    tags: list[str] | None = None
    detailed_narrative: str | None = None
    desired_outcome: str | None = None
    desired_outcome_structured: list[str] | None = None
    jurisdiction_country: str | None = None
    jurisdiction_region: str | None = None
    jurisdiction_county_state: str | None = None
    applicable_laws: str | None = None
    cultural_considerations: str | None = None
    additional_notes: str | None = None
    assigned_mediator_id: UUID | None = None
    status: str = "draft"
    confidentiality_level: str | None = None
    estimated_duration: str | None = None
    preferred_format: list[str] | None = None
    timeline: list[CaseTimelineEventCreate] | None = None
    parties: list[CasePartyCreate] | None = None
    external_links: list[CaseExternalLinkCreate] | None = None


class CaseUpdate(BaseModel):
    """Partial update for draft/autosave."""
    internal_reference: str | None = None
    title: str | None = None
    short_description: str | None = None
    case_type: str | None = None
    case_type_other: str | None = None
    priority_level: str | None = None
    tags: list[str] | None = None
    detailed_narrative: str | None = None
    desired_outcome: str | None = None
    desired_outcome_structured: list[str] | None = None
    jurisdiction_country: str | None = None
    jurisdiction_region: str | None = None
    jurisdiction_county_state: str | None = None
    applicable_laws: str | None = None
    cultural_considerations: str | None = None
    additional_notes: str | None = None
    assigned_mediator_id: UUID | None = None
    status: str | None = None
    confidentiality_level: str | None = None
    estimated_duration: str | None = None
    preferred_format: list[str] | None = None
    timeline: list[CaseTimelineEventCreate] | None = None
    parties: list[CasePartyCreate] | None = None
    external_links: list[CaseExternalLinkCreate] | None = None


class CaseResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    case_number: str
    status: str
    mediator_id: UUID | None
    dispute_category: str | None
    created_at: datetime
    updated_at: datetime | None

    # Rich fields
    internal_reference: str | None = None
    title: str | None = None
    short_description: str | None = None
    case_type: str | None = None
    case_type_other: str | None = None
    priority_level: str | None = None
    tags: list | None = None
    detailed_narrative: str | None = None
    desired_outcome: str | None = None
    desired_outcome_structured: list | None = None
    jurisdiction_country: str | None = None
    jurisdiction_region: str | None = None
    jurisdiction_county_state: str | None = None
    applicable_laws: str | None = None
    cultural_considerations: str | None = None
    additional_notes: str | None = None
    confidentiality_level: str | None = None
    estimated_duration: str | None = None
    preferred_format: list | None = None
    last_auto_save_at: datetime | None = None

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
    jwt: str | None = None  # JaaS JWT when configured
    jaas_app_id: str | None = None  # For loading script from 8x8.vc/{app_id}/external_api.js
