"""Knowledge base - Phase 3. Ingest, chunk, search, RAG."""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func

from app.api.deps import get_current_user
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


@router.post("/ingest")
async def ingest_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Upload document. Chunk, store in knowledge base."""
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
        title=doc_title,
        source_type="upload",
        content_text=text,
    )
    db.add(kb_doc)
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
    return {"document_id": str(kb_doc.id), "chunks": len(chunks), "status": "ingested"}


@router.get("/search")
async def search_knowledge(
    q: str,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    limit: int = 10,
) -> dict:
    """Keyword search over knowledge base chunks."""
    if not q or len(q.strip()) < 2:
        return {"results": []}

    q_filter = f"%{q.strip()}%"
    result = await db.execute(
        select(KnowledgeBaseChunk, KnowledgeBaseDocument)
        .join(KnowledgeBaseDocument, KnowledgeBaseChunk.document_id == KnowledgeBaseDocument.id)
        .where(
            KnowledgeBaseChunk.content.ilike(q_filter),
            or_(
                KnowledgeBaseDocument.tenant_id.is_(None),
                KnowledgeBaseDocument.tenant_id == user.tenant_id,
            ),
        )
        .limit(limit)
    )
    rows = result.all()

    results = []
    for chunk, doc in rows:
        results.append({
            "chunk_id": str(chunk.id),
            "document_id": str(doc.id),
            "document_title": doc.title,
            "content": chunk.content[:300] + ("..." if len(chunk.content) > 300 else ""),
        })
    return {"results": results}


@router.post("/query")
async def query_knowledge(
    data: QueryRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """AI-powered Q&A with citations. Uses search + optional LLM."""
    if not data.query.strip():
        return {"answer": "", "citations": []}

    # Search for relevant chunks
    q_filter = f"%{data.query.strip()}%"
    result = await db.execute(
        select(KnowledgeBaseChunk, KnowledgeBaseDocument)
        .join(KnowledgeBaseDocument, KnowledgeBaseChunk.document_id == KnowledgeBaseDocument.id)
        .where(
            KnowledgeBaseChunk.content.ilike(q_filter),
            or_(
                KnowledgeBaseDocument.tenant_id.is_(None),
                KnowledgeBaseDocument.tenant_id == user.tenant_id,
            ),
        )
        .limit(5)
    )
    rows = result.all()

    citations = []
    context_parts = []
    for chunk, doc in rows:
        context_parts.append(chunk.content)
        citations.append({"document_title": doc.title, "snippet": chunk.content[:200]})

    if not context_parts:
        return {
            "answer": "No relevant documents found in the knowledge base for your query.",
            "citations": [],
        }

    context = "\n\n---\n\n".join(context_parts)

    # If OpenAI key set, use it for better answer
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
                    return {"answer": answer, "citations": citations}
        except Exception:
            pass

    # Fallback: return first matching chunk as answer
    answer = f"Based on the knowledge base:\n\n{context_parts[0][:500]}..."
    return {"answer": answer, "citations": citations}


@router.get("/documents")
async def list_documents(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List documents in knowledge base."""
    result = await db.execute(
        select(KnowledgeBaseDocument)
        .where(
            or_(
                KnowledgeBaseDocument.tenant_id.is_(None),
                KnowledgeBaseDocument.tenant_id == user.tenant_id,
            ),
        )
        .order_by(KnowledgeBaseDocument.created_at.desc())
    )
    docs = result.scalars().all()
    return [{"id": str(d.id), "title": d.title, "source_type": d.source_type} for d in docs]
