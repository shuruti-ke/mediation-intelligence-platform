"""Judiciary case search - Phase 3. Tausi, Laws.Africa, cache."""
import hashlib
import logging
from urllib.parse import quote_plus, unquote, parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends
from pydantic import BaseModel

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User
from app.models.document import JudiciarySearchCache

router = APIRouter(prefix="/judiciary", tags=["judiciary"])
settings = get_settings()

# User-Agent for scraping (identify as a bot, be respectful)
SCRAPE_UA = "Mozilla/5.0 (compatible; MediationPlatform/1.0; +https://mediation-intelligence-platform.vercel.app)"


def _extract_ddg_url(href: str) -> str:
    """Extract real URL from DuckDuckGo redirect link."""
    if not href:
        return ""
    if "uddg=" in href:
        parsed = urlparse(href)
        qs = parse_qs(parsed.query)
        return unquote(qs.get("uddg", [""])[0]) if qs.get("uddg") else href
    return href


async def _scrape_duckduckgo(search_q: str, max_results: int = 10) -> list[dict]:
    """Generic DuckDuckGo HTML search. Returns list of {title, url, snippet}. No API keys needed."""
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": search_q},
                headers={"User-Agent": SCRAPE_UA},
            )
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        results = []
        for div in soup.find_all("div", class_="result")[:max_results]:
            link = div.find("a", class_="result__a") or div.find("a", class_="result-link")
            snippet_el = div.find("a", class_="result__snippet") or div.find("div", class_="result__snippet") or div.find("div", class_="result__body")
            if not link:
                continue
            href = link.get("href", "")
            real_url = _extract_ddg_url(href)
            if not real_url or real_url.startswith("https://duckduckgo.com"):
                continue
            title = link.get_text(strip=True)
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""
            results.append({"title": title, "url": real_url, "snippet": snippet})
        return results
    except Exception as e:
        logger.warning("DuckDuckGo scrape error: %s", str(e) or type(e).__name__)
        return []


async def scrape_kenya_law(query: str, max_results: int = 10) -> tuple[list[dict], list[str]]:
    """Search Kenya Law via DuckDuckGo HTML (site:new.kenyalaw.org). No API keys needed."""
    q = quote_plus(f"{query} site:new.kenyalaw.org")
    raw = await _scrape_duckduckgo(q, max_results)
    results = [r for r in raw if "kenyalaw.org" in r.get("url", "")]
    for r in results:
        r["source"] = "Kenya Law"
    return results, ["Kenya Law"] if results else []


# Region-specific legal databases for web search fallback (no API keys)
_REGION_SITES = {
    "AF": (None, "AfricanLII"),  # Africa-wide: African Legal Information Institute + broad search
    "ZA": ("site:saflii.org", "SAFLII"),  # Southern African Legal Information Institute
    "NG": ("site:lawpavilion.com", "Law Pavilion"),
}


async def scrape_web_search_region(query: str, region: str, max_results: int = 10) -> tuple[list[dict], list[str]]:
    """Web search for case law in a given region via DuckDuckGo. No API keys needed."""
    region = region.upper()
    if region in _REGION_SITES:
        site_op, label = _REGION_SITES[region]
        if site_op:
            search_q = f"{query} {site_op}"
        else:
            # Africa-wide: search AfricanLII + broad Africa case law
            search_q = f"{query} site:africanlii.org"
    else:
        # Generic fallback: search for query + country name + case law
        country_names = {"ZA": "South Africa", "NG": "Nigeria", "GH": "Ghana", "TZ": "Tanzania", "UG": "Uganda"}
        country = country_names.get(region, region)
        search_q = f"{query} {country} case law judiciary"
        label = "Web search"
    raw = await _scrape_duckduckgo(search_q, max_results)
    for r in raw:
        r["source"] = label
    return raw, [label] if raw else []


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

    # Check cache (may have multiple entries for same query - use most recent)
    result = await db.execute(
        select(JudiciarySearchCache)
        .where(
            JudiciarySearchCache.query_hash == query_hash,
            JudiciarySearchCache.region == data.region,
        )
        .order_by(JudiciarySearchCache.created_at.desc())
        .limit(1)
    )
    cached = result.scalar_one_or_none()
    # Don't use cache for placeholder results - run fresh search (including web search fallback)
    if cached:
        cached_results = cached.results_json or []
        is_placeholder = (
            not cached_results
            or (len(cached_results) == 1 and cached_results[0].get("source") == "system")
            or (len(cached_results) == 1 and ("Search on " in cached_results[0].get("title", "") or "No results" in cached_results[0].get("title", "")))
        )
        if not is_placeholder:
            return {"results": cached_results, "sources": ["cache"], "query": data.query, "cached": True}

    results = []
    sources = []

    # Laws.Africa API (legislation) - v3/search may return 404 if endpoint changed/deprecated
    if settings.laws_africa_api_key and data.region.upper() != "AF":
        try:
            async with httpx.AsyncClient() as client:
                r = await client.get(
                    "https://api.laws.africa/v3/search",
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
                elif r.status_code == 404:
                    logger.debug("Laws.Africa /v3/search not found (endpoint may have changed)")
                else:
                    logger.warning("Laws.Africa API returned %s: %s", r.status_code, r.text[:200])
        except Exception as e:
            logger.warning("Laws.Africa API error: %s", e)

    # Tausi API (Kenya judicial decisions)
    if data.region.upper() == "KE" and settings.tausi_api_key:
        try:
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

    # Fallback: scrape Kenya Law via DuckDuckGo search (no API keys needed)
    if not results and data.region.upper() == "KE":
        try:
            results, sources = await scrape_kenya_law(data.query)
        except Exception as e:
            logger.warning("Kenya Law scrape error: %s", str(e) or type(e).__name__)
            results = []
            sources = []

    # Fallback for other regions (ZA, NG, etc.): web search via DuckDuckGo - no API keys needed
    if not results and data.region.upper() != "KE":
        try:
            results, sources = await scrape_web_search_region(data.query, data.region)
        except Exception as e:
            logger.warning("Web search fallback error: %s", str(e) or type(e).__name__)
            results = []
            sources = []

    # Final fallback when nothing worked
    if not results:
        if data.region.upper() == "KE":
            results = [{
                "title": "Search on Kenya Law",
                "snippet": "Could not fetch results. Search directly on Kenya Law.",
                "url": f"https://new.kenyalaw.org/search/?q={quote_plus(data.query)}",
                "source": "Kenya Law",
            }]
            sources = ["Kenya Law"]
        elif data.region.upper() == "ZA":
            results = [{
                "title": "Search on SAFLII",
                "snippet": "Could not fetch results. Search directly on SAFLII (Southern African Legal Information Institute).",
                "url": f"https://www.saflii.org/search.html?q={quote_plus(data.query)}",
                "source": "SAFLII",
            }]
            sources = ["SAFLII"]
        elif data.region.upper() == "NG":
            results = [{
                "title": "Search on Law Pavilion",
                "snippet": "Could not fetch results. Search directly on Law Pavilion.",
                "url": f"https://www.lawpavilion.com/search/?q={quote_plus(data.query)}",
                "source": "Law Pavilion",
            }]
            sources = ["Law Pavilion"]
        elif data.region.upper() == "AF":
            results = [{
                "title": "Search on AfricanLII",
                "snippet": "Could not fetch results. Search directly on AfricanLII (African Legal Information Institute).",
                "url": f"https://africanlii.org/en/search/?keywords={quote_plus(data.query)}",
                "source": "AfricanLII",
            }]
            sources = ["AfricanLII"]
        else:
            results = [{
                "title": "No results",
                "snippet": f"No case law sources configured for {data.region}. Try Kenya, South Africa, or Nigeria.",
                "source": "system",
            }]
            sources = ["system"]

    # Cache results (skip caching placeholders so next search tries scrape again)
    is_placeholder = (
        len(results) == 1
        and (
            results[0].get("source") == "system"
            or "Search on " in results[0].get("title", "")
            or "No results" in results[0].get("title", "")
        )
    )
    if not is_placeholder:
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
    sources.append("Kenya Law (KE)")
    sources.append("AfricanLII (Africa-wide), SAFLII (ZA), Law Pavilion (NG)")
    return {
        "sources": sources,
        "keys_configured": {
            "laws_africa": bool(settings.laws_africa_api_key),
            "tausi": bool(settings.tausi_api_key),
        },
    }


@router.delete("/cache")
async def clear_cache(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Clear judiciary search cache (e.g. after configuring API keys)."""
    from sqlalchemy import delete
    await db.execute(delete(JudiciarySearchCache))
    await db.flush()
    return {"message": "Cache cleared"}
