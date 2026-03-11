"""Add owner_id and visibility to knowledge_base_documents. Run: python scripts/migrate_knowledge_org.py"""
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
        await conn.execute(text("ALTER TABLE knowledge_base_documents ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES users(id)"))
        await conn.execute(text("ALTER TABLE knowledge_base_documents ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'private'"))
    await engine.dispose()
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
