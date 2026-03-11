"""Case management routes."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case
from app.schemas.case import CaseCreate, CaseResponse
from app.services.audit import log_audit

router = APIRouter(prefix="/cases", tags=["cases"])


@router.post("", response_model=CaseResponse)
async def create_case(
    data: CaseCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator", "trainee")),
) -> Case:
    """Create new case. Case number auto-generated."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")
    # Sync for case number - in async we need to run in same session
    case_number = f"MED-{datetime.utcnow().year}-{uuid.uuid4().hex[:4].upper()}"
    case = Case(
        tenant_id=user.tenant_id,
        case_number=case_number,
        dispute_category=data.dispute_category,
        status="INTAKE",
    )
    db.add(case)
    await db.flush()
    # Ensure unique - simple approach for MVP
    existing_result = await db.execute(select(Case).where(Case.case_number == case_number))
    existing_case = existing_result.scalar_one_or_none()
    if existing_case and existing_case != case:
        case.case_number = f"MED-{datetime.utcnow().year}-{uuid.uuid4().hex[:6].upper()}"
    await db.refresh(case)
    return case


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    status: str | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[CaseResponse]:
    """List cases. Filtered by tenant. Mediators see assigned cases."""
    q = select(Case)
    if user.tenant_id:
        q = q.where(Case.tenant_id == user.tenant_id)
    if status:
        q = q.where(Case.status == status)
    q = q.order_by(Case.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    cases = result.scalars().unique().all()
    # Convert to Pydantic before returning to avoid ResourceClosedError when session closes
    return [CaseResponse.model_validate(c) for c in cases]


@router.get("/{case_id}", response_model=CaseResponse)
async def get_case(
    case_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Case:
    """Get case by ID. Tenant-isolated."""
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    await log_audit(
        db, "CASE_VIEW", "case", str(case_id),
        tenant_id=user.tenant_id, user_id=user.id, request=request,
    )
    return case
