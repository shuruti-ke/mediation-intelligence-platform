"""Add rich case columns and new tables. Run: python scripts/migrate_case_rich.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.config import get_settings
from app.core.database import Base, engine
from app.models.case import Case, CaseTimelineEvent, CaseParty, CaseExternalLink


async def migrate():
    """Add new columns to cases, create new tables."""
    async with engine.begin() as conn:
        # Add columns to cases (IF NOT EXISTS for PostgreSQL)
        cols = [
            ("updated_at", "TIMESTAMPTZ DEFAULT NOW()"),
            ("created_by_id", "UUID REFERENCES users(id)"),
            ("internal_reference", "VARCHAR(50)"),
            ("title", "VARCHAR(200)"),
            ("short_description", "VARCHAR(500)"),
            ("case_type", "VARCHAR(50)"),
            ("case_type_other", "VARCHAR(100)"),
            ("priority_level", "VARCHAR(20)"),
            ("tags", "JSONB"),
            ("detailed_narrative", "TEXT"),
            ("desired_outcome", "TEXT"),
            ("desired_outcome_structured", "JSONB"),
            ("jurisdiction_country", "VARCHAR(10)"),
            ("jurisdiction_region", "VARCHAR(100)"),
            ("jurisdiction_county_state", "VARCHAR(100)"),
            ("applicable_laws", "TEXT"),
            ("cultural_considerations", "TEXT"),
            ("additional_notes", "TEXT"),
            ("confidentiality_level", "VARCHAR(30)"),
            ("estimated_duration", "VARCHAR(100)"),
            ("preferred_format", "JSONB"),
            ("last_auto_save_at", "TIMESTAMPTZ"),
        ]
        for col, typ in cols:
            try:
                await conn.execute(text(f"ALTER TABLE cases ADD COLUMN IF NOT EXISTS {col} {typ}"))
            except Exception as e:
                if "already exists" not in str(e).lower() and "duplicate" not in str(e).lower():
                    print(f"Warning: {col}: {e}")
        # Create new tables
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
