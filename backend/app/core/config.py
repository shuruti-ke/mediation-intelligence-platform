"""Application configuration."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """App settings from environment."""

    # Database
    database_url: str = "postgresql+asyncpg://mediation:mediation_secret@localhost:5432/mediation_platform"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Jitsi
    jitsi_domain: str = "meet.jit.si"

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Phase 3: Documents & AI
    storage_path: str = "./uploads"
    openai_api_key: str | None = None
    laws_africa_api_key: str | None = None
    tausi_api_key: str | None = None

    def database_url_sync(self) -> str:
        """Sync URL for Alembic (replace asyncpg with psycopg2)."""
        return self.database_url.replace("+asyncpg", "")

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
