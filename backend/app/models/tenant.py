"""Tenant and User models."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Tenant(Base):
    """Multi-tenant organization."""

    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_residency_region: Mapped[str] = mapped_column(String(50), nullable=False)
    isolation_level: Mapped[str] = mapped_column(String(50), default="SHARED_LOGICAL")
    commercial_config: Mapped[dict] = mapped_column(JSONB, default=dict)  # branding, payment_methods_enabled, ai_features_enabled
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    users = relationship("User", back_populates="tenant")


class User(Base):
    """Platform user with role-based access."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # super_admin, mediator, trainee, client_corporate, client_individual
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, active, inactive
    onboarded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)

    # Intake & profile (Stage 1)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    country: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # Progressive profile (Stage 2)
    profile_data: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Mediator assignment (clients only)
    assigned_mediator_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    profile_complete_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # User ID: USR-{COUNTRY}-{YEAR}-{SEQ}, generated on approval
    user_id: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True, index=True)
    # Approval: pending_approval, approved, rejected, on_hold
    approval_status: Mapped[str | None] = mapped_column(String(30), default="approved")  # legacy users
    approval_rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    approval_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)  # admin notes for on_hold
    # Who submitted this client for approval (mediator)
    submitted_by_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    # Force password change on first login
    must_change_password: Mapped[bool] = mapped_column(default=False)
    # Soft delete
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Deactivation reason (stored when admin deactivates)
    deactivation_reason: Mapped[str | None] = mapped_column(String(100), nullable=True)

    tenant = relationship("Tenant", back_populates="users")
