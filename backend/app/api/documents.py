"""Document service - Phase 3. Multi-format (PyMuPDF, python-docx)."""
import uuid
import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user, require_role
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User
from app.models.case import Case
from app.models.document import Document
from app.services.document_parser import extract_text

router = APIRouter(prefix="/documents", tags=["documents"])
settings = get_settings()
UPLOAD_DIR = Path(settings.storage_path)
ALLOWED_EXTENSIONS = {
    ".pdf", ".docx", ".doc", ".txt",
    ".xlsx", ".xls", ".pptx", ".ppt",
    ".png", ".jpg", ".jpeg", ".gif", ".csv",
}


@router.get("")
async def list_documents(
    case_id: uuid.UUID | None = Query(None, description="Filter by case"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list:
    """List documents, optionally filtered by case_id."""
    q = select(Document)
    if user.tenant_id:
        q = q.where(Document.tenant_id == user.tenant_id)
    if case_id:
        q = q.where(Document.case_id == case_id)
    q = q.order_by(Document.created_at.desc())
    result = await db.execute(q)
    docs = result.scalars().all()
    return [
        {
            "id": str(d.id),
            "file_name": d.file_name,
            "mime_type": d.mime_type,
            "case_id": str(d.case_id) if d.case_id else None,
            "created_at": d.created_at.isoformat(),
        }
        for d in docs
    ]


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    case_id: str | None = Form(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Upload document. MVP: PDF, DOCX, TXT. Parsed with PyMuPDF/python-docx."""
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported format. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    case_uuid = uuid.UUID(case_id) if case_id else None
    if case_uuid and user.tenant_id:
        result = await db.execute(select(Case).where(Case.id == case_uuid))
        case = result.scalar_one_or_none()
        if not case or case.tenant_id != user.tenant_id:
            raise HTTPException(status_code=403, detail="Case not found or access denied")

    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    file_id = uuid.uuid4()
    storage_path = str(UPLOAD_DIR / f"{file_id}{ext}")

    content = await file.read()
    with open(storage_path, "wb") as f:
        f.write(content)

    extracted_text = None
    try:
        extracted_text = extract_text(content, file.filename or "")
    except Exception as e:
        pass  # Store without extracted text if parsing fails

    doc = Document(
        case_id=case_uuid,
        tenant_id=user.tenant_id,
        file_name=file.filename or "document",
        mime_type=file.content_type or "application/octet-stream",
        storage_path=storage_path,
        extracted_text=extracted_text,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)
    return {"id": str(doc.id), "filename": doc.file_name, "status": "uploaded"}


@router.get("/{document_id}")
async def get_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Get document metadata."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user.tenant_id and doc.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {
        "id": str(doc.id),
        "file_name": doc.file_name,
        "mime_type": doc.mime_type,
        "case_id": str(doc.case_id) if doc.case_id else None,
        "created_at": doc.created_at.isoformat(),
    }


@router.get("/{document_id}/download")
async def download_document(
    document_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Download document file."""
    result = await db.execute(select(Document).where(Document.id == document_id))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if user.tenant_id and doc.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        doc.storage_path,
        filename=doc.file_name,
        media_type=doc.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{doc.file_name}"'},
    )
