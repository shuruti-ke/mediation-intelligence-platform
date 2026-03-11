# Mediation Intelligence Platform

AI-enabled mediation platform with Jitsi video, knowledge base, and judiciary search.

**Source of truth:** [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.12+
- Docker & Docker Compose (for PostgreSQL, Redis)

### 1. Start database

```bash
docker compose up -d db redis
```

### 2. Backend

```bash
cd backend
pip install -r requirements.txt
python -m scripts.seed   # Create initial tenant + admin user
uvicorn app.main:app --reload --port 8000
```

**Default credentials:**
- Admin: `admin@mediationfocus.co.ke` / `admin123`
- Mediator: `mediator@mediationfocus.co.ke` / `mediator123`

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

### 4. Full stack with Docker

```bash
docker compose up -d
# Backend: http://localhost:8000
# Docs: http://localhost:8000/docs
```

## Project Structure

```
mediation-platform/
├── backend/          # FastAPI
├── frontend/         # React + Vite
├── docker-compose.yml
└── IMPLEMENTATION_PLAN.md
```

## Phases (Implementation Status)

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1** | Done | Foundation, auth, CMS, Jitsi embed, usage stub, commercial config |
| **Phase 2** | Done | Session timer, recording API (consent modal), caucus rooms, session history |
| **Phase 3** | Done | Documents (PyMuPDF, python-docx), knowledge base (ingest, search, RAG), judiciary search (Laws.Africa, Tausi, cache) |
| **Phase 4** | Stubs | Public portal, payments - API structure ready |
| **Phase 5** | Stubs | Training, CPD - API structure ready |

Full implementation of Phases 3–5 requires: R2/S3, Vectorize, Tausi/Laws.Africa APIs, Stripe/M-Pesa.
