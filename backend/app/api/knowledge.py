"""Knowledge base - org vs mediator, ingest with visibility."""
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
from sqlalchemy import select, or_, and_

from app.api.deps import get_current_user, require_role
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User
from app.models.document import KnowledgeBaseDocument, KnowledgeBaseChunk
from app.services.document_parser import extract_text
from app.services.chunker import chunk_text

router = APIRouter(prefix="/knowledge", tags=["knowledge"])
settings = get_settings()


class QueryRequest(BaseModel):
    query: str
    scope: str | None = None  # org | personal | all (default: all)


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


async def _web_search_books(query: str, max_results: int = 8) -> list[dict]:
    """Search for books on the topic via DuckDuckGo. Returns title, url, snippet."""
    search_q = f"{query} books"
    SCRAPE_UA = "Mozilla/5.0 (compatible; MediationPlatform/1.0; +https://mediation-intelligence-platform.vercel.app)"
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(
                "https://html.duckduckgo.com/html/",
                params={"q": quote_plus(search_q)},
                headers={"User-Agent": SCRAPE_UA},
            )
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        results = []
        for div in soup.find_all("div", class_="result")[:max_results]:
            link = div.find("a", class_="result__a")
            snippet_el = div.find("a", class_="result__snippet")
            if not link:
                continue
            href = link.get("href", "")
            if "uddg=" in href:
                parsed = urlparse(href)
                qs = parse_qs(parsed.query)
                real_url = unquote(qs.get("uddg", [""])[0]) if qs.get("uddg") else href
            else:
                real_url = href
            title = link.get_text(strip=True)
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""
            results.append({"title": title, "url": real_url, "snippet": snippet})
        return results
    except Exception:
        return []


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

@router.get("/search")
async def search_knowledge(
    q: str,
    scope: str = Query("all", pattern="^(org|personal|all)$"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 10,
) -> dict:
    """Keyword search. scope: org, personal, or all."""
    if not q or len(q.strip()) < 2:
        return {"results": []}

    q_filter = f"%{q.strip()}%"
    base = select(KnowledgeBaseChunk, KnowledgeBaseDocument).join(
        KnowledgeBaseDocument, KnowledgeBaseChunk.document_id == KnowledgeBaseDocument.id
    ).where(KnowledgeBaseChunk.content.ilike(q_filter))

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

    # Try full phrase first, then word-based search for better recall
    q_stripped = data.query.strip()
    words = _search_words(q_stripped)
    base = (
        select(KnowledgeBaseChunk, KnowledgeBaseDocument)
        .join(KnowledgeBaseDocument, KnowledgeBaseChunk.document_id == KnowledgeBaseDocument.id)
        .where(scope_filter)
    )
    # Match full phrase OR any meaningful word
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

    if context_parts:
        context = "\n\n---\n\n".join(context_parts)
        answer = ""
        if settings.openai_api_key:
            try:
                import httpx
                async with httpx.AsyncClient() as client:
                    r = await client.post(
                        "https://api.openai.com/v1/chat/completions",
                        headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                        json={
                            "model": "gpt-4o-mini",
                            "messages": [
                                {"role": "system", "content": "Answer based only on the provided context. Cite document titles. NEVER quote or cite any law unless it appears verbatim in the context from a verified source. Do not invent laws or present them as real. If legal specifics are needed, direct users to Kenya Law (new.kenyalaw.org) or a qualified legal professional."},
                                {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {data.query}"},
                            ],
                            "max_tokens": 500,
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

        # Always run web search to supplement with books and external resources
        book_results = await _web_search_books(data.query, max_results=6)
        if book_results:
            answer += "\n\n---\n\nAdditional resources from the web (books and articles that may help):\n\n"
            for i, r in enumerate(book_results[:5], 1):
                answer += f"{i}. {r['title']}\n"
                if r.get("snippet"):
                    answer += f"   {r['snippet'][:120]}...\n"
                if r.get("url"):
                    answer += f"   {r['url']}\n"
                answer += "\n"
        return {"answer": answer, "citations": citations}

    # No docs found: web search for book recommendations
    book_results = await _web_search_books(data.query, max_results=8)
    if book_results:
        lines = [
            "No relevant documents found in the knowledge base for your query.",
            "",
            "Here are some books and resources that may help:",
            "",
        ]
        for i, r in enumerate(book_results[:6], 1):
            lines.append(f"{i}. {r['title']}")
            if r.get("snippet"):
                lines.append(f"   {r['snippet'][:150]}...")
            if r.get("url"):
                lines.append(f"   {r['url']}")
            lines.append("")
        answer = "\n".join(lines)
        return {"answer": answer, "citations": [], "source": "web_search"}
    return {
        "answer": "No relevant documents found in the knowledge base for your query. Try rephrasing or uploading documents on this topic.",
        "citations": [],
    }
