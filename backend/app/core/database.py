"""Database connection and session management."""
import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

engine = create_async_engine(
    settings.database_url,
    echo=False,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """SQLAlchemy declarative base."""

    pass


async def get_db():
    """Dependency for async database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def migrate_training_module_archived(conn):
    """Add archived_at to training_modules if missing."""
    try:
        await conn.execute(text(
            "ALTER TABLE training_modules ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ"
        ))
        logger.info("Migration: ensured column training_modules.archived_at")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration training_modules.archived_at: %s", e)


async def migrate_academy_target_audience(conn):
    """Add target_audience to academy_modules if missing."""
    try:
        await conn.execute(text(
            "ALTER TABLE academy_modules ADD COLUMN IF NOT EXISTS target_audience VARCHAR(20) DEFAULT 'trainee'"
        ))
        logger.info("Migration: ensured column academy_modules.target_audience")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration academy_modules.target_audience: %s", e)


async def migrate_kb_fts_index(conn):
    """Add GIN index for full-text search on knowledge_base_chunks.content."""
    try:
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_kb_chunk_content_fts "
            "ON knowledge_base_chunks USING GIN (to_tsvector('english', content))"
        ))
        logger.info("Migration: ensured GIN FTS index on knowledge_base_chunks")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration kb_fts: %s", e)


async def migrate_kb_chunk_embedding(conn):
    """Add embedding_vector JSONB to knowledge_base_chunks for vector RAG."""
    try:
        await conn.execute(text(
            "ALTER TABLE knowledge_base_chunks ADD COLUMN IF NOT EXISTS embedding_vector JSONB"
        ))
        logger.info("Migration: ensured embedding_vector on knowledge_base_chunks")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration kb_chunk_embedding: %s", e)


async def migrate_session_transcripts(conn):
    """Create session_transcripts table for Phase 6b."""
    try:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS session_transcripts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                recording_id UUID NOT NULL REFERENCES session_recordings(id) ON DELETE CASCADE,
                content_text TEXT NOT NULL,
                segments_json JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_session_transcripts_recording_id "
            "ON session_transcripts (recording_id)"
        ))
        logger.info("Migration: ensured session_transcripts table")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration session_transcripts: %s", e)


async def migrate_user_id_columns(conn):
    """Add user_id, approval_status, approval_rejection_reason, submitted_by_id, must_change_password to users if missing."""
    for col, sql in [
        ("user_id", "ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id VARCHAR(30)"),
        ("approval_status", "ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'approved'"),
        ("approval_rejection_reason", "ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_rejection_reason VARCHAR(500)"),
        ("approval_notes", "ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_notes VARCHAR(500)"),
        ("submitted_by_id", "ALTER TABLE users ADD COLUMN IF NOT EXISTS submitted_by_id UUID"),
        ("must_change_password", "ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE"),
        ("deleted_at", "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE"),
        ("deactivation_reason", "ALTER TABLE users ADD COLUMN IF NOT EXISTS deactivation_reason VARCHAR(100)"),
    ]:
        try:
            await conn.execute(text(sql))
            logger.info("Migration: ensured column users.%s", col)
        except Exception as e:
            if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                logger.warning("Migration users.%s: %s", col, e)


async def migrate_invoice_user_id(conn):
    """Add user_id to invoices for client-scoped billing."""
    try:
        await conn.execute(text(
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id)"
        ))
        logger.info("Migration: ensured column invoices.user_id")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration invoices.user_id: %s", e)


async def migrate_billing_services(conn):
    """Create billing_services table for platform services."""
    try:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS billing_services (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                name VARCHAR(200) NOT NULL,
                description TEXT,
                price_minor INTEGER NOT NULL,
                currency VARCHAR(3) NOT NULL DEFAULT 'KES',
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_billing_services_tenant_id "
            "ON billing_services (tenant_id)"
        ))
        logger.info("Migration: ensured billing_services table")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration billing_services: %s", e)


async def migrate_billing_service_type(conn):
    """Add service_type to billing_services (platform | mediation)."""
    try:
        await conn.execute(text(
            "ALTER TABLE billing_services ADD COLUMN IF NOT EXISTS service_type VARCHAR(20) DEFAULT 'mediation'"
        ))
        logger.info("Migration: ensured column billing_services.service_type")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration billing_services.service_type: %s", e)


async def migrate_invoice_type_mediator(conn):
    """Add invoice_type and mediator_id to invoices for platform vs client reconciliation."""
    try:
        await conn.execute(text(
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS invoice_type VARCHAR(20) DEFAULT 'client'"
        ))
        await conn.execute(text(
            "ALTER TABLE invoices ADD COLUMN IF NOT EXISTS mediator_id UUID REFERENCES users(id)"
        ))
        logger.info("Migration: ensured columns invoices.invoice_type, invoices.mediator_id")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration invoices.invoice_type/mediator_id: %s", e)


async def migrate_payment_receipts(conn):
    """Create payment_receipts table for manual receipting (M-Pesa code, cheque, cash, EFT)."""
    try:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS payment_receipts (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
                tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
                method VARCHAR(20) NOT NULL,
                amount_minor_units BIGINT NOT NULL,
                currency_code VARCHAR(3) NOT NULL DEFAULT 'KES',
                reference VARCHAR(100),
                attachment_path VARCHAR(500),
                attachment_original_name VARCHAR(255),
                received_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
                received_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_payment_receipts_invoice_id ON payment_receipts (invoice_id)"
        ))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_payment_receipts_tenant_id ON payment_receipts (tenant_id)"
        ))
        logger.info("Migration: ensured payment_receipts table")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration payment_receipts: %s", e)


async def migrate_settlement_agreements(conn):
    """Create settlement_agreements table for Phase 6a."""
    try:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS settlement_agreements (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
                template_type VARCHAR(50) NOT NULL,
                status VARCHAR(50) DEFAULT 'draft',
                content_json JSONB,
                signatures_json JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                signed_at TIMESTAMPTZ
            )
        """))
        await conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_settlement_agreements_case_id "
            "ON settlement_agreements (case_id)"
        ))
        logger.info("Migration: ensured settlement_agreements table")
    except Exception as e:
        if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
            logger.warning("Migration settlement_agreements: %s", e)


async def init_db():
    """Initialize schema based on configured management mode."""
    mode = (settings.schema_management_mode or "runtime").strip().lower()
    if mode not in {"runtime", "alembic"}:
        logger.warning("Unknown schema_management_mode=%s. Falling back to runtime.", mode)
        mode = "runtime"

    if mode == "alembic":
        logger.info("Schema management mode is 'alembic': skipping runtime create_all/ALTER migrations.")
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await migrate_user_id_columns(conn)
        await migrate_training_module_archived(conn)
        await migrate_academy_target_audience(conn)
        await migrate_kb_fts_index(conn)
        await migrate_invoice_user_id(conn)
        await migrate_billing_services(conn)
        await migrate_billing_service_type(conn)
        await migrate_invoice_type_mediator(conn)
        await migrate_payment_receipts(conn)
        await migrate_settlement_agreements(conn)
        await migrate_kb_chunk_embedding(conn)
        await migrate_session_transcripts(conn)
