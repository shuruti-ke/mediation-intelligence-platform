"""Document parsing - PyMuPDF (PDF), python-docx (DOCX)."""
import io
from pathlib import Path

def extract_text_from_pdf(content: bytes) -> str:
    """Extract text from PDF using PyMuPDF."""
    import fitz  # PyMuPDF
    doc = fitz.open(stream=content, filetype="pdf")
    text_parts = []
    for page in doc:
        text_parts.append(page.get_text())
    doc.close()
    return "\n".join(text_parts).strip()


def extract_text_from_docx(content: bytes) -> str:
    """Extract text from DOCX using python-docx."""
    from docx import Document
    doc = Document(io.BytesIO(content))
    return "\n".join(p.text for p in doc.paragraphs if p.text).strip()


def extract_text(content: bytes, filename: str) -> str:
    """Extract text based on file extension."""
    ext = Path(filename).suffix.lower()
    if ext == ".pdf":
        return extract_text_from_pdf(content)
    if ext in (".docx", ".doc"):
        return extract_text_from_docx(content)
    if ext == ".txt":
        return content.decode("utf-8", errors="replace")
    raise ValueError(f"Unsupported format: {ext}")
