"""Knowledge base - org vs mediator, ingest with visibility."""
import asyncio
import os
import re
from pathlib import Path
from urllib.parse import quote_plus, unquote, parse_qs, urlparse
from uuid import UUID

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, text

from app.api.deps import get_current_user, require_role
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User
from app.models.document import KnowledgeBaseDocument, KnowledgeBaseChunk, KnowledgeBaseFeedback
from app.services.document_parser import extract_text
from app.services.chunker import chunk_text
from app.services.embeddings import get_embedding, cosine_similarity

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
settings = get_settings()


class QueryRequest(BaseModel):
    query: str
    scope: str | None = None  # org | personal | all (default: all)


class FeedbackRequest(BaseModel):
    query: str
    answer: str | None = None
    source: str | None = None
    context_relevance: int | None = None
    answer_relevance: int | None = None
    rating: int  # 1 = thumbs up, -1 = thumbs down


def _org_or_public_filter():
    """Docs visible in org KB: owner_id is null (org doc) OR visibility='public'."""
    return or_(
        KnowledgeBaseDocument.owner_id.is_(None),
        KnowledgeBaseDocument.visibility == "public",
    )


def _tenant_filter(tenant_id):
    """Tenant scope: null (platform-wide) or matching tenant."""
    return or_(
        KnowledgeBaseDocument.tenant_id.is_(None),
        KnowledgeBaseDocument.tenant_id == tenant_id,
    )


def _mime_for_ext(ext: str) -> str:
    m = {".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ".doc": "application/msword", ".txt": "text/plain"}
    return m.get(ext.lower(), "application/octet-stream")


_STOPWORDS = {"what", "are", "the", "a", "an", "is", "it", "for", "of", "to", "in", "on", "at", "by", "with", "how", "when", "where", "which", "who", "that", "this", "and", "or", "but", "if", "as", "be", "been", "being", "have", "has", "had", "do", "does", "did", "will", "would", "could", "should", "can", "may", "might", "must", "shall"}


def _search_words(query: str) -> list[str]:
    """Extract meaningful search terms (min 3 chars, skip stopwords)."""
    words = re.findall(r"\b[a-zA-Z]{3,}\b", query.lower())
    return [w for w in words if w not in _STOPWORDS][:8]


def _extract_ddg_url(href: str) -> str:
    """Extract real URL from DuckDuckGo redirect link."""
    if not href:
        return ""
    if "uddg=" in href:
        parsed = urlparse(href)
        qs = parse_qs(parsed.query)
        return unquote(qs.get("uddg", [""])[0]) if qs.get("uddg") else href
    return href


async def _web_search_duckduckgo(search_q: str, max_results: int = 8) -> list[dict]:
    """Search via DuckDuckGo HTML. Returns title, url, snippet."""
    SCRAPE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=True) as client:
            r = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": quote_plus(search_q)},
                headers={"User-Agent": SCRAPE_UA, "Accept": "text/html,application/xhtml+xml"},
            )
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        results = []
        for div in soup.find_all("div", class_="result")[:max_results]:
            link = div.find("a", class_="result__a") or div.find("a", class_="result-link") or div.find("a", class_="result__url")
            if not link:
                continue
            href = link.get("href", "")
            real_url = _extract_ddg_url(href)
            if not real_url or real_url.startswith("https://duckduckgo.com"):
                continue
            title = link.get_text(strip=True)
            snippet_el = (
                div.find("a", class_="result__snippet")
                or div.find("div", class_="result__snippet")
                or div.find("div", class_="js-result-snippet")
                or div.find("div", class_="result__body")
            )
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""
            if not snippet:
                all_links = div.find_all("a", href=True)
                for a in all_links:
                    t = a.get_text(strip=True)
                    if len(t) > len(snippet) and len(t) > 20 and t != title:
                        snippet = t
            if not snippet:
                snippet = div.get_text(separator=" ", strip=True)[:300] or title
            results.append({"title": title or "Source", "url": real_url, "snippet": snippet})
        return results
    except Exception:
        return []


async def _web_search_books(query: str, max_results: int = 8) -> list[dict]:
    """Search for books on the topic via DuckDuckGo."""
    return await _web_search_duckduckgo(f"{query} mediation books", max_results)


async def _web_search_resources(query: str, max_results: int = 10) -> list[dict]:
    """Search for PDFs, docs, guides. Runs 3 queries in parallel."""
    search_queries = [f"{query} mediation PDF", f"{query} mediation guide filetype:pdf", f"{query} mediation handbook"]
    hits_list = await asyncio.gather(*[_web_search_duckduckgo(q, 4) for q in search_queries])
    results, seen_urls = [], set()
    for hits in hits_list:
        for r in hits:
            url = r.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                rtype = "pdf" if ".pdf" in url.lower() else "doc" if any(x in url.lower() for x in [".doc", ".docx"]) else "article"
                results.append({"title": r.get("title", ""), "url": url, "snippet": r.get("snippet", ""), "type": rtype})
                if len(results) >= max_results:
                    return results
    return results


async def _web_search_general(query: str, max_results: int = 10) -> list[dict]:
    """Search for general mediation info. Runs queries in parallel; single query often enough."""
    search_queries = [f"{query} mediation", f"{query} mediation Kenya"]
    hits_list = await asyncio.gather(*[_web_search_duckduckgo(q, 6) for q in search_queries])
    results, seen_urls = [], set()
    for hits in hits_list:
        for r in hits:
            url = r.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                results.append(r)
                if len(results) >= max_results:
                    return results
    return results


async def _score_relevance(question: str, text: str, api_key: str) -> int:
    """Score how well the text addresses the question. Returns 0-100."""
    if not api_key or not text or len(text) < 50:
        return 50
    try:
        async with httpx.AsyncClient() as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": "You are a relevance scorer. Given a question and a text, rate 0-100 how well the text directly addresses the question. Reply with ONLY a number."},
                        {"role": "user", "content": f"Question: {question}\n\nText (excerpt): {text[:1500]}\n\nRelevance score (0-100):"},
                    ],
                    "max_tokens": 5,
                },
                timeout=10,
            )
            if r.status_code == 200:
                content = r.json().get("choices", [{}])[0].get("message", {}).get("content", "50")
                return max(0, min(100, int(re.sub(r"\D", "", content) or 50)))
    except Exception:
        pass
    return 50


# --- Mediator ingest (personal KB, optional share to org) ---

@router.post("/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    visibility: str = Form("private"),  # private | public
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Upload to mediator's personal KB. visibility: private (only you) or public (included in org KB)."""
    if visibility not in ("private", "public"):
        visibility = "private"
    from pathlib import Path
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".pdf", ".docx", ".doc", ".txt"}:
        raise HTTPException(status_code=400, detail="Unsupported format")

    content = await file.read()
    try:
        text = extract_text(content, file.filename or "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {str(e)}")

    doc_title = title or (file.filename or "Untitled")
    kb_doc = KnowledgeBaseDocument(
        tenant_id=user.tenant_id,
        owner_id=user.id,
        visibility=visibility,
        title=doc_title,
        source_type="upload",
        content_text=text,
    )
    db.add(kb_doc)
    await db.flush()

    # Store original file in DB (persists on Render's ephemeral filesystem)
    kb_doc.file_content = content
    kb_doc.metadata_json = {
        "original_filename": file.filename or doc_title,
        "mime_type": file.content_type or _mime_for_ext(ext),
    }
    await db.flush()

    chunks = chunk_text(text)
    for i, chunk_content in enumerate(chunks):
        chunk = KnowledgeBaseChunk(
            document_id=kb_doc.id,
            chunk_index=i,
            content=chunk_content,
        )
        emb = get_embedding(chunk_content)
        if emb:
            chunk.embedding_vector = emb
        db.add(chunk)

    await db.flush()
    return {"document_id": str(kb_doc.id), "chunks": len(chunks), "status": "ingested", "visibility": visibility}


# --- Admin: org KB ingest ---

@router.post("/org/ingest")
async def ingest_org_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Upload to organization knowledge base. Admin only."""
    from pathlib import Path
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".pdf", ".docx", ".doc", ".txt"}:
        raise HTTPException(status_code=400, detail="Unsupported format")

    content = await file.read()
    try:
        text = extract_text(content, file.filename or "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse document: {str(e)}")

    doc_title = title or (file.filename or "Untitled")
    kb_doc = KnowledgeBaseDocument(
        tenant_id=user.tenant_id,
        owner_id=None,
        visibility="public",
        title=doc_title,
        source_type="upload",
        content_text=text,
    )
    db.add(kb_doc)
    await db.flush()

    # Store original file in DB (persists on Render's ephemeral filesystem)
    kb_doc.file_content = content
    kb_doc.metadata_json = {
        "original_filename": file.filename or doc_title,
        "mime_type": file.content_type or _mime_for_ext(ext),
    }
    await db.flush()

    chunks = chunk_text(text)
    for i, chunk_content in enumerate(chunks):
        chunk = KnowledgeBaseChunk(
            document_id=kb_doc.id,
            chunk_index=i,
            content=chunk_content,
        )
        emb = get_embedding(chunk_content)
        if emb:
            chunk.embedding_vector = emb
        db.add(chunk)

    await db.flush()
    return {"document_id": str(kb_doc.id), "chunks": len(chunks), "status": "ingested", "scope": "org"}


# --- List documents ---

@router.get("/documents")
async def list_documents(
    scope: str = Query("all", pattern="^(org|personal|all)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List documents. scope: org (org KB only), personal (your docs), all (org + your)."""
    if scope == "org":
        q = select(KnowledgeBaseDocument).where(
            _org_or_public_filter(),
            _tenant_filter(user.tenant_id),
        )
    elif scope == "personal":
        q = select(KnowledgeBaseDocument).where(KnowledgeBaseDocument.owner_id == user.id)
    else:
        # all: org docs + public mediator docs + own docs
        q = select(KnowledgeBaseDocument).where(
            or_(
                and_(_org_or_public_filter(), _tenant_filter(user.tenant_id)),
                KnowledgeBaseDocument.owner_id == user.id,
            ),
        )
    q = q.order_by(KnowledgeBaseDocument.created_at.desc())
    result = await db.execute(q)
    docs = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "source_type": d.source_type,
            "visibility": d.visibility if d.owner_id else "org",
            "owner_id": str(d.owner_id) if d.owner_id else None,
            "is_org": d.owner_id is None,
            "original_filename": (d.metadata_json or {}).get("original_filename"),
        }
        for d in docs
    ]


@router.get("/org/documents")
async def list_org_documents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List organization knowledge base documents. Mediators can view; admins manage."""
    q = select(KnowledgeBaseDocument).where(
        _org_or_public_filter(),
        _tenant_filter(user.tenant_id),
    ).order_by(KnowledgeBaseDocument.created_at.desc())
    result = await db.execute(q)
    docs = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "title": d.title,
            "source_type": d.source_type,
            "is_org": d.owner_id is None,
            "original_filename": (d.metadata_json or {}).get("original_filename"),
        }
        for d in docs
    ]


# --- Get document content (view / download) ---

@router.get("/documents/{document_id}/content")
async def get_document_content(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get document title and content for viewing or downloading as text."""
    result = await db.execute(select(KnowledgeBaseDocument).where(KnowledgeBaseDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    # Access check: org/public docs or own docs
    if doc.owner_id is None:
        if doc.tenant_id is not None and doc.tenant_id != user.tenant_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": str(doc.id),
        "title": doc.title,
        "content_text": doc.content_text or "",
    }


@router.get("/documents/{document_id}/download")
async def download_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download document in original format (PDF, DOCX, etc.) or as TXT if file not stored."""
    from fastapi.responses import Response
    result = await db.execute(select(KnowledgeBaseDocument).where(KnowledgeBaseDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.owner_id is None:
        if doc.tenant_id is not None and doc.tenant_id != user.tenant_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif doc.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Serve original file from DB (persists on Render)
    if doc.file_content:
        meta = doc.metadata_json or {}
        filename = meta.get("original_filename") or (doc.title or "document")
        mime = meta.get("mime_type") or "application/octet-stream"
        from fastapi.responses import Response
        safe_name = (filename or "document").replace('"', "_").replace("\\", "_")
        return Response(
            content=bytes(doc.file_content),
            media_type=mime,
            headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
        )

    # Fallback: file on disk (local dev)
    if doc.file_path and os.path.exists(doc.file_path):
        meta = doc.metadata_json or {}
        filename = meta.get("original_filename") or (doc.title or "document")
        mime = meta.get("mime_type") or "application/octet-stream"
        return FileResponse(doc.file_path, filename=filename, media_type=mime)

    # Fallback: content_text as TXT
    content = doc.content_text or ""
    safe_title = "".join(c for c in (doc.title or "document") if c.isalnum() or c in " -_.")[:80]
    return Response(
        content=content.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}.txt"'},
    )


# --- Delete ---

@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Delete document. Admin can delete org docs; mediator can delete own."""
    result = await db.execute(select(KnowledgeBaseDocument).where(KnowledgeBaseDocument.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.owner_id is None:
        if user.role != "super_admin":
            raise HTTPException(status_code=403, detail="Only admin can delete org documents")
    else:
        if doc.owner_id != user.id:
            raise HTTPException(status_code=403, detail="Not your document")
    await db.execute(KnowledgeBaseChunk.__table__.delete().where(KnowledgeBaseChunk.document_id == document_id))
    await db.delete(doc)
    await db.flush()
    return {"deleted": True}


# --- Search ---

def _scope_base(scope: str, user):
    """Build base query for chunk+doc with scope filter."""
    base = select(KnowledgeBaseChunk, KnowledgeBaseDocument).join(
        KnowledgeBaseDocument, KnowledgeBaseChunk.document_id == KnowledgeBaseDocument.id
    )
    if scope == "org":
        base = base.where(_org_or_public_filter(), _tenant_filter(user.tenant_id))
    elif scope == "personal":
        base = base.where(KnowledgeBaseDocument.owner_id == user.id)
    else:
        base = base.where(
            or_(
                and_(_org_or_public_filter(), _tenant_filter(user.tenant_id)),
                KnowledgeBaseDocument.owner_id == user.id,
            ),
        )
    return base


@router.get("/search")
async def search_knowledge(
    q: str,
    scope: str = Query("all", pattern="^(org|personal|all)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 10,
) -> dict:
    """Keyword or vector search. Uses vector similarity when OPENAI_API_KEY set and embeddings available."""
    if not q or len(q.strip()) < 2:
        return {"results": []}

    q_stripped = q.strip()

    # Vector search when API key and embeddings available
    if settings.openai_api_key:
        query_emb = get_embedding(q_stripped)
        if query_emb:
            base = _scope_base(scope, user)
            base = base.where(KnowledgeBaseChunk.embedding_vector.isnot(None))
            result = await db.execute(base.limit(200))  # fetch more for scoring
            rows = result.all()
            if rows:
                scored = []
                for chunk, doc in rows:
                    emb = chunk.embedding_vector
                    if isinstance(emb, list):
                        sim = cosine_similarity(query_emb, emb)
                        scored.append((sim, chunk, doc))
                scored.sort(key=lambda x: -x[0])
                results = []
                for sim, chunk, doc in scored[:limit]:
                    results.append({
                        "chunk_id": str(chunk.id),
                        "document_id": str(doc.id),
                        "document_title": doc.title,
                        "content": chunk.content[:300] + ("..." if len(chunk.content) > 300 else ""),
                        "is_org": doc.owner_id is None,
                        "score": round(sim, 4),
                    })
                return {"results": results}

    # Fallback: keyword search
    q_filter = f"%{q_stripped}%"
    base = _scope_base(scope, user).where(KnowledgeBaseChunk.content.ilike(q_filter))
    result = await db.execute(base.limit(limit))
    rows = result.all()
    results = []
    for chunk, doc in rows:
        results.append({
            "chunk_id": str(chunk.id),
            "document_id": str(doc.id),
            "document_title": doc.title,
            "content": chunk.content[:300] + ("..." if len(chunk.content) > 300 else ""),
            "is_org": doc.owner_id is None,
        })
    return {"results": results}


# --- Query (AI) ---

@router.post("/query")
async def query_knowledge(
    data: QueryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """AI-powered Q&A. Searches KB first; if no docs found, web search for book recommendations."""
    if not data.query.strip():
        return {"answer": "", "citations": []}
    scope = (data.scope or "all") if data.scope in ("org", "personal", "all") else "all"

    # Build scope filter
    if scope == "org":
        scope_filter = and_(_org_or_public_filter(), _tenant_filter(user.tenant_id))
    elif scope == "personal":
        scope_filter = KnowledgeBaseDocument.owner_id == user.id
    else:
        scope_filter = or_(
            and_(_org_or_public_filter(), _tenant_filter(user.tenant_id)),
            KnowledgeBaseDocument.owner_id == user.id,
        )

    q_stripped = data.query.strip()
    rows: list = []

    # Vector search when API key and embeddings available
    if settings.openai_api_key:
        query_emb = get_embedding(q_stripped)
        if query_emb:
            base = (
                select(KnowledgeBaseChunk, KnowledgeBaseDocument)
                .join(KnowledgeBaseDocument, KnowledgeBaseChunk.document_id == KnowledgeBaseDocument.id)
                .where(scope_filter, KnowledgeBaseChunk.embedding_vector.isnot(None))
            )
            result = await db.execute(base.limit(100))
            all_rows = result.all()
            if all_rows:
                scored = [(cosine_similarity(query_emb, c.embedding_vector or []), c, d) for c, d in all_rows if isinstance(c.embedding_vector, list)]
                scored.sort(key=lambda x: -x[0])
                rows = [(c, d) for _, c, d in scored[:10]]

    # Fallback: keyword/FTS search
    if not rows:
        words = _search_words(q_stripped)
        base = (
            select(KnowledgeBaseChunk, KnowledgeBaseDocument)
            .join(KnowledgeBaseDocument, KnowledgeBaseChunk.document_id == KnowledgeBaseDocument.id)
            .where(scope_filter)
        )
        fts_query = re.sub(r"[^\w\s]", " ", q_stripped).strip()[:200]
        use_fts = len(fts_query) >= 2
        if use_fts:
            try:
                base = base.where(
                    text("to_tsvector('english', knowledge_base_chunks.content) @@ plainto_tsquery('english', :q)").bindparams(q=fts_query)
                )
            except Exception:
                use_fts = False
        if not use_fts:
            if words:
                phrase_filter = KnowledgeBaseChunk.content.ilike(f"%{q_stripped}%")
                word_filters = [KnowledgeBaseChunk.content.ilike(f"%{w}%") for w in words]
                base = base.where(or_(phrase_filter, *word_filters))
            else:
                base = base.where(KnowledgeBaseChunk.content.ilike(f"%{q_stripped}%"))
        result = await db.execute(base.limit(10))
        rows = result.all()

    citations = []
    context_parts = []
    seen_doc_ids = set()
    for chunk, doc in rows:
        if doc.id not in seen_doc_ids:
            seen_doc_ids.add(doc.id)
            citations.append({"document_title": doc.title, "snippet": chunk.content[:200]})
        context_parts.append(chunk.content)

    # Run in parallel: relevance check, web search (for low-KB path), suggested resources
    async def _gather_aux():
        tasks = []
        if context_parts and settings.openai_api_key:
            tasks.append(("relevance", _score_relevance(data.query, "\n".join(context_parts[:3]), settings.openai_api_key)))
        tasks.append(("web", _web_search_general(data.query, max_results=10)))
        tasks.append(("suggested", _web_search_resources(data.query, max_results=8)))
        tasks.append(("books", _web_search_books(data.query, max_results=4)))
        results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
        out = {}
        for i, (name, _) in enumerate(tasks):
            out[name] = results[i] if not isinstance(results[i], Exception) else (50 if name == "relevance" else [])
        return out

    aux = await _gather_aux()
    context_relevance = aux.get("relevance", 50)
    web_results = aux.get("web", [])
    suggested_resources = aux.get("suggested", [])
    for r in aux.get("books", []):
        if r.get("url") and not any(s["url"] == r["url"] for s in suggested_resources):
            suggested_resources.append({"title": r["title"], "url": r["url"], "snippet": r.get("snippet", ""), "type": "book"})
        if len(suggested_resources) >= 10:
            break
    use_web_search = not context_parts or context_relevance < 60

    if context_parts and not use_web_search:
        context = "\n\n---\n\n".join(context_parts)
        answer = ""
        if settings.openai_api_key:
            try:
                import httpx
                sys_prompt = """Answer the user's question using the provided context when relevant. Cite document titles from the context.
Focus on topic-specific information. Skip generic "what is mediation" or step-by-step process unless asked.
NEVER quote or cite laws unless they appear verbatim in the context. Direct to Kenya Law (new.kenyalaw.org) or a qualified legal professional for specifics.
Be concise and practical."""
                async with httpx.AsyncClient() as client:
                    r = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                        json={
                            "model": "gpt-4o-mini",
                            "messages": [
                                {"role": "system", "content": sys_prompt},
                                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {data.query}"},
                            ],
                            "max_tokens": 800,
                        },
                        timeout=30,
                    )
                    if r.status_code == 200:
                        data_res = r.json()
                        answer = data_res.get("choices", [{}])[0].get("message", {}).get("content", "")
            except Exception:
                pass
        if not answer:
            answer = f"Based on the knowledge base:\n\n{context_parts[0][:500]}..."

        if suggested_resources:
            answer += "\n\n---\n\n**Suggested resources to add to your knowledge base** (download and upload via the form above):\n\n"
            for i, res in enumerate(suggested_resources[:6], 1):
                answer += f"{i}. **{res['title']}**\n   {res['url']}\n"
                if res.get("snippet"):
                    answer += f"   {res['snippet'][:100]}...\n"
                answer += "\n"
        answer_relevance = await _score_relevance(data.query, answer, settings.openai_api_key) if settings.openai_api_key else 50
        return {"answer": answer, "citations": citations, "suggested_resources": suggested_resources[:8], "context_relevance": context_relevance, "answer_relevance": answer_relevance, "source": "knowledge_base"}

    # No docs found or low relevance: use web_results from parallel fetch above
    web_context = "\n\n".join(
        [f"Source: {r.get('title','')} ({r.get('url','')})\n{r.get('snippet') or r.get('title','')}" for r in web_results if (r.get("snippet") or r.get("title"))]
    )

    answer = ""
    if settings.openai_api_key:
        try:
            import httpx
            if web_context:
                sys_prompt = """You are a mediation expert. Use the web search results below to answer the user's question.
FOCUS on topic-specific information: types of disputes, key concepts, best practices, and considerations for the specific topic (e.g. employment, family).
DO NOT include generic content the user did not ask for: skip "what is mediation", "the mediation process", or step-by-step mediation procedures (preparation, opening statements, caucusing, etc.) unless the user explicitly asks.
Be concise and practical. Include a brief conclusion and direct to Kenya Law (new.kenyalaw.org) or qualified professionals for legal specifics."""
                user_content = f"Web search results:\n{web_context}\n\nQuestion: {data.query}"
            else:
                sys_prompt = """You are a mediation expert. Answer the user's question concisely.
Focus on topic-specific concepts, best practices, and considerations. Skip generic "what is mediation" or step-by-step process unless asked.
Direct to Kenya Law (new.kenyalaw.org) or qualified professionals for legal specifics."""
                user_content = f"Question: {data.query}"
            async with httpx.AsyncClient() as client:
                r = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": sys_prompt},
                            {"role": "user", "content": user_content},
                        ],
                        "max_tokens": 1000,
                    },
                    timeout=30,
                )
                if r.status_code == 200:
                    data_res = r.json()
                    answer = data_res.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception:
            pass

    if not answer:
        answer = "No relevant documents found in your knowledge base for this query.\n\n"
        if web_results:
            answer += "Here are some web resources that may help:\n\n"
            for i, r in enumerate(web_results[:5], 1):
                answer += f"{i}. {r.get('title','')}\n   {r.get('url','')}\n"
        else:
            answer += "Try rephrasing your question or uploading relevant documents on this topic."

    if suggested_resources:
        answer += "\n\n---\n\n**Suggested resources to add to your knowledge base** (download PDFs/docs and upload above):\n\n"
        for i, res in enumerate(suggested_resources[:6], 1):
            answer += f"{i}. **{res['title']}** ({res.get('type','link')})\n   {res['url']}\n"

    answer_relevance = await _score_relevance(data.query, answer, settings.openai_api_key) if settings.openai_api_key else 50
    return {"answer": answer, "citations": citations, "suggested_resources": suggested_resources[:8], "context_relevance": context_relevance, "answer_relevance": answer_relevance, "source": "web_search"}


@router.post("/feedback")
async def submit_feedback(
    data: FeedbackRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Store user feedback on a knowledge base answer for learning."""
    if data.rating not in (1, -1):
        raise HTTPException(status_code=400, detail="rating must be 1 (helpful) or -1 (not helpful)")
    fb = KnowledgeBaseFeedback(
        user_id=user.id,
        tenant_id=user.tenant_id,
        query=data.query[:1000],
        answer=data.answer[:10000] if data.answer else None,
        source=data.source,
        context_relevance=data.context_relevance,
        answer_relevance=data.answer_relevance,
        rating=data.rating,
    )
    db.add(fb)
    await db.flush()
    return {"ok": True, "id": str(fb.id)}
