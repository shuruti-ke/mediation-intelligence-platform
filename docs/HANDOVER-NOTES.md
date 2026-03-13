# Handover Notes for New Agent

**Project:** Mediation Intelligence Platform  
**Location:** `C:\Users\shuru\Documents\AIProjects\Mediation Platform`  
**GitHub:** https://github.com/shuruti-ke/mediation-intelligence-platform  
**Branch:** `main`  
**Last Updated:** March 13, 2026  
**Live URL:** https://mediation-intelligence-platform.vercel.app  

---

## ⚠️ Design & Theme Preservation (MANDATORY)

**All Phase 6 work must preserve the existing platform design.** Do not change colors, typography, or layout patterns.

| Element | Value | Usage |
|---------|-------|-------|
| **Primary purple** | `#8b5cf6` | Buttons, accents, links, headings |
| **Secondary teal** | `#1fbfb8` | Secondary accents, gradients |
| **CSS variables** | `--color-*`, `--bold-purple`, `--academy-*` | Use existing variables in `App.css` |
| **Typography** | Playfair Display (headings), Source Sans 3 (body) | `frontend/index.html` |
| **Layout** | Two-column split-view, card-based sections, existing nav structure | Match `AdminDashboardPage`, `DashboardPage`, `CaseDetailPage` |
| **Components** | Lucide icons, Recharts, Tailwind v4 | Do not introduce new UI libraries without approval |

**Key files:** `frontend/src/App.css`, `frontend/src/pages/AdminTrainingAcademyPage.css`, `frontend/index.html`

---

## Phases Completed (Ready for Phase 6)

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 2** | User Onboarding with Approval Workflow | ✅ Done |
| **Phase 3** | Searchable Internal Reference System | ✅ Done |
| **Phase 4** | Scalable User Management (1000+ users) | ✅ Done |
| **Phase 5** | Training, CPD, Security Audit, Offline PWA | ✅ Done |
| **Phase 6** | Recording, E-Signatures, Payments, RAG, Scalability, Analytics | 🔜 Next |

**Phase 2 delivered:** Mediator submit → Admin approve/reject/request-info → Client notified; first-login force password change; resubmit for rejected; in-app notifications.

**Phase 3 delivered:** Global search bar (debounced 300ms); unified `/api/search` (users + cases); keyboard nav; recent searches; role-scoped results.

**Phase 4 delivered:** Virtual scrolling (react-window), pagination, sort/filter, mediator assignment (clients only), deactivate with reason, impersonate, soft delete.

**Phase 5 delivered:** Mediator + trainee modules (editable/archivable), Training Academy dashboard, security audit logs, compliance checklist, store-and-forward offline queue, PWA.

---

## Phase 6: Implementation Roadmap for New Agent

Phase 6 is split into four sub-phases. Implement in order (6a → 6b → 6c → 6d). **Preserve platform colors, theme, and layout in all work.**

---

### Phase 6a: Recording, E-Signatures, Payments (8–12 weeks)

**Objective:** Core competitive features — session recording, settlement agreements with e-signatures, live payments.

#### 6a.1 Session Recording (Jibri)
- **Current state:** `POST /sessions/{id}/recording/start` and `/stop` exist; Jibri not integrated.
- **Tasks:**
  - Integrate Jibri with Jitsi (Docker/VM or JaaS recording if available).
  - Store recordings in S3/R2 with encryption; link to `MediationSession`.
  - Consent capture before recording (already in API).
  - Recording list/download in case detail or session view.
- **Files:** `backend/app/api/recordings.py`, `backend/app/api/sessions.py`, `frontend/src/pages/` (session/room UI).
- **Design:** Use existing purple-teal buttons, card layout; add Recording section to case/session views.

#### 6a.2 E-Signatures & Settlement Agreements
- **Current state:** No e-signature; documents uploaded manually.
- **Tasks:**
  - Settlement agreement templates (family, commercial, employment).
  - E-signature integration (DocuSign, HelloSign, or custom).
  - Co-drafting during session (optional).
  - Store signed agreements with audit trail.
- **Files:** New `backend/app/api/settlements.py`, `backend/app/models/` (SettlementAgreement), `frontend/src/pages/` (settlement flow).
- **Design:** Match `CaseDetailPage` document sidebar; use `--color-*` for signatures/status.

#### 6a.3 Payments (M-Pesa & Stripe)
- **Current state:** `backend/app/api/payments.py` — stubs only.
- **Tasks:**
  - M-Pesa Daraja integration (Kenya).
  - Stripe for cards/international.
  - Per-session and subscription billing.
  - Usage metering (recordings, AI, storage) for billing.
- **Files:** `backend/app/api/payments.py`, `backend/app/services/`, `frontend/src/pages/` (billing/invoice UI).
- **Design:** Use existing invoice/billing patterns; purple primary buttons.

---

### Phase 6b: AI Transcription, Vector RAG (6–8 weeks)

**Objective:** AI-powered transcription and semantic knowledge search.

#### 6b.1 AI Transcription
- **Tasks:**
  - Integrate AI transcription (Sonix, AssemblyAI, or Whisper API).
  - Real-time or post-session transcripts.
  - Speaker identification, searchable transcripts.
  - Multi-language (Swahili, French, Arabic) if supported.
- **Files:** New `backend/app/services/transcription.py`, `backend/app/api/recordings.py`, session UI.
- **Design:** Transcript viewer in session/case detail; match document viewer styling.

#### 6b.2 Vector RAG for Knowledge Base
- **Current state:** Keyword + FTS only (`knowledge_base_chunks`).
- **Tasks:**
  - Add embeddings (OpenAI or local).
  - Vector DB (pgvector, Pinecone, or Cloudflare Vectorize).
  - RAG for AI Q&A over documents.
  - Improve citation/source display.
- **Files:** `backend/app/api/knowledge.py`, `backend/app/services/`, `backend/app/models/`.
- **Design:** Keep existing Library/knowledge UI; enhance search results layout.

---

### Phase 6c: Scalable User Management, Multi-Language (6–8 weeks)

**Objective:** Scale to 1000+ users, Africa-first localization.

#### 6c.1 Scalable User Management (Phase 4 polish)
- **Current state:** Virtual scrolling, pagination, filters exist; verify at scale.
- **Tasks:**
  - Verify virtual scrolling with 1000+ users.
  - Pagination: 50 per page; cursor or offset.
  - Filters: Role, Status, Date Range.
  - Mediator assignment: clients only; hide for non-clients.
- **Files:** `frontend/src/pages/AdminDashboardPage.jsx`, `backend/app/api/users.py`.
- **Design:** No layout changes; ensure `split-view-*` classes remain.

#### 6c.2 Multi-Language Support
- **Tasks:**
  - i18n (e.g. react-i18next).
  - Languages: EN, SW (Swahili), FR, AR.
  - Localize: case intake, training, client portal, key labels.
- **Files:** `frontend/src/`, new `locales/` folder.
- **Design:** Preserve layout; only translate text. Buttons/forms keep same structure.

---

### Phase 6d: Analytics, Low-Bandwidth, Practice Persistence (4–6 weeks)

**Objective:** Analytics enhancements, Africa-first resilience, training completion.

#### 6d.1 Analytics Enhancements
- **Tasks:**
  - PDF export (in addition to CSV).
  - Custom date range picker (calendar).
  - Threshold alerts / anomaly detection.
  - User activity heatmap.
- **Files:** `frontend/src/pages/AdminDashboardPage.jsx`, `backend/app/api/analytics_dashboard.py`.
- **Design:** Use existing chart colors (`CHART_COLORS`), `kpi-card`, `chart-card` classes.

#### 6d.2 Low-Bandwidth Mode
- **Tasks:**
  - "Lite" mode toggle: disable auto-refresh, lighter charts.
  - Reduce image size, lazy-load.
  - Text alternatives for media where possible.
- **Files:** `frontend/src/`, settings/preferences.
- **Design:** Same layout; reduced assets/animations only.

#### 6d.3 Practice Scenario Backend Persistence
- **Current state:** `localStorage` only.
- **Tasks:**
  - Persist completion to backend.
  - Track progress, analytics.
  - Resume across devices.
- **Files:** `backend/app/api/training.py`, `frontend/src/pages/PracticeScenarioPage.jsx`.
- **Design:** Match Training/CPD dashboard styling.

---

## Phase 4 Reference (Completed — for context)

**Objective:** Scalable User Management (1000+ users).

**Spec:** See `docs/CURRENT STATE & PROBLEMS.md` — Sections 4, D, E, F.

**Key files:** `AdminDashboardPage.jsx` (Users tab), `backend/app/api/users.py`, `User.assigned_mediator_id`.

---

## Quick Start for New Agent

1. **Read this file first** – then the "Files to Read First" section.
2. **Run locally:** `cd frontend && npm install && npm run dev` (frontend). Backend: `cd backend && uvicorn app.main:app --reload --port 8000` (needs PostgreSQL + env vars).
3. **Deploy:** Push to `main` → Vercel (frontend) and Render (backend) auto-deploy from GitHub if connected.
4. **Do NOT confuse with rafiki-local** – that is a separate HR platform at `C:\Users\shuru\Documents\AIProjects\rafiki-local` (rafikihr.com). This is the Mediation Platform.

---

## Project Overview

A mediation platform with AI features, Jitsi video, knowledge base, judiciary search, and training/CPD. **Primary target:** Kenya/East Africa. **Roles:** `super_admin`, `mediator`, `trainee`, `client_corporate`, `client_individual`.

---

## Tech Stack

- **Backend:** FastAPI, PostgreSQL, SQLAlchemy (async)
- **Frontend:** React 19, Vite 7, React Router 7, Tailwind v4, Recharts, Lucide icons
- **AI:** OpenAI (optional; `OPENAI_API_KEY` in config)
- **Deploy:** Vercel (frontend), Render (backend) – both auto-deploy from GitHub on push to `main`

---

## Key Paths

| Area | Path |
|------|------|
| Backend API | `backend/app/api/` |
| Models | `backend/app/models/` |
| Case API | `backend/app/api/cases.py` |
| Documents API | `backend/app/api/documents.py` |
| Users API (clients, cases, approval) | `backend/app/api/users.py` |
| Search API | `backend/app/api/search.py` |
| Calendar API | `backend/app/api/calendar.py` |
| Training API | `backend/app/api/training.py` |
| Academy Admin API | `backend/app/api/academy_admin.py` |
| Analytics API | `backend/app/api/analytics_dashboard.py` |
| Notifications API | `backend/app/api/notifications.py` |
| Case schemas | `backend/app/schemas/case.py` |
| Auth schemas | `backend/app/schemas/auth.py` |
| Frontend pages | `frontend/src/pages/` |
| GlobalSearch component | `frontend/src/components/GlobalSearch.jsx` |
| Mediator dashboard | `frontend/src/pages/DashboardPage.jsx` |
| Case detail | `frontend/src/pages/CaseDetailPage.jsx` |
| New Case form | `frontend/src/pages/NewCasePage.jsx` |
| Client profile/edit | `frontend/src/pages/ClientProfilePage.jsx` |
| Change password | `frontend/src/pages/ChangePasswordPage.jsx` |
| Admin dashboard | `frontend/src/pages/AdminDashboardPage.jsx` |
| Training Academy admin | `frontend/src/pages/AdminTrainingAcademyPage.jsx` |
| Trainee Academy | `frontend/src/pages/TraineeTrainingPage.jsx` |
| Mediator Training | `frontend/src/pages/TrainingPage.jsx` |
| Calendar | `frontend/src/pages/CalendarPage.jsx` |
| API client | `frontend/src/api/client.js` |
| App routes | `frontend/src/App.jsx` |

---

## Recent Bug Fixes (March 2026)

- **sessions.py (line 153):** `end_session` had `body` (with default) before `request: Request` (no default). Fixed by moving `request` before `body`.
- **documents.py (line 61):** `upload_document` had `file`/`case_id` (with defaults) before `request: Request`. Fixed by moving `request` first.

---

## Recently Implemented (March 2026)

### Phase 2: Approval Workflow
- **Mediator onboard client:** `POST /users/onboard-client` → creates `pending_approval`
- **Admin approve/reject/request-info:** `POST /users/{id}/approve`, `/reject`, `/request-info`
- **Resubmit:** `POST /users/{id}/resubmit` (mediator for rejected clients)
- **Notifications:** In-app on submit (admin), approve (client), reject/on_hold (mediator)
- **First-login:** `must_change_password` → `/change-password` page
- **User model:** `submitted_by_id`, `approval_notes`, `on_hold` status
- **Mediator dashboard:** Submissions panel, Resubmit, notification bell
- **Admin dashboard:** Approvals tab with Request Info, On Hold status

### Phase 3: Search
- **Unified search:** `GET /api/search?q=` returns `{ users, cases }` grouped
- **GlobalSearch component:** Debounced 300ms, keyboard nav, recent searches (localStorage)
- **Search in:** Admin, Mediator, Client dashboards (header)
- **Role-scoped:** Admins see all; mediators see assigned clients; clients see own cases

### Calendar Fix
- **Free slots:** `GET /api/calendar/free-slots` — availability minus scheduled bookings
- **Booking modal:** Clients pick from dropdown of actual free slots (prevents 400)

### Case & Client
- **New Case** (`/cases/new`): Rich form with Case Identification, Details, Parties, Documents
- **Case Detail** (`/cases/:id`): Two-column layout — Documents sidebar (left), full case info (right)
- **Document upload:** PDF, DOCX, TXT, XLSX, PPTX, images, CSV — clickable and downloadable
- **Internal reference:** Used to link cases to clients (e.g. `USR-KE-2026-0001`)

- **Case–Client linking:**
- Cases linked via `Case.internal_reference` = client User ID or `CaseParty.user_id`
- **GET** `/users/{id}/cases` returns cases for a client
- **New Case** from client detail pre-fills internal reference

- **Client management (mediator dashboard):**
- **Assign to Case** button removed
- **Edit Client** → direct to edit page (`/users/:id`)
- Client view shows **Cases assigned** (always visible)
- **New Case** button from client detail pre-fills internal reference

- **Client profile** (`/users/:id`):
- Direct edit form (no separate view mode)
- Fields: Contact name, Contact email, Contact number, Country
- Backend: `GET/PATCH /users/{id}/profile`

- **Onboard client:**
- Labels updated: **Contact name**, **Contact email**, **Contact number**

- **Validation fix (backend):**
- `desired_outcome_structured` and `preferred_format` stored as `{"items": [...]}` and `{"formats": [...]}` in DB
- `CaseResponse` in `backend/app/schemas/case.py` normalizes these to lists

### Training Academy
- **Manual Upload** opens with one default lesson; wizard supports multiple content types per lesson:
  - **Text** – content textarea (HTML or plain text)
  - **Video** – YouTube URL (stored as `video_url`; trainee view extracts `video_id` for embed)
  - **Document** – file upload via `POST /documents/upload` or document URL; stored as `file_url`
  - **Embed** – embed URL or full iframe HTML; stored in `content_html`
- **Per-lesson fields:** title, content_type, YouTube URL, document URL/file upload, content, duration (min)
- **Backend:** `AcademyLesson` model has `content_type`, `video_url`, `file_url`, `content_html`, `duration_minutes`
- **Trainee view:** File lessons show "Download Document" (authenticated via `api.get('/documents/{id}/download', { responseType: 'blob' })`); Embed lessons render `content_html` (plain URLs wrapped in iframe)
- **CSS:** `wizard-lessons-section`, `wizard-lesson-card`, `wizard-lessons-header`, `academy-btn-sm`, `uploading-text` in `AdminTrainingAcademyPage.css`
- **Import fix:** Lucide `Link` icon aliased as `LinkIcon` to avoid conflict with `react-router-dom` `Link`

- **Admin dashboard:**
- **Route:** `/admin/training-academy` (linked from Admin nav)
- **Features:** AI module creator wizard, dynamic manual upload (see above), module cards grid, analytics (KPIs, module popularity, completion funnel, risk alert), student drill-down modal
- **Backend:** `academy_admin.py` – CRUD modules/lessons/quizzes, AI generation, analytics, student detail
- **Models:** `academy.py` – AcademyModule, AcademyLesson, AcademyMaterial, AcademyModuleProgress, AcademyQuiz, AcademyQuizAttempt

- **Trainee access & redirects:**
- **Trainees** redirect to `/training/trainee-academy` (not mediator dashboard)
- **Access control:** Trainee Academy = trainees only; Training & Induction = mediators + super_admin only
- **Admin-created modules** merged with trainee modules via `training.py` (`get_trainee_academy_modules`)

### Analytics
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
- **academy.py:** AcademyModule, AcademyLesson (content_type: text|video|file|embed, video_url, file_url, content_html), AcademyMaterial, AcademyModuleProgress, AcademyQuiz, AcademyQuizAttempt

### Trainee Academy (Merged: Admin + Static)
- **API:** `GET /training/trainee-academy/modules` returns published Academy modules (from admin) merged with any static modules
- **Lesson types:** `video` (YouTube), `file` (document download), `article` (content_html), `summary`, `embed` (iframe/URL)
- **API:** `GET/POST /training/trainee-academy/progress`
- **Frontend:** `TraineeTrainingPage.jsx`, `TraineeArticlePage.jsx` – renders video, file, article, summary, embed
- **Document download:** Uses `api.get('/documents/{id}/download', { responseType: 'blob' })` for authenticated download; `file_url` format: `${VITE_API_URL}/documents/${id}/download`

### Training Academy (Admin)
- **API:** `trainingAcademyApi` in `frontend/src/api/client.js`; `documents.upload()` for file uploads
- **Frontend:** `AdminTrainingAcademyPage.jsx` – purple-teal theme, dark mode, dynamic lesson editor

---

## Visual Design (Current) — PRESERVE IN PHASE 6

- **Palette:** Purple (#8b5cf6) + Teal (#1fbfb8)
- **Typography:** Playfair Display (headings), Source Sans 3 (body)
- **Key files:** `frontend/src/App.css` (:root variables, `--color-*`, `--bold-purple`), `frontend/src/pages/AdminTrainingAcademyPage.css`, `frontend/index.html` (fonts)
- **Layout patterns:** Two-column split-view, card-based sections, `kpi-card`, `chart-card`, `split-view-*` classes
- **Do not:** Change primary/secondary colors; introduce new UI libraries; alter nav structure or page layout patterns

---

## Architecture Notes

- **Tenant:** `tenant_id` on many models; `null` = global
- **Auth:** JWT in `Authorization: Bearer token`; user in `localStorage.getItem('user')`
- **API:** `POST /api/auth/login`, `GET /api/auth/me`; `get_current_user`, `require_role` in deps
- **OpenAI:** Uses `get_settings().openai_api_key`; if missing, falls back to rule-based/curated content
- **Database:** `init_db()` creates tables on startup (no Alembic migrations)

---

## Deployment

- **Frontend (Vercel):** https://mediation-intelligence-platform.vercel.app – auto-deploys from GitHub on push to `main`. Config in `vercel.json` (build: `cd frontend && npm ci && npm run build`, output: `frontend/dist`).
- **Backend (Render):** `render.yaml` – Docker build, PostgreSQL (mediation-db).
- **Manual deploy:**
  ```bash
  cd "C:\Users\shuru\Documents\AIProjects\Mediation Platform"
  git add -A && git commit -m "..." && git push origin main
  ```
- **Build note:** Uses `vite-plugin-pwa`; avoid duplicate symbol imports (e.g. `Link` from both react-router-dom and lucide-react).

---

## Technical Notes for New Agent

- **FastAPI parameter order:** Parameters without defaults (e.g. `request: Request`) must come *before* parameters with defaults (`File`, `Form`, `Body`, `Query`, `Depends`). Otherwise: `SyntaxError: parameter without a default follows parameter with a default`. Affected files: `sessions.py`, `documents.py` (fixed March 2026).
- **AdminTrainingAcademyPage:** Lucide `Link` icon must be imported as `LinkIcon` (conflict with `react-router-dom` `Link`).
- **Document upload (training):** `file_url` is built as `${API_BASE}/documents/${data.id}/download`; ensure `VITE_API_URL` is correct in production.
- **Embed content:** Plain `http(s)` URLs are wrapped in iframe; full iframe HTML is rendered as-is. Admin trusts content.
- **Academy module conversion:** `backend/app/api/training.py` → `get_trainee_academy_modules` converts AcademyLesson to trainee lesson format (video_id, file_url, content_html, type).
- **Alembic:** Not used; schema changes via `init_db()` or manual scripts.
- **Phase 6:** Recording stubs in `recordings.py`; payment stubs in `payments.py`; knowledge base uses FTS (no vector RAG). Preserve `--color-*` and layout in all new UI.

---

## Suggested Next Steps for New Agent

**Priority:** Implement **Phase 6** in order: 6a → 6b → 6c → 6d. See Phase 6 sections above for full spec.

**Design rule:** Preserve platform colors (#8b5cf6, #1fbfb8), theme, and layout. Use existing `--color-*` variables and component patterns.

1. **Phase 6a** — Recording (Jibri), E-Signatures, Payments
2. **Phase 6b** — AI Transcription, Vector RAG
3. **Phase 6c** — Scalable User Management polish, Multi-Language
4. **Phase 6d** — Analytics enhancements, Low-Bandwidth, Practice persistence

---

## New API Endpoints (Case/Client/Phase 2–3)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/{id}/cases` | Cases linked to client (internal_ref or party) |
| GET | `/users/{id}/profile` | Client profile (mediator) |
| PATCH | `/users/{id}/profile` | Update client (mediator) |
| POST | `/users/onboard-client` | Mediator submit client (pending_approval) |
| GET | `/users/pending-approvals` | Admin list pending/on_hold |
| POST | `/users/{id}/approve` | Admin approve, generate user_id |
| POST | `/users/{id}/reject` | Admin reject with reason |
| POST | `/users/{id}/request-info` | Admin put on hold |
| POST | `/users/{id}/resubmit` | Mediator resubmit rejected |
| GET | `/users/my-submitted-clients` | Mediator's pending/on_hold/rejected |
| POST | `/auth/change-password` | Change password (clears must_change_password) |
| GET | `/search?q=` | Unified search (users + cases) |
| GET | `/calendar/free-slots` | Available slots for mediator (for booking) |
| GET | `/documents?case_id=` | List documents by case |
| POST | `/documents/upload` | Upload (FormData: file, case_id) |
| GET | `/documents/{id}/download` | Download document |
| POST | `/sessions/{id}/start` | Start mediation session |
| POST | `/sessions/{id}/end` | End session (body: optional free_tier_email) |
| GET | `/sessions/{id}/room` | Jitsi room URL for session |
| GET | `/audit/logs` | Audit logs (super_admin; Query: resource_type, limit) |

---

## Files to Read First

**Phase 6 context:**
- `docs/HANDOVER-NOTES.md` – this file; **Phase 6 spec above**
- `docs/CURRENT STATE & PROBLEMS.md` – implementation guide
- `IMPLEMENTATION_PLAN.md` – original phased roadmap

**Backend:**
- `backend/app/api/recordings.py` – recording stubs (Phase 6a)
- `backend/app/api/payments.py` – payment stubs (Phase 6a)
- `backend/app/api/knowledge.py` – knowledge base (Phase 6b RAG)
- `backend/app/api/users.py` – users, reassign, pagination
- `backend/app/api/cases.py` – case CRUD, documents
- `backend/app/api/academy_admin.py` – academy CRUD, AI, analytics
- `backend/app/api/training.py` – trainee modules, lesson conversion
- `backend/app/api/analytics_dashboard.py` – dashboard + drill-down

**Frontend:**
- `frontend/src/App.css` – **theme variables; preserve colors and layout**
- `frontend/src/pages/DashboardPage.jsx` – mediator dashboard
- `frontend/src/pages/AdminDashboardPage.jsx` – admin, Users tab, Analytics, Audit
- `frontend/src/pages/CaseDetailPage.jsx` – case view, documents sidebar
- `frontend/src/pages/AdminTrainingAcademyPage.jsx` – training academy
- `frontend/src/pages/TraineeTrainingPage.jsx` – trainee academy
- `frontend/src/pages/PracticeScenarioPage.jsx` – practice scenarios (Phase 6d)
- `frontend/src/api/client.js` – API client

---

## Important: Separate from rafiki-local

- **rafiki-local** = HR platform (rafikihr.com), at `C:\Users\shuru\Documents\AIProjects\rafiki-local`
- **Mediation Platform** = This project, at `C:\Users\shuru\Documents\AIProjects\Mediation Platform`
- They share a similar visual style (purple-teal) but are different codebases, repos, and deployments.

---

## Known Gaps (Phase 6 Targets)

**Phase 6a:**
- Session recording: Jibri not integrated; API stubs exist
- E-signatures: Not implemented; settlement agreements manual only
- Payments: M-Pesa/Stripe stubs; no real provider integration

**Phase 6b:**
- AI transcription: Not implemented
- Knowledge base: Keyword + FTS only; no vector RAG

**Phase 6c:**
- Multi-language: English only
- User management: Verify at 1000+ scale; mediator assignment clients-only

**Phase 6d:**
- Practice scenario completion: `localStorage` only
- Export: CSV only; no PDF
- No threshold alerts or anomaly detection
- No low-bandwidth mode

**Infrastructure:**
- No Alembic; schema changes via `init_db()` or manual scripts
