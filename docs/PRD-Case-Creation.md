# Product Requirement Document: Mediation Case Creation

**Version:** 1.0  
**Date:** March 2026  
**Product:** Mediation Intelligence Platform  
**Feature:** Rich Case Creation for Admins & Mediators

---

## 1. Executive Summary

Enable admins and mediators to create new mediation cases with comprehensive detail while avoiding user overwhelm through progressive disclosure, draft saving, auto-save, and country-aware form logic. The form supports offline entry for low-connectivity regions across Africa.

---

## 2. User Story Map

### Epic: Create New Mediation Case

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ USER JOURNEY: Case Creation                                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  [Start] → [Case Identification] → [Case Details] → [Persons] → [Supporting]│
│     │              │                    │               │            │       │
│     │              │                    │               │            │       │
│     ▼              ▼                    ▼               ▼            ▼       │
│  As a mediator,  I want to         I want to       I want to    I want to   │
│  I want to       enter case ID,     add detailed    add multiple add docs &   │
│  start a new     title, type,      narrative,      parties with links so     │
│  case quickly    priority so       timeline,       roles &       evidence is  │
│  and save        cases are         outcomes &      contact info  captured    │
│  progress        findable          jurisdiction   so I can      for the     │
│  anytime         and categorized   so context is   reach them   case file   │
│                  correctly        complete        easily                    │
│                                                                              │
│  [Workflow & Metadata] → [Review & Submit]                                    │
│           │                        │                                         │
│           ▼                        ▼                                         │
│  I want to assign I want to review all                                       │
│  mediator, set    details and submit                                         │
│  status, format   or save as draft                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### User Stories (Prioritized)

| ID | Role | Story | Priority |
|----|------|-------|----------|
| US-1 | Mediator/Admin | As a mediator, I want to create a case with essential info (title, type, priority) so I can start quickly | P0 |
| US-2 | Mediator/Admin | As a mediator, I want to save as draft so I can complete the case later | P0 |
| US-3 | Mediator/Admin | As a mediator, I want auto-save so I don't lose data if I close the browser | P0 |
| US-4 | Mediator/Admin | As a mediator, I want to add parties with roles and contact info so I can manage participants | P0 |
| US-5 | Mediator/Admin | As a mediator, I want to upload documents and link external evidence so all evidence is in one place | P1 |
| US-6 | Mediator/Admin | As a mediator, I want country-aware fields (county/state) so the form matches my jurisdiction | P1 |
| US-7 | Mediator/Admin | As a mediator, I want to add a timeline of events so the case narrative is clear | P1 |
| US-8 | Mediator/Admin | As a mediator, I want to work offline so I can enter data in low-connectivity areas | P1 |
| US-9 | Mediator/Admin | As a mediator, I want to assign a mediator and set confidentiality so workflow is clear | P1 |
| US-10 | Mediator/Admin | As a mediator, I want law/policy suggestions so I can capture applicable frameworks | P2 |

---

## 3. Required Sections & Fields

### 3.1 Case Identification (Always Visible)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Case Number | Display | Auto | — | Format: `MED-[COUNTRY]-[YYYY]-[SEQ]` (e.g., MED-KE-2026-0841) |
| Internal Reference | Text | No | Max 50 chars | Client-provided IDs, internal codes |
| Case Title | Text | Yes | 5–200 chars | Short, descriptive |
| Short Description | Textarea | Yes | 10–500 chars | 1–2 sentence summary |
| Case Type | Dropdown | Yes | Enum | Family, Commercial, Land/Property, Employment, Community Dispute, Other |
| Case Type (Other) | Text | If Other | Max 100 chars | Free text when "Other" selected |
| Priority Level | Dropdown | Yes | Enum | Low, Medium, High, Urgent |
| Tags/Labels | Multi-select / Tags | No | Max 10 tags, 30 chars each | Internal categorization |

### 3.2 Case Details (Expandable Section)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Detailed Narrative | Rich text | No | Max 10,000 chars | Bullet points, formatting, attachments |
| Timeline of Events | Repeater | No | — | Date + description; max 50 entries |
| Desired Outcome | Textarea + structured | No | Max 2,000 chars | Free text + checkboxes (e.g., Settlement, Apology, Restitution) |
| Jurisdiction Country | Dropdown | Yes | ISO 3166 | Default from user location |
| Jurisdiction Region | Dropdown | No | Dynamic | State/Province/Region based on country |
| Jurisdiction County/State | Dropdown | No | Dynamic | County (KE), State (NG), etc. |
| Applicable Laws/Policies | Textarea | No | Max 2,000 chars | Free text + suggestion engine (optional) |
| Cultural Considerations | Textarea | No | Max 1,000 chars | Free text |

### 3.3 Persons Involved (Dynamic Repeater)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Name | Text | Yes | 2–200 chars | Full name |
| Role | Dropdown | Yes | Enum | Complainant, Respondent, Witness, Legal Rep, Support Person |
| Phone | Tel | No | E.164 or local | — |
| Email | Email | No | Valid email | — |
| WhatsApp | Tel | No | E.164 | Optional |
| Country/Location | Text/Dropdown | No | — | — |
| Language Preference | Dropdown | No | ISO 639-1 | e.g., en, sw, am |
| Link to User Profile | Lookup | No | — | Search existing users or create temp |
| Relationship to Case | Dropdown + notes | No | — | e.g., Direct party, Family member |
| Accessibility/Vulnerability | Multi-select | No | — | Requires interpreter, Minor, Disability accommodation, etc. |

### 3.4 Supporting Information (Expandable)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Document Uploads | File upload | No | PDF, DOC, DOCX, JPG, PNG, MP3, M4A; max 25MB each | Type tag: ID, Contract, Photo, Voice Note, Other |
| External Links | URL list | No | Valid URL, max 500 chars each | Google Drive, WhatsApp export, etc. |
| Additional Notes | Textarea | No | Max 5,000 chars | Unstructured context |

### 3.5 Workflow & Metadata (Always Visible)

| Field | Type | Required | Validation | Notes |
|-------|------|----------|------------|-------|
| Assigned Mediator | Searchable dropdown | No | — | From active mediators |
| Case Status | Dropdown | Yes | Enum | Draft, Submitted, In Mediation, Resolved, Closed |
| Confidentiality Level | Dropdown | Yes | Enum | Public, Parties Only, Mediator Only |
| Estimated Duration | Text/Dropdown | No | — | e.g., 1 session, 2–3 sessions |
| Preferred Format | Multi-select | No | — | In-person, Video, Phone, Hybrid |

---

## 4. Field-Level Validation Rules

```yaml
case_title:
  required: true
  min_length: 5
  max_length: 200
  pattern: "^[\\p{L}\\p{N}\\p{P}\\p{Zs}]+$"  # Unicode letters, numbers, punctuation, spaces

short_description:
  required: true
  min_length: 10
  max_length: 500

case_type:
  required: true
  enum: [family, commercial, land_property, employment, community_dispute, other]

case_type_other:
  required_if: case_type == "other"
  max_length: 100

priority_level:
  required: true
  enum: [low, medium, high, urgent]

tags:
  max_items: 10
  max_length_per_item: 30

detailed_narrative:
  max_length: 10000

timeline_entries:
  max_items: 50
  date: valid_date
  description: max_length 500

party_name:
  required: true
  min_length: 2
  max_length: 200

party_role:
  required: true
  enum: [complainant, respondent, witness, legal_rep, support_person]

party_email:
  format: email
  required_if: no phone and no whatsapp

document_upload:
  max_size_mb: 25
  allowed_types: [pdf, doc, docx, jpg, jpeg, png, mp3, m4a]

external_link:
  format: url
  max_length: 500
```

---

## 5. Data Model

### 5.1 Core Tables (SQLAlchemy / PostgreSQL)

```python
# Case (extends or replaces existing)
class Case(Base):
    __tablename__ = "cases"
    id: UUID
    case_number: str  # MED-KE-2026-0841 (unique, auto-generated)
    internal_reference: str | None
    title: str
    short_description: str
    case_type: str  # family, commercial, land_property, employment, community_dispute, other
    case_type_other: str | None
    priority_level: str  # low, medium, high, urgent
    tags: JSONB  # ["employment", "nairobi"]
    detailed_narrative: str | None  # rich text HTML
    desired_outcome: str | None
    desired_outcome_structured: JSONB  # ["settlement", "apology"]
    jurisdiction_country: str  # KE, NG, ZA
    jurisdiction_region: str | None
    jurisdiction_county_state: str | None
    applicable_laws: str | None
    cultural_considerations: str | None
    additional_notes: str | None
    assigned_mediator_id: UUID | None  # FK users
    status: str  # draft, submitted, in_mediation, resolved, closed
    confidentiality_level: str  # public, parties_only, mediator_only
    estimated_duration: str | None
    preferred_format: JSONB  # ["in_person", "video", "phone", "hybrid"]
    tenant_id: UUID
    created_by_id: UUID
    created_at: datetime
    updated_at: datetime
    last_auto_save_at: datetime | None

# Timeline events
class CaseTimelineEvent(Base):
    __tablename__ = "case_timeline_events"
    id: UUID
    case_id: UUID
    event_date: date
    description: str
    sort_order: int

# Parties (extends or replaces)
class CaseParty(Base):
    __tablename__ = "case_parties"
    id: UUID
    case_id: UUID
    name: str
    role: str  # complainant, respondent, witness, legal_rep, support_person
    phone: str | None
    email: str | None
    whatsapp: str | None
    country_location: str | None
    language_preference: str | None
    user_id: UUID | None  # linked user
    relationship_to_case: str | None
    relationship_notes: str | None
    accessibility_flags: JSONB  # ["interpreter", "minor", "disability"]
    sort_order: int

# Documents
class CaseDocument(Base):
    __tablename__ = "case_documents"
    id: UUID
    case_id: UUID
    file_path: str
    file_name: str
    mime_type: str
    document_type: str  # id, contract, photo, voice_note, other
    uploaded_at: datetime

# External links
class CaseExternalLink(Base):
    __tablename__ = "case_external_links"
    id: UUID
    case_id: UUID
    url: str
    label: str | None
```

### 5.2 JSON Schema (API / Form State)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["title", "short_description", "case_type", "priority_level", "status", "confidentiality_level", "jurisdiction_country"],
  "properties": {
    "case_number": { "type": "string", "readOnly": true, "pattern": "^MED-[A-Z]{2}-\\d{4}-\\d{4}$" },
    "internal_reference": { "type": "string", "maxLength": 50 },
    "title": { "type": "string", "minLength": 5, "maxLength": 200 },
    "short_description": { "type": "string", "minLength": 10, "maxLength": 500 },
    "case_type": { "enum": ["family", "commercial", "land_property", "employment", "community_dispute", "other"] },
    "case_type_other": { "type": "string", "maxLength": 100 },
    "priority_level": { "enum": ["low", "medium", "high", "urgent"] },
    "tags": { "type": "array", "items": { "type": "string", "maxLength": 30 }, "maxItems": 10 },
    "detailed_narrative": { "type": "string", "maxLength": 10000 },
    "timeline": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "event_date": { "type": "string", "format": "date" },
          "description": { "type": "string", "maxLength": 500 }
        }
      },
      "maxItems": 50
    },
    "desired_outcome": { "type": "string", "maxLength": 2000 },
    "desired_outcome_structured": { "type": "array", "items": { "type": "string" } },
    "jurisdiction_country": { "type": "string", "pattern": "^[A-Z]{2}$" },
    "jurisdiction_region": { "type": "string" },
    "jurisdiction_county_state": { "type": "string" },
    "applicable_laws": { "type": "string", "maxLength": 2000 },
    "cultural_considerations": { "type": "string", "maxLength": 1000 },
    "parties": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "role"],
        "properties": {
          "name": { "type": "string", "minLength": 2, "maxLength": 200 },
          "role": { "enum": ["complainant", "respondent", "witness", "legal_rep", "support_person"] },
          "phone": { "type": "string" },
          "email": { "type": "string", "format": "email" },
          "whatsapp": { "type": "string" },
          "country_location": { "type": "string" },
          "language_preference": { "type": "string" },
          "user_id": { "type": "string", "format": "uuid" },
          "relationship_to_case": { "type": "string" },
          "accessibility_flags": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "additional_notes": { "type": "string", "maxLength": 5000 },
    "assigned_mediator_id": { "type": "string", "format": "uuid" },
    "status": { "enum": ["draft", "submitted", "in_mediation", "resolved", "closed"] },
    "confidentiality_level": { "enum": ["public", "parties_only", "mediator_only"] },
    "estimated_duration": { "type": "string" },
    "preferred_format": { "type": "array", "items": { "enum": ["in_person", "video", "phone", "hybrid"] } }
  }
}
```

---

## 6. Country-Aware Form Logic

| Country (ISO) | Region Field Label | Sub-region Field Label | Source |
|---------------|--------------------|------------------------|--------|
| KE | Region/Province | County | Kenya counties |
| NG | Zone | State | Nigeria states |
| ZA | Province | District/Municipality | South Africa |
| GH | Region | District | Ghana |
| TZ | Region | District | Tanzania |
| UG | Region | District | Uganda |
| Default | Region | Sub-region | Generic |

**Implementation:** Load region/county options via API `GET /api/locations?country=KE` returning `{ regions: [...], sub_regions: { "Nairobi": ["Westlands", "Dagoretti", ...] } }`.

---

## 7. UX Requirements

### 7.1 Progressive Disclosure

- **Tier 1 (Always visible):** Case Identification + Workflow & Metadata
- **Tier 2 (Expandable "Add Case Details"):** Detailed narrative, timeline, outcomes, jurisdiction, laws
- **Tier 3 (Expandable "Add Parties"):** Persons involved repeater
- **Tier 4 (Expandable "Add Supporting Information"):** Documents, links, additional notes

### 7.2 Save as Draft

- Button: "Save as Draft" — sets `status = draft`, persists all fields
- Button: "Submit Case" — sets `status = submitted`, runs full validation
- Draft cases appear in "My Drafts" list

### 7.3 Auto-Save

- Interval: 60 seconds
- Trigger: Any field change since last save
- Store in `last_auto_save_at`; show "Last saved at HH:MM" indicator
- On network error: queue for retry, show "Saving..." / "Offline - will sync when online"

### 7.4 Offline-Capable Form

- Use Service Worker + IndexedDB (or similar) to cache form state
- Store draft locally when offline; sync when connection restored
- Show offline banner: "You're offline. Data will sync when connected."
- Use `navigator.onLine` and `online`/`offline` events

---

## 8. Accessibility & Localization for African Users

### 8.1 Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Screen reader support | ARIA labels on all inputs, live regions for validation errors |
| Keyboard navigation | Tab order, focus management in repeaters, Escape to collapse sections |
| Color contrast | WCAG 2.1 AA minimum (4.5:1 text, 3:1 UI) |
| Touch targets | Min 44×44px for buttons/links on mobile |
| Error messages | Inline, clear, associated with fields via `aria-describedby` |
| Low bandwidth | Lazy-load expandable sections; compress images on upload |

### 8.2 Localization

| Consideration | Approach |
|---------------|----------|
| Language | Support Swahili (sw), Amharic (am), French (fr), Portuguese (pt) for labels/errors |
| Date format | Use locale (e.g., DD/MM/YYYY for KE, NG) |
| Phone input | Country code selector, local format hints |
| Currency | If fees: support KES, NGN, ZAR, etc. |
| RTL | Not required for primary markets; plan for future if needed |
| Numeric input | Respect locale (e.g., comma vs period for decimals) |

### 8.3 Low-Connectivity / Rural Context

- Minimize initial payload; load heavy assets on demand
- Offline-first form with sync queue
- Clear "Saving..." / "Saved" / "Offline" feedback
- Retry logic with exponential backoff
- Optional: SMS-based case number delivery for users without email

---

## 9. Case Number Generation

**Format:** `MED-[COUNTRY]-[YYYY]-[SEQ]`

**Example:** `MED-KE-2026-0841`

**Logic:**
1. `COUNTRY`: From jurisdiction_country (default user's country)
2. `YYYY`: Current year
3. `SEQ`: 4-digit zero-padded sequence per country per year (reset annually)

**SQL (conceptual):**
```sql
SELECT COALESCE(MAX(seq), 0) + 1
FROM cases
WHERE jurisdiction_country = :country
  AND EXTRACT(YEAR FROM created_at) = :year;
```

---

## 10. Implementation Phases

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1 | Case Identification + Workflow, Save Draft, Auto-save | 2–3 weeks |
| 2 | Case Details (expandable), Timeline, Jurisdiction | 2 weeks |
| 3 | Persons repeater, document upload | 2 weeks |
| 4 | Country-aware locations API, offline support | 2 weeks |
| 5 | Law suggestion engine, accessibility audit | 1–2 weeks |

---

## 11. Appendix: Existing Case Model Reference

Review `backend/app/models/case.py` and `frontend/src/pages/NewCasePage.jsx` to align with current schema and extend rather than replace where possible.
