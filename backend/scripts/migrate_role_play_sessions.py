"""Add role_play_sessions table. Run: python scripts/migrate_role_play_sessions.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import engine


async def migrate():
    """Create role_play_sessions table."""
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS role_play_sessions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES users(id),
                scenario_id UUID NOT NULL REFERENCES role_play_scenarios(id),
                messages_json JSONB DEFAULT '[]',
                status VARCHAR(20) DEFAULT 'active',
                debrief_json JSONB,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                ended_at TIMESTAMPTZ
            )
        """))
    await engine.dispose()
    print("Role-play sessions migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
