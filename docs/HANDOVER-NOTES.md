# Handover Notes for New Agent

**Project:** Mediation Intelligence Platform  
**Location:** `C:\Users\shuru\Documents\AIProjects\Mediation Platform`  
**GitHub:** https://github.com/shuruti-ke/mediation-intelligence-platform  
**Branch:** `main`  
**Date:** March 2025  

---

## Project Overview

A mediation platform with AI features, Jitsi video, knowledge base, judiciary search, and training/CPD. **Primary target:** Kenya/East Africa. **Roles:** `super_admin`, `mediator`, `trainee`, `client_corporate`, `client_individual`.

---

## Tech Stack

- **Backend:** FastAPI, PostgreSQL, SQLAlchemy (async), Alembic
- **Frontend:** React 19, Vite 7, React Router 7, Tailwind v4, Recharts, Lucide icons
- **AI:** OpenAI (optional; `OPENAI_API_KEY` in config)
- **Deploy:** Vercel (frontend), GitHub (repo)

---

## Key Paths

| Area | Path |
|------|------|
| Backend API | `backend/app/api/` |
| Models | `backend/app/models/` |
| Training API | `backend/app/api/training.py` |
| Frontend pages | `frontend/src/pages/` |
| Admin dashboard | `frontend/src/pages/AdminDashboardPage.jsx` |
| API client | `frontend/src/api/client.js` |
| App routes | `frontend/src/App.jsx` |

---

## Training System (Current State)

### Backend Models (`backend/app/models/training.py`)

- **TrainingModule** – `slug`, `title`, `description`, `content_html`, `order_index`, `is_published`
- **TrainingProgress** – `user_id`, `module_id`, `progress_pct`, `completed`, `completed_at`
- **CPDProgress** – `user_id`, `year`, `hours_completed`, `hours_required`
- **Quiz** – `module_id`, `title`, `questions_json`, `passing_score_pct`
- **QuizAttempt** – `user_id`, `quiz_id`, `score_pct`, `passed`, `answers_json`
- **RolePlayScenario** – AI-generated scenarios
- **RolePlaySession** – Chat sessions with AI parties
- **TrainingModuleConfig** – Interactive steps (branching)
- **TraineeAcademyProgress** – `progress_json` for trainee academy

### Trainee Academy

- **Static modules** in `backend/app/api/training.py` (`TRAINEE_MODULES`)
- **Full articles** in `backend/app/data/trainee_articles.py` (5000+ words each)
- **API:** `GET /training/trainee-academy/modules`, `GET/POST /training/trainee-academy/progress`, `GET /training/trainee-academy/article/:lessonId`
- **Frontend:** `TraineeTrainingPage.jsx`, `TraineeArticlePage.jsx`

### Practice Scenarios

- **Data:** `frontend/src/data/practiceScenarios.js` (Power imbalance, Cultural sensitivity, Hidden interests)
- **Page:** `PracticeScenarioPage.jsx` – rich content, progressive disclosure, "Practice now" → Role-Play
- **Completion:** `localStorage` key `practiceScenarioCompleted`

### Admin Dashboard

- **Route:** `/admin` (super_admin only)
- **Tabs:** Dashboard, Tenants, Users, Trainees, Org KB
- **Trainees:** Add trainee modal; link to Trainee Academy
- **Training Academy admin:** Not yet implemented

---

## Pending Work: Training Academy Admin Dashboard

**Requested:** Full admin dashboard for training academy with:

1. **AI Module Creator**
   - Input: topic, audience, duration
   - Output: module outline, lessons, draft quiz
   - Human review before publish
   - Fallback: manual upload (SCORM, PDF, MP4)

2. **Content Management (CMS)**
   - Module: title, description, thumbnail, difficulty, tags, visibility (Public/Private)
   - Lesson: rich text, video embed, file upload, ordering/drag-drop
   - Version control
   - Soft delete (archive)

3. **Quiz & Assessment Builder**
   - Question types: MC, T/F, scenario, drag-drop
   - Settings: passing score, time limit, randomize, retries
   - Feedback per answer
   - Link to modules or final exams

4. **Analytics Dashboard**
   - KPIs: enrolled, completion rate, avg score, training hours
   - Charts: module popularity, completion funnel, risk alert
   - Filters: date, module, region

5. **Student Drill-Down**
   - Click student → profile, progress radar, task list (Not Started / In Progress / Completed / Failed)
   - Time tracking per module
   - Actions: Message, Assign remedial module

6. **Africa-First**
   - Low bandwidth: text over media, “Lite Mode” for videos
   - Offline sync
   - Mobile admin

**Design:** Indigo-purple gradients, clean data viz, mobile-responsive, dark mode option.

---

## Architecture Notes

- **Tenant:** `tenant_id` on many models; `null` = global
- **Auth:** JWT in `Authorization: Bearer token`; user in `localStorage.getItem('user')`
- **API:** `POST /api/auth/login`, `GET /api/auth/me`; `get_current_user`, `require_role` in deps
- **OpenAI:** Uses `get_settings().openai_api_key`; if missing, falls back to rule-based/curated content

---

## Migrations

- **Alembic:** `backend/alembic/` (may not exist; check)
- **Scripts:** `backend/scripts/` – `migrate_trainee_academy.py`, `migrate_role_play_sessions.py`, etc.
- Run migrations before starting new schema work

---

## Deployment

```bash
cd "C:\Users\shuru\Documents\AIProjects\Mediation Platform"
git add -A && git commit -m "..." && git push origin main
```

---

## Suggested Next Steps for New Agent

1. Inspect `AdminDashboardPage.jsx` and add a new tab (e.g. “Training Academy”) or section.
2. Add backend models (e.g. `AcademyModule`, `AcademyLesson`, `AcademyMaterial`) if needed beyond `TrainingModule`.
3. Add API endpoints for AI module creation, CRUD, analytics, student progress.
4. Build UI: AI wizard, module cards, analytics charts, student drill-down modal.
5. Implement quiz builder and link to modules.
6. Add soft delete and version control.

---

## Files to Read First

- `backend/app/api/training.py` – training APIs
- `backend/app/models/training.py` – training models
- `frontend/src/pages/AdminDashboardPage.jsx` – admin layout
- `frontend/src/pages/TraineeTrainingPage.jsx` – trainee view
- `frontend/src/api/client.js` – API client

---

## Known Gaps

- `TrainingModule` has no `thumbnail`, `difficulty`, `tags`, `visibility`
- No lesson-level model (lesson data in `content_html` or `config_json`)
- No time-tracking per module
- No student drill-down API
- Analytics: `analyticsApi` exists for cases/dashboard; not for training academy
- Practice scenario completion is `localStorage` only (no backend)
