"""Add user_id, approval_status, approval_rejection_reason to users. Run: python scripts/migrate_user_id.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.database import engine


async def migrate():
    async with engine.begin() as conn:
        cols = [
            ("user_id", "VARCHAR(30)"),
            ("approval_status", "VARCHAR(30) DEFAULT 'approved'"),
            ("approval_rejection_reason", "VARCHAR(500)"),
        ]
        for col, typ in cols:
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN IF NOT EXISTS {col} {typ}"))
            except Exception as e:
                if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                    print(f"Warning: {col}: {e}")
    await engine.dispose()
    print("User ID migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
