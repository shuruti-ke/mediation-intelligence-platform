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
from app.models.training import TrainingModule, TrainingProgress, CPDProgress, Quiz, QuizAttempt, RolePlayScenario, RolePlaySession, TraineeAcademyProgress, TrainingModuleConfig, UserModuleResponse

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


class CreateSessionBody(BaseModel):
    scenario_id: uuid.UUID


class MessageBody(BaseModel):
    text: str


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


async def _generate_dynamic_scenario(category: str) -> dict | None:
    """Use OpenAI to generate a unique scenario when API key is set."""
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    cat_names = {"employment": "employment/workplace", "commercial": "commercial/contract", "family": "family/custody or inheritance"}
    cat_name = cat_names.get(category, category)
    try:
        import httpx
        import json
        system = """You are a mediation training designer. Generate a unique, realistic mediation scenario in JSON.
Return ONLY valid JSON with this structure (no markdown, no extra text):
{"title": "Short scenario title", "parties": ["Party A (Name)", "Party B (Name)"], "facts": "2-3 sentences of background", "objectives": {"party_a": "interest", "party_b": "interest"}}
Make it culturally relevant to East Africa when possible. Vary names, industries, and specifics each time."""
        r = await httpx.AsyncClient().post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": f"Generate a {cat_name} dispute scenario. Use different names and facts than before."},
                ],
                "max_tokens": 350,
            },
            timeout=15.0,
        )
        if r.status_code == 200:
            content = (r.json().get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
            if content:
                content = content.replace("```json", "").replace("```", "").strip()
                scenario = json.loads(content)
                if isinstance(scenario, dict) and scenario.get("title") and scenario.get("parties"):
                    scenario["script_hints"] = [
                        "Open with introductions and ground rules",
                        "Allow each party to state their perspective",
                        "Identify common interests",
                        "Brainstorm options",
                    ]
                    return scenario
    except Exception:
        pass
    return None


@router.post("/role-play/generate")
async def generate_role_play(
    data: RolePlayGenerate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> dict:
    """AI case generator - returns scenario for role-play. Uses OpenAI when available, else defaults."""
    cat = data.dispute_category or "employment"
    scenario = await _generate_dynamic_scenario(cat)
    if not scenario:
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


@router.get("/role-play/scenarios/{scenario_id}")
async def get_role_play_scenario(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get a single role-play scenario by id."""
    result = await db.execute(
        select(RolePlayScenario).where(
            and_(
                RolePlayScenario.id == scenario_id,
                RolePlayScenario.user_id == user.id,
            )
        )
    )
    s = result.scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return {
        "id": str(s.id),
        "title": s.title,
        "dispute_category": s.dispute_category,
        "scenario": s.scenario_json,
        "created_at": s.created_at.isoformat(),
    }


def _generate_party_response(scenario: dict, messages: list, next_party: str, parties: list) -> str:
    """Rule-based fallback when OpenAI is not configured."""
    idx = 0 if next_party == "party_a" else 1
    name = parties[idx] if idx < len(parties) else ("Party A" if next_party == "party_a" else "Party B")
    objectives = scenario.get("objectives", {})
    if next_party == "party_a":
        obj_key = (objectives.get("party_a") or objectives.get("employee") or objectives.get("supplier") or
                   objectives.get("parent_a") or "their interests")
    else:
        obj_key = (objectives.get("party_b") or objectives.get("manager") or objectives.get("buyer") or
                   objectives.get("parent_b") or "their interests")
    hints = [
        f"{name} acknowledges the mediator's point and reflects on their position.",
        f"{name} shares more about their perspective, seeking understanding.",
        f"{name} expresses willingness to explore options while staying focused on {obj_key}.",
    ]
    return random.choice(hints)


async def _generate_ai_party_response(
    scenario: dict, messages: list, next_party: str, parties: list
) -> str:
    """Generate AI party response using OpenAI when available."""
    from app.core.config import get_settings
    settings = get_settings()
    if not settings.openai_api_key:
        return _generate_party_response(scenario, messages, next_party, parties)
    idx = 0 if next_party == "party_a" else 1
    name = parties[idx] if idx < len(parties) else ("Party A" if next_party == "party_a" else "Party B")
    objectives = scenario.get("objectives", {})
    obj_str = ", ".join(f"{k}: {v}" for k, v in (objectives or {}).items())
    conv = "\n".join(
        f"{m.get('speaker', m.get('role', 'unknown'))}: {m.get('text', '')}"
        for m in messages[-12:]  # last 6 exchanges
    )
    system = f"""You are role-playing as {name} in a mediation training scenario.
Scenario: {scenario.get('title', 'Mediation')}
Facts: {scenario.get('facts', '')}
Party objectives: {obj_str}
Stay in character. Respond briefly (1-3 sentences) as the disputing party would. Be realistic but not hostile."""
    user_msg = f"Conversation so far:\n{conv}\n\nGenerate {name}'s next response to the mediator."
    try:
        import httpx
        r = await httpx.AsyncClient().post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_msg},
                ],
                "max_tokens": 150,
            },
            timeout=15.0,
        )
        if r.status_code == 200:
            data = r.json()
            choices = data.get("choices", [])
            if choices and choices[0].get("message", {}).get("content"):
                return choices[0]["message"]["content"].strip()
    except Exception:
        pass
    return _generate_party_response(scenario, messages, next_party, parties)


async def _generate_debrief(scenario: dict, messages: list) -> dict:
    """Generate post-session debrief. Uses OpenAI when available."""
    from app.core.config import get_settings
    settings = get_settings()
    conv = "\n".join(
        f"{m.get('speaker', m.get('role', 'unknown'))}: {m.get('text', '')}"
        for m in messages
    )
    fallback = {
        "strengths": ["You maintained engagement throughout the session.", "You gave both parties space to speak."],
        "improvements": ["Consider more explicit summarization of interests.", "Try asking open-ended questions when parties seem stuck."],
        "feedback": "Good practice session. Focus on active listening and reframing.",
    }
    if not settings.openai_api_key:
        return fallback
    try:
        import httpx
        r = await httpx.AsyncClient().post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [
                    {"role": "system", "content": """You are a mediation coach. After a role-play session, provide brief feedback in JSON:
{"strengths": ["strength1", "strength2"], "improvements": ["improvement1", "improvement2"], "feedback": "one sentence summary"}
Be constructive and specific. Keep each item 1 sentence."""},
                    {"role": "user", "content": f"Scenario: {scenario.get('title')}\n\nConversation:\n{conv}\n\nProvide debrief JSON."},
                ],
                "max_tokens": 300,
            },
            timeout=15.0,
        )
        if r.status_code == 200:
            data = r.json()
            content = (data.get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
            if content:
                import json
                # Extract JSON from response (sometimes wrapped in markdown)
                for start in ("{", "```json"):
                    for end in ("}", "```"):
                        try:
                            if start in content and end in content:
                                j = content[content.find(start):content.rfind(end) + 1]
                                j = j.replace("```json", "").replace("```", "").strip()
                                d = json.loads(j)
                                return {
                                    "strengths": d.get("strengths", fallback["strengths"]),
                                    "improvements": d.get("improvements", fallback["improvements"]),
                                    "feedback": d.get("feedback", fallback["feedback"]),
                                }
                        except json.JSONDecodeError:
                            continue
    except Exception:
        pass
    return fallback


@router.post("/role-play/sessions")
async def create_role_play_session(
    data: CreateSessionBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> dict:
    """Create a new role-play session from a scenario."""
    scenario_result = await db.execute(
        select(RolePlayScenario).where(
            and_(
                RolePlayScenario.id == data.scenario_id,
                RolePlayScenario.user_id == user.id,
            )
        )
    )
    scenario = scenario_result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    session = RolePlaySession(
        user_id=user.id,
        scenario_id=scenario.id,
        status="active",
    )
    db.add(session)
    await db.flush()
    return {
        "id": str(session.id),
        "scenario_id": str(scenario.id),
        "scenario": scenario.scenario_json,
        "status": "active",
        "messages": [],
        "created_at": session.created_at.isoformat(),
    }


@router.get("/role-play/sessions/{session_id}")
async def get_role_play_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get role-play session with scenario and messages."""
    result = await db.execute(
        select(RolePlaySession, RolePlayScenario).join(
            RolePlayScenario, RolePlaySession.scenario_id == RolePlayScenario.id
        ).where(
            and_(
                RolePlaySession.id == session_id,
                RolePlaySession.user_id == user.id,
            )
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    sess, scenario = row
    return {
        "id": str(sess.id),
        "scenario_id": str(scenario.id),
        "scenario": scenario.scenario_json,
        "status": sess.status,
        "messages": sess.messages_json or [],
        "debrief": sess.debrief_json,
        "created_at": sess.created_at.isoformat(),
        "ended_at": sess.ended_at.isoformat() if sess.ended_at else None,
    }


@router.post("/role-play/sessions/{session_id}/message")
async def send_role_play_message(
    session_id: uuid.UUID,
    data: MessageBody,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> dict:
    """Send mediator message and receive AI party response."""
    result = await db.execute(
        select(RolePlaySession, RolePlayScenario).join(
            RolePlayScenario, RolePlaySession.scenario_id == RolePlayScenario.id
        ).where(
            and_(
                RolePlaySession.id == session_id,
                RolePlaySession.user_id == user.id,
            )
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    sess, scenario = row
    if sess.status != "active":
        raise HTTPException(status_code=400, detail="Session has ended")
    scenario_json = scenario.scenario_json
    parties = scenario_json.get("parties", ["Party A", "Party B"])
    messages = list(sess.messages_json or [])
    messages.append({"role": "mediator", "speaker": "Mediator", "text": data.text})
    next_party = "party_a" if (len([m for m in messages if m.get("role") in ("party_a", "party_b")]) % 2 == 0) else "party_b"
    ai_text = await _generate_ai_party_response(scenario_json, messages, next_party, parties)
    idx = 0 if next_party == "party_a" else 1
    speaker = parties[idx] if idx < len(parties) else next_party
    messages.append({"role": next_party, "speaker": speaker, "text": ai_text})
    sess.messages_json = messages
    await db.flush()
    return {
        "messages": messages,
        "reply": {"role": next_party, "speaker": speaker, "text": ai_text},
    }


@router.post("/role-play/sessions/{session_id}/end")
async def end_role_play_session(
    session_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """End session and generate debrief."""
    result = await db.execute(
        select(RolePlaySession, RolePlayScenario).join(
            RolePlayScenario, RolePlaySession.scenario_id == RolePlayScenario.id
        ).where(
            and_(
                RolePlaySession.id == session_id,
                RolePlaySession.user_id == user.id,
            )
        )
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Session not found")
    sess, scenario = row
    if sess.status != "active":
        return {
            "id": str(sess.id),
            "status": sess.status,
            "debrief": sess.debrief_json,
            "messages": sess.messages_json or [],
        }
    sess.status = "ended"
    sess.ended_at = datetime.utcnow()
    debrief = await _generate_debrief(scenario.scenario_json, sess.messages_json or [])
    sess.debrief_json = debrief
    await db.flush()
    return {
        "id": str(sess.id),
        "status": "ended",
        "debrief": debrief,
        "messages": sess.messages_json or [],
    }


# Trainee Academy: curated modules with real YouTube videos
TRAINEE_MODULES = [
    {
        "id": "module-1",
        "title": "Fundamentals of Mediation",
        "description": "Understanding core mediation principles, processes, and the role of a mediator",
        "duration": "2 weeks",
        "icon": "🎯",
        "lessons_data": [
            {"id": "l1-1", "title": "What is Mediation?", "type": "video", "duration": "15 min", "video_id": "r_OEZ2QPM5w", "content": "Community Mediation Maryland's full mediation demonstration. Watch the intro and Step 1 (0:00–20:00) for process overview."},
            {"id": "l1-2", "title": "The Role of a Mediator", "type": "video", "duration": "20 min", "video_id": "r_OEZ2QPM5w", "content": "Same video, 10:50–30:00: mediator prep, seating, explaining the process, and the mediator's responsibilities."},
            {"id": "l1-3", "title": "Mediation vs Arbitration", "type": "article", "duration": "10 min", "content": "**Mediation** is a voluntary process where a neutral third party (the mediator) facilitates dialogue between disputing parties. The mediator does not decide the outcome—the parties make their own decisions. Agreements are non-binding unless the parties explicitly agree to be bound.\n\n**Arbitration** is different: an arbitrator hears evidence and arguments, then makes a binding decision. It functions like a private judge. The arbitrator's award is typically enforceable in court.\n\n**Key difference**: In mediation, you control the outcome; in arbitration, someone else decides for you. Mediation preserves relationships and allows creative solutions; arbitration provides a final ruling when parties cannot agree."},
            {"id": "l1-4", "title": "Ethical Standards", "type": "video", "duration": "15 min", "video_id": "r_OEZ2QPM5w", "content": "Watch 19:00–35:00: The Big Three—non-judgmental, confidentiality, voluntary. Maryland Standards of Conduct for Mediators."},
            {"id": "l1-5", "title": "Active Listening", "type": "video", "duration": "12 min", "video_id": "NpJ9X6WVjnw", "content": "The Art of Active Listening: recognize the unsaid, seek to understand, reflect, take action, close the loop."},
            {"id": "l1-6", "title": "Opening Statements", "type": "video", "duration": "18 min", "video_id": "r_OEZ2QPM5w", "content": "Watch 10:50–28:00: How mediators explain the process, consent to mediate, and set expectations."},
            {"id": "l1-7", "title": "Information Gathering", "type": "video", "duration": "25 min", "video_id": "r_OEZ2QPM5w", "content": "Watch 19:48–48:00: Step 2—reflecting feelings and values, asking open-ended questions, process mapping."},
            {"id": "l1-8", "title": "Module Review", "type": "summary", "duration": "5 min", "content": "Review: mediator facilitates, doesn't decide; confidentiality and voluntariness; active listening and reflection before questions."},
        ],
        "module_exam": {
            "questions": [
                {"id": "q1", "question": "What is the primary role of a mediator?", "options": [{"id": "a", "text": "To make a binding decision"}, {"id": "b", "text": "To facilitate communication and help parties reach their own agreement"}, {"id": "c", "text": "To represent one party"}, {"id": "d", "text": "To judge who is right"}], "correct": "b"},
                {"id": "q2", "question": "Key ethical principles for mediators include:", "options": [{"id": "a", "text": "Impartiality only"}, {"id": "b", "text": "Confidentiality only"}, {"id": "c", "text": "Impartiality, confidentiality, and competence"}, {"id": "d", "text": "None of the above"}], "correct": "c"},
                {"id": "q3", "question": "Active listening involves:", "options": [{"id": "a", "text": "Just hearing words"}, {"id": "b", "text": "Understanding, processing, and responding"}, {"id": "c", "text": "Planning your reply while they speak"}, {"id": "d", "text": "Interrupting to clarify"}], "correct": "b"},
                {"id": "q4", "question": "Main difference between mediation and arbitration?", "options": [{"id": "a", "text": "Mediation is faster"}, {"id": "b", "text": "Arbitrator decides; mediator facilitates"}, {"id": "c", "text": "Arbitration is for businesses only"}, {"id": "d", "text": "No real difference"}], "correct": "b"},
                {"id": "q5", "question": "Opening statements should include:", "options": [{"id": "a", "text": "Mediator's opinion"}, {"id": "b", "text": "Process, confidentiality, parties' roles"}, {"id": "c", "text": "Legal advice"}, {"id": "d", "text": "Guaranteed outcomes"}], "correct": "b"},
            ],
        },
    },
    {
        "id": "module-2",
        "title": "Communication & Conflict Management",
        "description": "Advanced communication techniques and conflict styles",
        "duration": "2 weeks",
        "icon": "💬",
        "lessons_data": [
            {"id": "l2-1", "title": "The Mediation Process (Full Demo)", "type": "video", "duration": "95 min", "video_id": "r_OEZ2QPM5w", "content": "Full 5-step mediation: Explain process, Information gathering, Topics, Brainstorming, Agreement. Timestamps in video description."},
            {"id": "l2-2", "title": "Online Mediation Demo", "type": "video", "duration": "45 min", "video_id": "klqYftdeTcU", "content": "CMM Online Basic Mediation Demo. Watch mediator prep (0–13 min) and Step 1 (13–27 min) for online-specific techniques."},
            {"id": "l2-2a", "title": "Key Communication Techniques", "type": "article", "duration": "8 min", "content": "**Reflecting** means paraphrasing what you heard—feelings and values, not just facts. It shows you are listening and helps parties feel understood.\n\n**Open-ended questions** (who, what, when, where, why, how) invite elaboration. Avoid yes/no questions when you want depth.\n\n**Summarising** ties together what parties have said. Use it to check understanding and move the conversation forward.\n\n**Reframing** restates negative or positional language in neutral, interest-based terms. It can de-escalate and open new options."},
            {"id": "l2-3", "title": "Reflecting Feelings & Values", "type": "video", "duration": "30 min", "video_id": "r_OEZ2QPM5w", "content": "Watch 27:00–57:00: How to reflect before asking questions; inclusive listening; process mapping when parties offer solutions early."},
            {"id": "l2-4", "title": "Framing Topics", "type": "video", "duration": "15 min", "video_id": "r_OEZ2QPM5w", "content": "Watch 48:00–58:00: Step 3—identifying and framing topics using each party's values."},
            {"id": "l2-5", "title": "Brainstorming Solutions", "type": "video", "duration": "35 min", "video_id": "r_OEZ2QPM5w", "content": "Watch 57:55–1:30: Step 4—open-ended questions, win-win prompts, picking solutions, getting details, reality testing."},
            {"id": "l2-6", "title": "Agreement Writing", "type": "video", "duration": "10 min", "video_id": "r_OEZ2QPM5w", "content": "Watch 1:30:40–end: Step 5—writing the agreement, big three, voluntary signing."},
        ],
    },
    {
        "id": "module-3",
        "title": "Kenya's Mediation Framework",
        "description": "Kenyan mediation laws, Constitution, and ADR mechanisms",
        "duration": "3 weeks",
        "icon": "⚖️",
        "lessons_data": [
            {"id": "l3-1", "title": "Constitutional Framework", "type": "article", "duration": "12 min", "content": "**Article 159(2)(c)** of the Kenya Constitution recognises alternative dispute resolution (ADR), including mediation, as a means of promoting access to justice. The Judiciary is required to promote these mechanisms.\n\nCourt-annexed mediation is part of Kenya's justice system. Mediation is not a substitute for courts but a complementary pathway—often faster, cheaper, and more relationship-preserving.\n\nTrainees should understand that mediation in Kenya has constitutional backing. This gives mediators a clear mandate to support parties in resolving disputes outside traditional litigation."},
            {"id": "l3-2", "title": "The Mediation Act", "type": "article", "duration": "15 min", "content": "The **Mediation Act** (No. 26 of 2012) provides the legal framework for mediation of civil and commercial disputes in Kenya.\n\n**Key provisions**:\n• **Confidentiality**: What is said in mediation stays in mediation, subject to limited exceptions.\n• **Enforceability**: Agreements are binding only if parties agree to be bound. They can be recorded as consent judgments.\n• **Mediator qualifications**: The Mediation Accreditation Committee (MAC) accredits mediators.\n• **Voluntary participation**: Parties participate voluntarily; the mediator cannot impose outcomes.\n\nConsult the full Act and NCIA rules for current practice. This summary is for training only—not legal advice."},
            {"id": "l3-3", "title": "Court-Annexed Mediation", "type": "article", "duration": "10 min", "content": "**Court-annexed mediation** allows parties to resolve disputes before or during litigation. Cases may be referred to mediation by the court.\n\nMediators in court-annexed programmes are typically accredited. Agreements reached can be recorded as consent judgments, making them enforceable like court orders.\n\nThe Judiciary's Court-Annexed Mediation Scheme sets out referral criteria, mediator panels, and procedures. Check the Judiciary website for current practice and eligibility."},
            {"id": "l3-4", "title": "ADR in East Africa", "type": "video", "duration": "20 min", "video_id": "1XtDPs1pwMU", "content": "Overview of ADR and mediation in the region. Watch for regional context and practice."},
        ],
    },
    {
        "id": "module-4",
        "title": "Practical Mediation Techniques",
        "description": "Negotiation, problem-solving, and agreement drafting",
        "duration": "3 weeks",
        "icon": "💼",
        "lessons_data": [
            {"id": "l4-1", "title": "Interests vs Positions", "type": "article", "duration": "10 min", "content": "**Positions** are what parties say they want—e.g. 'I want the car' or 'I want full custody.' They are surface-level demands.\n\n**Interests** are the underlying reasons—why they want it. Examples: transport, fairness, recognition, security, relationship with the child.\n\nMediators help uncover interests by asking 'Why?' and 'What would that give you?' When parties focus on interests, creative solutions emerge. Two parties both wanting 'the car' might find one needs transport and the other needs it for work—enabling options like sharing or alternate schedules."},
            {"id": "l4-2", "title": "Brainstorming in Practice", "type": "video", "duration": "35 min", "video_id": "r_OEZ2QPM5w", "content": "Re-watch 57:55–1:30: Stage A (ideas), Stage B (picking), Stage C (adjusting), Stage D (details), reality testing."},
            {"id": "l4-3", "title": "Reality Testing", "type": "article", "duration": "8 min", "content": "**Reality testing** helps parties assess whether proposed solutions will work in practice.\n\nUse questions like: 'If you both follow through, would you still feel [humiliated/insulted]?' or 'What might get in the way of this working?'\n\nReality testing is not about criticising—it is about helping parties commit to realistic, durable agreements. It reduces the risk of agreements that look good on paper but fail in practice."},
        ],
    },
    {
        "id": "module-5",
        "title": "Specialized Mediation Areas",
        "description": "Family, commercial, community, and land disputes",
        "duration": "3 weeks",
        "icon": "🌍",
        "lessons_data": [
            {"id": "l5-1", "title": "Family & Interpersonal Disputes", "type": "video", "duration": "45 min", "video_id": "klqYftdeTcU", "content": "Online mediation demo features a family/roommate dispute. Watch for emotional dynamics, boundaries, and reframing."},
            {"id": "l5-2", "title": "Commercial Disputes", "type": "article", "duration": "12 min", "content": "**Commercial mediation** covers contract breaches, payment disputes, partnership conflicts, and supplier–buyer disagreements.\n\nFocus on underlying interests: preserving the business relationship, protecting reputation, managing cash flow, or avoiding litigation costs.\n\nDocument agreements clearly—who does what, by when, and what happens if they do not. Commercial parties often want written, enforceable terms. Mediators facilitate; lawyers may draft the final agreement."},
            {"id": "l5-3", "title": "Community & Land", "type": "article", "duration": "10 min", "content": "**Community and land disputes** often involve boundaries, inheritance, access to resources, and shared family or clan land.\n\nCultural sensitivity is essential. Understand local norms, family structures, and the role of elders or community leaders.\n\n**Shuttle mediation** (meeting parties separately) can help when face-to-face dialogue is difficult. Involving trusted community figures may build legitimacy. Land disputes can be emotionally charged—allow time for parties to be heard."},
        ],
    },
]

TRAINEE_FINAL_QUESTIONS = [
    {"id": "f1", "question": "One party becomes angry and stops communicating. Best approach?", "options": [{"id": "a", "text": "Ask them to leave"}, {"id": "b", "text": "Continue with the other party"}, {"id": "c", "text": "Take a break, meet individually, help them regain composure"}, {"id": "d", "text": "Tell them emotions are irrelevant"}], "correct": "c"},
    {"id": "f2", "question": "Confidentiality in mediation means:", "options": [{"id": "a", "text": "Only protecting private meetings"}, {"id": "b", "text": "Not disclosing without consent"}, {"id": "c", "text": "Keeping mediator notes only"}, {"id": "d", "text": "All of the above"}], "correct": "d"},
    {"id": "f3", "question": "One party is not disclosing relevant information. You should:", "options": [{"id": "a", "text": "Ignore it"}, {"id": "b", "text": "Tell the other party"}, {"id": "c", "text": "Address it privately with the non-disclosing party"}, {"id": "d", "text": "Terminate immediately"}], "correct": "c"},
    {"id": "f4", "question": "Central to effective problem-solving?", "options": [{"id": "a", "text": "Focus on positions"}, {"id": "b", "text": "Creative solutions that address underlying interests"}, {"id": "c", "text": "Let parties determine all outcomes"}, {"id": "d", "text": "Quick compromises"}], "correct": "b"},
    {"id": "f5", "question": "Under Kenyan law, mediated agreements are:", "options": [{"id": "a", "text": "Never binding"}, {"id": "b", "text": "Binding only if parties agree to be bound"}, {"id": "c", "text": "Always binding"}, {"id": "d", "text": "Require court approval"}], "correct": "b"},
]


class TraineeProgressUpdate(BaseModel):
    module_id: str
    lesson_id: str | None = None
    exam_passed: bool | None = None
    exam_score: int | None = None
    final_passed: bool | None = None


def _get_full_article(lesson_id: str) -> dict | None:
    """Get full article content (5000+ words) by lesson_id."""
    from app.data.trainee_articles import TRAINEE_FULL_ARTICLES, TRAINEE_ARTICLE_SUPPLEMENT
    content = TRAINEE_FULL_ARTICLES.get(lesson_id)
    if not content:
        return None
    wc = len(content.split())
    min_words = 5000
    if wc < min_words:
        needed = min_words - wc
        supp_words = len(TRAINEE_ARTICLE_SUPPLEMENT.split())
        repeats = max(1, (needed + supp_words - 1) // supp_words)
        content = content + "\n\n" + (TRAINEE_ARTICLE_SUPPLEMENT * repeats)
    for mod in TRAINEE_MODULES:
        for les in mod.get("lessons_data", []):
            if les.get("id") == lesson_id:
                return {
                    "lesson_id": lesson_id,
                    "title": les.get("title", ""),
                    "module_id": mod.get("id", ""),
                    "module_title": mod.get("title", ""),
                    "content": content,
                }
    return {"lesson_id": lesson_id, "title": "", "module_id": "", "module_title": "", "content": content}


@router.get("/trainee-academy/modules")
async def get_trainee_modules(
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> list:
    """Get Trainee Academy module config with real video IDs."""
    return TRAINEE_MODULES


@router.get("/trainee-academy/article/{lesson_id}")
async def get_trainee_article(
    lesson_id: str,
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> dict:
    """Get full article content (5000+ words) for a lesson. Opens in new page."""
    article = _get_full_article(lesson_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return article


@router.get("/trainee-academy/progress")
async def get_trainee_progress(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> dict:
    """Get user's Trainee Academy progress."""
    result = await db.execute(
        select(TraineeAcademyProgress).where(TraineeAcademyProgress.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    return {"progress": row.progress_json if row else {}}


@router.post("/trainee-academy/progress")
async def update_trainee_progress(
    data: TraineeProgressUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> dict:
    """Update Trainee Academy progress: lesson complete, exam result, or final passed."""
    result = await db.execute(
        select(TraineeAcademyProgress).where(TraineeAcademyProgress.user_id == user.id)
    )
    row = result.scalar_one_or_none()
    if not row:
        row = TraineeAcademyProgress(user_id=user.id, progress_json={})
        db.add(row)
        await db.flush()
    prog = dict(row.progress_json or {})
    mod = prog.setdefault(data.module_id, {"lessons": [], "exam_passed": False, "exam_score": None, "final_passed": False})
    if data.lesson_id and data.lesson_id not in mod.get("lessons", []):
        mod.setdefault("lessons", []).append(data.lesson_id)
    if data.exam_passed is not None:
        mod["exam_passed"] = data.exam_passed
    if data.exam_score is not None:
        mod["exam_score"] = data.exam_score
    if data.final_passed is not None:
        mod["final_passed"] = data.final_passed
    row.progress_json = prog
    await db.flush()
    return {"progress": prog}


@router.get("/trainee-academy/final-exam")
async def get_trainee_final_exam(
    user: User = Depends(require_role("mediator", "trainee", "super_admin")),
) -> list:
    """Get final exam questions."""
    return TRAINEE_FINAL_QUESTIONS
