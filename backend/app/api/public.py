"""Public portal - Phase 4. Awareness, Should I Mediate?, lead-gen, free tier."""
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user_optional
from app.core.database import get_db
from app.models.tenant import User
from app.models.booking import Lead, FreeTierUsage

router = APIRouter(prefix="/public", tags=["public"])

AWARENESS_CONTENT = {
    "title": "What is Mediation?",
    "sections": [
        {
            "heading": "Mediation vs Litigation",
            "content": "Mediation is a voluntary, confidential process where a neutral third party helps disputing parties reach a mutually acceptable agreement. Unlike litigation, it's typically faster, less costly, and preserves relationships.",
        },
        {
            "heading": "Benefits",
            "content": "Faster resolution, lower costs, confidentiality, party control over the outcome, and solutions tailored to your specific needs.",
        },
        {
            "heading": "When to Consider Mediation",
            "content": "Employment disputes, commercial conflicts, family matters, landlord-tenant issues, and many other civil disputes can be effectively resolved through mediation.",
        },
    ],
}


class ShouldIMediateRequest(BaseModel):
    """Lead-gen: capture email/phone with consent."""
    email: EmailStr
    phone: str | None = None
    consent_marketing: bool = False
    dispute_type: str | None = None
    urgency: str | None = None  # low, medium, high


@router.get("/awareness")
async def get_awareness() -> dict:
    """Public awareness content. What is mediation, litigation vs mediation."""
    return AWARENESS_CONTENT


@router.post("/should-i-mediate")
async def should_i_mediate_assessment(
    data: ShouldIMediateRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """AI 'Should I Mediate?' assessment. Lead-gen: capture email/phone with consent."""
    lead = Lead(
        email=data.email,
        phone=data.phone,
        consent_marketing=data.consent_marketing,
        source="should_i_mediate",
        assessment_response={"dispute_type": data.dispute_type, "urgency": data.urgency},
    )
    db.add(lead)
    await db.flush()

    recommendation = "Consider mediation"
    if data.urgency == "high":
        recommendation = "Mediation is recommended for faster resolution. We'll follow up to schedule an intake session."
    elif data.dispute_type:
        recommendation = f"For {data.dispute_type} disputes, mediation often achieves better outcomes than litigation."

    return {
        "recommendation": recommendation,
        "lead_captured": True,
        "next_step": "Schedule a free consultation or intake session",
    }


@router.get("/free-tier")
async def get_free_tier_info() -> dict:
    """1 free mediation session to drive adoption."""
    return {
        "free_sessions": 1,
        "message": "Your first mediation session is free. Sign up to get started.",
        "conditions": "One free session per email. Subject to availability.",
    }


@router.get("/free-tier/check")
async def check_free_tier(
    email: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Check if user has free session remaining."""
    result = await db.execute(
        select(FreeTierUsage).where(FreeTierUsage.email == email)
    )
    usage = result.scalar_one_or_none()
    if not usage:
        return {"free_sessions_remaining": 1, "max_free_sessions": 1}
    remaining = max(0, usage.max_free_sessions - usage.sessions_used)
    return {
        "free_sessions_remaining": remaining,
        "max_free_sessions": usage.max_free_sessions,
        "sessions_used": usage.sessions_used,
    }
