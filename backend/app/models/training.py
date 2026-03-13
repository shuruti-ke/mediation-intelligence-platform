"""Training, CPD, and role-play models - Phase 5."""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TrainingModule(Base):
    """Induction module: Orientation, Ethics, Online Mediation Intro."""

    __tablename__ = "training_modules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True)
    slug: Mapped[str] = mapped_column(String(50), nullable=False, index=True)  # orientation, ethics, online_mediation
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    content_html: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class TrainingProgress(Base):
    """User progress on training modules."""

    __tablename__ = "training_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("training_modules.id"), nullable=False)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    progress_pct: Mapped[int] = mapped_column(Integer, default=0)  # 0-100
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class CPDProgress(Base):
    """CPD hours and certification tracking."""

    __tablename__ = "cpd_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    hours_completed: Mapped[float] = mapped_column(default=0.0)
    hours_required: Mapped[float] = mapped_column(default=12.0)  # per year
    certifications: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # [{name, date, issuer}]
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class Quiz(Base):
    """Quiz for CPD / training."""

    __tablename__ = "quizzes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("training_modules.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    questions_json: Mapped[dict] = mapped_column(JSONB, nullable=False)  # [{q, options, correct_idx}]
    passing_score_pct: Mapped[int] = mapped_column(Integer, default=70)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class QuizAttempt(Base):
    """User quiz attempt."""

    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    quiz_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("quizzes.id"), nullable=False)
    score_pct: Mapped[int] = mapped_column(Integer, nullable=False)
    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    answers_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RolePlayScenario(Base):
    """AI-generated role-play scenario for training."""

    __tablename__ = "role_play_scenarios"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    dispute_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    scenario_json: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {parties, facts, objectives, script_hints}
    title: Mapped[str | None] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class RolePlaySession(Base):
    """Active role-play session: mediator + AI parties dialogue."""

    __tablename__ = "role_play_sessions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    scenario_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("role_play_scenarios.id"), nullable=False)
    messages_json: Mapped[list] = mapped_column(JSONB, default=lambda: [])  # [{role, text, speaker?}]
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, ended
    debrief_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {strengths, improvements, feedback}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class TrainingModuleConfig(Base):
    """Interactive steps for a training module. Enables branching based on user choices."""

    __tablename__ = "training_module_configs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("training_modules.id"), nullable=False)
    config_json: Mapped[dict] = mapped_column(JSONB, nullable=False)  # {steps: [{id, type, content?, choices?}], learning_outcomes: []}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class TraineeAcademyProgress(Base):
    """Trainee Academy progress: completed lessons, module exams, final exam."""

    __tablename__ = "trainee_academy_progress"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    progress_json: Mapped[dict] = mapped_column(JSONB, default=lambda: {})  # {module_id: {lessons: [id], exam_passed, exam_score}, final_passed}
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)


class UserModuleResponse(Base):
    """User responses to interactive module steps. Used for personalization and improving training."""

    __tablename__ = "user_module_responses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    module_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("training_modules.id"), nullable=False)
    step_id: Mapped[str] = mapped_column(String(100), nullable=False)
    response_type: Mapped[str] = mapped_column(String(20), nullable=False)  # choice, text
    response_value: Mapped[dict | None] = mapped_column(JSONB, nullable=True)  # {choice_idx} or {text}
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)


class PracticeScenarioCompletion(Base):
    """Practice scenario completion tracking - Phase 6d.3. Syncs with frontend localStorage."""

    __tablename__ = "practice_scenario_completions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    scenario_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)  # e.g. "power-imbalance"
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
