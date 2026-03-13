# Handover Notes for New Agent

**Project:** Mediation Intelligence Platform  
**Location:** `C:\Users\shuru\Documents\AIProjects\Mediation Platform`  
**GitHub:** https://github.com/shuruti-ke/mediation-intelligence-platform  
**Branch:** `main`  
**Last Updated:** March 2026  

---

## Quick Start for New Agent

1. **Read this file first** – then the "Files to Read First" section.
2. **Run locally:** `cd frontend && npm install && npm run dev` (frontend only). Backend needs PostgreSQL + env vars.
3. **Deploy:** Push to `main` → Vercel auto-deploys from GitHub (if connected).
4. **Do NOT confuse with rafiki-local** – that is a separate HR platform at `C:\Users\shuru\Documents\AIProjects\rafiki-local` (rafikihr.com). This is the Mediation Platform.

---

## Project Overview

A mediation platform with AI features, Jitsi video, knowledge base, judiciary search, and training/CPD. **Primary target:** Kenya/East Africa. **Roles:** `super_admin`, `mediator`, `trainee`, `client_corporate`, `client_individual`.

---

## Tech Stack

- **Backend:** FastAPI, PostgreSQL, SQLAlchemy (async)
- **Frontend:** React 19, Vite 7, React Router 7, Tailwind v4, Recharts, Lucide icons
- **AI:** OpenAI (optional; `OPENAI_API_KEY` in config)
- **Deploy:** Vercel (frontend), GitHub (repo)

---

## Key Paths

| Area | Path |
|------|------|
| Backend API | `backend/app/api/` |
| Models | `backend/app/models/` |
| Case API | `backend/app/api/cases.py` |
| Documents API | `backend/app/api/documents.py` |
| Users API (clients, cases) | `backend/app/api/users.py` |
| Training API | `backend/app/api/training.py` |
| Academy Admin API | `backend/app/api/academy_admin.py` |
| Analytics API | `backend/app/api/analytics_dashboard.py` |
| Case schemas | `backend/app/schemas/case.py` |
| Frontend pages | `frontend/src/pages/` |
| Mediator dashboard | `frontend/src/pages/DashboardPage.jsx` |
| Case detail | `frontend/src/pages/CaseDetailPage.jsx` |
| New Case form | `frontend/src/pages/NewCasePage.jsx` |
| Client profile/edit | `frontend/src/pages/ClientProfilePage.jsx` |
| Admin dashboard | `frontend/src/pages/AdminDashboardPage.jsx` |
| Training Academy admin | `frontend/src/pages/AdminTrainingAcademyPage.jsx` |
| API client | `frontend/src/api/client.js` |
| App routes | `frontend/src/App.jsx` |

---

## Recently Implemented (March 2026)

### 1. Case Management & Document Upload ✅
- **New Case** (`/cases/new`): Rich form with Case Identification, Details, Parties, Documents
- **Case Detail** (`/cases/:id`): Two-column layout — Documents sidebar (left), full case info (right)
- **Document upload:** PDF, DOCX, TXT, XLSX, PPTX, images, CSV — clickable and downloadable
- **Internal reference:** Used to link cases to clients (e.g. `USR-KE-2026-0001`)

### 2. Case–Client Linking ✅
- Cases linked via `Case.internal_reference` = client User ID or `CaseParty.user_id`
- **GET** `/users/{id}/cases` returns cases for a client
- **New Case** from client detail pre-fills internal reference

### 3. Client Management (Mediator Dashboard) ✅
- **Assign to Case** button removed
- **Edit Client** → direct to edit page (`/users/:id`)
- Client view shows **Cases assigned** (always visible)
- **New Case** button from client detail pre-fills internal reference

### 4. Client Profile Page (`/users/:id`) ✅
- Direct edit form (no separate view mode)
- Fields: Contact name, Contact email, Contact number, Country
- Backend: `GET/PATCH /users/{id}/profile`

### 5. Onboard Client ✅
- Labels updated: **Contact name**, **Contact email**, **Contact number**

### 6. Validation Fix (Backend) ✅
- `desired_outcome_structured` and `preferred_format` stored as `{"items": [...]}` and `{"formats": [...]}` in DB
- `CaseResponse` in `backend/app/schemas/case.py` normalizes these to lists

---

## Recently Implemented (March 2025)

### 1. Training Academy Admin Dashboard ✅
- **Route:** `/admin/training-academy` (linked from Admin nav)
- **Features:** AI module creator wizard, manual upload, module cards grid, analytics (KPIs, module popularity, completion funnel, risk alert), student drill-down modal
- **Backend:** `academy_admin.py` – CRUD modules/lessons/quizzes, AI generation, analytics, student detail
- **Models:** `academy.py` – AcademyModule, AcademyLesson, AcademyMaterial, AcademyModuleProgress, AcademyQuiz, AcademyQuizAttempt

### 2. Interactive Admin Analytics Dashboard ✅
- **Time range:** 7d, 30d, 90d, This Year
- **Refresh:** Manual + auto-refresh (5 min)
- **Export:** CSV download
- **Clickable KPI cards:** Active Cases, New Users, Active Mediators → drill-down modals
- **Trend indicators:** New Users shows ↑/↓ vs previous period
- **Charts:** Cases Created vs Resolved, Case Distribution (pie), Mediator Workload (horizontal bar)
- **Drill-down APIs:** `/analytics/drill-down/active-cases`, `/analytics/drill-down/new-users`, `/analytics/drill-down/case-distribution`

---

## Training System (Current State)

### Backend Models
- **training.py:** TrainingModule, TrainingProgress, CPDProgress, Quiz, QuizAttempt, RolePlayScenario, RolePlaySession, TraineeAcademyProgress, TrainingModuleConfig
- **academy.py:** AcademyModule, AcademyLesson, AcademyMaterial, AcademyModuleProgress, AcademyQuiz, AcademyQuizAttempt

### Trainee Academy (Static)
- **TRAINEE_MODULES** in `backend/app/api/training.py`
- **API:** `GET /training/trainee-academy/modules`, `GET/POST /training/trainee-academy/progress`
- **Frontend:** `TraineeTrainingPage.jsx`, `TraineeArticlePage.jsx`

### Training Academy (Admin-Managed)
- **API:** `trainingAcademyApi` in `frontend/src/api/client.js`
- **Frontend:** `AdminTrainingAcademyPage.jsx` – purple-teal theme (matches rafikihr.com), dark mode

---

## Visual Design (Current)

- **Palette:** Purple (#8b5cf6) + Teal (#1fbfb8), matching rafikihr.com
- **Typography:** Playfair Display (headings), Source Sans 3 (body)
- **Key files:** `frontend/src/App.css` (:root variables), `frontend/src/pages/AdminTrainingAcademyPage.css`, `frontend/index.html` (fonts)
- **Last restyle:** Commit `9819602` – switched from Omen earth tones to purple-teal

---

## Architecture Notes

- **Tenant:** `tenant_id` on many models; `null` = global
- **Auth:** JWT in `Authorization: Bearer token`; user in `localStorage.getItem('user')`
- **API:** `POST /api/auth/login`, `GET /api/auth/me`; `get_current_user`, `require_role` in deps
- **OpenAI:** Uses `get_settings().openai_api_key`; if missing, falls back to rule-based/curated content
- **Database:** `init_db()` creates tables on startup (no Alembic migrations)

---

## Deployment

- **Vercel:** Frontend auto-deploys from GitHub when `main` is pushed. Config in `vercel.json` (build: `cd frontend && npm ci && npm run build`, output: `frontend/dist`).
- **Manual deploy:**
  ```bash
  cd "C:\Users\shuru\Documents\AIProjects\Mediation Platform"
  git add -A && git commit -m "..." && git push origin main
  ```
- **Backend:** Not on Vercel; typically Render or similar. Check repo for backend deploy config.

---

## Suggested Next Steps for New Agent

**Priority:** Read `CURRENT STATE & PROBLEMS.md` for core platform gaps (interactive cases, approval workflow, search, scalable user management, mediator assignment).

1. **Training Academy enhancements**
   - Module edit flow (currently only archive)
   - Quiz builder UI (backend exists)
   - Filter bar (region, case type, mediator) on analytics
   - "Message Student" / "Assign Remedial Module" actions

2. **Analytics enhancements**
   - PDF export (currently CSV only)
   - Custom date range picker (calendar)
   - Threshold alerts / anomaly detection
   - User activity heatmap

3. **Africa-first**
   - Low bandwidth mode (disable auto-refresh, lighter charts)
   - Multi-language labels (EN, FR, SW, AR)
   - Offline support / stale data indicator

4. **Other**
   - Practice scenario completion → backend (currently localStorage)
   - Alembic migrations for schema changes

---

## New API Endpoints (Case/Client)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/{id}/cases` | Cases linked to client (internal_ref or party) |
| GET | `/users/{id}/profile` | Client profile (mediator) |
| PATCH | `/users/{id}/profile` | Update client (mediator) |
| GET | `/documents?case_id=` | List documents by case |
| POST | `/documents/upload` | Upload (FormData: file, case_id) |
| GET | `/documents/{id}/download` | Download document |

---

## Files to Read First

- `docs/CURRENT STATE & PROBLEMS.md` – implementation & deployment guide (core gaps)
- `HANDOVER.md` – full handover (case/client features, deployment)
- `backend/app/api/cases.py` – case CRUD, documents
- `backend/app/api/users.py` – clients, cases, profile
- `backend/app/api/academy_admin.py` – academy CRUD, AI, analytics
- `backend/app/api/analytics_dashboard.py` – dashboard + drill-down
- `frontend/src/pages/DashboardPage.jsx` – mediator dashboard
- `frontend/src/pages/ClientProfilePage.jsx` – client edit
- `frontend/src/pages/AdminDashboardPage.jsx` – main admin + analytics
- `frontend/src/pages/AdminTrainingAcademyPage.jsx` – training academy
- `frontend/src/api/client.js` – API client (analyticsApi, trainingAcademyApi)

---

## Important: Separate from rafiki-local

- **rafiki-local** = HR platform (rafikihr.com), at `C:\Users\shuru\Documents\AIProjects\rafiki-local`
- **Mediation Platform** = This project, at `C:\Users\shuru\Documents\AIProjects\Mediation Platform`
- They share a similar visual style (purple-teal) but are different codebases, repos, and deployments.

---

## Known Gaps

**Infrastructure & Training:**
- No Alembic; schema changes require `init_db()` or manual migration scripts
- Practice scenario completion is `localStorage` only
- Module edit UI not implemented (archive only)
- Quiz builder UI not built (backend ready)
- Export is CSV only (no PDF)
- No threshold alerts or anomaly detection

**Core Platform (see `CURRENT STATE & PROBLEMS.md` for full spec):**
- ~~Cases in mediation dashboard are static~~ — Case detail, documents, New Case, Edit Case implemented
- ~~No client–case linking~~ — Linked via internal_reference and CaseParty.user_id
- ~~No Edit Client flow~~ — ClientProfilePage at `/users/:id` with GET/PATCH profile
- No approval process for new user onboarding
- No searchable internal reference system (User ID, Client ID, name, email)
- User management lacks scalability for 1000+ users
- No mediator assignment workflow from admin panel
- All users currently assigned a mediator (incorrect—only clients should have mediators)
