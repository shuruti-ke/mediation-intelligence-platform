"""Case, Session, and Recording models."""
import uuid
from datetime import datetime, date
from sqlalchemy import String, Text, DateTime, ForeignKey, Boolean, Integer, Date
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Case(Base):
    """Mediation case."""

    __tablename__ = "cases"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    case_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, submitted, INTAKE, in_mediation, resolved, closed
    mediator_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    dispute_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    # Rich case fields
    internal_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    short_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    case_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    case_type_other: Mapped[str | None] = mapped_column(String(100), nullable=True)
    priority_level: Mapped[str | None] = mapped_column(String(20), nullable=True)
    tags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    detailed_narrative: Mapped[str | None] = mapped_column(Text, nullable=True)
    desired_outcome: Mapped[str | None] = mapped_column(Text, nullable=True)
    desired_outcome_structured: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    jurisdiction_country: Mapped[str | None] = mapped_column(String(10), nullable=True)
    jurisdiction_region: Mapped[str | None] = mapped_column(String(100), nullable=True)
    jurisdiction_county_state: Mapped[str | None] = mapped_column(String(100), nullable=True)
    applicable_laws: Mapped[str | None] = mapped_column(Text, nullable=True)
    cultural_considerations: Mapped[str | None] = mapped_column(Text, nullable=True)
    additional_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    confidentiality_level: Mapped[str | None] = mapped_column(String(30), nullable=True)
    estimated_duration: Mapped[str | None] = mapped_column(String(100), nullable=True)
    preferred_format: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    last_auto_save_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    sessions = relationship("MediationSession", back_populates="case")
    participants = relationship("CaseParticipant", back_populates="case")
    timeline_events = relationship("CaseTimelineEvent", back_populates="case", order_by="CaseTimelineEvent.sort_order")
    parties = relationship("CaseParty", back_populates="case", order_by="CaseParty.sort_order")
    external_links = relationship("CaseExternalLink", back_populates="case")


class CaseTimelineEvent(Base):
    """Timeline event for a case."""

    __tablename__ = "case_timeline_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    case = relationship("Case", back_populates="timeline_events")


class CaseParty(Base):
    """Party involved in a case (name, role, contact - separate from user-linked CaseParticipant)."""

    __tablename__ = "case_parties"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    whatsapp: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country_location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    language_preference: Mapped[str | None] = mapped_column(String(10), nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    relationship_to_case: Mapped[str | None] = mapped_column(String(100), nullable=True)
    relationship_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    accessibility_flags: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    case = relationship("Case", back_populates="parties")


class CaseExternalLink(Base):
    """External link (evidence, documents) for a case."""

    __tablename__ = "case_external_links"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    label: Mapped[str | None] = mapped_column(String(200), nullable=True)

    case = relationship("Case", back_populates="external_links")


class CaseParticipant(Base):
    """Case participant with consent flags (user-linked)."""

    __tablename__ = "case_participants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # party_a, party_b, mediator, observer
    consent_flags: Mapped[dict] = mapped_column(JSONB, default=dict)  # allow_recording, allow_ai, etc.
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    case = relationship("Case", back_populates="participants")


class MediationSession(Base):
    """Mediation session (video room)."""

    __tablename__ = "mediation_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    jitsi_room_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="SCHEDULED")  # SCHEDULED, ACTIVE, ENDED, CANCELLED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    case = relationship("Case", back_populates="sessions")
    recordings = relationship("SessionRecording", back_populates="session")


class SessionRecording(Base):
    """Session recording metadata."""

    __tablename__ = "session_recordings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("mediation_sessions.id"), nullable=False)
    storage_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    consent_confirmed: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    session = relationship("MediationSession", back_populates="recordings")
