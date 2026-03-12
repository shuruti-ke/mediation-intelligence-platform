"""Training Academy models - Admin-managed modules, lessons, materials, time tracking."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Boolean, Float
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AcademyModule(Base):
    """Admin-managed training module with full CMS fields."""

    __tablename__ = "academy_modules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(20), default="beginner")  # beginner, intermediate, advanced
    tags: Mapped[list] = mapped_column(JSONB, default=list)  # ["mediation", "ethics", ...]
    visibility: Mapped[str] = mapped_column(String(20), default="public")  # public, private
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # soft delete
    version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class AcademyLesson(Base):
    """Lesson within an academy module - rich text, video, file upload."""

    __tablename__ = "academy_lessons"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academy_modules.id"), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_type: Mapped[str] = mapped_column(String(20), default="text")  # text, video, file, embed
    video_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class AcademyMaterial(Base):
    """Attached materials (PDF, Video, Text) for lessons or modules."""

    __tablename__ = "academy_materials"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("academy_modules.id"), nullable=True)
    lesson_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("academy_lessons.id"), nullable=True)
    material_type: Mapped[str] = mapped_column(String(20), nullable=False)  # pdf, video, text, scorm
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    content_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    lite_mode_available: Mapped[bool] = mapped_column(Boolean, default=True)  # text alternative for low bandwidth
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class AcademyModuleProgress(Base):
    """User progress on academy modules - completion, time spent."""

    __tablename__ = "academy_module_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academy_modules.id"), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="not_started")  # not_started, in_progress, completed, failed
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0)
    lessons_completed: Mapped[list] = mapped_column(JSONB, default=list)  # [lesson_id, ...]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class AcademyQuiz(Base):
    """Quiz/assessment linked to academy module - extended from Quiz."""

    __tablename__ = "academy_quizzes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("academy_modules.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    questions_json: Mapped[dict] = mapped_column(JSONB, nullable=False)
    passing_score_pct: Mapped[int] = mapped_column(Integer, default=70)
    time_limit_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    randomize_questions: Mapped[bool] = mapped_column(Boolean, default=True)
    retry_attempts: Mapped[int] = mapped_column(Integer, default=3)
    is_final_exam: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class AcademyQuizAttempt(Base):
    """User quiz attempt for academy quizzes."""

    __tablename__ = "academy_quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    quiz_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("academy_quizzes.id"), nullable=False)
    score_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answers_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
