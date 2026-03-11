"""Training & CPD - Phase 5. Induction modules, role-play, quizzes."""
import uuid
import random
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import User
from app.models.training import TrainingModule, TrainingProgress, CPDProgress, Quiz, QuizAttempt, RolePlayScenario, TrainingModuleConfig, UserModuleResponse

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


class ModuleRespondBody(BaseModel):
    step_id: str
    choice_idx: int | None = None
    text: str | None = None


# Curated thought-provoking reflection prompts for mediators (no AI required)
REFLECTION_PROMPTS = [
    "When a party says 'I just want what's fair'—what underlying interests might they be protecting?",
    "How might cultural norms in Kenya affect how parties express (or withhold) emotions during mediation?",
    "In a commercial dispute, when is preserving the relationship more valuable than winning the argument?",
    "What would you do if both parties seem to agree—but you sense one is acquiescing out of fear?",
    "How do you balance neutrality with ensuring a less powerful party is truly heard?",
    "When a party brings a lawyer to mediation, how does that change your approach?",
    "What does 'informed consent' mean when one party has limited literacy or legal knowledge?",
    "How might generational differences affect communication styles in family disputes?",
    "When is it appropriate to suggest a party seek external support (e.g. counselling) before continuing?",
    "What red flags suggest a dispute may not be suitable for mediation?",
    "How do you handle a party who uses mediation as a delay tactic rather than genuine dialogue?",
    "In employment disputes, what is the mediator's role in addressing power imbalance?",
]


@router.get("/reflection")
async def get_reflection_prompt(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Return a thought-provoking reflection prompt. Personalizes based on user responses when possible. Never cites laws."""
    from app.core.config import get_settings
    settings = get_settings()
    prompts_pool = list(REFLECTION_PROMPTS)
    if settings.openai_api_key:
        try:
            import httpx
            system = """You are a mediation expert. Generate ONE thought-provoking reflection question for a mediator in 1-2 sentences.
Focus on ethics, practical dilemmas, or communication—NOT on legal specifics.
CRITICAL: NEVER quote or cite any law. Do not invent laws or purport them to be real. The system cannot verify legal accuracy.
If legal matters arise, direct users to consult verified sources (e.g. Kenya Law at new.kenyalaw.org) or a qualified legal professional.
Keep it concise. No legal citations whatsoever."""
            r = await httpx.AsyncClient().post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user", "content": "Generate a daily reflection prompt for a mediator."},
                    ],
                    "max_tokens": 80,
                },
                timeout=10.0,
            )
            if r.status_code == 200:
                data = r.json()
                choices = data.get("choices", [])
                if choices and choices[0].get("message", {}).get("content"):
                    prompt = choices[0]["message"]["content"].strip().strip('"')
                    if "act" not in prompt.lower() and "section" not in prompt.lower() and "statute" not in prompt.lower():
                        return {"prompt": prompt, "source": "ai"}
        except Exception:
            pass
    prompt = random.choice(prompts_pool)
    return {"prompt": prompt, "source": "curated"}


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
    """Get module content, progress, and interactive config if present."""
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
    config_result = await db.execute(
        select(TrainingModuleConfig).where(TrainingModuleConfig.module_id == module_id)
    )
    cfg = config_result.scalar_one_or_none()
    return {
        "id": str(mod.id),
        "slug": mod.slug,
        "title": mod.title,
        "description": mod.description,
        "content_html": mod.content_html,
        "progress_pct": p.progress_pct if p else 0,
        "completed": p.completed if p else False,
        "interactive_config": cfg.config_json if cfg else None,
    }


@router.post("/modules/{module_id}/respond")
async def respond_to_step(
    module_id: uuid.UUID,
    data: ModuleRespondBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Record user response to interactive step; return next step and feedback. Enables branching and personalization."""
    result = await db.execute(select(TrainingModule).where(TrainingModule.id == module_id))
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    cfg_result = await db.execute(
        select(TrainingModuleConfig).where(TrainingModuleConfig.module_id == module_id)
    )
    cfg = cfg_result.scalar_one_or_none()
    if not cfg or not cfg.config_json.get("steps"):
        raise HTTPException(status_code=400, detail="Module has no interactive steps")
    steps = {s["id"]: s for s in cfg.config_json["steps"]}
    step = steps.get(data.step_id)
    if not step:
        raise HTTPException(status_code=400, detail="Step not found")
    next_step_id = None
    feedback = None
    if step.get("type") == "scenario" and step.get("choices") and data.choice_idx is not None:
        choice = step["choices"][data.choice_idx] if 0 <= data.choice_idx < len(step["choices"]) else None
        if choice:
            next_step_id = choice.get("next")
            feedback = choice.get("feedback")
        resp_value = {"choice_idx": data.choice_idx}
    elif step.get("type") == "content" or step.get("next"):
        next_step_id = step.get("next")
        resp_value = {"text": data.text} if data.text else {}
    else:
        resp_value = {}
    umr = UserModuleResponse(
        user_id=user.id,
        module_id=module_id,
        step_id=data.step_id,
        response_type="choice" if data.choice_idx is not None else "text",
        response_value=resp_value,
    )
    db.add(umr)
    prog_result = await db.execute(
        select(TrainingProgress).where(
            and_(
                TrainingProgress.user_id == user.id,
                TrainingProgress.module_id == module_id,
            )
        )
    )
    prog = prog_result.scalar_one_or_none()
    total_steps = len(cfg.config_json["steps"])
    steps_by_user = await db.execute(
        select(UserModuleResponse).where(
            and_(
                UserModuleResponse.user_id == user.id,
                UserModuleResponse.module_id == module_id,
            )
        )
    )
    count = len(steps_by_user.scalars().all()) + 1
    progress_pct = min(100, int((count / max(total_steps, 1)) * 100))
    if not prog:
        prog = TrainingProgress(
            user_id=user.id,
            module_id=module_id,
            progress_pct=progress_pct,
            completed=progress_pct >= 100 or next_step_id is None,
            completed_at=datetime.utcnow() if (progress_pct >= 100 or next_step_id is None) else None,
        )
        db.add(prog)
    else:
        prog.progress_pct = progress_pct
        if progress_pct >= 100 or next_step_id is None:
            prog.completed = True
            prog.completed_at = datetime.utcnow()
    await db.flush()
    next_step = steps.get(next_step_id) if next_step_id else None
    return {
        "next_step_id": next_step_id,
        "next_step": next_step,
        "feedback": feedback,
        "progress_pct": progress_pct,
        "completed": prog.completed,
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
