"""Training Academy Admin API - CRUD, AI generation, analytics, student drill-down."""
import json
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import select, and_, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.core.config import get_settings
from app.models.tenant import User
from app.models.academy import (
    AcademyModule,
    AcademyLesson,
    AcademyMaterial,
    AcademyModuleProgress,
    AcademyQuiz,
    AcademyQuizAttempt,
)
from app.models.training import TraineeAcademyProgress

# Import curated modules for admin view (read-only, trainees see these)
from app.api.training import TRAINEE_MODULES

router = APIRouter(prefix="/training/academy-admin", tags=["academy-admin"])


# --- Pydantic schemas ---
class AIModuleGenerate(BaseModel):
    topic: str
    target_audience: str = "mediators"
    duration_hours: float = 2.0


class ModuleCreate(BaseModel):
    slug: str
    title: str
    description: str | None = None
    thumbnail_url: str | None = None
    difficulty: str = "beginner"
    tags: list[str] = []
    visibility: str = "public"
    target_audience: str = "trainee"  # trainee, mediator


class ModuleUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    thumbnail_url: str | None = None
    difficulty: str | None = None
    tags: list[str] | None = None
    visibility: str | None = None
    target_audience: str | None = None
    is_published: bool | None = None
    order_index: int | None = None


class LessonCreate(BaseModel):
    title: str
    content_html: str | None = None
    content_type: str = "text"
    video_url: str | None = None
    file_url: str | None = None
    order_index: int = 0
    duration_minutes: int | None = None


class LessonUpdate(BaseModel):
    title: str | None = None
    content_html: str | None = None
    content_type: str | None = None
    video_url: str | None = None
    file_url: str | None = None
    order_index: int | None = None
    duration_minutes: int | None = None


class QuizCreate(BaseModel):
    module_id: uuid.UUID | None = None
    title: str
    questions_json: dict
    passing_score_pct: int = 70
    time_limit_minutes: int | None = None
    randomize_questions: bool = True
    retry_attempts: int = 3
    is_final_exam: bool = False


class QuizUpdate(BaseModel):
    title: str | None = None
    questions_json: dict | None = None
    passing_score_pct: int | None = None
    time_limit_minutes: int | None = None
    randomize_questions: bool | None = None
    retry_attempts: int | None = None
    is_final_exam: bool | None = None


# --- AI Module Generation ---
async def _generate_ai_module(topic: str, audience: str, duration: float) -> dict | None:
    """Use OpenAI to generate module structure, lessons outline, draft quiz."""
    settings = get_settings()
    if not settings.openai_api_key:
        return None
    try:
        import httpx
        system = """You are a mediation training designer. Generate a training module structure in JSON.
Return ONLY valid JSON with this structure (no markdown, no extra text):
{
  "title": "Module title",
  "description": "2-3 sentence description",
  "lessons": [
    {"title": "Lesson 1 title", "content_type": "text", "suggested_content": "brief outline"},
    ...
  ],
  "quiz_questions": [
    {"question": "Question text?", "options": ["A", "B", "C", "D"], "correct_idx": 0, "feedback_correct": "...", "feedback_incorrect": "..."},
    ...
  ]
}
Create 4-6 lessons. Create 4-5 quiz questions. Make it relevant to East Africa when possible."""
        user_msg = f"Topic: {topic}. Target audience: {audience}. Duration: {duration} hours."
        r = await httpx.AsyncClient().post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
                "max_tokens": 2000,
            },
            timeout=30.0,
        )
        if r.status_code != 200:
            return None
        content = (r.json().get("choices", [{}])[0].get("message", {}).get("content") or "").strip()
        content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)
    except Exception:
        return None


@router.post("/ai-generate")
async def ai_generate_module(
    data: AIModuleGenerate,
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """AI generates module structure, lessons outline, draft quiz. Human must review before publish."""
    result = await _generate_ai_module(data.topic, data.target_audience, data.duration_hours)
    if not result:
        # Fallback when no OpenAI
        slug = data.topic.lower().replace(" ", "-")[:50]
        return {
            "title": data.topic,
            "description": f"Training module on {data.topic} for {data.target_audience}.",
            "lessons": [
                {"title": "Introduction", "content_type": "text", "suggested_content": "Overview and objectives"},
                {"title": "Core Concepts", "content_type": "text", "suggested_content": "Key principles"},
                {"title": "Practical Application", "content_type": "text", "suggested_content": "Examples and exercises"},
                {"title": "Summary", "content_type": "text", "suggested_content": "Recap and next steps"},
            ],
            "quiz_questions": [
                {"question": "What is the main focus of this module?", "options": ["A", "B", "C", "D"], "correct_idx": 0, "feedback_correct": "Correct!", "feedback_incorrect": "Review the introduction."},
            ],
            "slug": slug,
        }
    result["slug"] = data.topic.lower().replace(" ", "-")[:50].replace("'", "")
    return result


# --- Curated modules (read-only, shown to admin so they see what trainees see) ---
@router.get("/curated-modules")
async def list_curated_modules(
    user: User = Depends(require_role("super_admin")),
) -> list:
    """List curated trainee modules (read-only). Admin sees these alongside academy modules."""
    out = []
    for m in TRAINEE_MODULES:
        lessons = m.get("lessons_data", [])
        out.append({
            "id": m.get("id", ""),
            "slug": m.get("title", "").lower().replace(" ", "-")[:50],
            "title": m.get("title", ""),
            "description": m.get("description", ""),
            "thumbnail_url": None,
            "difficulty": "beginner",
            "tags": [],
            "visibility": "public",
            "target_audience": "trainee",
            "order_index": 0,
            "is_published": True,
            "archived_at": None,
            "lesson_count": len(lessons),
            "quiz_count": 1 if m.get("module_exam") else 0,
            "created_at": None,
            "is_curated": True,
        })
    return out


# --- Module CRUD ---
@router.get("/modules")
async def list_academy_modules(
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> list:
    """List all academy modules. Excludes archived by default."""
    q = select(AcademyModule)
    if not include_archived:
        q = q.where(AcademyModule.archived_at.is_(None))
    q = q.order_by(AcademyModule.order_index, AcademyModule.title)
    result = await db.execute(q)
    modules = result.scalars().all()
    out = []
    for m in modules:
        lesson_count = await db.execute(select(func.count(AcademyLesson.id)).where(AcademyLesson.module_id == m.id))
        quiz_count = await db.execute(select(func.count(AcademyQuiz.id)).where(AcademyQuiz.module_id == m.id))
        out.append({
            "id": str(m.id),
            "slug": m.slug,
            "title": m.title,
            "description": m.description,
            "thumbnail_url": m.thumbnail_url,
            "difficulty": m.difficulty,
            "tags": m.tags or [],
            "visibility": m.visibility,
            "target_audience": getattr(m, "target_audience", None) or "trainee",
            "order_index": m.order_index,
            "is_published": m.is_published,
            "archived_at": m.archived_at.isoformat() if m.archived_at else None,
            "version": m.version,
            "lesson_count": lesson_count.scalar() or 0,
            "quiz_count": quiz_count.scalar() or 0,
            "created_at": m.created_at.isoformat(),
            "is_curated": False,
        })
    return out


@router.post("/modules")
async def create_academy_module(
    data: ModuleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Create a new academy module."""
    existing = await db.execute(select(AcademyModule).where(AcademyModule.slug == data.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug already exists")
    mod = AcademyModule(
        slug=data.slug,
        title=data.title,
        description=data.description,
        thumbnail_url=data.thumbnail_url,
        difficulty=data.difficulty,
        tags=data.tags,
        visibility=data.visibility,
        target_audience=getattr(data, "target_audience", "trainee") or "trainee",
        tenant_id=user.tenant_id,
    )
    db.add(mod)
    await db.flush()
    return {"id": str(mod.id), "slug": mod.slug, "title": mod.title}


@router.get("/modules/{module_id}")
async def get_academy_module(
    module_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Get module with lessons and quizzes."""
    result = await db.execute(select(AcademyModule).where(AcademyModule.id == module_id))
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    lessons_result = await db.execute(
        select(AcademyLesson).where(AcademyLesson.module_id == module_id).order_by(AcademyLesson.order_index)
    )
    lessons = lessons_result.scalars().all()
    quizzes_result = await db.execute(
        select(AcademyQuiz).where(AcademyQuiz.module_id == module_id)
    )
    quizzes = quizzes_result.scalars().all()
    return {
        "id": str(mod.id),
        "slug": mod.slug,
        "title": mod.title,
        "description": mod.description,
        "thumbnail_url": mod.thumbnail_url,
        "difficulty": mod.difficulty,
        "tags": mod.tags or [],
        "visibility": mod.visibility,
        "order_index": mod.order_index,
        "is_published": mod.is_published,
        "archived_at": mod.archived_at.isoformat() if mod.archived_at else None,
        "version": mod.version,
        "target_audience": getattr(mod, "target_audience", None) or "trainee",
        "lessons": [
            {
                "id": str(l.id),
                "title": l.title,
                "content_type": l.content_type,
                "content_html": l.content_html,
                "video_url": l.video_url,
                "file_url": l.file_url,
                "order_index": l.order_index,
                "duration_minutes": l.duration_minutes,
            }
            for l in lessons
        ],
        "quizzes": [
            {
                "id": str(q.id),
                "title": q.title,
                "passing_score_pct": q.passing_score_pct,
                "questions_json": q.questions_json,
                "time_limit_minutes": q.time_limit_minutes,
                "randomize_questions": q.randomize_questions,
                "retry_attempts": q.retry_attempts,
                "is_final_exam": q.is_final_exam,
            }
            for q in quizzes
        ],
        "created_at": mod.created_at.isoformat(),
    }


@router.patch("/modules/{module_id}")
async def update_academy_module(
    module_id: uuid.UUID,
    data: ModuleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Update academy module."""
    result = await db.execute(select(AcademyModule).where(AcademyModule.id == module_id))
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    if mod.archived_at:
        raise HTTPException(status_code=400, detail="Cannot update archived module")
    updates = data.model_dump(exclude_unset=True)
    for k, v in updates.items():
        setattr(mod, k, v)
    mod.version += 1
    await db.flush()
    return {"id": str(mod.id), "version": mod.version}


@router.delete("/modules/{module_id}")
async def archive_academy_module(
    module_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Soft delete - archive module to preserve student progress history."""
    result = await db.execute(select(AcademyModule).where(AcademyModule.id == module_id))
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    mod.archived_at = datetime.utcnow()
    mod.is_published = False
    await db.flush()
    return {"id": str(mod.id), "archived": True}


@router.patch("/modules/{module_id}/unarchive")
async def unarchive_academy_module(
    module_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Restore an archived module."""
    result = await db.execute(select(AcademyModule).where(AcademyModule.id == module_id))
    mod = result.scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    mod.archived_at = None
    await db.flush()
    return {"id": str(mod.id), "archived": False}


# --- Lesson CRUD ---
@router.post("/modules/{module_id}/lessons")
async def create_lesson(
    module_id: uuid.UUID,
    data: LessonCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Create lesson in module."""
    mod = (await db.execute(select(AcademyModule).where(AcademyModule.id == module_id))).scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    lesson = AcademyLesson(
        module_id=module_id,
        title=data.title,
        content_html=data.content_html,
        content_type=data.content_type,
        video_url=data.video_url,
        file_url=data.file_url,
        order_index=data.order_index,
        duration_minutes=data.duration_minutes,
    )
    db.add(lesson)
    await db.flush()
    return {"id": str(lesson.id), "title": lesson.title}


@router.patch("/lessons/{lesson_id}")
async def update_lesson(
    lesson_id: uuid.UUID,
    data: LessonUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Update lesson."""
    result = await db.execute(select(AcademyLesson).where(AcademyLesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(lesson, k, v)
    await db.flush()
    return {"id": str(lesson.id)}


@router.delete("/lessons/{lesson_id}")
async def delete_lesson(
    lesson_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Delete lesson."""
    result = await db.execute(select(AcademyLesson).where(AcademyLesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    await db.delete(lesson)
    await db.flush()
    return {"deleted": True}


# --- Quiz CRUD ---
class AssignModuleRequest(BaseModel):
    user_id: uuid.UUID
    module_id: uuid.UUID


@router.post("/assign-module")
async def assign_module_to_student(
    data: AssignModuleRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Assign a module to a trainee. Creates AcademyModuleProgress with not_started if not exists."""
    mod = (await db.execute(select(AcademyModule).where(AcademyModule.id == data.module_id))).scalar_one_or_none()
    if not mod or mod.archived_at:
        raise HTTPException(status_code=404, detail="Module not found or archived")
    trainee = (await db.execute(select(User).where(User.id == data.user_id, User.role == "trainee"))).scalar_one_or_none()
    if not trainee:
        raise HTTPException(status_code=404, detail="Student not found or not a trainee")
    existing = (await db.execute(
        select(AcademyModuleProgress).where(
            AcademyModuleProgress.user_id == data.user_id,
            AcademyModuleProgress.module_id == data.module_id,
        )
    )).scalar_one_or_none()
    if existing:
        return {"id": str(existing.id), "status": existing.status, "message": "Already assigned"}
    prog = AcademyModuleProgress(
        user_id=data.user_id,
        module_id=data.module_id,
        status="not_started",
        progress_pct=0,
    )
    db.add(prog)
    await db.flush()
    return {"id": str(prog.id), "status": "not_started", "message": "Module assigned"}


@router.post("/quizzes")
async def create_quiz(
    data: QuizCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Create academy quiz."""
    quiz = AcademyQuiz(
        module_id=data.module_id,
        title=data.title,
        questions_json=data.questions_json,
        passing_score_pct=data.passing_score_pct,
        time_limit_minutes=data.time_limit_minutes,
        randomize_questions=data.randomize_questions,
        retry_attempts=data.retry_attempts,
        is_final_exam=data.is_final_exam,
    )
    db.add(quiz)
    await db.flush()
    return {"id": str(quiz.id), "title": quiz.title}


@router.patch("/quizzes/{quiz_id}")
async def update_quiz(
    quiz_id: uuid.UUID,
    data: QuizUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Update academy quiz."""
    result = await db.execute(select(AcademyQuiz).where(AcademyQuiz.id == quiz_id))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(quiz, k, v)
    await db.flush()
    return {"id": str(quiz.id), "title": quiz.title}


# --- Analytics ---
@router.get("/analytics/overview")
async def get_academy_analytics(
    date_from: str | None = None,
    date_to: str | None = None,
    module_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Aggregate KPIs: enrolled, completion rate, avg score, training hours."""
    # Trainees (role=trainee) as enrolled
    trainees_q = select(func.count(User.id)).where(User.role == "trainee")
    trainees_result = await db.execute(trainees_q)
    total_enrolled = trainees_result.scalar() or 0

    # Completion from AcademyModuleProgress
    completed_q = select(func.count(AcademyModuleProgress.id)).where(
        AcademyModuleProgress.status == "completed"
    )
    if module_id:
        completed_q = completed_q.where(AcademyModuleProgress.module_id == module_id)
    completed_result = await db.execute(completed_q)
    completed_count = completed_result.scalar() or 0

    # Started
    started_q = select(func.count(func.distinct(AcademyModuleProgress.user_id))).where(
        AcademyModuleProgress.status.in_(["in_progress", "completed"])
    )
    if module_id:
        started_q = started_q.where(AcademyModuleProgress.module_id == module_id)
    started_result = await db.execute(started_q)
    started_count = started_result.scalar() or 0

    completion_rate = (completed_count / started_count * 100) if started_count else 0

    # Avg quiz score
    avg_score_q = select(func.avg(AcademyQuizAttempt.score_pct))
    if module_id:
        avg_score_q = avg_score_q.join(AcademyQuiz).where(AcademyQuiz.module_id == module_id)
    avg_result = await db.execute(avg_score_q)
    avg_score = round(avg_result.scalar() or 0, 1)

    # Total training hours
    hours_q = select(func.sum(AcademyModuleProgress.time_spent_seconds))
    if module_id:
        hours_q = hours_q.where(AcademyModuleProgress.module_id == module_id)
    hours_result = await db.execute(hours_q)
    total_seconds = hours_result.scalar() or 0
    total_hours = round(total_seconds / 3600, 1)

    # Module popularity (enrollments per module)
    pop_q = (
        select(AcademyModule.title, func.count(AcademyModuleProgress.id).label("count"))
        .join(AcademyModuleProgress, AcademyModuleProgress.module_id == AcademyModule.id)
        .where(AcademyModule.archived_at.is_(None))
        .group_by(AcademyModule.id, AcademyModule.title)
        .order_by(func.count(AcademyModuleProgress.id).desc())
        .limit(10)
    )
    pop_result = await db.execute(pop_q)
    module_popularity = [{"module": r[0], "enrollments": r[1]} for r in pop_result.all()]

    # Completion funnel: not_started, in_progress, completed
    funnel_q = select(AcademyModuleProgress.status, func.count(AcademyModuleProgress.id)).group_by(
        AcademyModuleProgress.status
    )
    if module_id:
        funnel_q = funnel_q.where(AcademyModuleProgress.module_id == module_id)
    funnel_result = await db.execute(funnel_q)
    funnel_data = {r[0]: r[1] for r in funnel_result.all()}

    return {
        "total_enrolled": total_enrolled,
        "completion_rate_pct": completion_rate,
        "avg_quiz_score": avg_score,
        "total_training_hours": total_hours,
        "module_popularity": module_popularity,
        "completion_funnel": {
            "not_started": funnel_data.get("not_started", 0),
            "in_progress": funnel_data.get("in_progress", 0),
            "completed": funnel_data.get("completed", 0),
        },
    }


@router.get("/analytics/risk-alert")
async def get_risk_alert(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> list:
    """Students with >5 uncompleted tasks or stalled >30 days."""
    cutoff = datetime.utcnow() - timedelta(days=30)
    # Get trainees
    trainees_result = await db.execute(select(User).where(User.role == "trainee"))
    trainees = trainees_result.scalars().all()
    risk_list = []
    for t in trainees:
        # Count uncompleted (in_progress or not_started) modules
        prog_result = await db.execute(
            select(AcademyModuleProgress).where(
                and_(
                    AcademyModuleProgress.user_id == t.id,
                    AcademyModuleProgress.status.in_(["not_started", "in_progress"])
                )
            )
        )
        progs = prog_result.scalars().all()
        uncompleted = len(progs)
        last_activity = None
        for p in progs:
            if p.updated_at and (not last_activity or p.updated_at > last_activity):
                last_activity = p.updated_at
        stalled = last_activity and last_activity < cutoff if last_activity else (uncompleted > 5)
        if uncompleted > 5 or stalled:
            risk_list.append({
                "id": str(t.id),
                "user_id": str(t.id),
                "name": t.display_name or t.email,
                "email": t.email,
                "uncompleted_count": uncompleted,
                "stalled": stalled,
                "last_activity": last_activity.isoformat() if last_activity else None,
            })
    return risk_list


@router.get("/analytics/students")
async def list_students_for_analytics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> list:
    """List students (trainees) for drill-down."""
    result = await db.execute(
        select(User).where(User.role == "trainee").order_by(User.display_name, User.email)
    )
    trainees = result.scalars().all()
    out = []
    for t in trainees:
        prog_count = await db.execute(
            select(func.count(AcademyModuleProgress.id)).where(AcademyModuleProgress.user_id == t.id)
        )
        completed_count = await db.execute(
            select(func.count(AcademyModuleProgress.id)).where(
                and_(
                    AcademyModuleProgress.user_id == t.id,
                    AcademyModuleProgress.status == "completed"
                )
            )
        )
        out.append({
            "id": str(t.id),
            "name": t.display_name or t.email,
            "email": t.email,
            "country": t.country or "-",
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "progress_count": prog_count.scalar() or 0,
            "completed_count": completed_count.scalar() or 0,
        })
    return out


@router.get("/analytics/student/{user_id}")
async def get_student_drill_down(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Student drill-down: profile, progress radar, task list, time tracking."""
    result = await db.execute(select(User).where(User.id == user_id))
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    if student.role != "trainee":
        raise HTTPException(status_code=400, detail="User is not a trainee")

    # Progress per module
    prog_result = await db.execute(
        select(AcademyModuleProgress, AcademyModule)
        .join(AcademyModule, AcademyModule.id == AcademyModuleProgress.module_id)
        .where(AcademyModuleProgress.user_id == user_id)
    )
    rows = prog_result.all()
    task_list = []
    total_time = 0
    completed = 0
    in_progress = 0
    not_started = 0
    failed = 0
    for prog, mod in rows:
        total_time += prog.time_spent_seconds or 0
        if prog.status == "completed":
            completed += 1
        elif prog.status == "in_progress":
            in_progress += 1
        elif prog.status == "failed":
            failed += 1
        else:
            not_started += 1
        task_list.append({
            "module_id": str(mod.id),
            "module_title": mod.title,
            "status": prog.status,
            "progress_pct": prog.progress_pct,
            "time_spent_seconds": prog.time_spent_seconds or 0,
            "completed_at": prog.completed_at.isoformat() if prog.completed_at else None,
        })

    # Also include TraineeAcademyProgress for static trainee academy
    tap_result = await db.execute(select(TraineeAcademyProgress).where(TraineeAcademyProgress.user_id == user_id))
    tap = tap_result.scalar_one_or_none()
    trainee_progress = tap.progress_json if tap else {}

    return {
        "profile": {
            "id": str(student.id),
            "name": student.display_name or student.email,
            "email": student.email,
            "role": student.role,
            "country": student.country or "-",
            "join_date": student.created_at.isoformat() if student.created_at else None,
        },
        "skills_mastered": completed,
        "skills_pending": not_started + in_progress,
        "task_list": task_list,
        "total_time_seconds": total_time,
        "summary": {
            "completed": completed,
            "in_progress": in_progress,
            "not_started": not_started,
            "failed": failed,
        },
        "trainee_academy_progress": trainee_progress,
    }
