"""Judiciary case search - Phase 3. Tausi, Laws.Africa, cache."""
from datetime import datetime, timezone
import hashlib
import logging
import re
from typing import Any
from urllib.parse import quote_plus, unquote, parse_qs, urlparse

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, or_, select

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User
from app.models.document import JudiciaryCorpusEntry, JudiciarySearchCache

router = APIRouter(prefix="/judiciary", tags=["judiciary"])
settings = get_settings()

# User-Agent for scraping (identify as a bot, be respectful)
SCRAPE_UA = "Mozilla/5.0 (compatible; MediationPlatform/1.0; +https://mediation-intelligence-platform.vercel.app)"
PRIMARY_SOURCES = {"Laws.Africa", "Tausi"}
_CITATION_YEAR_RE = re.compile(r"(19|20)\d{2}")


def _provider_enabled(provider: str) -> bool:
    flags = {
        "laws_africa": settings.judiciary_enable_laws_africa,
        "tausi": settings.judiciary_enable_tausi,
        "kenya_law_scrape": settings.judiciary_enable_kenya_law_scrape,
        "web_fallback": settings.judiciary_enable_web_fallback,
        "local_corpus": settings.judiciary_enable_local_corpus,
    }
    return bool(flags.get(provider, False))


def _with_result_metadata(items: list[dict], default_confidence: float) -> list[dict]:
    fetched_at = datetime.now(timezone.utc).isoformat()
    enriched: list[dict[str, Any]] = []
    for item in items:
        row = dict(item)
        source = row.get("source", "")
        row["source_url"] = row.get("url", "")
        row["confidence"] = row.get("confidence", default_confidence)
        row["fetched_at"] = row.get("fetched_at", fetched_at)
        if source in PRIMARY_SOURCES:
            row["source_type"] = "primary"
        elif source == "Local corpus":
            row["source_type"] = "local"
        elif source == "system":
            row["source_type"] = "system"
        else:
            row["source_type"] = "fallback"
        enriched.append(row)
    return enriched


def _is_valid_citation(citation: str) -> bool:
    c = citation.strip()
    if not c or len(c) > 255:
        return False
    return bool(_CITATION_YEAR_RE.search(c))


def _apply_result_guardrails(results: list[dict]) -> list[dict]:
    guarded: list[dict] = []
    for item in results:
        row = dict(item)
        flags: list[str] = []
        confidence = float(row.get("confidence", 0.4))
        source_url = (row.get("source_url") or row.get("url") or "").strip()

        citation = row.get("citation")
        if citation:
            is_valid = _is_valid_citation(str(citation))
            row["citation_valid"] = is_valid
            if not is_valid:
                confidence = min(confidence, 0.65)
                flags.append("citation_format_invalid")

        # Guardrail: high-confidence legal result must have a source URL.
        if confidence >= 0.85 and not source_url:
            confidence = 0.79
            flags.append("high_confidence_without_source_url")

        # Guardrail: block uncited system assertions from being treated as legal output.
        if row.get("source") == "system" and not source_url:
            confidence = min(confidence, 0.3)
            flags.append("uncited_assertion_blocked")

        row["confidence"] = round(confidence, 2)
        if flags:
            row["guardrail_flags"] = flags
        guarded.append(row)
    return guarded


async def _search_laws_africa(query: str, region: str) -> tuple[list[dict], list[str]]:
    if not _provider_enabled("laws_africa") or not settings.laws_africa_api_key:
        return [], []
    if region.upper() == "AF":
        return [], []

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.laws.africa/v3/search",
                params={"q": query, "country": region.lower()},
                headers={"Authorization": f"Token {settings.laws_africa_api_key}"},
                timeout=15,
            )
        if r.status_code != 200:
            logger.warning("Laws.Africa API returned %s: %s", r.status_code, r.text[:200])
            return [], []

        data_res = r.json()
        items = data_res.get("results", [])[:10]
        results = [{
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "snippet": item.get("snippet", ""),
            "source": "Laws.Africa",
        } for item in items]
        return _with_result_metadata(results, default_confidence=0.9), (["Laws.Africa"] if items else [])
    except Exception as e:
        logger.warning("Laws.Africa API error: %s", e)
        return [], []


async def _search_tausi(query: str, region: str) -> tuple[list[dict], list[str]]:
    if not _provider_enabled("tausi") or not settings.tausi_api_key:
        return [], []
    if region.upper() != "KE":
        return [], []

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                "https://api.tausi.laws.africa/v1/decisions",
                params={"q": query},
                headers={"Authorization": f"Token {settings.tausi_api_key}"},
                timeout=15,
            )
        if r.status_code != 200:
            logger.warning("Tausi API returned %s: %s", r.status_code, r.text[:200])
            return [], []

        data_res = r.json()
        items = data_res.get("results", [])[:10]
        results = [{
            "title": item.get("title", item.get("citation", "")),
            "url": item.get("url", ""),
            "snippet": item.get("summary", ""),
            "source": "Tausi",
            "court": item.get("court"),
            "date": item.get("date"),
        } for item in items]
        return _with_result_metadata(results, default_confidence=0.92), (["Tausi"] if items else [])
    except Exception as e:
        logger.warning("Tausi API error: %s", e)
        return [], []


def _to_dedupe_key(
    title: str,
    region: str,
    citation: str | None = None,
    year: int | None = None,
    court: str | None = None,
) -> str:
    raw = f"{(citation or '').strip().lower()}|{title.strip().lower()}|{(court or '').strip().lower()}|{year or ''}|{region.upper()}"
    return hashlib.sha256(raw.encode()).hexdigest()


async def _search_local_corpus(
    db: AsyncSession,
    query: str,
    region: str,
    limit: int = 10,
) -> tuple[list[dict], list[str]]:
    if not _provider_enabled("local_corpus"):
        return [], []

    query_tokens = [t.strip() for t in query.split() if t.strip()]
    if not query_tokens:
        return [], []

    filters = []
    for token in query_tokens:
        like = f"%{token}%"
        filters.append(
            or_(
                JudiciaryCorpusEntry.title.ilike(like),
                JudiciaryCorpusEntry.summary.ilike(like),
                JudiciaryCorpusEntry.content_text.ilike(like),
                JudiciaryCorpusEntry.citation.ilike(like),
                JudiciaryCorpusEntry.court.ilike(like),
            )
        )

    region_u = region.upper()
    result = await db.execute(
        select(JudiciaryCorpusEntry)
        .where(
            JudiciaryCorpusEntry.region.in_([region_u, "AF"]),
            *filters,
        )
        .order_by(JudiciaryCorpusEntry.updated_at.desc())
        .limit(limit * 3)
    )
    rows = result.scalars().all()
    if not rows:
        return [], []

    scored_rows: list[tuple[int, JudiciaryCorpusEntry]] = []
    for row in rows:
        haystack = " ".join(
            [
                row.title or "",
                row.summary or "",
                row.content_text or "",
                row.citation or "",
                row.court or "",
            ]
        ).lower()
        score = sum(haystack.count(token.lower()) for token in query_tokens)
        scored_rows.append((score, row))

    scored_rows.sort(key=lambda item: item[0], reverse=True)
    top_rows = [row for score, row in scored_rows if score > 0][:limit]
    if not top_rows:
        top_rows = [row for _, row in scored_rows][:limit]

    output = []
    for row in top_rows:
        output.append(
            {
                "title": row.title,
                "url": row.source_url or "",
                "snippet": row.summary or (row.content_text[:280] + ("..." if len(row.content_text) > 280 else "")),
                "source": "Local corpus",
                "court": row.court,
                "date": str(row.year) if row.year else None,
                "citation": row.citation,
            }
        )

    return _with_result_metadata(output, default_confidence=0.8), ["Local corpus"]


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
    if not _provider_enabled("kenya_law_scrape"):
        return [], []
    q = quote_plus(f"{query} site:new.kenyalaw.org")
    raw = await _scrape_duckduckgo(q, max_results)
    results = [r for r in raw if "kenyalaw.org" in r.get("url", "")]
    for r in results:
        r["source"] = "Kenya Law"
    return _with_result_metadata(results, default_confidence=0.7), (["Kenya Law"] if results else [])


# Region-specific legal databases for web search fallback (no API keys)
_REGION_SITES = {
    "AF": (None, "AfricanLII"),  # Africa-wide: African Legal Information Institute + broad search
    "ZA": ("site:saflii.org", "SAFLII"),  # Southern African Legal Information Institute
    "NG": ("site:lawpavilion.com", "Law Pavilion"),
}


async def scrape_web_search_region(query: str, region: str, max_results: int = 10) -> tuple[list[dict], list[str]]:
    """Web search for case law in a given region via DuckDuckGo. No API keys needed."""
    if not _provider_enabled("web_fallback"):
        return [], []
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
    return _with_result_metadata(raw, default_confidence=0.55), ([label] if raw else [])


class SearchRequest(BaseModel):
    query: str
    region: str = "KE"
    mode: str = "live"  # live | fast


class CorpusIngestItem(BaseModel):
    title: str
    region: str = "KE"
    citation: str | None = None
    court: str | None = None
    year: int | None = None
    source_url: str | None = None
    summary: str | None = None
    content_text: str = Field(min_length=20)
    tags: list[str] = Field(default_factory=list)
    metadata_json: dict[str, Any] = Field(default_factory=dict)


class CorpusIngestRequest(BaseModel):
    entries: list[CorpusIngestItem]
    overwrite_existing: bool = True


@router.post("/search")
async def search_judiciary(
    data: SearchRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Search judiciary/case databases. Caches results."""
    mode = (data.mode or "live").strip().lower()
    if mode not in {"live", "fast"}:
        mode = "live"
    query_hash = hashlib.sha256(f"{data.query}:{data.region}".encode()).hexdigest()

    # Fast mode: cache/local-first behavior.
    if mode == "fast":
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
        if cached:
            cached_results = _apply_result_guardrails(cached.results_json or [])
            is_placeholder = (
                not cached_results
                or (len(cached_results) == 1 and cached_results[0].get("source") == "system")
                or (
                    len(cached_results) == 1
                    and ("Search on " in cached_results[0].get("title", "") or "No results" in cached_results[0].get("title", ""))
                )
            )
            if not is_placeholder:
                used_sources = {r.get("source") for r in cached_results if r.get("source")}
                degraded_mode = bool(used_sources) and used_sources.isdisjoint(PRIMARY_SOURCES)
                return {
                    "results": cached_results,
                    "sources": ["cache"],
                    "query": data.query,
                    "cached": True,
                    "mode": mode,
                    "degraded_mode": degraded_mode,
                    "degraded_reason": "Using cached/fallback/local results while live primary sources are unavailable." if degraded_mode else None,
                }

    results: list[dict] = []
    sources: list[str] = []

    # Sprint 3 routing:
    # - live mode: primary first
    # - fast mode: cache/local/fallback first
    if mode == "fast":
        provider_plan = [("local_corpus", _search_local_corpus)]
        if data.region.upper() == "KE":
            provider_plan.append(("kenya_law_scrape", lambda q, r: scrape_kenya_law(q)))
        else:
            provider_plan.append(("web_fallback", scrape_web_search_region))
        provider_plan.extend(
            [
                ("laws_africa", _search_laws_africa),
                ("tausi", _search_tausi),
            ]
        )
    else:
        provider_plan = [
            ("laws_africa", _search_laws_africa),
            ("tausi", _search_tausi),
            ("local_corpus", _search_local_corpus),
        ]
        if data.region.upper() == "KE":
            provider_plan.append(("kenya_law_scrape", lambda q, r: scrape_kenya_law(q)))
        else:
            provider_plan.append(("web_fallback", scrape_web_search_region))

    for provider_name, provider_fn in provider_plan:
        if not _provider_enabled(provider_name):
            continue
        try:
            if provider_name == "local_corpus":
                provider_results, provider_sources = await _search_local_corpus(
                    db=db,
                    query=data.query,
                    region=data.region,
                )
            else:
                provider_results, provider_sources = await provider_fn(data.query, data.region)
            if provider_results:
                results = provider_results
                sources = provider_sources
                break
        except Exception as e:
            logger.warning("%s provider error: %s", provider_name, str(e) or type(e).__name__)

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
        results = _with_result_metadata(results, default_confidence=0.4)

    results = _apply_result_guardrails(results)

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

    used_sources = {r.get("source") for r in results if r.get("source")}
    degraded_mode = bool(used_sources) and used_sources.isdisjoint(PRIMARY_SOURCES)
    return {
        "results": results,
        "sources": sources,
        "query": data.query,
        "cached": False,
        "mode": mode,
        "degraded_mode": degraded_mode,
        "degraded_reason": "Live primary sources unavailable. Showing fallback/local corpus results." if degraded_mode else None,
    }


@router.post("/local-corpus/ingest")
async def ingest_local_corpus(
    payload: CorpusIngestRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Ingest or upsert judiciary documents into local corpus fallback."""
    if not _provider_enabled("local_corpus"):
        return {"inserted": 0, "updated": 0, "skipped": len(payload.entries), "message": "local corpus provider disabled"}

    inserted = 0
    updated = 0
    skipped = 0

    for entry in payload.entries:
        region = entry.region.upper()
        dedupe_key = _to_dedupe_key(
            title=entry.title,
            region=region,
            citation=entry.citation,
            year=entry.year,
            court=entry.court,
        )
        result = await db.execute(
            select(JudiciaryCorpusEntry).where(JudiciaryCorpusEntry.dedupe_key == dedupe_key).limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            if not payload.overwrite_existing:
                skipped += 1
                continue
            existing.region = region
            existing.title = entry.title
            existing.citation = entry.citation
            existing.court = entry.court
            existing.year = entry.year
            existing.source_url = entry.source_url
            existing.summary = entry.summary
            existing.content_text = entry.content_text
            existing.tags_json = entry.tags
            existing.metadata_json = entry.metadata_json
            updated += 1
            continue

        db.add(
            JudiciaryCorpusEntry(
                tenant_id=user.tenant_id,
                region=region,
                title=entry.title,
                citation=entry.citation,
                court=entry.court,
                year=entry.year,
                source_url=entry.source_url,
                summary=entry.summary,
                content_text=entry.content_text,
                tags_json=entry.tags,
                metadata_json=entry.metadata_json,
                dedupe_key=dedupe_key,
            )
        )
        inserted += 1

    await db.flush()
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "total_processed": len(payload.entries),
    }


@router.get("/local-corpus/documents")
async def list_local_corpus_documents(
    region: str | None = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """List local corpus documents for inspection."""
    stmt = select(JudiciaryCorpusEntry).order_by(JudiciaryCorpusEntry.updated_at.desc())
    count_stmt = select(func.count(JudiciaryCorpusEntry.id))

    if region:
        region_u = region.upper()
        stmt = stmt.where(JudiciaryCorpusEntry.region == region_u)
        count_stmt = count_stmt.where(JudiciaryCorpusEntry.region == region_u)

    stmt = stmt.offset(offset).limit(min(max(limit, 1), 200))

    rows_result = await db.execute(stmt)
    rows = rows_result.scalars().all()
    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one() or 0

    return {
        "total": total,
        "items": [
            {
                "id": str(row.id),
                "region": row.region,
                "title": row.title,
                "citation": row.citation,
                "court": row.court,
                "year": row.year,
                "source_url": row.source_url,
                "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            }
            for row in rows
        ],
    }


@router.get("/sources")
async def list_sources(
    user: User = Depends(get_current_user),
) -> dict:
    """List configured sources by region."""
    sources = []
    if _provider_enabled("laws_africa") and settings.laws_africa_api_key:
        sources.append("Laws.Africa")
    if _provider_enabled("tausi") and settings.tausi_api_key:
        sources.append("Tausi (Kenya)")
    if _provider_enabled("kenya_law_scrape"):
        sources.append("Kenya Law (KE)")
    if _provider_enabled("web_fallback"):
        sources.append("AfricanLII (Africa-wide), SAFLII (ZA), Law Pavilion (NG)")
    if _provider_enabled("local_corpus"):
        sources.append("Local corpus (fallback)")
    return {
        "sources": sources,
        "providers_enabled": {
            "laws_africa": settings.judiciary_enable_laws_africa,
            "tausi": settings.judiciary_enable_tausi,
            "kenya_law_scrape": settings.judiciary_enable_kenya_law_scrape,
            "web_fallback": settings.judiciary_enable_web_fallback,
            "local_corpus": settings.judiciary_enable_local_corpus,
        },
        "keys_configured": {
            "laws_africa": bool(settings.laws_africa_api_key),
            "tausi": bool(settings.tausi_api_key),
        },
    }


@router.get("/health")
async def health_sources(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Provider health and configuration status for judiciary adapters."""
    providers: dict[str, dict[str, Any]] = {
        "laws_africa": {
            "enabled": settings.judiciary_enable_laws_africa,
            "configured": bool(settings.laws_africa_api_key),
            "healthy": False,
            "message": "disabled",
        },
        "tausi": {
            "enabled": settings.judiciary_enable_tausi,
            "configured": bool(settings.tausi_api_key),
            "healthy": False,
            "message": "disabled",
        },
        "kenya_law_scrape": {
            "enabled": settings.judiciary_enable_kenya_law_scrape,
            "configured": True,
            "healthy": False,
            "message": "disabled",
        },
        "web_fallback": {
            "enabled": settings.judiciary_enable_web_fallback,
            "configured": True,
            "healthy": False,
            "message": "disabled",
        },
        "local_corpus": {
            "enabled": settings.judiciary_enable_local_corpus,
            "configured": True,
            "healthy": False,
            "message": "disabled",
        },
    }

    if providers["laws_africa"]["enabled"] and providers["laws_africa"]["configured"]:
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get("https://api.laws.africa/")
            providers["laws_africa"]["healthy"] = r.status_code < 500
            providers["laws_africa"]["message"] = f"http_{r.status_code}"
        except Exception as e:
            providers["laws_africa"]["message"] = str(e) or type(e).__name__
    elif providers["laws_africa"]["enabled"]:
        providers["laws_africa"]["message"] = "missing_api_key"

    if providers["tausi"]["enabled"] and providers["tausi"]["configured"]:
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get("https://api.tausi.laws.africa/")
            providers["tausi"]["healthy"] = r.status_code < 500
            providers["tausi"]["message"] = f"http_{r.status_code}"
        except Exception as e:
            providers["tausi"]["message"] = str(e) or type(e).__name__
    elif providers["tausi"]["enabled"]:
        providers["tausi"]["message"] = "missing_api_key"

    if providers["kenya_law_scrape"]["enabled"]:
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get("https://new.kenyalaw.org/")
            providers["kenya_law_scrape"]["healthy"] = r.status_code < 500
            providers["kenya_law_scrape"]["message"] = f"http_{r.status_code}"
        except Exception as e:
            providers["kenya_law_scrape"]["message"] = str(e) or type(e).__name__

    if providers["web_fallback"]["enabled"]:
        try:
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get("https://html.duckduckgo.com/html/?q=legal+case+law")
            providers["web_fallback"]["healthy"] = r.status_code < 500
            providers["web_fallback"]["message"] = f"http_{r.status_code}"
        except Exception as e:
            providers["web_fallback"]["message"] = str(e) or type(e).__name__

    if providers["local_corpus"]["enabled"]:
        try:
            count_result = await db.execute(select(func.count(JudiciaryCorpusEntry.id)))
            count = int(count_result.scalar_one() or 0)
            providers["local_corpus"]["healthy"] = True
            providers["local_corpus"]["message"] = f"entries_{count}"
        except Exception as e:
            providers["local_corpus"]["message"] = str(e) or type(e).__name__

    overall_ok = any(
        provider["healthy"] and provider["enabled"]
        for provider in providers.values()
        if provider["enabled"]
    )
    return {"status": "ok" if overall_ok else "degraded", "providers": providers}


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
