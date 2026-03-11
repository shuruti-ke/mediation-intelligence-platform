"""Tenant management - for super_admin."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.database import get_db
from app.models.tenant import Tenant, User
from app.schemas.tenant import TenantResponse

router = APIRouter(prefix="/tenants", tags=["tenants"])


class TenantCreate(BaseModel):
    name: str
    data_residency_region: str = "af-south-1"


@router.post("", response_model=TenantResponse)
async def create_tenant(
    data: TenantCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """Create tenant. Super-admin only."""
    tenant = Tenant(
        name=data.name,
        data_residency_region=data.data_residency_region,
        commercial_config={"payment_methods_enabled": False, "ai_features_enabled": True},
    )
    db.add(tenant)
    await db.flush()
    await db.refresh(tenant)
    return tenant


@router.get("", response_model=list[TenantResponse])
async def list_tenants(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
):
    """List all tenants. Super-admin only."""
    result = await db.execute(select(Tenant))
    return list(result.scalars().all())
