"""Seed database with initial tenant and super_admin user."""
import asyncio
import uuid

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

# Add parent to path
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Base
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models import Tenant, User, Case, UsageMeteringEvent, AnalyticsEvent, Document, KnowledgeBaseDocument, KnowledgeBaseChunk, JudiciarySearchCache, TrainingModule


async def seed():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(select(Tenant).limit(1))
        tenant = result.scalar_one_or_none()

        if not tenant:
            tenant = Tenant(
                name="Mediation Focus",
                data_residency_region="af-south-1",
                commercial_config={
                    "payment_methods_enabled": False,
                    "ai_features_enabled": True,
                    "branding": {},
                },
            )
            session.add(tenant)
            await session.flush()

            user = User(
                email="admin@mediationfocus.co.ke",
                hashed_password=get_password_hash("admin123"),
                display_name="Super Admin",
                role="super_admin",
                tenant_id=tenant.id,
            )
            session.add(user)
            mediator = User(
                email="mediator@mediationfocus.co.ke",
                hashed_password=get_password_hash("mediator123"),
                display_name="Test Mediator",
                role="mediator",
                tenant_id=tenant.id,
            )
            session.add(mediator)
            await session.flush()
            print("Seeded: tenant, super_admin (admin@mediationfocus.co.ke / admin123), mediator (mediator@mediationfocus.co.ke / mediator123)")

        # Phase 5: Seed induction modules (if none exist)
        mod_result = await session.execute(select(TrainingModule).limit(1))
        if not mod_result.scalar_one_or_none():
            for i, (slug, title, desc) in enumerate([
                ("orientation", "Orientation", "Welcome to the Mediation Intelligence Platform. Learn the basics of the system."),
                ("ethics", "Ethics in Mediation", "Core ethical principles: neutrality, confidentiality, informed consent."),
                ("online_mediation_intro", "Online Mediation Intro", "Best practices for conducting mediation sessions online."),
            ]):
                mod = TrainingModule(
                    tenant_id=tenant.id,
                    slug=slug,
                    title=title,
                    description=desc,
                    content_html=f"<h2>{title}</h2><p>{desc}</p><p>Complete this module to earn CPD credits.</p>",
                    order_index=i,
                )
                session.add(mod)
            print("Seeded: 3 training modules")

        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
