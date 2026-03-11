"""Add user intake and profile columns. Run: python scripts/migrate_user_intake.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import engine


async def migrate():
    """Add user profile and intake columns."""
    async with engine.begin() as conn:
        cols = [
            ("phone", "VARCHAR(50)"),
            ("country", "VARCHAR(10)"),
            ("profile_data", "JSONB"),
            ("assigned_mediator_id", "UUID REFERENCES users(id)"),
            ("profile_complete_at", "TIMESTAMPTZ"),
        ]
        for col, typ in cols:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {typ}"))
            except Exception as e:
                if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                    print(f"Warning: {col}: {e}")
        # Invite tokens table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS invite_tokens (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                email VARCHAR(255) NOT NULL,
                token VARCHAR(64) NOT NULL UNIQUE,
                role VARCHAR(50) NOT NULL,
                tenant_id UUID REFERENCES tenants(id),
                expires_at TIMESTAMPTZ NOT NULL,
                used_at TIMESTAMPTZ,
                created_by_id UUID REFERENCES users(id),
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
        # Mediator assignment audit log
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS mediator_assignments (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                mediator_id UUID REFERENCES users(id),
                assigned_by_id UUID REFERENCES users(id),
                reason VARCHAR(100),
                note TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))
    await engine.dispose()
    print("User intake migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
