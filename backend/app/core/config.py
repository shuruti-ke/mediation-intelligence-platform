"""Application configuration."""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    """App settings from environment."""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False, extra="ignore")

    # Database (Render/Neon give postgresql://; we need postgresql+asyncpg for async)
    database_url: str = "postgresql+asyncpg://mediation:mediation_secret@localhost:5432/mediation_platform"
    # Schema management: "runtime" uses startup schema sync helpers; "alembic" disables runtime sync.
    schema_management_mode: str = "runtime"

    @field_validator("database_url", mode="after")
    @classmethod
    def fix_db_url(cls, v: str) -> str:
        if v.startswith("postgresql://") and "+asyncpg" not in v:
            return v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Auth
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    # Jitsi / JaaS (8x8) - use JAAS_API_KEY_ID, JAAS_APP_ID, JAAS_PRIVATE_KEY in Render
    jitsi_domain: str = "meet.jit.si"
    jaas_api_key_id: str | None = None  # API Key ID (kid in JWT header)
    jaas_app_id: str | None = None  # App ID (sub in JWT, vpaas-magic-cookie-xxx)
    jaas_private_key: str | None = None  # RSA private key (PEM) for RS256 signing

    # CORS - production URL always allowed; env can add more (e.g. localhost)
    cors_origins: str = "http://localhost:5173,http://localhost:3000,https://mediation-intelligence-platform.vercel.app"

    # Phase 3: Documents & AI
    storage_path: str = "./uploads"
    openai_api_key: str | None = None
    laws_africa_api_key: str | None = None
    tausi_api_key: str | None = None
    # Sprint 1: Judiciary source feature flags
    judiciary_enable_laws_africa: bool = True
    judiciary_enable_tausi: bool = True
    judiciary_enable_kenya_law_scrape: bool = True
    judiciary_enable_web_fallback: bool = True
    judiciary_enable_local_corpus: bool = True

    # Phase 6a: Payments - M-Pesa Daraja & Stripe
    m_pesa_consumer_key: str | None = None
    m_pesa_consumer_secret: str | None = None
    m_pesa_shortcode: str = "174379"  # Sandbox default
    m_pesa_passkey: str | None = None
    m_pesa_callback_url: str | None = None
    stripe_secret_key: str | None = None
    frontend_base_url: str = "http://localhost:5173"  # For Stripe success/cancel redirects

    def database_url_sync(self) -> str:
        """Sync URL for Alembic (replace asyncpg with psycopg2)."""
        return self.database_url.replace("+asyncpg", "")


@lru_cache
def get_settings() -> Settings:
    return Settings()
