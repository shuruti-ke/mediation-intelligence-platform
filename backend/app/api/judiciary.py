"""Judiciary case search - Phase 3. Tausi, Laws.Africa, cache."""
import hashlib

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User
from app.models.document import JudiciarySearchCache

router = APIRouter(prefix="/judiciary", tags=["judiciary"])
settings = get_settings()


class SearchRequest(BaseModel):
    query: str
    region: str = "KE"


@router.post("/search")
async def search_judiciary(
    data: SearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Search judiciary/case databases. Caches results."""
    query_hash = hashlib.sha256(f"{data.query}:{data.region}".encode()).hexdigest()

    # Check cache
    result = await db.execute(
        select(JudiciarySearchCache)
        .where(
            JudiciarySearchCache.query_hash == query_hash,
            JudiciarySearchCache.region == data.region,
        )
    )
    cached = result.scalar_one_or_none()
    if cached:
        return {"results": cached.results_json, "sources": ["cache"], "query": data.query, "cached": True}

    results = []
    sources = []

    # Laws.Africa API (legislation, not cases - but useful for legal context)
    if settings.laws_africa_api_key:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    f"https://api.laws.africa/v3/search",
                    params={"q": data.query, "country": data.region.lower()},
                    headers={"Authorization": f"Token {settings.laws_africa_api_key}"},
                    timeout=15,
                )
                if r.status_code == 200:
                    data_res = r.json()
                    items = data_res.get("results", [])[:10]
                    for item in items:
                        results.append({
                            "title": item.get("title", ""),
                            "url": item.get("url", ""),
                            "snippet": item.get("snippet", ""),
                            "source": "Laws.Africa",
                        })
                    if items:
                        sources.append("Laws.Africa")
        except Exception:
            pass

    # Tausi API (Kenya judicial decisions)
    if data.region.upper() == "KE" and settings.tausi_api_key:
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    "https://api.tausi.laws.africa/v1/decisions",
                    params={"q": data.query},
                    headers={"Authorization": f"Token {settings.tausi_api_key}"},
                    timeout=15,
                )
                if r.status_code == 200:
                    data_res = r.json()
                    items = data_res.get("results", [])[:10]
                    for item in items:
                        results.append({
                            "title": item.get("title", item.get("citation", "")),
                            "url": item.get("url", ""),
                            "snippet": item.get("summary", ""),
                            "source": "Tausi",
                            "court": item.get("court"),
                            "date": item.get("date"),
                        })
                    if items:
                        sources.append("Tausi")
        except Exception:
            pass

    # Fallback: return placeholder with search tips
    if not results:
        results = [{
            "title": "No API results",
            "snippet": f"Configure LAWS_AFRICA_API_KEY and/or TAUSI_API_KEY for {data.region} to search judiciary databases. See IMPLEMENTATION_PLAN.md.",
            "source": "system",
        }]
        sources = ["system"]

    # Cache results
    cache_entry = JudiciarySearchCache(
        query_hash=query_hash,
        region=data.region,
        results_json=results,
    )
    db.add(cache_entry)
    await db.flush()

    return {"results": results, "sources": sources, "query": data.query, "cached": False}


@router.get("/sources")
async def list_sources(
    user: User = Depends(get_current_user),
) -> dict:
    """List configured sources by region."""
    sources = []
    if settings.laws_africa_api_key:
        sources.append("Laws.Africa")
    if settings.tausi_api_key:
        sources.append("Tausi (Kenya)")
    if not sources:
        sources.append("Configure API keys for judiciary search")
    return {"sources": sources}
