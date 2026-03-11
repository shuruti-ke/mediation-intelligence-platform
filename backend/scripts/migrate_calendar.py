"""Create calendar tables if they don't exist. Run: python scripts/migrate_calendar.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.core.config import get_settings
from app.core.database import Base, engine
from app.models.calendar import MediatorAvailability, CalendarBooking


async def migrate():
    """Create calendar tables via metadata."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
    print("Calendar tables ensured.")


if __name__ == "__main__":
    asyncio.run(migrate())
