# Mediation Intelligence Platform — Deployment Guide

Deploy the frontend to **Vercel** and the backend to **Render** (with PostgreSQL).

---

## Prerequisites

- GitHub account (repo: `shuruti-ke/mediation-intelligence-platform`)
- [Vercel](https://vercel.com) account
- [Render](https://render.com) account

---

## 1. Deploy Backend (Render)

### Option A: Blueprint (recommended)

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Blueprint**
3. Connect your GitHub repo: `shuruti-ke/mediation-intelligence-platform`
4. Render will detect `render.yaml` and create:
   - **mediation-api** (web service)
   - **mediation-db** (PostgreSQL, free tier)
5. Before deploying, set environment variables for **mediation-api**:
   - `CORS_ORIGINS` = `https://your-vercel-app.vercel.app,https://your-custom-domain.com`
   - `REDIS_URL` = leave empty or use a Redis URL (optional for MVP)
6. Click **Apply**
7. Wait for the build. Note the backend URL, e.g. `https://mediation-api.onrender.com`

### Option B: Manual

1. **Create PostgreSQL**
   - New → PostgreSQL
   - Name: `mediation-db`
   - Plan: Free
   - Copy the **Internal Database URL**

2. **Create Web Service**
   - New → Web Service
   - Connect repo: `shuruti-ke/mediation-intelligence-platform`
   - Name: `mediation-api`
   - Runtime: **Docker**
   - Dockerfile path: `./backend/Dockerfile`
   - Docker context: `./backend`
   - Add environment variables:
     - `DATABASE_URL` = (paste Internal Database URL; change `postgresql://` to `postgresql+asyncpg://` if needed — the app auto-converts)
     - `SECRET_KEY` = generate a random string (e.g. `openssl rand -hex 32`)
     - `CORS_ORIGINS` = `https://your-frontend.vercel.app` (update after frontend deploy)

3. Deploy

### Seed the database

After the first deploy, run the seed script:

1. In Render, open **mediation-api** → **Shell**
2. Run:
   ```bash
   python -m app.scripts.seed
   ```
   Or from the project root:
   ```bash
   cd backend && python scripts/seed.py
   ```

---

## 2. Deploy Frontend (Vercel)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **Add New** → **Project**
3. Import `shuruti-ke/mediation-intelligence-platform`
4. Configure:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend` (or leave blank if using root `vercel.json`)
   - **Build Command:** `npm run build` (if root is `frontend`)
   - **Output Directory:** `dist`
5. Add environment variable:
   - **Name:** `VITE_API_URL`
   - **Value:** `https://mediation-api.onrender.com/api` (your Render backend URL)
6. Deploy

---

## 3. Update CORS

After the frontend is live, update the backend CORS:

1. Render → **mediation-api** → **Environment**
2. Set `CORS_ORIGINS` to your frontend URL(s), e.g.:
   ```
   https://mediation-intelligence-platform.vercel.app,https://your-domain.com
   ```
3. Save (triggers a redeploy)

---

## 4. Custom Domain (optional)

### Vercel
- Project → Settings → Domains → Add your domain

### Render
- Web Service → Settings → Custom Domains → Add

---

## Environment Variables Reference

| Variable | Backend | Frontend | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | ✓ | — | PostgreSQL URL (Render provides) |
| `SECRET_KEY` | ✓ | — | JWT signing key |
| `CORS_ORIGINS` | ✓ | — | Allowed frontend origins |
| `VITE_API_URL` | — | ✓ | Backend API URL |

---

## Troubleshooting

- **CORS errors:** Ensure `CORS_ORIGINS` includes your exact frontend URL (no trailing slash).
- **Database connection:** Render free tier spins down after 15 min inactivity; first request may be slow.
- **Build fails:** Check Render logs; ensure `backend/requirements.txt` and `Dockerfile` are correct.
