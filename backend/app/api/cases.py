"""Case management routes."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case, CaseTimelineEvent, CaseParty, CaseExternalLink
from app.schemas.case import CaseCreateRich, CaseUpdate, CaseResponse
from app.services.audit import log_audit

router = APIRouter(prefix="/cases", tags=["cases"])


@router.get("/locations")
async def get_locations(country: str = Query("KE", max_length=2)):
    """Get region/county options for country-aware form. country=KE|NG|ZA."""
    from app.data.locations import LOCATIONS, DEFAULT
    c = country.upper()[:2]
    data = LOCATIONS.get(c, DEFAULT)
    return JSONResponse(content=data)


def _next_case_number(db_sync, country: str = "KE") -> str:
    """Generate MED-{COUNTRY}-{YEAR}-{SEQ}."""
    year = datetime.utcnow().year
    # Count cases with this country+year pattern (case_number like MED-XX-YYYY-%)
    from sqlalchemy import text
    result = db_sync.execute(
        text("SELECT COALESCE(MAX(CAST(SUBSTRING(case_number FROM 14) AS INTEGER)), 0) + 1 FROM cases WHERE case_number LIKE :pat"),
        {"pat": f"MED-{country}-{year}-%"}
    )
    seq = result.scalar() or 1
    return f"MED-{country}-{year}-{seq:04d}"


async def _generate_case_number(db: AsyncSession, country: str = "KE") -> str:
    """Generate next case number for country+year."""
    year = datetime.utcnow().year
    result = await db.execute(
        select(func.count(Case.id)).where(
            Case.case_number.like(f"MED-{country}-{year}-%")
        )
    )
    count = result.scalar() or 0
    return f"MED-{country}-{year}-{count + 1:04d}"


def _apply_case_update(case: Case, data: dict):
    """Apply update dict to case, excluding None."""
    for k, v in data.items():
        if v is not None and hasattr(case, k):
            setattr(case, k, v)


@router.post("", response_model=CaseResponse)
async def create_case(
    data: CaseCreateRich,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator", "trainee")),
) -> Case:
    """Create new case. All fields optional for draft-first flow."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="User must belong to a tenant")

    # Rich create (minimal or full)
    country = (data.jurisdiction_country or "KE").upper()[:2]
    case_number = await _generate_case_number(db, country)

    case = Case(
        tenant_id=user.tenant_id,
        case_number=case_number,
        dispute_category=data.dispute_category or data.case_type or data.case_type_other,
        status=data.status or "draft",
        mediator_id=data.assigned_mediator_id,
        created_by_id=user.id,
        internal_reference=data.internal_reference,
        title=data.title,
        short_description=data.short_description,
        case_type=data.case_type,
        case_type_other=data.case_type_other,
        priority_level=data.priority_level,
        tags={"tags": data.tags} if data.tags else None,
        detailed_narrative=data.detailed_narrative,
        desired_outcome=data.desired_outcome,
        desired_outcome_structured={"items": data.desired_outcome_structured} if data.desired_outcome_structured else None,
        jurisdiction_country=data.jurisdiction_country,
        jurisdiction_region=data.jurisdiction_region,
        jurisdiction_county_state=data.jurisdiction_county_state,
        applicable_laws=data.applicable_laws,
        cultural_considerations=data.cultural_considerations,
        additional_notes=data.additional_notes,
        confidentiality_level=data.confidentiality_level,
        estimated_duration=data.estimated_duration,
        preferred_format={"formats": data.preferred_format} if data.preferred_format else None,
    )
    db.add(case)
    await db.flush()

    if data.timeline:
        for i, ev in enumerate(data.timeline):
            db.add(CaseTimelineEvent(case_id=case.id, event_date=ev.event_date, description=ev.description, sort_order=i))
    if data.parties:
        for i, p in enumerate(data.parties):
            db.add(CaseParty(
                case_id=case.id, name=p.name, role=p.role, phone=p.phone, email=p.email,
                whatsapp=p.whatsapp, country_location=p.country_location, language_preference=p.language_preference,
                user_id=p.user_id, relationship_to_case=p.relationship_to_case, relationship_notes=p.relationship_notes,
                accessibility_flags={"flags": p.accessibility_flags} if p.accessibility_flags else None,
                sort_order=i,
            ))
    if data.external_links:
        for link in data.external_links:
            db.add(CaseExternalLink(case_id=case.id, url=link.url, label=link.label))

    await db.flush()
    await db.refresh(case)
    return case


@router.patch("/{case_id}", response_model=CaseResponse)
async def update_case(
    case_id: uuid.UUID,
    data: CaseUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator", "trainee")),
) -> Case:
    """Update case (draft/autosave)."""
    result = await db.execute(select(Case).where(Case.id == case_id))
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Apply scalar updates
    update_data = data.model_dump(exclude_unset=True)
    timeline = update_data.pop("timeline", None)
    parties = update_data.pop("parties", None)
    external_links = update_data.pop("external_links", None)

    for k, v in update_data.items():
        if hasattr(case, k):
            if k == "assigned_mediator_id":
                setattr(case, "mediator_id", v)
            elif k == "desired_outcome_structured" and v is not None:
                setattr(case, k, {"items": v} if isinstance(v, list) else v)
            elif k == "preferred_format" and v is not None:
                setattr(case, k, {"formats": v} if isinstance(v, list) else v)
            elif k == "tags" and v is not None:
                setattr(case, k, {"tags": v} if isinstance(v, list) else v)
            else:
                setattr(case, k, v)

    case.last_auto_save_at = datetime.utcnow()

    if timeline is not None:
        await db.execute(delete(CaseTimelineEvent).where(CaseTimelineEvent.case_id == case_id))
        for i, ev in enumerate(timeline):
            db.add(CaseTimelineEvent(case_id=case.id, event_date=ev.event_date, description=ev.description, sort_order=i))
    if parties is not None:
        await db.execute(delete(CaseParty).where(CaseParty.case_id == case_id))
        for i, p in enumerate(parties):
            db.add(CaseParty(
                case_id=case.id, name=p.name, role=p.role, phone=p.phone, email=p.email,
                whatsapp=p.whatsapp, country_location=p.country_location, language_preference=p.language_preference,
                user_id=p.user_id, relationship_to_case=p.relationship_to_case, relationship_notes=p.relationship_notes,
                accessibility_flags={"flags": p.accessibility_flags} if p.accessibility_flags else None,
                sort_order=i,
            ))
    if external_links is not None:
        await db.execute(delete(CaseExternalLink).where(CaseExternalLink.case_id == case_id))
        for link in external_links:
            db.add(CaseExternalLink(case_id=case.id, url=link.url, label=link.label))

    await db.flush()
    await db.refresh(case)
    return case


@router.get("", response_model=list[CaseResponse])
async def list_cases(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    status: str | None = Query(None),
    mediator_id: uuid.UUID | None = Query(None, description="Filter by mediator (mediators see own by default)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
) -> list[CaseResponse]:
    """List cases. Filtered by tenant. Mediators see own cases when mediator_id not specified."""
    q = select(Case)
    if user.tenant_id:
        q = q.where(Case.tenant_id == user.tenant_id)
    if status:
        q = q.where(Case.status == status)
    if user.role in ("mediator", "trainee"):
        q = q.where(Case.mediator_id == user.id)
    elif mediator_id:
        q = q.where(Case.mediator_id == mediator_id)
    q = q.order_by(Case.updated_at.desc().nullslast(), Case.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(q)
    cases = result.scalars().unique().all()
    return [CaseResponse.model_validate(c) for c in cases]


@router.get("/{case_id}")
async def get_case(
    case_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get case by ID. Tenant-isolated. Includes timeline, parties, external_links."""
    result = await db.execute(
        select(Case)
        .where(Case.id == case_id)
        .options(
            selectinload(Case.timeline_events),
            selectinload(Case.parties),
            selectinload(Case.external_links),
        )
    )
    case = result.scalar_one_or_none()
    if not case:
        raise HTTPException(status_code=404, detail="Case not found")
    if user.tenant_id and case.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    await log_audit(
        db, "CASE_VIEW", "case", str(case_id),
        tenant_id=user.tenant_id, user_id=user.id, request=request,
    )
    resp = CaseResponse.model_validate(case).model_dump()
    resp["timeline"] = [{"event_date": str(e.event_date), "description": e.description} for e in case.timeline_events]
    resp["parties"] = [
        {
            "name": p.name, "role": p.role, "phone": p.phone, "email": p.email,
            "whatsapp": p.whatsapp, "country_location": p.country_location,
            "language_preference": p.language_preference, "relationship_to_case": p.relationship_to_case,
        }
        for p in case.parties
    ]
    resp["external_links"] = [{"url": l.url, "label": l.label} for l in case.external_links]
    return resp
