"""Add status, onboarded_at, last_login_at to users. Run: python scripts/migrate_user_status.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.config import get_settings
from sqlalchemy.ext.asyncio import create_async_engine


async def migrate():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=True)
    async with engine.begin() as conn:
        for col, sql in [
            ("status", "ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'"),
            ("onboarded_at", "ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ"),
            ("last_login_at", "ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ"),
        ]:
            await conn.execute(text(sql))
            print(f"Ensured column: {col}")
    await engine.dispose()
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
