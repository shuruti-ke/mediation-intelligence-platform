"""Mediation Intelligence Platform - FastAPI application."""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings

logger = logging.getLogger(__name__)
from app.core.database import init_db
from app.api import auth, cases, sessions, billing, tenants, recordings, documents, knowledge, judiciary, public, payments, bookings, mediators, training, audit, users, analytics_dashboard

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


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch unhandled exceptions so CORS headers are added to error responses."""
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


# Parse CORS origins: strip whitespace, filter empty; always include production
_production_origin = "https://mediation-intelligence-platform.vercel.app"
_cors_origins = list({o.strip() for o in settings.cors_origins.split(",") if o.strip()} | {_production_origin})

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
app.include_router(users.router, prefix="/api")
app.include_router(analytics_dashboard.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Mediation Intelligence Platform API", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok"}
