# Current State & Problems

**Purpose:** Implementation and deployment guide for the Mediation Intelligence Platform. Use this document alongside the handover notes to prioritize fixes and new features.

**Related docs:** `HANDOVER-NOTES.md` | `PRD-Case-Creation.md` | `PRD-Analytics-Dashboard.md` | `PRD-Role-Play-Studio.md` | `Implement and add A vibrant admin d.txt`

**Implementation references:** `backend/app/models/case.py` | `backend/app/models/tenant.py` | `frontend/src/pages/AdminDashboardPage.jsx` | `frontend/src/pages/CaseDetailPage.jsx` | `frontend/src/pages/NewCasePage.jsx`

---

## Current State & Problems (Summary)

| # | Problem | Status |
|---|---------|--------|
| 1 | Cases in mediation dashboard are static (not clickable/editable) | Open |
| 2 | No approval process for new user onboarding | Open |
| 3 | No searchable internal reference system | Open |
| 4 | User management lacks scalability for 1000+ users | Open |
| 5 | No mediator assignment workflow from admin panel | Open |
| 6 | Currently all users are assigned a mediator which is incorrect (only clients should have mediators) | Open |

---

## 🎯 Core Objectives

### 1. Interactive Case Dashboard

- Cases must be **clickable** → opens detailed case view
- Cases must be **editable** → inline editing or modal edit form
- Quick actions: Edit, View, Assign Mediator, Change Status

### 2. User Onboarding with Approval Workflow

- **Mediator Portal:** Mediators can initiate client onboarding
- **Admin Approval:** All new users require admin approval before activation
- **User ID Generation:** System auto-generates unique User ID upon approval

**Notification Flow:**
- Mediator submits → Admin notified
- Admin approves → Client notified with User ID
- Admin rejects → Mediator notified with reason

### 3. Searchable Internal Reference System

**Search by:**
- Company/Individual/Client name (partial match)
- User ID (exact match)
- Client ID (exact match)
- Email, Phone (partial match)

**Search Results:** Display full user details card

**Quick Actions from Search:** View Profile, Assign Case, Message User

### 4. Scalable User Management (1000+ users)

**Two-Panel Layout:**

| Left Panel (40% width) | Right Panel (60% width) |
|------------------------|-------------------------|
| Search bar at top (real-time search) | Empty state: "Select a user to view details" |
| Scrollable list of user names with avatars | When user clicked: Full editable profile |
| Filter by: Role (Client/Mediator/Admin), Status (Active/Inactive/Pending) | Editable fields: Personal, Professional, Status, Metadata |
| Sort by: Name, Date Added, Last Active | Actions: Save, Assign mediator, Activate/Deactivate, Impersonate, Delete |
| Show: Name, Role badge, Status indicator | |

### 5. User ID System

- **Generation:** Auto-generated upon admin approval
- **Uniqueness:** System-wide unique identifier
- **Primary Search Key:** All searches indexed by User ID
- **Display:** Visible to user in profile, used in all communications

---

## Detailed Feature Specifications

### A. Clickable & Editable Cases

**Case Card Component:**
- Click anywhere → Opens case detail modal/drawer
- Edit button → Inline editing or edit modal
- Quick status change → Dropdown on card
- Hover actions → Edit, Assign, View History

**Case Detail View:**
- Full case information
- Editable fields (with save/cancel)
- Activity timeline
- Assigned parties
- Documents section
- Quick actions bar

**Existing:** `CaseDetailPage.jsx`, `NewCasePage.jsx`, `backend/app/api/cases.py` – extend rather than replace.

### B. Onboarding Approval Workflow

**States:**
1. Draft (Mediator creating)
2. Pending Approval (Submitted to admin)
3. Approved (User ID generated, account active)
4. Rejected (With reason, can resubmit)
5. On Hold (Admin requests more info)

**Workflow:**

| Mediator Portal | Admin Dashboard | Client Experience |
|-----------------|-----------------|-------------------|
| Click "Onboard Client" | Notification badge: "3 pending approvals" | Receive email: "Welcome to [Platform]" |
| Fill client details (name, email, phone, org) | Click → Approval queue list | Contains: User ID, temporary password, login link |
| Submit for approval | Review each application | First login → Force password change |
| Status: "Pending Admin Approval" | Approve → Generate User ID → Activate → Send welcome email | Access granted based on role |
| | Reject → Enter reason → Notify mediator | |
| | Request Info → Add notes → Notify mediator | |

### C. Search & Reference System

**Global Search Bar (Header):**
- Placeholder: "Search by User ID, Name, Client ID, Email..."
- Real-time results (debounced 300ms)
- Results grouped by: Users, Cases, Organizations
- Keyboard navigation (Arrow keys, Enter to select)
- Recent searches (last 5)

**Advanced Search Filters:**
- Role: Client | Mediator | Admin | All
- Status: Active | Inactive | Pending | All
- Date Range: Created date, Last active
- Organization: Multi-select
- Assigned Mediator: For clients only

**Search Results Card:**
- Avatar/Initials
- Full Name (bold)
- User ID (monospace font)
- Role badge
- Status indicator (green/orange/red dot)
- Organization (if applicable)
- Last active timestamp
- Quick actions: View | Message | Assign Case

### D. User Management Interface

**Layout:** Split-view responsive design

**Left Panel - User List:**
```
┌─────────────────────────────────┐
│ 🔍 Search users...              │
├─────────────────────────────────┤
│ Filters: [Role ▼] [Status ▼]   │
├─────────────────────────────────┤
│ 👤 John Doe           [Active]  │
│    Client • USR-KE-2026-001     │
├─────────────────────────────────┤
│ 👤 Jane Smith         [Pending] │
│    Mediator • USR-NG-2026-045   │
├─────────────────────────────────┤
│ 👤 ABC Corp           [Active]  │
│    Client • USR-ZA-2026-112     │
└─────────────────────────────────┘
```
- Virtual scrolling for 1000+ users
- Lazy loading (load 50 at a time)
- Highlight selected user
- Unread indicator (if messages)

**Right Panel - User Details:**
```
┌───────────────────────────────────────┐
│ ← Back to list                        │
├───────────────────────────────────────┤
│ 👤 JOHN DOE                           │
│    USR-KE-2026-001234                 │
│    [Active] [Edit] [⋮ More]          │
├───────────────────────────────────────┤
│ TABS: Overview | Cases | Activity     │
├───────────────────────────────────────┤
│ Overview Tab:                         │
│ ┌─────────────────────────────────┐  │
│ │ Personal Information            │  │
│ │ • Full Name: [John Doe      ]   │  │
│ │ • Email:    [john@mail.com  ]   │  │
│ │ • Phone:    [+254 7XX XXX XXX]  │  │
│ │ • Address:  [Nairobi, Kenya ]   │  │
│ └─────────────────────────────────┘  │
│ ┌─────────────────────────────────┐  │
│ │ Professional Details            │  │
│ │ • Role:      [Client        ▼]  │  │
│ │ • Organization: [ABC Corp    ]  │  │
│ │ • Assigned Mediator:            │  │
│ │   [Jane Smith (Mediator)    ▼]  │  │
│ │ • Client ID: [CL-2026-001   ]   │  │
│ └─────────────────────────────────┘  │
│ ┌─────────────────────────────────┐  │
│ │ Account Status                  │  │
│ │ • Status: [● Active      ▼]     │  │
│ │ • Approved: Yes                 │  │
│ │ • Last Login: 2 hours ago       │  │
│ │ • Created: Jan 15, 2026         │  │
│ └─────────────────────────────────┘  │
│                                     │
│ [Save Changes] [Cancel]              │
└───────────────────────────────────────┘
```

**Actions Menu (⋮):**
- Assign to Case
- Send Message
- Reset Password
- Impersonate User
- Deactivate Account
- Delete Account (soft delete)
- Export Data

### E. Mediator Assignment

**Assignment Flow:**
1. Admin opens client profile
2. Click "Assigned Mediator" dropdown
3. Search mediators by name/specialty
4. Select mediator
5. Optional: Add assignment notes
6. Save → Notification sent to:
   - Client: "You've been assigned to [Mediator]"
   - Mediator: "New client assigned: [Client Name]"
   - Admin: Assignment logged

**Mediator Selection Criteria:**
- Availability (current caseload)
- Specialty match (case type)
- Language preference
- Geographic location
- Client preference (if any)

**Note:** `User.assigned_mediator_id` exists. Restrict to clients only (`client_corporate`, `client_individual`); remove or hide for mediators, trainees, admins.

### F. User Activation/Deactivation

**Activation Toggle:**
- Switch component with confirmation
- Deactivate → Modal: "Are you sure?"
  - Reason dropdown (optional): Inactive user, Policy violation, Requested by user, Other (specify)
  - Effective date: Immediate | Schedule
  - Notify user: Yes/No

**Deactivation Effects:**
- User cannot login
- Active cases: Reassign or keep?
- Scheduled meetings: Cancel or reassign?
- Data retention: Keep for X days
- Search visibility: Show inactive users (filtered)

**Reactivation:**
- Toggle back to Active
- Restore access immediately
- Notify user of reactivation

---

## Additional Considerations

**Approval Workflow Timezones:**
- Display all timestamps in user's local timezone
- SLA tracking: "Pending for 2 days" (business hours)
- Auto-reminders: Every 24h for pending approvals

**Scalability for 1000+ Users:**
- Virtual scrolling (react-window or similar)
- Pagination: 50 users per page
- Search indexing: Elasticsearch or Algolia
- Caching: Redis for frequent searches
- CDN: For user avatars/profile images

---

## 📐 Technical Requirements

| Area | Requirement |
|------|-------------|
| **Performance** | Search results: <200ms response time; User list load: <1s for 1000 users; Profile save: <500ms; Real-time updates: WebSocket for approval notifications |
| **Security** | Role-based access control (RBAC); Audit log: Who approved/rejected, when, why; Data encryption: User IDs, Client IDs at rest; Rate limiting: Search API (100 req/min); Session management: Auto-logout after 30min |
| **Accessibility** | Keyboard navigation for all interactions; Screen reader labels for status indicators; High contrast mode support; Focus management in modals |

---

## ✅ Acceptance Criteria

| Feature | Criteria |
|--------|----------|
| **Clickable Cases** | All case cards are clickable; Click opens case detail view; Edit button enables inline editing; Changes save successfully; Validation errors display clearly |
| **Approval Workflow** | Mediator can submit new client; Admin receives notification; Admin can approve/reject; User ID generated on approval; Client receives welcome email with User ID; Rejected applications can be resubmitted |
| **Search Functionality** | Search by User ID returns exact match; Search by name returns partial matches; Search by Client ID works; Advanced filters apply correctly; Results update in real-time |
| **User Management** | Left panel shows scrollable user list; Search filters list in real-time; Click user loads details in right panel; All fields are editable (with permissions); Mediator assignment works (clients only); Activate/Deactivate toggle works; Changes persist after save; 1000+ users load without performance issues |

---

## Known Gaps (Consolidated from Handover & This Doc)

| # | Gap | Source |
|---|-----|--------|
| 1 | No Alembic migrations; schema changes require `init_db()` or manual migration scripts | Handover |
| 2 | Practice scenario completion is `localStorage` only (not persisted to backend) | Handover |
| 3 | Module edit UI not implemented (archive only) | Handover |
| 4 | Quiz builder UI not built (backend ready) | Handover |
| 5 | Export is CSV only (no PDF) | Handover |
| 6 | No threshold alerts or anomaly detection in analytics | Handover |
| 7 | Cases in dashboard are static (not clickable/editable) | This doc |
| 8 | No approval workflow for new user onboarding | This doc |
| 9 | No searchable internal reference system | This doc |
| 10 | User management not scalable for 1000+ users | This doc |
| 11 | No mediator assignment workflow from admin panel | This doc |
| 12 | All users assigned mediator (should be clients only) | This doc |

---

## Deployment Considerations

| Item | Notes |
|------|-------|
| **Frontend** | Vercel auto-deploys from `main`; `vercel.json` → build: `cd frontend && npm ci && npm run build`, output: `frontend/dist` |
| **Backend** | Not on Vercel; typically Render or similar; requires PostgreSQL + env vars |
| **Environment** | `OPENAI_API_KEY` optional for AI features; `DATABASE_URL` required |
| **Database** | No Alembic; schema changes require `init_db()` or manual migration scripts |

---

*Last updated: March 2026*  
*Use with HANDOVER-NOTES.md for full context.*
