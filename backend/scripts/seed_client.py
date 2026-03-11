"""Ensure client user exists. Run this if client login fails: python scripts/seed_client.py"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models import User, Tenant


async def seed_client():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=True)
    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == "client@mediationfocus.co.ke"))
        if result.scalar_one_or_none():
            print("Client user already exists.")
            return
        tenant_result = await session.execute(select(Tenant).limit(1))
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            print("No tenant found. Run full seed first: python scripts/seed.py")
            return
        client = User(
            email="client@mediationfocus.co.ke",
            hashed_password=get_password_hash("client123"),
            display_name="Test Client",
            role="client_individual",
            tenant_id=tenant.id,
        )
        session.add(client)
        await session.commit()
        print("Created client user: client@mediationfocus.co.ke / client123")


if __name__ == "__main__":
    asyncio.run(seed_client())
