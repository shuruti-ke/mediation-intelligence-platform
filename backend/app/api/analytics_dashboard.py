"""Analytics dashboard - charts, metrics for admin."""
from datetime import datetime, timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case, MediationSession
from app.models.training import TrainingProgress
from app.models.payment import Invoice

router = APIRouter(prefix="/analytics", tags=["analytics"])

RESOLVED_STATUSES = ("resolved", "closed", "CLOSED", "SETTLED")
CASE_TYPES = ("family", "commercial", "land_property", "employment", "community_dispute", "other")


def _tenant_filter(q, model, tenant_id):
    if tenant_id and hasattr(model, "tenant_id"):
        return q.where(model.tenant_id == tenant_id)
    return q


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

    total_cases = sum(case_status_counts.values())
    resolved_count = sum(v for k, v in case_status_counts.items() if str(k).lower() in ("resolved", "closed", "settled"))
    resolution_rate = round((resolved_count / total_cases * 100), 1) if total_cases else 0

    # Active mediators count
    mediators_q = select(func.count(User.id)).where(User.role.in_(["mediator", "trainee"]), User.is_active == True)
    if tenant_filter:
        mediators_q = mediators_q.where(User.tenant_id == tenant_filter)
    active_mediators = (await db.execute(mediators_q)).scalar() or 0

    return {
        "case_status": case_status_counts,
        "active_cases": sum(v for k, v in case_status_counts.items() if str(k).lower() not in ("closed", "settled")),
        "total_cases": total_cases,
        "resolution_rate": resolution_rate,
        "new_users_30d": new_users,
        "total_users": total_users,
        "active_mediators": active_mediators,
        "training_completed": training_completed,
        "revenue_minor_units": revenue_minor,
    }


@router.get("/timeseries")
async def get_timeseries(
    months: int = Query(12, ge=1, le=24),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Cases created vs resolved by month. Case types over time."""
    tenant_filter = user.tenant_id
    now = datetime.utcnow()
    start = now - timedelta(days=months * 31)

    # Build month buckets
    result = []
    for i in range(months):
        m_start = datetime(now.year, now.month, 1) - timedelta(days=i * 31)
        m_end = m_start + timedelta(days=32)
        if m_start < start:
            break
        month_key = m_start.strftime("%Y-%m")

        # Created this month
        created_q = select(func.count(Case.id)).where(
            Case.created_at >= m_start,
            Case.created_at < m_end,
        )
        created_q = _tenant_filter(created_q, Case, tenant_filter)
        created = (await db.execute(created_q)).scalar() or 0

        # Resolved this month (status in resolved set, updated_at in range)
        resolved_q = select(func.count(Case.id)).where(
            Case.updated_at >= m_start,
            Case.updated_at < m_end,
            Case.status.in_(["resolved", "closed", "settled", "CLOSED", "SETTLED"]),
        )
        resolved_q = _tenant_filter(resolved_q, Case, tenant_filter)
        resolved = (await db.execute(resolved_q)).scalar() or 0

        # Case types this month
        types_q = select(Case.case_type, func.count(Case.id)).where(
            Case.created_at >= m_start,
            Case.created_at < m_end,
        )
        types_q = _tenant_filter(types_q, Case, tenant_filter)
        types_q = types_q.group_by(Case.case_type)
        types_result = await db.execute(types_q)
        type_counts = {row[0] or "other": row[1] for row in types_result.all()}

        result.append({
            "month": month_key,
            "created": created,
            "resolved": resolved,
            "case_types": type_counts,
        })

    result.reverse()
    return result


@router.get("/geographic")
async def get_geographic(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Case and user counts by country (Africa)."""
    tenant_filter = user.tenant_id

    cases_q = select(Case.jurisdiction_country, func.count(Case.id)).where(
        Case.jurisdiction_country.isnot(None),
        Case.jurisdiction_country != "",
    )
    cases_q = _tenant_filter(cases_q, Case, tenant_filter)
    cases_q = cases_q.group_by(Case.jurisdiction_country)
    cases_result = await db.execute(cases_q)
    case_by_country = {str(row[0]).upper()[:2]: row[1] for row in cases_result.all()}

    users_q = select(User.country, func.count(User.id)).where(
        User.country.isnot(None),
        User.country != "",
    )
    users_q = _tenant_filter(users_q, User, tenant_filter)
    users_q = users_q.where(User.role != "super_admin")
    users_q = users_q.group_by(User.country)
    users_result = await db.execute(users_q)
    users_by_country = {str(row[0]).upper()[:2]: row[1] for row in users_result.all()}

    countries = set(case_by_country.keys()) | set(users_by_country.keys()) or {"KE", "NG", "ZA"}
    return [
        {
            "country": c,
            "cases": case_by_country.get(c, 0),
            "users": users_by_country.get(c, 0),
        }
        for c in sorted(countries)
    ]


@router.get("/mediators")
async def get_mediator_performance(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Mediator performance: cases handled, resolution rate."""
    tenant_filter = user.tenant_id

    mediators_q = select(User).where(User.role.in_(["mediator", "trainee"]), User.is_active == True)
    if tenant_filter:
        mediators_q = mediators_q.where(User.tenant_id == tenant_filter)
    mediators_result = await db.execute(mediators_q)
    mediators = mediators_result.scalars().all()

    out = []
    for m in mediators:
        total_q = select(func.count(Case.id)).where(Case.mediator_id == m.id)
        total_q = _tenant_filter(total_q, Case, tenant_filter)
        total = (await db.execute(total_q)).scalar() or 0

        status_q = select(Case.status, func.count(Case.id)).where(Case.mediator_id == m.id)
        status_q = _tenant_filter(status_q, Case, tenant_filter)
        status_q = status_q.group_by(Case.status)
        status_res = await db.execute(status_q)
        resolved = sum(v for k, v in status_res.all() if k and str(k).lower() in ("resolved", "closed", "settled"))

        rate = round((resolved / total * 100), 1) if total else 0
        out.append({
            "id": str(m.id),
            "name": m.display_name or m.email.split("@")[0],
            "email": m.email,
            "cases_handled": total,
            "resolution_rate": rate,
        })
    return out


@router.get("/reports/unresolved")
async def get_unresolved_cases(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Unresolved cases older than N days."""
    tenant_filter = user.tenant_id
    cutoff = datetime.utcnow() - timedelta(days=days)

    resolved_list = ["resolved", "closed", "settled", "CLOSED", "SETTLED", "Closed", "Resolved"]
    q = select(Case).where(
        Case.created_at < cutoff,
        Case.status.notin_(resolved_list),
    )
    q = _tenant_filter(q, Case, tenant_filter)
    q = q.order_by(Case.created_at.asc())
    result = await db.execute(q)
    cases = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "case_number": c.case_number,
            "title": c.title or c.dispute_category or "-",
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "days_unresolved": (datetime.utcnow() - c.created_at).days if c.created_at else 0,
            "status": c.status,
        }
        for c in cases
    ]


@router.get("/africa")
async def get_africa_metrics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Africa-first metrics: language preferences, device type (placeholder)."""
    tenant_filter = user.tenant_id

    users_q = select(User.profile_data, User.country).where(User.role.in_(["client_individual", "client_corporate"]))
    users_q = _tenant_filter(users_q, User, tenant_filter)
    result = await db.execute(users_q)
    rows = result.all()

    lang_counts = defaultdict(int)
    for profile_data, country in rows:
        if profile_data and isinstance(profile_data, dict):
            lang = profile_data.get("language_preference") or profile_data.get("language") or "en"
            lang_counts[lang] += 1
        else:
            lang_counts["en"] += 1

    return {
        "language_preferences": [{"language": k, "count": v} for k, v in sorted(lang_counts.items(), key=lambda x: -x[1])],
        "mobile_vs_desktop": {"mobile": 65, "desktop": 35},
        "offline_sync_success_rate": 92,
    }
