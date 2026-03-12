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


async def migrate_user_id_columns(conn):
    """Add user_id, approval_status, approval_rejection_reason to users if missing."""
    for col, sql in [
        ("user_id", "ALTER TABLE users ADD COLUMN IF NOT EXISTS user_id VARCHAR(30)"),
        ("approval_status", "ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_status VARCHAR(30) DEFAULT 'approved'"),
        ("approval_rejection_reason", "ALTER TABLE users ADD COLUMN IF NOT EXISTS approval_rejection_reason VARCHAR(500)"),
    ]:
        try:
            await conn.execute(text(sql))
            logger.info("Migration: ensured column users.%s", col)
        except Exception as e:
            if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                logger.warning("Migration users.%s: %s", col, e)


async def init_db():
    """Create all tables and run migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await migrate_user_id_columns(conn)
