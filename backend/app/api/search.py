"""Unified search API - Phase 3. Users and cases by User ID, name, email, phone, case number, internal reference."""
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case, CaseParty

router = APIRouter(prefix="/search", tags=["search"])


def _user_to_card(u: User) -> dict:
    return {
        "id": str(u.id),
        "type": "user",
        "display_name": u.display_name or u.email,
        "email": u.email,
        "user_id": getattr(u, "user_id", None),
        "role": u.role,
        "status": getattr(u, "status", "active") or "active",
        "phone": getattr(u, "phone", None),
        "country": getattr(u, "country", None),
        "last_login_at": u.last_login_at.isoformat() if getattr(u, "last_login_at", None) else None,
        "created_at": u.created_at.isoformat(),
    }


def _case_to_card(c) -> dict:
    return {
        "id": str(c.id),
        "type": "case",
        "case_number": c.case_number,
        "title": c.title or c.case_number,
        "status": c.status,
        "case_type": c.case_type or c.dispute_category,
        "internal_reference": c.internal_reference,
        "created_at": c.created_at.isoformat(),
    }


@router.get("")
async def unified_search(
    q: str = Query(..., min_length=2),
    role: str | None = Query(None, description="Filter users by role: client_individual, client_corporate, mediator, trainee"),
    status: str | None = Query(None, description="Filter users by status: active, inactive, pending"),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """
    Search users and cases. Results grouped by Users and Cases.
    - User ID: exact match
    - Name, email, phone: partial match
    - Case number, internal reference, title: partial match
    """
    term = f"%{q.strip()}%"
    exact_term = q.strip()

    # Users search (admins see all; mediators/trainees see assigned/submitted clients only; clients see none)
    user_q = select(User).where(User.role != "super_admin")
    if user.tenant_id:
        user_q = user_q.where(User.tenant_id == user.tenant_id)
    if user.role in ("mediator", "trainee"):
        user_q = user_q.where(
            or_(
                User.assigned_mediator_id == user.id,
                User.submitted_by_id == user.id,
            )
        )
    elif user.role in ("client_corporate", "client_individual"):
        user_q = user_q.where(False)  # Clients don't search other users
    if role:
        user_q = user_q.where(User.role == role)
    if status:
        user_q = user_q.where(User.status == status)
    user_conds = [
        User.user_id == exact_term,
        User.email.ilike(term),
        User.display_name.ilike(term),
    ]
    if hasattr(User, "phone"):
        user_conds.append(User.phone.ilike(term))
    user_q = user_q.where(or_(*user_conds))
    user_q = user_q.order_by(User.display_name.asc()).limit(limit)
    user_result = await db.execute(user_q)
    users = user_result.scalars().all()

    # Cases search
    case_q = select(Case)
    if user.tenant_id:
        case_q = case_q.where(Case.tenant_id == user.tenant_id)
    if user.role in ("mediator", "trainee"):
        case_q = case_q.where(Case.mediator_id == user.id)
    elif user.role in ("client_corporate", "client_individual"):
        client_user_id = getattr(user, "user_id", None)
        case_conds = [Case.id.in_(select(CaseParty.case_id).where(CaseParty.user_id == user.id))]
        if client_user_id:
            case_conds.append(Case.internal_reference == client_user_id)
        case_q = case_q.where(or_(*case_conds))
    case_q = case_q.where(
        or_(
            Case.case_number.ilike(term),
            Case.internal_reference.ilike(term),
            Case.title.ilike(term),
            Case.short_description.ilike(term),
        )
    )
    case_q = case_q.order_by(Case.updated_at.desc().nullslast()).limit(limit)
    case_result = await db.execute(case_q)
    cases = case_result.scalars().unique().all()

    return {
        "users": [_user_to_card(u) for u in users],
        "cases": [_case_to_card(c) for c in cases],
    }
