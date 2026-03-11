"""Analytics dashboard - charts, metrics for admin."""
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case
from app.models.training import TrainingProgress
from app.models.payment import Invoice

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/dashboard")
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Dashboard metrics: active cases, revenue, user growth, training completion."""
    tenant_filter = user.tenant_id
    now = datetime.utcnow()
    thirty_days_ago = now - timedelta(days=30)

    # Active cases by status
    cases_q = select(Case.status, func.count(Case.id)).group_by(Case.status)
    if tenant_filter:
        cases_q = cases_q.where(Case.tenant_id == tenant_filter)
    cases_result = await db.execute(cases_q)
    case_status_counts = {row[0]: row[1] for row in cases_result.all()}

    # User growth (last 30 days)
    users_q = select(func.count(User.id)).where(User.created_at >= thirty_days_ago)
    if tenant_filter:
        users_q = users_q.where(User.tenant_id == tenant_filter)
    users_q = users_q.where(User.role != "super_admin")
    new_users = (await db.execute(users_q)).scalar() or 0

    # Total users
    total_q = select(func.count(User.id)).where(User.role != "super_admin")
    if tenant_filter:
        total_q = total_q.where(User.tenant_id == tenant_filter)
    total_users = (await db.execute(total_q)).scalar() or 0

    # Training completion
    completed_q = select(func.count(TrainingProgress.id)).where(TrainingProgress.completed == True)
    training_completed = (await db.execute(completed_q)).scalar() or 0

    # Revenue (from invoices)
    revenue_q = select(func.coalesce(func.sum(Invoice.amount_minor_units), 0)).where(Invoice.status == "PAID")
    if tenant_filter:
        revenue_q = revenue_q.where(Invoice.tenant_id == tenant_filter)
    revenue_minor = (await db.execute(revenue_q)).scalar() or 0

    return {
        "case_status": case_status_counts,
        "active_cases": sum(v for k, v in case_status_counts.items() if k not in ("CLOSED", "SETTLED")),
        "total_cases": sum(case_status_counts.values()),
        "new_users_30d": new_users,
        "total_users": total_users,
        "training_completed": training_completed,
        "revenue_minor_units": revenue_minor,
    }
