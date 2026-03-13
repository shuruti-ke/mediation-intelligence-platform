"""Settlement agreement model - Phase 6a. E-signatures."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SettlementAgreement(Base):
    """Settlement agreement with e-signature support."""

    __tablename__ = "settlement_agreements"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    case_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("cases.id"), nullable=False)
    template_type: Mapped[str] = mapped_column(String(50), nullable=False)  # family, commercial, employment
    status: Mapped[str] = mapped_column(String(50), default="draft")  # draft, pending_signatures, signed
    content_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    signatures_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {party_id: {signed_at, ip, name}}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    case = relationship("Case", back_populates="settlement_agreements")
