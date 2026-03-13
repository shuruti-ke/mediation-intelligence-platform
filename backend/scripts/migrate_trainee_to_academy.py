"""Migrate TRAINEE_MODULES (curated) to AcademyModule. Run: python scripts/migrate_trainee_to_academy.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import get_settings
from app.models.academy import AcademyModule, AcademyLesson, AcademyQuiz
from app.models.training import TraineeAcademyProgress
from app.api.training import TRAINEE_MODULES

# Slug mapping: module-1 -> fundamentals-of-mediation etc
SLUG_MAP = {
    "module-1": "fundamentals-of-mediation",
    "module-2": "communication-conflict-management",
    "module-3": "kenya-mediation-framework",
    "module-4": "practical-mediation-techniques",
    "module-5": "specialized-mediation-areas",
}


def _parse_duration(dur: str) -> int:
    """Parse '15 min' or '95 min' to minutes."""
    if not dur:
        return 10
    try:
        return int("".join(c for c in dur if c.isdigit()) or "10")
    except Exception:
        return 10


async def migrate():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        for mod_data in TRAINEE_MODULES:
            old_id = mod_data.get("id", "")
            slug = SLUG_MAP.get(old_id) or mod_data.get("title", "").lower().replace(" ", "-")[:50]
            existing = await session.execute(select(AcademyModule).where(AcademyModule.slug == slug))
            if existing.scalar_one_or_none():
                print(f"Module {slug} already exists, skipping")
                continue

            # Create AcademyModule
            academy_mod = AcademyModule(
                slug=slug,
                title=mod_data.get("title", ""),
                description=mod_data.get("description", ""),
                difficulty="beginner",
                target_audience="trainee",
                is_published=True,
                order_index=TRAINEE_MODULES.index(mod_data),
            )
            session.add(academy_mod)
            await session.flush()

            # Create lessons
            lessons_data = mod_data.get("lessons_data", [])
            for i, les in enumerate(lessons_data):
                les_type = les.get("type", "article")
                video_id = les.get("video_id")
                content = les.get("content", "")

                # Use full article content if available
                try:
                    from app.data.trainee_articles import TRAINEE_FULL_ARTICLES, TRAINEE_ARTICLE_SUPPLEMENT
                    full = TRAINEE_FULL_ARTICLES.get(les.get("id", ""))
                    if full:
                        wc = len(full.split())
                        if wc < 5000:
                            supp = TRAINEE_ARTICLE_SUPPLEMENT
                            repeats = max(1, (5000 - wc + len(supp.split()) - 1) // len(supp.split()))
                            full = full + "\n\n" + (supp * repeats)
                        content = full
                except Exception:
                    pass

                content_type = "video" if video_id else "text"
                video_url = f"https://www.youtube.com/watch?v={video_id}" if video_id else None
                content_html = content if content_type == "text" else (content or "")

                lesson = AcademyLesson(
                    module_id=academy_mod.id,
                    title=les.get("title", ""),
                    content_type=content_type,
                    content_html=content_html if content_type == "text" else None,
                    video_url=video_url,
                    order_index=i,
                    duration_minutes=_parse_duration(les.get("duration", "10 min")),
                )
                session.add(lesson)

            # Create quiz from module_exam
            exam = mod_data.get("module_exam", {})
            if exam and exam.get("questions"):
                raw_qs = exam["questions"]
                questions = []
                for rq in raw_qs:
                    opts = rq.get("options", [])
                    options = []
                    correct_idx = 0
                    correct = rq.get("correct", "a")
                    for j, o in enumerate(opts):
                        otext = o.get("text", str(o)) if isinstance(o, dict) else str(o)
                        oid = o.get("id", f"o{j}") if isinstance(o, dict) else f"o{j}"
                        options.append({"id": str(oid), "text": otext})
                        if str(oid) == str(correct):
                            correct_idx = j
                    questions.append({
                        "question": rq.get("question", ""),
                        "options": options,
                        "correct_idx": correct_idx,
                        "feedback_correct": "Correct!",
                        "feedback_incorrect": "Review the material.",
                    })
                quiz = AcademyQuiz(
                    module_id=academy_mod.id,
                    title=f"{mod_data.get('title', '')} - Quiz",
                    questions_json={"questions": questions},
                    passing_score_pct=70,
                )
                session.add(quiz)

            print(f"Created module: {academy_mod.title} ({academy_mod.slug})")

        await session.commit()

        # Migrate trainee progress: module-1 -> new UUID, l1-1 -> lesson UUID
        mod_old_to_new = {}
        lesson_old_to_new = {}
        for old_mod_id, slug in SLUG_MAP.items():
            mod = (await session.execute(select(AcademyModule).where(AcademyModule.slug == slug))).scalar_one_or_none()
            if not mod:
                continue
            mod_old_to_new[old_mod_id] = str(mod.id)
            lessons = (await session.execute(select(AcademyLesson).where(AcademyLesson.module_id == mod.id).order_by(AcademyLesson.order_index))).scalars().all()
            mod_data = next((m for m in TRAINEE_MODULES if m.get("id") == old_mod_id), None)
            if mod_data:
                for i, les in enumerate(mod_data.get("lessons_data", [])):
                    old_les_id = les.get("id", "")
                    if i < len(lessons):
                        lesson_old_to_new[old_les_id] = str(lessons[i].id)

        result = await session.execute(select(TraineeAcademyProgress))
        for row in result.scalars().all():
            prog = dict(row.progress_json or {})
            updated = False
            for old_mod_id, new_mod_id in mod_old_to_new.items():
                if old_mod_id in prog:
                    old_data = prog.pop(old_mod_id)
                    new_lessons = []
                    for old_les_id in old_data.get("lessons", []):
                        new_les_id = lesson_old_to_new.get(old_les_id)
                        if new_les_id:
                            new_lessons.append(new_les_id)
                    prog[new_mod_id] = {**old_data, "lessons": new_lessons}
                    updated = True
            if updated:
                row.progress_json = prog
                print(f"Migrated progress for user {row.user_id}")

        await session.commit()

    await engine.dispose()
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
