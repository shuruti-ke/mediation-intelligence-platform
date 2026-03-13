"""Settlement agreements - Phase 6a. E-signatures."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case
from app.models.settlement import SettlementAgreement
from app.api.settlement_templates import TEMPLATES

router = APIRouter(prefix="/settlements", tags=["settlements"])


def _get_template(template_type: str) -> dict:
    t = TEMPLATES.get(template_type)
    if not t:
        raise HTTPException(status_code=400, detail=f"Invalid template_type. Must be one of: family, commercial, employment")
    return t


async def _verify_case_access(db: AsyncSession, case_id: uuid.UUID, user: User) -> Case | None:
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case or (user.tenant_id and case.tenant_id != user.tenant_id):
        return None
    return case


class SettlementCreate(BaseModel):
    case_id: uuid.UUID
    template_type: str  # family, commercial, employment


class SettlementUpdate(BaseModel):
    content_json: dict | None = None


class RequestSignatureBody(BaseModel):
    party_ids: list[str]  # party_a, party_b, etc.


class SignBody(BaseModel):
    party_id: str  # party_a, party_b, etc.
    signer_name: str


@router.post("")
async def create_settlement(
    data: SettlementCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Create settlement from template."""
    case = await _verify_case_access(db, data.case_id, user)
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    template = _get_template(data.template_type)
    content = {**template, "sections": [s.copy() for s in template["sections"]]}
    settlement = SettlementAgreement(
        case_id=data.case_id,
        template_type=data.template_type,
        status="draft",
        content_json=content,
    )
    db.add(settlement)
    await db.flush()
    await db.refresh(settlement)
    return {
        "id": str(settlement.id),
        "case_id": str(settlement.case_id),
        "template_type": settlement.template_type,
        "status": settlement.status,
        "content_json": settlement.content_json,
        "created_at": settlement.created_at.isoformat(),
    }


@router.get("")
async def list_settlements(
    case_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List settlements, optionally filtered by case_id."""
    q = select(SettlementAgreement).join(Case, SettlementAgreement.case_id == Case.id)
    if user.tenant_id:
        q = q.where(Case.tenant_id == user.tenant_id)
    if case_id:
        q = q.where(SettlementAgreement.case_id == case_id)
    q = q.order_by(SettlementAgreement.created_at.desc()).limit(100)
    result = await db.execute(q)
    items = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "case_id": str(s.case_id),
            "template_type": s.template_type,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
            "signed_at": s.signed_at.isoformat() if s.signed_at else None,
        }
        for s in items
    ]


@router.get("/{settlement_id}")
async def get_settlement(
    settlement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get settlement by ID."""
    result = await db.execute(
        select(SettlementAgreement, Case).join(Case, SettlementAgreement.case_id == Case.id).where(SettlementAgreement.id == settlement_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Settlement not found")
    settlement, case = row
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": str(settlement.id),
        "case_id": str(settlement.case_id),
        "template_type": settlement.template_type,
        "status": settlement.status,
        "content_json": settlement.content_json,
        "signatures_json": settlement.signatures_json,
        "created_at": settlement.created_at.isoformat(),
        "signed_at": settlement.signed_at.isoformat() if settlement.signed_at else None,
    }


@router.patch("/{settlement_id}")
async def update_settlement(
    settlement_id: uuid.UUID,
    data: SettlementUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Update settlement content. Only when status is draft."""
    result = await db.execute(
        select(SettlementAgreement, Case).join(Case, SettlementAgreement.case_id == Case.id).where(SettlementAgreement.id == settlement_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Settlement not found")
    settlement, case = row
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if settlement.status != "draft":
        raise HTTPException(status_code=400, detail="Can only update draft settlements")
    if data.content_json is not None:
        settlement.content_json = data.content_json
    await db.flush()
    await db.refresh(settlement)
    return {
        "id": str(settlement.id),
        "status": settlement.status,
        "content_json": settlement.content_json,
    }


@router.post("/{settlement_id}/request-signature")
async def request_signature(
    settlement_id: uuid.UUID,
    body: RequestSignatureBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Request signatures from parties. Moves status to pending_signatures."""
    result = await db.execute(
        select(SettlementAgreement, Case).join(Case, SettlementAgreement.case_id == Case.id).where(SettlementAgreement.id == settlement_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Settlement not found")
    settlement, case = row
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if settlement.status != "draft":
        raise HTTPException(status_code=400, detail="Can only request signatures for draft settlements")
    settlement.status = "pending_signatures"
    settlement.signatures_json = {pid: None for pid in body.party_ids}
    await db.flush()
    return {"status": "pending_signatures", "party_ids": body.party_ids}


@router.post("/{settlement_id}/sign")
async def sign_settlement(
    settlement_id: uuid.UUID,
    body: SignBody,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """E-sign the settlement. Stores signature in signatures_json."""
    result = await db.execute(
        select(SettlementAgreement, Case).join(Case, SettlementAgreement.case_id == Case.id).where(SettlementAgreement.id == settlement_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Settlement not found")
    settlement, case = row
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if settlement.status not in ("draft", "pending_signatures"):
        raise HTTPException(status_code=400, detail="Settlement already signed")
    sigs = settlement.signatures_json or {}
    if body.party_id not in sigs and settlement.status == "pending_signatures":
        sigs = dict(sigs)
    sigs[body.party_id] = {
        "signed_at": datetime.utcnow().isoformat(),
        "ip": request.client.host if request.client else None,
        "name": body.signer_name,
        "user_id": str(user.id),
    }
    settlement.signatures_json = sigs
    # Check if all parties have signed (when pending_signatures)
    if settlement.status == "pending_signatures":
        pending = [k for k, v in sigs.items() if v is None]
        if not pending:
            settlement.status = "signed"
            settlement.signed_at = datetime.utcnow()
    await db.flush()
    await db.refresh(settlement)
    return {
        "id": str(settlement.id),
        "status": settlement.status,
        "signatures_json": settlement.signatures_json,
        "signed_at": settlement.signed_at.isoformat() if settlement.signed_at else None,
    }
