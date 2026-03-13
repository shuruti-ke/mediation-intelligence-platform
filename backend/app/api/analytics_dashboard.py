"""Analytics dashboard - charts, metrics for admin."""
from datetime import datetime, timedelta
from collections import defaultdict
from io import BytesIO

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, extract

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case, MediationSession
from app.models.training import TrainingProgress
from app.models.payment import Invoice
from app.models.audit import AuditLog

router = APIRouter(prefix="/analytics", tags=["analytics"])

RESOLVED_STATUSES = ("resolved", "closed", "CLOSED", "SETTLED")
CASE_TYPES = ("family", "commercial", "land_property", "employment", "community_dispute", "other")


def _tenant_filter(q, model, tenant_id):
    if tenant_id and hasattr(model, "tenant_id"):
        return q.where(model.tenant_id == tenant_id)
    return q


@router.get("/dashboard")
async def get_dashboard_metrics(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Dashboard metrics: active cases, revenue, user growth, training completion. Supports date range."""
    tenant_filter = user.tenant_id
    now = datetime.utcnow()
    period_start = now - timedelta(days=days)
    prev_period_start = now - timedelta(days=days * 2)

    # Active cases by status
    cases_q = select(Case.status, func.count(Case.id)).group_by(Case.status)
    if tenant_filter:
        cases_q = cases_q.where(Case.tenant_id == tenant_filter)
    cases_result = await db.execute(cases_q)
    case_status_counts = {row[0]: row[1] for row in cases_result.all()}

    # User growth (last N days)
    users_q = select(func.count(User.id)).where(User.created_at >= period_start)
    if tenant_filter:
        users_q = users_q.where(User.tenant_id == tenant_filter)
    users_q = users_q.where(User.role != "super_admin")
    new_users = (await db.execute(users_q)).scalar() or 0

    # Previous period new users (for trend)
    prev_users_q = select(func.count(User.id)).where(
        User.created_at >= prev_period_start,
        User.created_at < period_start,
    )
    if tenant_filter:
        prev_users_q = prev_users_q.where(User.tenant_id == tenant_filter)
    prev_users_q = prev_users_q.where(User.role != "super_admin")
    prev_new_users = (await db.execute(prev_users_q)).scalar() or 0

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
    active_cases = sum(v for k, v in case_status_counts.items() if str(k).lower() not in ("closed", "settled"))

    # Active mediators count (excludes trainees - they are not practicing mediators)
    mediators_q = select(func.count(User.id)).where(User.role == "mediator", User.is_active == True)
    if tenant_filter:
        mediators_q = mediators_q.where(User.tenant_id == tenant_filter)
    active_mediators = (await db.execute(mediators_q)).scalar() or 0

    # Active trainees count
    trainees_q = select(func.count(User.id)).where(User.role == "trainee", User.is_active == True)
    if tenant_filter:
        trainees_q = trainees_q.where(User.tenant_id == tenant_filter)
    active_trainees = (await db.execute(trainees_q)).scalar() or 0

    # Trend: new users vs previous period
    new_users_trend = (new_users - prev_new_users) if prev_new_users else (new_users if new_users else 0)

    return {
        "case_status": case_status_counts,
        "active_cases": active_cases,
        "total_cases": total_cases,
        "resolution_rate": resolution_rate,
        "new_users_30d": new_users,
        "new_users_trend": new_users_trend,
        "total_users": total_users,
        "active_mediators": active_mediators,
        "active_trainees": active_trainees,
        "training_completed": training_completed,
        "revenue_minor_units": revenue_minor,
        "period_days": days,
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
    """Mediator performance: cases handled, resolution rate. Excludes trainees."""
    tenant_filter = user.tenant_id

    mediators_q = select(User).where(User.role == "mediator", User.is_active == True)
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


@router.get("/drill-down/active-cases")
async def get_active_cases_list(
    days: int = Query(90, ge=1, le=365),
    status: str | None = Query(None),
    case_type: str | None = Query(None),
    mediator_id: str | None = Query(None),
    country: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """List active cases for drill-down. Supports filters."""
    tenant_filter = user.tenant_id
    cutoff = datetime.utcnow() - timedelta(days=days)
    q = select(Case).where(Case.created_at >= cutoff)
    resolved_list = ["resolved", "closed", "settled", "CLOSED", "SETTLED"]
    q = q.where(~Case.status.in_(resolved_list))
    if tenant_filter:
        q = q.where(Case.tenant_id == tenant_filter)
    if status:
        q = q.where(Case.status == status)
    if case_type:
        q = q.where(Case.case_type == case_type)
    if mediator_id:
        q = q.where(Case.mediator_id == mediator_id)
    if country:
        q = q.where(Case.jurisdiction_country == country)
    q = q.order_by(Case.updated_at.desc())
    result = await db.execute(q)
    cases = result.scalars().all()
    return [
        {
            "id": str(c.id),
            "case_number": c.case_number,
            "title": c.title or c.dispute_category or "-",
            "case_type": c.case_type or "other",
            "status": c.status,
            "mediator_id": str(c.mediator_id) if c.mediator_id else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "updated_at": c.updated_at.isoformat() if c.updated_at else None,
            "days_active": (datetime.utcnow() - (c.updated_at or c.created_at)).days if c.updated_at or c.created_at else 0,
        }
        for c in cases
    ]


@router.get("/drill-down/new-users")
async def get_new_users_list(
    days: int = Query(30, ge=1, le=365),
    country: str | None = Query(None),
    role: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """List new users for drill-down. Supports region (country) and role filters."""
    tenant_filter = user.tenant_id
    cutoff = datetime.utcnow() - timedelta(days=days)
    q = select(User).where(User.created_at >= cutoff, User.role != "super_admin")
    if tenant_filter:
        q = q.where(User.tenant_id == tenant_filter)
    if country:
        q = q.where(User.country == country)
    if role:
        q = q.where(User.role == role)
    q = q.order_by(User.created_at.desc())
    result = await db.execute(q)
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "display_name": u.display_name,
            "role": u.role,
            "country": u.country,
            "status": u.status,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        }
        for u in users
    ]


@router.get("/drill-down/active-trainees")
async def get_active_trainees_list(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """List active trainees for drill-down."""
    tenant_filter = user.tenant_id
    q = select(User).where(User.role == "trainee", User.is_active == True)
    if tenant_filter:
        q = q.where(User.tenant_id == tenant_filter)
    q = q.order_by(User.display_name, User.email)
    result = await db.execute(q)
    trainees = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "email": u.email,
            "display_name": u.display_name,
            "country": u.country,
            "status": u.status,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        }
        for u in trainees
    ]


@router.get("/drill-down/case-distribution")
async def get_case_distribution(
    days: int = Query(90, ge=1, le=365),
    country: str | None = Query(None),
    mediator_id: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Case distribution by type for pie chart. Supports region and mediator filters."""
    tenant_filter = user.tenant_id
    cutoff = datetime.utcnow() - timedelta(days=days)
    q = select(Case.case_type, func.count(Case.id)).where(Case.created_at >= cutoff)
    if tenant_filter:
        q = q.where(Case.tenant_id == tenant_filter)
    if country:
        q = q.where(Case.jurisdiction_country == country)
    if mediator_id:
        q = q.where(Case.mediator_id == mediator_id)
    q = q.group_by(Case.case_type)
    result = await db.execute(q)
    rows = result.all()
    return [{"name": row[0] or "other", "value": row[1]} for row in rows]


@router.get("/export-pdf")
async def export_analytics_pdf(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Export analytics summary as PDF. Uses reportlab."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib import colors

    tenant_filter = user.tenant_id
    now = datetime.utcnow()
    period_start = now - timedelta(days=days)

    # Gather metrics
    cases_q = select(func.count(Case.id)).where(Case.created_at >= period_start)
    if tenant_filter:
        cases_q = cases_q.where(Case.tenant_id == tenant_filter)
    new_cases = (await db.execute(cases_q)).scalar() or 0

    users_q = select(func.count(User.id)).where(User.created_at >= period_start, User.role != "super_admin")
    if tenant_filter:
        users_q = users_q.where(User.tenant_id == tenant_filter)
    new_users = (await db.execute(users_q)).scalar() or 0

    resolved_q = select(func.count(Case.id)).where(
        Case.updated_at >= period_start,
        Case.status.in_(["resolved", "closed", "settled", "CLOSED", "SETTLED"]),
    )
    if tenant_filter:
        resolved_q = resolved_q.where(Case.tenant_id == tenant_filter)
    resolved = (await db.execute(resolved_q)).scalar() or 0

    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=inch, leftMargin=inch, topMargin=inch, bottomMargin=inch)
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph("Analytics Report", styles["Title"]))
    story.append(Spacer(1, 0.2 * inch))
    story.append(Paragraph(f"Period: Last {days} days (generated {now.strftime('%Y-%m-%d %H:%M')} UTC)", styles["Normal"]))
    story.append(Spacer(1, 0.3 * inch))
    data = [
        ["Metric", "Value"],
        ["New Cases", str(new_cases)],
        ["New Users", str(new_users)],
        ["Cases Resolved", str(resolved)],
    ]
    t = Table(data)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, 0), 12),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 12),
        ("BACKGROUND", (0, 1), (-1, -1), colors.beige),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
    ]))
    story.append(t)
    doc.build(story)
    buffer.seek(0)
    return Response(content=buffer.getvalue(), media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=analytics-report.pdf"})


@router.get("/threshold-alerts")
async def get_threshold_alerts(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Return anomalies: sudden drop in cases, spike in new users, etc."""
    tenant_filter = user.tenant_id
    now = datetime.utcnow()
    period_start = now - timedelta(days=days)
    half_period = now - timedelta(days=days // 2)

    alerts = []

    # New cases: first half vs second half
    cases_first = select(func.count(Case.id)).where(Case.created_at >= period_start, Case.created_at < half_period)
    cases_second = select(func.count(Case.id)).where(Case.created_at >= half_period)
    if tenant_filter:
        cases_first = cases_first.where(Case.tenant_id == tenant_filter)
        cases_second = cases_second.where(Case.tenant_id == tenant_filter)
    c1 = (await db.execute(cases_first)).scalar() or 0
    c2 = (await db.execute(cases_second)).scalar() or 0
    if c1 > 0 and c2 < c1 * 0.5:
        alerts.append({"type": "case_drop", "severity": "high", "message": f"Cases dropped ~50%+ in second half of period ({c1} -> {c2})"})
    elif c1 > 0 and c2 > c1 * 2:
        alerts.append({"type": "case_spike", "severity": "medium", "message": f"Cases doubled in second half ({c1} -> {c2})"})

    # New users: first half vs second half
    users_first = select(func.count(User.id)).where(User.created_at >= period_start, User.created_at < half_period, User.role != "super_admin")
    users_second = select(func.count(User.id)).where(User.created_at >= half_period, User.role != "super_admin")
    if tenant_filter:
        users_first = users_first.where(User.tenant_id == tenant_filter)
        users_second = users_second.where(User.tenant_id == tenant_filter)
    u1 = (await db.execute(users_first)).scalar() or 0
    u2 = (await db.execute(users_second)).scalar() or 0
    if u1 > 0 and u2 > u1 * 2:
        alerts.append({"type": "user_spike", "severity": "medium", "message": f"New users doubled in second half ({u1} -> {u2})"})
    elif u2 == 0 and u1 > 2:
        alerts.append({"type": "user_drop", "severity": "low", "message": f"No new users in second half (was {u1} in first half)"})

    return {"alerts": alerts, "period_days": days}


@router.get("/activity-heatmap")
async def get_activity_heatmap(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """User activity heatmap: {hour: 0-23, dayOfWeek: 0-6, count} for user logins/actions (from AuditLog)."""
    tenant_filter = user.tenant_id
    period_start = datetime.utcnow() - timedelta(days=days)

    hour_expr = extract("hour", AuditLog.created_at)
    dow_expr = extract("dow", AuditLog.created_at)
    q = select(
        hour_expr.label("hour"),
        dow_expr.label("dow"),
        func.count(AuditLog.id).label("cnt"),
    ).where(
        AuditLog.created_at >= period_start,
        AuditLog.user_id.isnot(None),
    )
    if tenant_filter:
        q = q.where(AuditLog.tenant_id == tenant_filter)
    q = q.group_by(hour_expr, dow_expr)

    result = await db.execute(q)
    rows = result.all()

    heatmap = defaultdict(int)
    for row in rows:
        hour = int(row.hour) if row.hour is not None else 0
        dow = int(row.dow) if row.dow is not None else 0
        heatmap[(hour, dow)] += row.cnt or 0

    out = [{"hour": h, "dayOfWeek": d, "count": c} for (h, d), c in heatmap.items()]
    return {"data": out, "period_days": days}


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
