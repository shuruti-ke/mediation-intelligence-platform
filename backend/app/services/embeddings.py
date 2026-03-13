"""Embeddings via OpenAI text-embedding-3-small for vector RAG."""
from app.core.config import get_settings


def get_embedding(text: str) -> list[float] | None:
    """
    Get embedding vector for text using OpenAI text-embedding-3-small.
    Returns list of floats (1536 dims) or None if API key missing or error.
    """
    settings = get_settings()
    if not settings.openai_api_key:
        return None

    if not text or not text.strip():
        return None

    try:
        import httpx

        with httpx.Client(timeout=30) as client:
            r = client.post(
                "https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {settings.openai_api_key}"},
                json={
                    "model": "text-embedding-3-small",
                    "input": text[:8000],  # API limit
                },
            )
            r.raise_for_status()
            data = r.json()
        items = data.get("data", [])
        if not items:
            return None
        return items[0].get("embedding")
    except Exception:
        return None


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
