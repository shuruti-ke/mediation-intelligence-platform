# Mediation Intelligence Platform — Handover Document

**Project:** Mediation Intelligence Platform  
**Repository:** https://github.com/shuruti-ke/mediation-intelligence-platform  
**Branch:** `main`  
**Last Updated:** March 2026  

---

## 1. Project Overview

AI-enabled mediation platform for Kenya/East Africa with Jitsi video, knowledge base, judiciary search, case management, and training/CPD.

**Roles:** `super_admin`, `mediator`, `trainee`, `client_corporate`, `client_individual`

**Tech Stack:**
- **Backend:** FastAPI, PostgreSQL, SQLAlchemy (async)
- **Frontend:** React, Vite, React Router, Lucide icons
- **Deploy:** Vercel (frontend), Render (backend)

---

## 2. Quick Start

### Local Development

```bash
# 1. Start database
docker compose up -d db redis

# 2. Backend
cd backend
pip install -r requirements.txt
python -m scripts.seed
uvicorn app.main:app --reload --port 8000

# 3. Frontend
cd frontend
npm install
npm run dev
```

**Default credentials:**
- Admin: `admin@mediationfocus.co.ke` / `admin123`
- Mediator: `mediator@mediationfocus.co.ke` / `mediator123`

### Deploy

```bash
git add -A && git commit -m "Your message" && git push origin main
```

- **Vercel:** Auto-deploys frontend on push to `main`
- **Render:** Auto-deploys backend (if connected); otherwise use Manual Deploy

---

## 3. Key Features (Recent Implementation)

### Case Management
- **New Case** (`/cases/new`): Rich form with Case Identification, Details, Parties, Documents
- **Case Detail** (`/cases/:id`): Two-column layout — Documents sidebar (left), full case info (right)
- **Document upload:** PDF, DOCX, TXT, XLSX, PPTX, images, CSV — clickable and downloadable
- **Internal reference:** Used to link cases to clients (e.g. `USR-KE-2026-0001`)

### Client–Case Linking
- Cases linked to clients via:
  1. `Case.internal_reference` = client's User ID (e.g. `USR-KE-2026-0001`)
  2. `CaseParty.user_id` = client's UUID
- When creating a case for a client, set **Internal reference** to the client's User ID
- **New Case** from client detail pre-fills internal reference

### Mediator Dashboard (`/dashboard`)
- **My Clients** + **My Cases** split view
- Client detail shows: Contact, Account, **Cases assigned** (linked cases), **New Case**, **Edit Client**
- **Assign to Case** button removed
- **Edit Client** → direct to edit page (`/users/:id`)

### Client Profile / Edit (`/users/:id`)
- Direct edit form (no separate view mode)
- Fields: Contact name, Contact email, Contact number, Country
- Shows cases assigned to the client

### Onboard Client
- Fields: **Contact name**, **Contact email**, **Contact number**, User type, Country, Password
- Submits for admin approval

### Validation Fix (Backend)
- `desired_outcome_structured` and `preferred_format` stored as `{"items": [...]}` and `{"formats": [...]}` in DB
- `CaseResponse` schema normalizes these to lists for API responses

---

## 4. Key Paths

| Area | Path |
|------|------|
| Case API | `backend/app/api/cases.py` |
| Documents API | `backend/app/api/documents.py` |
| Users API (clients, cases) | `backend/app/api/users.py` |
| Case schemas | `backend/app/schemas/case.py` |
| Dashboard (mediator) | `frontend/src/pages/DashboardPage.jsx` |
| Case detail | `frontend/src/pages/CaseDetailPage.jsx` |
| New Case form | `frontend/src/pages/NewCasePage.jsx` |
| Client profile/edit | `frontend/src/pages/ClientProfilePage.jsx` |
| API client | `frontend/src/api/client.js` |
| Routes | `frontend/src/App.jsx` |

---

## 5. API Endpoints (Relevant)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cases` | List cases |
| POST | `/cases` | Create case |
| GET | `/cases/{id}` | Get case (includes documents) |
| PATCH | `/cases/{id}` | Update case |
| GET | `/documents?case_id=` | List documents by case |
| POST | `/documents/upload` | Upload (FormData: file, case_id) |
| GET | `/documents/{id}/download` | Download document |
| GET | `/users/my-clients` | List mediator's clients |
| GET | `/users/{id}/cases` | Cases linked to client (internal_ref or party) |
| GET | `/users/{id}/profile` | Client profile (mediator) |
| PATCH | `/users/{id}/profile` | Update client (mediator) |
| POST | `/users/onboard-client` | Onboard new client |

---

## 6. Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `DATABASE_URL` | Render | PostgreSQL URL |
| `SECRET_KEY` | Render | JWT signing |
| `CORS_ORIGINS` | Render | Frontend URL(s) |
| `VITE_API_URL` | Vercel | Backend API URL |
| `STORAGE_PATH` | Backend | Document storage (default: `./uploads`) |

---

## 7. Deployment

- **Frontend:** Vercel — `vercel.json` → build `frontend`, output `frontend/dist`
- **Backend:** Render — `render.yaml` → Docker, `backend/Dockerfile`
- **Database:** Render PostgreSQL (mediation-db)
- **Seed:** Run `python -m app.scripts.seed` in Render Shell after first deploy

See `DEPLOYMENT.md` for full setup.

---

## 8. Training Academy (Recent)

- **Manual Upload:** Dynamic lesson editor – Text, Video (YouTube), Document (upload/URL), Embed (URL or iframe)
- **Trainee view:** Renders video, file (authenticated download), article, summary, embed
- **Paths:** `AdminTrainingAcademyPage.jsx`, `TraineeTrainingPage.jsx`, `backend/app/api/training.py`, `academy_admin.py`
- **Documents:** `POST /documents/upload`; `file_url` = `${API_BASE}/documents/${id}/download`

---

## 9. Known Gaps / Future Work

- No Alembic migrations; schema changes via `init_db()` or manual scripts
- Case parties: linking party to user (user_id) when creating case is manual
- Approval workflow for onboarded clients
- Searchable internal reference across users/cases
- PDF export for analytics (CSV only)
- Module edit UI (archive only); Quiz builder UI not built

---

## 10. Do Not Confuse With

- **rafiki-local** = HR platform at `C:\Users\shuru\Documents\AIProjects\rafiki-local` (different repo, rafikihr.com)
- **Mediation Platform** = This project

---

## 11. Files to Read First

1. `DEPLOYMENT.md` — deployment setup
2. `docs/HANDOVER-NOTES.md` — agent handover (training academy, paths, next steps)
3. `backend/app/api/cases.py` — case CRUD, documents
4. `backend/app/api/users.py` — clients, cases, profile
5. `backend/app/api/training.py` — trainee modules, lesson conversion
6. `backend/app/api/academy_admin.py` — academy CRUD, AI, manual upload
7. `frontend/src/pages/DashboardPage.jsx` — mediator dashboard
8. `frontend/src/pages/ClientProfilePage.jsx` — client edit
9. `frontend/src/pages/AdminTrainingAcademyPage.jsx` — training academy admin
10. `frontend/src/pages/TraineeTrainingPage.jsx` — trainee academy
11. `docs/CURRENT STATE & PROBLEMS.md` — implementation gaps
