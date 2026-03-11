# Mediation Intelligence Platform — Implementation Plan

**Version:** 1.2  
**Date:** March 10, 2026  
**Video Integration:** Jitsi Meet (with Jibri for recording)  
**Project Type:** New Greenfield Build

---

## Executive Summary

This plan translates the three source documents (AI Mediation Platform concept, Mediation Intelligence Platform v2.0 architecture, and v7.1 Commercial Master) into a phased, actionable implementation roadmap. The platform will use **Jitsi Meet** for video conferencing and **Jibri** for session recording, integrated into a secure, multi-tenant mediation infrastructure.

**Additions (v1.1):** Cloudflare database options, AI-powered library knowledge base, judiciary case web search, and multi-format document handling.

**Additions (v1.2 — Clarifications):** Revenue model options, Usage & Billing service, Jitsi/Jibri hybrid deployment strategy, AI cost guardrails, document parsing MVP (PyMuPDF + python-docx), commercial configuration, go-to-market (free tier, lead-gen), privacy policy requirements.

---

## 1. Technology Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | React + PWA (Vite) | Offline-first, responsive, low-bandwidth friendly |
| **Backend** | Python FastAPI / Node.js NestJS | API-first, async, strong typing |
| **Database** | **Cloudflare D1** or **Hyperdrive + PostgreSQL** | See §1.1 below |
| **Vector DB** | **Cloudflare Vectorize** | Knowledge base embeddings, RAG |
| **Object Storage** | **Cloudflare R2** or S3-compatible | Encrypted documents & recordings |
| **Video** | **Jitsi Meet** (embedded) | Open-source, self-hostable, breakout via separate rooms |
| **Recording** | **Jibri** (Jitsi Broadcasting Infrastructure) | Official Jitsi recording component |
| **Auth** | Keycloak / Auth0 / Custom JWT | RBAC, multi-tenant, MFA |
| **Payments** | Stripe + M-Pesa Daraja | Payment Orchestrator pattern |
| **AI** | Workers AI / OpenAI + RAG | Dual-path: probabilistic + deterministic |
| **Document Parsing** | PyMuPDF + python-docx (MVP); Apache Tika (later) | See §3C |

### 1.1 Revenue Model — Clarify Early

Define revenue options before build. Recommended mix:

| Model | Description | Best For |
|-------|-------------|----------|
| **Per session** | Charge per mediation session | Individual mediators, ad-hoc |
| **Per mediator license** | Monthly/annual fee per mediator | Mediation firms |
| **Enterprise tenant** | Subscription per organization | Corporates, courts |
| **Usage-based** | Meter recordings, AI queries, storage | Hybrid with base subscription |

**Implementation:** Add a **Usage Metrics & Billing** service from Day 1. Track billable events (recordings, AI queries, document storage) even if billing is not live — this enables correct pricing later. See §1.2.

### 1.2 Database on Cloudflare — Options

Cloudflare offers two viable database approaches:

| Option | Service | Best For | Trade-offs |
|--------|---------|----------|------------|
| **A. Full Cloudflare** | **D1** (SQLite) | Simpler deployments, edge-native, cost-effective | SQLite semantics; adapt schema (no native JSONB); 10GB limit; full-text search supported |
| **B. Hybrid** | **Hyperdrive + PostgreSQL** | Complex schemas, JSONB, RLS, event sourcing | PostgreSQL hosted elsewhere (Neon, Supabase, AWS RDS); Cloudflare Workers connect via Hyperdrive for connection pooling at the edge |

**Recommendation:**

- **MVP / Early stage:** Use **D1** — serverless, pay-per-query, built-in JSON support and full-text search. Schema can use `TEXT` with `json()` for consent flags and metadata.
- **Production / Enterprise:** Use **Hyperdrive + Neon or Supabase** — full PostgreSQL for event-sourced transcripts, RLS, and advanced multi-tenant isolation.

**Schema migration:** Design schema to avoid heavy reliance on SQLite-specific features (e.g., FTS5). When you hit scale or need advanced Postgres features (RLS, complex JSONB queries), Hyperdrive + Neon is a smooth transition.

**D1 Schema Adaptation (if chosen):**

```sql
-- D1 uses SQLite; JSON stored as TEXT, queried via json_extract
CREATE TABLE tenants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    data_residency_region TEXT NOT NULL,
    isolation_level TEXT DEFAULT 'SHARED_LOGICAL',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE knowledge_base_documents (
    id TEXT PRIMARY KEY,
    tenant_id TEXT,
    title TEXT,
    content_text TEXT,
    source_type TEXT,  -- 'upload', 'url', 'manual'
    metadata_json TEXT,
    created_at TEXT
);

CREATE VIRTUAL TABLE knowledge_base_fts USING fts5(
    title, content_text, content='knowledge_base_documents', content_rowid='rowid'
);
```

---

## 2. Jitsi Integration Architecture

### 2.1 Embedding Strategy

- **JitsiMeetExternalAPI** (iframe) for embedding in the mediation room UI
- Each mediation session gets a unique room name: `mediation-{case_id}-{session_id}`
- Room names are generated server-side and passed to the client with JWT-based auth

### 2.2 Jitsi Configuration (per session)

```javascript
// Key config for mediation use case
{
  roomName: `mediation-${caseId}-${sessionId}`,
  parentNode: document.querySelector('#jitsi-container'),
  configOverwrite: {
    startWithAudioMuted: false,
    startWithVideoMuted: false,
    enableWelcomePage: false,
    prejoinPageEnabled: false,
    disableThirdPartyRequests: true,
    enableRecording: true,  // Requires Jibri
    fileRecordingsEnabled: true,
    dropbox: { appKey: '...' },  // Optional: auto-upload to Dropbox
    resolution: 720,  // Balance quality vs bandwidth
    constraints: { video: { height: { ideal: 720 } } }
  },
  interfaceConfigOverwrite: {
    TOOLBAR_BUTTONS: [
      'microphone', 'camera', 'closedcaptions', 'desktop',
      'fullscreen', 'hangup', 'chat', 'recording', 'settings'
    ],
    SHOW_JITSI_WATERMARK: false,
    DEFAULT_LOGO_URL: '/logo.png'
  },
  userInfo: {
    displayName: mediatorDisplayName,
    email: mediatorEmail
  }
}
```

### 2.3 Breakout / Caucus Rooms

Jitsi does not natively support breakout rooms. **Approach:**

- Create **separate Jitsi rooms** per caucus: `mediation-{case_id}-caucus-{party_a|party_b}`
- Mediator can join any room; parties see only their caucus room
- Backend generates room URLs and enforces access (mediator sees all, parties see only theirs)
- Session timer and room lifecycle managed by the platform

### 2.4 Recording with Jibri

| Component | Responsibility |
|-----------|----------------|
| **Jibri** | Joins Jitsi room as a "recorder" participant, captures video/audio, outputs MP4 |
| **Storage** | Recordings saved to `/srv/recordings` or S3 via post-recording job |
| **Metadata** | Link recording file to `case_id`, `session_id`, `participants` in DB |
| **Retention** | Per consent flags; auto-delete unless `allow_recording_for_training` or legal hold |

**Jitsi/Jibri Deployment Strategy (Clarification):**

Self-hosting gives data sovereignty (great for trust) but adds DevOps overhead. **Recommended hybrid approach:**

| Phase | Approach | Rationale |
|-------|----------|------------|
| **Phase 1–2 (MVP)** | **Managed Jitsi** (8x8.vc or hosted Jitsi on AWS) | Reduce DevOps load; focus on product-market fit |
| **Post-revenue** | Migrate to **self-hosted** Jitsi + Jibri | Data sovereignty, cost control at scale |

**Jibri considerations:**
- Requires dedicated VMs (4 CPU, 8GB RAM) — factor into cloud cost projections.
- **Option:** Make recording a **Phase 2+ premium feature** if not critical for MVP.
- Design schema with migration in mind (provider-agnostic room IDs, recording metadata).

**Deployment options (when self-hosting):**
1. **Self-hosted:** Ubuntu 20.04+ VM, 4 CPU, 8GB RAM
2. **Docker:** `docker compose -f docker-compose.yml -f jibri.yml up -d`
3. **8x8.vc / hosted:** For Phase 1–2 to reduce operational overhead

### 2.5 Recording Flow

```
1. Mediator clicks "Start Recording" in mediation room
2. Frontend calls API: POST /api/cases/{id}/sessions/{sid}/recording/start
3. Backend validates consent, creates recording record, triggers Jibri via Jitsi Prosody
4. Jibri joins room, records to local disk
5. On "Stop Recording", Jibri finishes, file moved to S3 (encrypted)
6. Backend updates recording record with S3 URL, notifies participants
```

---

## 3. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER (PWA)                                 │
│  Mediator Portal │ Client Portal │ Admin Dashboard                           │
│  React + Offline-First + IndexedDB (encrypted cache)                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                        │
│  Auth │ Rate Limit │ Tenant Routing │ Data Residency Check                   │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌─────────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│  Case Service   │    │  Mediation Session Svc   │    │  Document Service    │
│  CMS, Allocation│    │  Jitsi room mgmt        │    │  E-sign, templates   │
│  Progress track │    │  Recording lifecycle    │    │  Version control     │
└─────────────────┘    └─────────────────────────┘    └─────────────────────┘
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  D1 / PostgreSQL │ Vectorize (embeddings) │ R2 / S3 (docs, recordings)       │
│  + Usage & Billing (usage_metering_events) │ Analytics (opt-in, consent)     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
         ┌────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
┌─────────────────┐    ┌─────────────────────────┐    ┌─────────────────────┐
│  Jitsi Meet     │    │  Jibri (Recording)      │    │  AI Gateway         │
│  (Docker/Self)  │    │  Ubuntu VM / Docker     │    │  RAG + KB + Judiciary│
└─────────────────┘    └─────────────────────────┘    └─────────────────────┘
```

---

## 3A. Library Knowledge Base (AI-Powered Search)

A searchable, queryable knowledge base that users access through the AI platform.

### Architecture

| Component | Role |
|-----------|------|
| **Cloudflare Vectorize** | Stores embeddings for semantic search |
| **D1 / PostgreSQL** | Stores document metadata, chunks, source references |
| **Workers AI** or **OpenAI** | Generates embeddings; answers queries with RAG |
| **Cloudflare Queues** | Batch processing for document ingestion |

### Content Sources

- **Curated library:** Mediation best practices, ethics guidelines, jurisdictional modules, settlement templates
- **User uploads:** PDF, DOCX, ODT (parsed via document service)
- **Case studies:** Anonymized examples (with consent)
- **Legislation:** Links to Laws.Africa, Kenya Law, etc.

### RAG Flow

```
1. User query → "What are best practices for employment mediation in Kenya?"
2. Embed query (Workers AI @cf/baai/bge-base-en-v1.5 or OpenAI)
3. Vectorize similarity search → top-k chunks
4. Fetch full text from D1 for matched chunks
5. Inject context into LLM prompt
6. Return answer with source citations
```

### AI/RAG Cost Guardrails (Clarification)

AI features are powerful but can get expensive. Implement:

| Guardrail | Implementation |
|-----------|----------------|
| **Query rate limits** | Per-tenant limits based on subscription tier |
| **Judiciary search cache** | Cache frequent Tausi/Laws.Africa results to avoid repeated API calls |
| **Premium AI features** | Make "AI-assisted settlement drafting" a premium add-on |
| **Usage metering** | Track AI tokens, KB queries for billing (see §1.2) |

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/knowledge/ingest` | Upload document; chunk, embed, store |
| `GET /api/knowledge/search` | Semantic + keyword search |
| `POST /api/knowledge/query` | AI-powered Q&A with citations |
| `GET /api/knowledge/documents` | List documents in library |

### Schema (D1 or PostgreSQL)

```sql
CREATE TABLE knowledge_base_documents (
    id UUID PRIMARY KEY,
    tenant_id UUID,
    title TEXT NOT NULL,
    source_type TEXT,  -- 'upload', 'url', 'manual', 'curated'
    file_path TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE knowledge_base_chunks (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES knowledge_base_documents(id),
    chunk_index INT,
    content TEXT NOT NULL,
    vector_id TEXT,  -- Reference in Vectorize
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3B. Judiciary Case Web Search

Enable users to search publicly available judiciary/court case databases through the AI platform.

### Data Sources (by Region)

| Region | Source | Access |
|--------|--------|--------|
| **Kenya** | Kenya Law (kenyalaw.org), Tausi API | Web scraping or Tausi API (token required) |
| **Africa** | Laws.Africa API, AfricanLII, judy.legal | API (Laws.Africa free for non-commercial) |
| **Global** | Google Custom Search, Bing API | API keys |

### Implementation Options

1. **Tausi API**

   - REST API for Kenyan judicial decisions

   - Filter by court, year, case type, area of law

   - Returns structured JSON

2. **Laws.Africa Content API**

   - Machine-readable African legislation

   - Akoma Ntoso XML, JSON, HTML

   - Free for non-commercial use

3. **Web Search Fallback**

   - Google Custom Search API or Bing Web Search API

   - Generic search for case citations, court names

   - AI summarizes results for relevance

### AI Integration

- User asks: "Find similar cases for employment disputes in Nairobi"
- AI calls judiciary search service → returns case list
- AI summarizes and cites cases in response
- **Optional:** Store search results in knowledge base for future reference (with consent)

### Judiciary Search Caching

Cache frequent judiciary search results (by query hash) to avoid repeated API calls to Tausi/Laws.Africa. Reduces cost and improves response time. See §3A AI Cost Guardrails.

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/judiciary/search` | Query judiciary/case databases |
| `GET /api/judiciary/sources` | List configured sources by region |
| `POST /api/ai/query` | AI query that can invoke judiciary search as a tool |

---

## 3C. Document Saving & Reading (Multi-Format)

Support various document formats for upload, parsing, and export.

### MVP Approach (Clarification): PyMuPDF + python-docx First

Apache Tika is powerful but Java-heavy. **For MVP:**

| Phase | Approach | Rationale |
|-------|----------|------------|
| **MVP** | **PyMuPDF** (PDF) + **python-docx** (DOCX) | Covers ~80% of use cases; no Java dependency; lighter ops |
| **Later** | Add **Apache Tika** | Only if you truly need 1000+ format support; adds operational complexity |

**Watch PDF/OCR costs:** OCR (Tesseract) can be CPU-intensive; consider async processing and rate limits.

### Supported Formats

| Format | Read | Write | Library (MVP) |
|--------|------|-------|---------------|
| **PDF** | ✓ | ✓ | PyMuPDF (fitz), ReportLab |
| **DOCX** | ✓ | ✓ | python-docx |
| **TXT** | ✓ | ✓ | Native |
| **ODT** | ✓ | ✓ | odfpy or Tika (Phase 2+) |
| **HTML** | ✓ | ✓ | BeautifulSoup, weasyprint |
| **Images** (OCR) | ✓ | — | pytesseract (Phase 2+; monitor cost) |

### Document Service Responsibilities

| Function | Description |
|----------|-------------|
| **Ingest** | Parse uploaded file → extract text → store in R2 + metadata in DB |
| **Index** | Chunk text → embed → store in Vectorize (for knowledge base) |
| **Export** | Generate PDF/DOCX from templates (settlement agreements, reports) |
| **Version control** | Track revisions, diff, audit log |
| **E-sign** | Integrate with DocuSign/HelloSign for signed documents |

### Format-Specific Libraries (MVP)

| Use Case | Library |
|----------|---------|
| PDF read | PyMuPDF (fitz) |
| PDF write | ReportLab, weasyprint |
| DOCX read/write | python-docx |
| OCR from images | pytesseract (Phase 2+; add Tika later for 1000+ formats if needed) |

### Storage Schema

```sql
CREATE TABLE documents (
    id UUID PRIMARY KEY,
    case_id UUID,
    tenant_id UUID,
    file_name TEXT,
    mime_type TEXT,
    storage_path TEXT,  -- R2/S3 key
    extracted_text TEXT,  -- For search; optional
    version INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 4. Core Data Model (PostgreSQL / D1)

### 4.1 Tenancy & Users

```sql
CREATE TABLE tenants (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    data_residency_region TEXT NOT NULL,
    isolation_level TEXT DEFAULT 'SHARED_LOGICAL',
    -- Commercial Configuration (Clarification): customize per client tier
    commercial_config JSONB DEFAULT '{}',  -- branding, payment_methods_enabled, ai_features_enabled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Metrics & Billing: track billable events from Day 1
CREATE TABLE usage_metering_events (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    event_type TEXT NOT NULL,  -- 'RECORDING_MINUTE', 'AI_QUERY', 'AI_TOKEN', 'STORAGE_GB', 'SESSION'
    quantity NUMERIC(10,2) NOT NULL,
    case_id UUID,
    metadata_json JSONB,  -- Anonymized context only
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID REFERENCES tenants(id),
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,  -- super_admin, mediator, trainee, client_corporate, client_individual
    display_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 Cases & Sessions

```sql
CREATE TABLE cases (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    case_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'INTAKE',  -- INTAKE, ASSIGNED, ACTIVE, SETTLED, CLOSED
    mediator_id UUID REFERENCES users(id),
    dispute_category TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE mediation_sessions (
    id UUID PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id),
    scheduled_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    jitsi_room_name TEXT,
    status TEXT DEFAULT 'SCHEDULED'
);

CREATE TABLE session_recordings (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES mediation_sessions(id),
    storage_path TEXT,
    duration_seconds INT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    consent_confirmed BOOLEAN DEFAULT FALSE
);
```

### 4.3 Event-Sourced Transcripts (from v2.0)

```sql
CREATE TABLE transcript_segments (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    seq BIGINT NOT NULL,
    speaker_label TEXT,
    start_ms INT,
    end_ms INT,
    raw_text TEXT,
    confidence NUMERIC(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(room_id, seq)
);

CREATE TABLE transcript_corrections (
    id UUID PRIMARY KEY,
    segment_id UUID REFERENCES transcript_segments(id),
    correction_type TEXT,
    original_text_snapshot TEXT,
    corrected_text TEXT,
    corrected_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 5. Phased Implementation Roadmap

### Phase 1: Foundation (Weeks 1–6)

**Goal:** Core platform, auth, basic Jitsi integration.

| Task | Details | Deliverable |
|------|---------|-------------|
| 1.1 Project setup | Monorepo: backend (FastAPI), frontend (React+Vite), docker-compose | Repo structure |
| 1.2 Database schema | Tenants, users, cases, sessions, recordings (D1 or PostgreSQL) | Migrations |
| 1.3 Auth & RBAC | JWT, role-based routes, tenant isolation | Login, protected routes |
| 1.4 Jitsi deploy | Docker Compose or self-hosted Jitsi Meet | `meet.example.com` |
| 1.5 Jitsi embed | Embed Jitsi in mediation room page, room name from API | Working video room |
| 1.6 Basic CMS | Case intake form, case list, allocation (manual) | Mediator can create cases |
| 1.7 **Usage & Billing stub** | Add `usage_metering_events` table; `GET /api/billing/usage` endpoint | Track usage even if billing not live |
| 1.8 **Analytics instrumentation** | Instrument key events (with consent); understand feature adoption | Privacy policy must disclose |
| 1.9 **Commercial config** | Add `commercial_config` to tenants (branding, ai_features_enabled) | Per-client tier customization |

**Jitsi-specific in Phase 1:**

- Use **managed Jitsi** (8x8.vc or hosted) for MVP to reduce DevOps; or Docker for local dev
- Create React component `JitsiEmbed.jsx` using `JitsiMeetExternalAPI`
- Room creation: `POST /api/sessions` returns `{ roomName, jwt }` for authenticated join

---

### Phase 2: Mediation Sessions & Recording (Weeks 7–10)

**Goal:** Full mediation flow with Jitsi + Jibri recording. *Recording can be a premium add-on if not critical for MVP.*

| Task | Details | Deliverable |
|------|---------|-------------|
| 2.1 Jibri setup | Install Jibri on separate VM or Docker; or defer to post-MVP as premium | Recording enabled |
| 2.2 Recording API | Start/stop recording, link to session | Recording lifecycle |
| 2.3 Recording storage | Move Jibri output to S3, encrypt, link in DB | Secure archive |
| 2.4 Caucus rooms | Create separate rooms per party, mediator access to all | Breakout flow |
| 2.5 Session timer | Start/end session, log history | Session metadata |
| 2.6 Consent flow | Consent before recording, store in `case_participants` | Compliance |

**Jitsi-specific in Phase 2:**

- Jibri config: `/etc/jitsi/jibri/config.json` with XMPP, recording dir
- API: `POST /sessions/{id}/recording/start` → trigger Jibri via Prosody
- Caucus: `POST /sessions/{id}/caucus` → create `mediation-{case}-caucus-{party}` rooms

---

### Phase 3: Documents, Knowledge Base & AI (Weeks 11–18)

**Goal:** Document exchange (multi-format), library knowledge base, judiciary search, e-signing, AI tools.

| Task | Details | Deliverable |
|------|---------|-------------|
| 3.1 Document parsing | **MVP:** PyMuPDF (PDF) + python-docx (DOCX) for 80% use case; add Tika later if needed | Multi-format ingest |
| 3.2 Document storage | R2/S3 encrypted storage, version tracking, metadata in DB | Document service |
| 3.3 Document export | Generate PDF/DOCX from templates (settlements, reports) | Export service |
| 3.4 Knowledge base | Vectorize + D1; ingest docs, chunk, embed; search API | Library KB |
| 3.5 AI query with RAG | User queries KB via AI; citations returned | `/api/knowledge/query` |
| 3.6 Judiciary search | Tausi API (Kenya), Laws.Africa, or web search fallback | `/api/judiciary/search` |
| 3.7 AI + judiciary tool | AI can invoke judiciary search when answering legal queries | Integrated AI |
| 3.8 E-signing | Integration with DocuSign/HelloSign or custom | Signed agreements |
| 3.9 Settlement template | Template builder, AI-assisted drafting (deterministic) | Clause injection |
| 3.10 Transcript integration | Optional: pipe Jitsi audio to STT, event-sourced segments | Transcript tables |

---

### Phase 4: Public Portal & Payments (Weeks 19–24)

**Goal:** Client-facing portal, booking, payments, go-to-market.

| Task | Details | Deliverable |
|------|---------|-------------|
| 4.1 Public portal | Awareness, "Should I Mediate?" assessment | Client landing |
| 4.2 **Free tier** | 1 free mediation session to drive adoption | Lead acquisition |
| 4.3 **Lead-gen: "Should I Mediate?"** | Capture emails/phone (with consent) for follow-up; doubles as lead-gen tool | Nurture pipeline |
| 4.4 Booking flow | Mediation intake, consultation booking | Intake + calendar |
| 4.5 Payment orchestrator | Stripe + M-Pesa Daraja, webhooks | Invoice, payment |
| 4.6 Mediator matching | AI-assisted or admin-assisted | Allocation logic |

---

### Phase 5: Training, CPD & Hardening (Weeks 25–30)

**Goal:** Mediator training, CPD, security hardening.

| Task | Details | Deliverable |
|------|---------|-------------|
| 5.1 Induction modules | Orientation, ethics, online mediation intro | Training content |
| 5.2 CPD dashboard | Progress, quizzes, certification tracking | CPD UI |
| 5.3 Role-play studio | AI case generator, script builder | Training tool |
| 5.4 Security audit | Encryption at rest, audit logs, key rotation | Compliance checklist |
| 5.5 Offline-first PWA | IndexedDB cache, store-and-forward | Resilience |

---

## 6. Jitsi-Specific Implementation Checklist

| Item | Status | Notes |
|------|--------|-------|
| Jitsi Meet server (Docker/self-host) | ☐ | Use `docker-compose` for dev |
| JitsiMeetExternalAPI embed component | ☐ | React wrapper |
| Room name generation (case + session) | ☐ | Server-side, unique per session |
| JWT auth for Jitsi (optional) | ☐ | For private deployments |
| Jibri installation | ☐ | Separate VM recommended |
| Recording start/stop API | ☐ | Trigger via Prosody/API |
| Recording → S3 pipeline | ☐ | Encrypt, link to case |
| Caucus room creation | ☐ | One room per party |
| Consent before recording | ☐ | UI + DB flag |
| Bandwidth adaptation | ☐ | Jitsi config: resolution, simulcast |

---

## 7. Security & Privacy Considerations (from v7.1 + Clarifications)

### Security

- **Encryption:** AES-256-GCM for transcripts and recordings in S3
- **Tenant isolation:** All queries filtered by `tenant_id`
- **Audit logs:** Immutable log for case/session/recording access
- **Consent:** `consent_flags` in `case_participants` (allow_recording, allow_ai)
- **No PII in payment:** Invoice descriptions avoid case details

### Privacy & Compliance (Clarification)

Even though this is commercial (not government), users in Kenya/EU expect strong privacy:

| Requirement | Implementation |
|-------------|----------------|
| **Consent UI** | Make consent explicit and auditable; clear checkboxes, timestamp, user ID |
| **Analytics disclosure** | Privacy policy must disclose analytics collection; build analytics from Day 1 but only with consent |
| **Monetization wording** | Draft privacy policy early — especially around analytics, recordings, AI training data. Enables responsible monetization while protecting users |
| **Draft early** | Privacy policy before launch; refine wording for analytics/phone numbers with legal review |

---

## 8. Recommended Project Structure

```
mediation-platform/
├── backend/                 # FastAPI (or Cloudflare Workers)
│   ├── app/
│   │   ├── api/
│   │   │   ├── cases.py
│   │   │   ├── sessions.py
│   │   │   ├── recordings.py
│   │   │   ├── jitsi.py
│   │   │   ├── knowledge.py     # Knowledge base search/query
│   │   │   ├── judiciary.py    # Judiciary case search
│   │   │   ├── documents.py   # Multi-format document service
│   │   │   └── billing.py     # Usage metrics, /api/billing/usage
│   │   ├── models/
│   │   ├── services/
│   │   │   ├── jitsi_service.py
│   │   │   ├── recording_service.py
│   │   │   ├── knowledge_service.py   # RAG, Vectorize
│   │   │   ├── judiciary_service.py  # Tausi, Laws.Africa, web search
│   │   │   └── document_service.py   # PyMuPDF, python-docx (MVP); Tika later
│   │   └── core/
│   └── alembic/
├── frontend/                # React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── JitsiEmbed.jsx
│   │   │   └── KnowledgeSearch.jsx
│   │   ├── pages/
│   │   │   ├── MediationRoom.jsx
│   │   │   ├── LibraryPage.jsx
│   │   │   └── ...
│   │   └── ...
│   └── public/
├── workers/                 # Optional: Cloudflare Workers for edge
│   ├── knowledge-ingest/
│   └── ai-query/
├── docker/
│   ├── docker-compose.yml
│   ├── jitsi/
│   └── jibri/
├── docs/
└── IMPLEMENTATION_PLAN.md
```

---

## 8A. Feature Implementation Checklists

### Cloudflare Database

| Item | Status | Notes |
|------|--------|-------|
| Choose D1 vs Hyperdrive+PostgreSQL | ☐ | D1 for MVP; Hyperdrive for production |
| D1 schema (if chosen) | ☐ | Adapt JSONB → TEXT + json_extract |
| Hyperdrive config (if chosen) | ☐ | Connect to Neon/Supabase |
| R2 for documents/recordings | ☐ | S3-compatible API |

### Library Knowledge Base

| Item | Status | Notes |
|------|--------|-------|
| Vectorize index creation | ☐ | Workers AI or OpenAI embeddings |
| Document chunking pipeline | ☐ | Chunk size ~500 tokens, overlap |
| Ingest API | ☐ | Upload → parse → chunk → embed → store |
| Search API (semantic + keyword) | ☐ | Vectorize + D1 FTS |
| AI query with citations | ☐ | RAG flow |

### Judiciary Case Search

| Item | Status | Notes |
|------|--------|-------|
| Tausi API integration (Kenya) | ☐ | API token required |
| Laws.Africa API integration | ☐ | Free for non-commercial |
| Web search fallback (Google/Bing) | ☐ | API keys |
| AI tool: invoke search in queries | ☐ | Function calling |

### Document Multi-Format

| Item | Status | Notes |
|------|--------|-------|
| PDF read/write (MVP) | ☐ | PyMuPDF, ReportLab |
| DOCX read/write (MVP) | ☐ | python-docx |
| Apache Tika (Phase 2+) | ☐ | Only if 1000+ formats needed |
| ODT support | ☐ | odfpy or Tika |
| OCR for images | ☐ | pytesseract; monitor cost |

### Quick Wins / Commercial Launch

| Item | Status | Notes |
|------|--------|-------|
| `/api/billing/usage` endpoint | ☐ | Add early; track even if billing not live |
| Analytics instrumentation | ☐ | From Day 1; with consent; privacy-disclosed |
| Commercial config in tenant | ☐ | branding, payment_methods_enabled, ai_features_enabled |
| Privacy policy draft | ☐ | Analytics, recordings, AI training; before launch |

---

## 9. Usage & Billing Service (Quick Win)

Add from Day 1, even if billing is not live:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/billing/usage` | Return usage summary for tenant (sessions, recordings, AI queries, storage) |
| `POST /api/billing/events` | Internal: record usage events (called by other services) |

**Event types:** `SESSION`, `RECORDING_MINUTE`, `AI_QUERY`, `AI_TOKEN`, `STORAGE_GB`

**Benefit:** Enables correct pricing; understand unit economics before going live.

---

## 10. Next Steps

1. **Create repository** with the structure above.
2. **Set up Jitsi** (managed for MVP, or Docker for local dev).
3. **Implement Phase 1** (auth, CMS, Jitsi embed, usage stub, analytics).
4. **Draft privacy policy** early — analytics, recordings, AI training.
5. **Add Jibri** in Phase 2 (or as premium feature post-MVP).
6. **Iterate** through phases 3–5 based on priorities.

---

## 11. References

**Jitsi**
- [Jitsi Meet Handbook](https://jitsi.github.io/handbook/)
- [Jitsi Web Integrations](https://jitsi.github.io/handbook/docs/dev-guide/dev-guide-web-integrations)
- [Jibri Setup Guide](https://jitsi.support/wiki/setting-up-jibri-jitsi-guide/)
- [Jitsi Docker Deployment](https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker)

**Cloudflare**
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [Cloudflare Hyperdrive (PostgreSQL)](https://developers.cloudflare.com/hyperdrive/)
- [Cloudflare Vectorize (RAG)](https://developers.cloudflare.com/vectorize/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/)

**Knowledge Base & Judiciary**
- [Laws.Africa Content API](https://laws.africa/api/)
- [Tausi API (Kenya)](https://tausi-dev.docs.laws.africa/api.html)
- [Kenya Law Case Database](https://kenyalaw.org/caselaw/)
- [AfricanLII Judgments](https://africanlii.org/judgments/all/)

**Document Parsing**
- [Apache Tika](https://tika.apache.org/)
- [tika-python](https://github.com/chrismattmann/tika-python)
- [python-docx](https://python-docx.readthedocs.io/)
- [PyMuPDF](https://pymupdf.readthedocs.io/)

---

*This plan consolidates requirements from: AI Mediation platform.docx, Mediation Intelligence Platform.docx, Mediation_Intelligence_Platform_v7.1_COMPLETE_PRIVATE_MASTER_DOCUMENT.docx, and clarifications.txt.*
