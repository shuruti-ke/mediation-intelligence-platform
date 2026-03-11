"""Mediation Intelligence Platform - FastAPI application."""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.api import auth, cases, sessions, billing, tenants, recordings, documents, knowledge, judiciary, public, payments, bookings, mediators, training, audit

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB. Shutdown: cleanup."""
    await init_db()
    yield
    # cleanup if needed


app = FastAPI(
    title="Mediation Intelligence Platform",
    description="AI-enabled mediation platform with Jitsi video, knowledge base, and judiciary search.",
    version="1.0.0",
    lifespan=lifespan,
)

# Parse CORS origins: strip whitespace, filter empty
_cors_origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_origin_regex=r"^https://[a-z0-9-]+\.vercel\.app$",  # Vercel preview deployments
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# API routes - prefix /api
app.include_router(auth.router, prefix="/api")
app.include_router(cases.router, prefix="/api")
app.include_router(sessions.router, prefix="/api")
app.include_router(billing.router, prefix="/api")
app.include_router(tenants.router, prefix="/api")
app.include_router(recordings.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(knowledge.router, prefix="/api")
app.include_router(judiciary.router, prefix="/api")
app.include_router(public.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(bookings.router, prefix="/api")
app.include_router(mediators.router, prefix="/api")
app.include_router(training.router, prefix="/api")
app.include_router(audit.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Mediation Intelligence Platform API", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}
