"""Training & CPD - Phase 5. Induction modules, role-play, quizzes."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.training import TrainingModule, TrainingProgress, CPDProgress, Quiz, QuizAttempt, RolePlayScenario

router = APIRouter(prefix="/training", tags=["training"])

# Default scenarios when AI is not configured
DEFAULT_SCENARIOS = {
    "employment": {
        "title": "Workplace Dispute",
        "parties": ["Employee (Sarah)", "Manager (James)"],
        "facts": "Sarah claims she was passed over for promotion. James says performance reviews were fair.",
        "objectives": {"employee": "Recognition and fair process", "manager": "Maintain team morale"},
    },
    "commercial": {
        "title": "Contract Dispute",
        "parties": ["Supplier (ABC Ltd)", "Buyer (XYZ Inc)"],
        "facts": "Delivery was late. ABC cites force majeure. XYZ demands compensation.",
        "objectives": {"supplier": "Preserve relationship", "buyer": "Recover losses"},
    },
    "family": {
        "title": "Custody Arrangement",
        "parties": ["Parent A", "Parent B"],
        "facts": "Disagreement on holiday schedule and school choice.",
        "objectives": {"parent_a": "More time with child", "parent_b": "Stability for child"},
    },
}


class ProgressUpdate(BaseModel):
    progress_pct: int
    completed: bool = False


class RolePlayGenerate(BaseModel):
    dispute_category: str | None = None


@router.get("/modules")
async def list_modules(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """Induction modules: Orientation, Ethics, Online Mediation Intro."""
    q = select(TrainingModule).where(TrainingModule.is_published == True)
    if user.tenant_id:
        q = q.where(
            (TrainingModule.tenant_id == user.tenant_id) | (TrainingModule.tenant_id.is_(None))
        )
    q = q.order_by(TrainingModule.order_index)
    result = await db.execute(q)
    modules = result.scalars().all()
    # Enrich with user progress
    out = []
    for m in modules:
        prog = await db.execute(
            select(TrainingProgress).where(
                and_(
                    TrainingProgress.user_id == user.id,
                    TrainingProgress.module_id == m.id,
                )
            )
        )
        p = prog.scalar_one_or_none()
        out.append({
            "id": str(m.id),
            "slug": m.slug,
            "title": m.title,
            "description": m.description,
            "order_index": m.order_index,
            "progress_pct": p.progress_pct if p else 0,
            "completed": p.completed if p else False,
        })
    return out


@router.get("/modules/{module_id}")
async def get_module(
    module_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get module content and progress."""
    result = await db.execute(select(TrainingModule).where(TrainingModule.id == module_id))
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    if user.tenant_id and mod.tenant_id and mod.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    prog = await db.execute(
        select(TrainingProgress).where(
            and_(
                TrainingProgress.user_id == user.id,
                TrainingProgress.module_id == module_id,
            )
        )
    )
    p = prog.scalar_one_or_none()
    return {
        "id": str(mod.id),
        "slug": mod.slug,
        "title": mod.title,
        "description": mod.description,
        "content_html": mod.content_html,
        "progress_pct": p.progress_pct if p else 0,
        "completed": p.completed if p else False,
    }


@router.put("/modules/{module_id}/progress")
async def update_progress(
    module_id: uuid.UUID,
    data: ProgressUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Update progress on a module."""
    result = await db.execute(select(TrainingModule).where(TrainingModule.id == module_id))
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    prog_result = await db.execute(
        select(TrainingProgress).where(
            and_(
                TrainingProgress.user_id == user.id,
                TrainingProgress.module_id == module_id,
            )
        )
    )
    prog = prog_result.scalar_one_or_none()
    if not prog:
        prog = TrainingProgress(
            user_id=user.id,
            module_id=module_id,
            progress_pct=data.progress_pct,
            completed=data.completed,
            completed_at=datetime.utcnow() if data.completed else None,
        )
        db.add(prog)
    else:
        prog.progress_pct = data.progress_pct
        prog.completed = data.completed
        prog.completed_at = datetime.utcnow() if data.completed else None
    await db.flush()
    return {"progress_pct": prog.progress_pct, "completed": prog.completed}


@router.get("/cpd")
async def get_cpd_dashboard(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    year: int | None = None,
) -> dict:
    """CPD progress, hours, certifications."""
    y = year or datetime.utcnow().year
    result = await db.execute(
        select(CPDProgress).where(
            and_(CPDProgress.user_id == user.id, CPDProgress.year == y)
        )
    )
    cpd = result.scalar_one_or_none()
    if not cpd:
        cpd = CPDProgress(user_id=user.id, year=y, hours_completed=0, hours_required=12)
        db.add(cpd)
        await db.flush()
    return {
        "year": cpd.year,
        "hours_completed": cpd.hours_completed,
        "hours_required": cpd.hours_required,
        "certifications": cpd.certifications or [],
    }


@router.post("/role-play/generate")
async def generate_role_play(
    data: RolePlayGenerate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> dict:
    """AI case generator - returns scenario for role-play. Uses defaults when no AI."""
    cat = data.dispute_category or "employment"
    scenario = DEFAULT_SCENARIOS.get(cat, DEFAULT_SCENARIOS["employment"]).copy()
    scenario["script_hints"] = [
        "Open with introductions and ground rules",
        "Allow each party to state their perspective",
        "Identify common interests",
        "Brainstorm options",
    ]
    rp = RolePlayScenario(
        user_id=user.id,
        dispute_category=cat,
        scenario_json=scenario,
        title=scenario.get("title", "Role-play Scenario"),
    )
    db.add(rp)
    await db.flush()
    return {
        "id": str(rp.id),
        "scenario": scenario,
        "created_at": rp.created_at.isoformat(),
    }


@router.get("/role-play")
async def list_role_plays(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List user's generated role-play scenarios."""
    result = await db.execute(
        select(RolePlayScenario).where(RolePlayScenario.user_id == user.id).order_by(RolePlayScenario.created_at.desc()).limit(20)
    )
    scenarios = result.scalars().all()
    return [
        {"id": str(s.id), "title": s.title, "dispute_category": s.dispute_category, "created_at": s.created_at.isoformat()}
        for s in scenarios
    ]
