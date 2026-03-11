# Product Requirements Document: Admin Analytics Dashboard

**Version:** 1.0  
**Date:** March 2026  
**Product:** Mediation Intelligence Platform  
**Feature:** Vibrant, Interactive Admin Analytics Dashboard

---

## 1. Executive Summary

Transform the Admin Dashboard analytics from static tables into a **vibrant, interactive decision-making hub** where every report element is clickable and drives actionable insights. The dashboard prioritizes Africa-relevant metrics, rich visualizations, and drill-down interactivity to support Super Admins, Regional Managers, and Data Officers.

---

## 2. Core Objectives

| Objective | Description |
|-----------|-------------|
| **Visual Vibrancy** | Move beyond sterile tables—dynamic colors, gradients, micro-interactions |
| **Rich Charting** | Diverse, context-appropriate visualizations (not just bar charts) |
| **Drill-Down Interactivity** | Every chart element and report row clickable → deeper insights |
| **Africa-Relevant Metrics** | Regional adoption, language preferences, mobile vs. desktop, offline sync success |

---

## 3. User Stories by Persona

### 3.1 Super Admin

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| SA-1 | As a Super Admin, I want to see an executive summary with KPIs so I can assess platform health at a glance | KPI cards show Total Cases, Active Mediators, Resolution Rate, Avg. Time-to-Resolve with sparklines |
| SA-2 | As a Super Admin, I want to click any KPI to drill into filtered data so I can investigate anomalies quickly | Click opens filtered case list or mediator performance view |
| SA-3 | As a Super Admin, I want a geographic heatmap of Africa so I can identify high- and low-adoption regions | Choropleth map with case density by country; click country → regional breakdown |
| SA-4 | As a Super Admin, I want to compare cases created vs. resolved over time so I can track backlog trends | Multi-line chart, last 12 months; click segment → filter dashboard |
| SA-5 | As a Super Admin, I want to export visible data as CSV/PDF so I can share with stakeholders | Export button on each chart; respects current filters |

### 3.2 Regional Manager

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| RM-1 | As a Regional Manager, I want to see top mediators in my region so I can allocate cases effectively | Mediator Performance Grid filterable by region; click row → detailed profile |
| RM-2 | As a Regional Manager, I want to track language preferences so I can ensure mediators match demand | Language preference bar chart (Swahili, English, French, Yoruba, Amharic) |
| RM-3 | As a Regional Manager, I want to see unresolved cases >30 days so I can prioritize follow-up | Clickable report row; click case number → full case file |
| RM-4 | As a Regional Manager, I want to compare case types over time so I can plan training and capacity | Stacked area chart: Family, Commercial, Land, Employment |

### 3.3 Data Officer

| ID | Story | Acceptance Criteria |
|----|-------|---------------------|
| DO-1 | As a Data Officer, I want to track offline sync success rates so I can assess data integrity in low-connectivity areas | Gauge chart; percentage of sync attempts that succeeded |
| DO-2 | As a Data Officer, I want to monitor mobile vs. desktop usage so I can optimize for the dominant platform | Pie chart; critical for low-connectivity regions |
| DO-3 | As a Data Officer, I want a country-specific compliance tracker so I can ensure consent rates and data retention adherence | Table with consent rates, retention adherence by country |
| DO-4 | As a Data Officer, I want to build custom reports by dragging metrics, filters, and chart types so I can answer ad-hoc questions | "Build Your Own Report" mode: drag-and-drop metrics + filters + chart type selector |

---

## 4. Dashboard Sections (Detailed)

### 4.1 Executive Summary (Top Fold)

**Layout:** 4 KPI cards in a row, responsive grid.

| KPI | Chart Type | Justification |
|-----|------------|---------------|
| Total Cases | Card + Sparkline | Sparkline shows trend without clutter; count-up animation on load |
| Active Mediators | Card + Sparkline | Same rationale; highlights growth/decline |
| Resolution Rate | Card + Sparkline | Trend matters; color-code: green (>90%), amber (70–90%), red (<70%) |
| Avg. Time-to-Resolve | Card + Sparkline | Days; lower is better; color-code by benchmark |

**Interactivity:**
- Click KPI → opens filtered case list (e.g., "Total Cases" → all cases) or mediator performance view
- Hover → tooltip with delta vs. previous period

**Visual Treatment:**
- Gradient backgrounds (emerald→cyan for positive, indigo→violet for neutral)
- Animated count-up on initial load
- Status color-coding: green = improving, amber = attention, red = critical

---

### 4.2 Geographic Heatmap

**Chart Type:** Choropleth map of Africa.

**Data:** Case density by country (or region within country where available).

**Color Scale:** Light → dark = low → high activity.

**Toggle Layers:**
- Cases
- Mediators
- Training Completion
- User Growth

**Interactivity:**
- **Click country** → drill to regional breakdown + top mediators in that area
- **Hover** → tooltip: "Kenya: 241 active cases, 89% resolved, Swahili/English primary languages"

**Tech Note:** Use a library such as Leaflet + GeoJSON for Africa, or a charting library with map support (e.g., Highcharts Maps, Mapbox).

---

### 4.3 Trend Charts (Time-Series)

#### 4.3.1 Cases Created vs. Resolved (Last 12 Months)

**Chart Type:** Multi-line chart.

**Justification:** Two lines clearly show backlog dynamics; resolved above created = backlog shrinking.

**Interactivity:**
- Click a line/segment → filter entire dashboard to that case type (if applicable)
- Drag to select date range → all charts update in real-time
- Export visible data as CSV/PDF

#### 4.3.2 Case Types Over Time

**Chart Type:** Stacked area chart.

**Justification:** Shows composition and total volume; stacked areas reveal shifts in case mix.

**Data:** Family, Commercial, Land, Employment, Community, Other.

**Interactivity:**
- Click segment → filter dashboard to that case type
- Legend click → toggle series visibility

---

### 4.4 Mediator Performance Grid

**Layout:** Table + mini-chart hybrid.

**Columns:**
- Mediator name
- Cases handled (number + mini bar)
- Avg. rating (stars or number)
- Resolution rate (color-coded cell)
- Specialty tags (badges)

**Color-Coded Cells (Resolution Rate):**
- Green: >90%
- Amber: 70–90%
- Red: <70%

**Interactivity:**
- Click mediator row → opens detailed profile: case history, user feedback, availability calendar
- Click "Resolution Rate" column header → sort + show benchmark comparison overlay
- Hover cell → tooltip with breakdown

---

### 4.5 Clickable Report Library

**Pre-Built Reports:**
- Monthly Activity
- Unresolved Cases >30 Days
- Training Completion by Region

**Interactivity:**
- Click case number → opens full case file
- Click user name → opens profile + communication history
- Click date → filters dashboard to that time window

**"Build Your Own Report" Mode:**
- Drag-and-drop metrics
- Filters (date range, region, case type, mediator)
- Chart type selector (bar, line, area, pie, table)
- Save and share report configurations

---

### 4.6 Africa-First Analytics

| Metric | Chart Type | Justification |
|--------|-------------|---------------|
| Mobile vs. Desktop usage | Pie chart | Critical for low-connectivity; shows platform optimization priority |
| Language preference | Horizontal bar chart | Swahili, English, French, Yoruba, Amharic, etc.; supports mediator matching |
| Offline sync success rate | Gauge (0–100%) | Tracks data integrity in intermittent connectivity |
| Country compliance | Table + mini bar | Consent rates, data retention adherence by country |

---

## 5. Drill-Down Navigation Map

```
Executive Summary
├── Total Cases (click) → Case List (all)
├── Active Mediators (click) → Mediator Performance Grid
├── Resolution Rate (click) → Case List (filter: resolved)
└── Avg. Time-to-Resolve (click) → Case List (sort by duration)

Geographic Heatmap
├── Country (click) → Regional Breakdown + Top Mediators
└── Hover → Tooltip

Trend Charts
├── Line segment (click) → Filter dashboard by case type
├── Date range (drag) → Update all charts
└── Export → CSV/PDF

Mediator Performance Grid
├── Row (click) → Mediator Profile (case history, feedback, calendar)
└── Column header (click) → Sort + benchmark overlay

Report Library
├── Case number (click) → Case File
├── User name (click) → Profile + Communication History
└── Date (click) → Filter dashboard to time window
```

---

## 6. Chart Type Recommendations

| Metric | Chart Type | Justification |
|--------|------------|---------------|
| KPIs | Card + Sparkline | Compact, trend visible, clickable |
| Geographic distribution | Choropleth | Intuitive for regional comparison |
| Cases created vs. resolved | Multi-line | Clear comparison of two series |
| Case types over time | Stacked area | Composition + total volume |
| Mediator resolution rate | Table + color-coded cells | Precise values, easy comparison |
| Mobile vs. desktop | Pie/Donut | Simple proportion; few categories |
| Language preference | Horizontal bar | Many categories; easy to read labels |
| Offline sync success | Gauge | Single metric, 0–100% scale |
| Compliance by country | Table + mini bar | Structured data, visual cue |

---

## 7. Sample JSON Structure for Clickable Report Payload

```json
{
  "report_id": "unresolved-cases-30d",
  "title": "Unresolved Cases >30 Days",
  "generated_at": "2026-03-10T14:30:00Z",
  "filters": {
    "status": ["in_mediation", "submitted"],
    "created_before": "2026-02-08",
    "region": null
  },
  "columns": [
    { "key": "case_number", "label": "Case #", "type": "link", "target": "case_detail" },
    { "key": "title", "label": "Title", "type": "text" },
    { "key": "assigned_mediator", "label": "Mediator", "type": "link", "target": "mediator_profile" },
    { "key": "created_at", "label": "Created", "type": "date", "click_action": "filter_dashboard" },
    { "key": "days_unresolved", "label": "Days Open", "type": "number", "color_threshold": { "amber": 45, "red": 60 } }
  ],
  "rows": [
    {
      "case_number": "MED-KE-2026-0123",
      "case_id": "uuid-123",
      "title": "Employment dispute - ABC Ltd",
      "assigned_mediator": "Jane Mwangi",
      "mediator_id": "uuid-456",
      "created_at": "2026-01-15",
      "days_unresolved": 54,
      "status": "in_mediation"
    }
  ],
  "metadata": {
    "total_rows": 12,
    "export_formats": ["csv", "pdf"]
  }
}
```

---

## 8. Localization Strategy

### 8.1 Number Formats

| Locale | Decimal | Thousands | Example |
|--------|---------|-----------|---------|
| en-KE | . | , | 1,234.56 |
| fr-FR | , |   | 1 234,56 |
| pt-BR | , | . | 1.234,56 |

**Implementation:** Use `Intl.NumberFormat` with user locale or region setting.

### 8.2 Date Formats

| Locale | Format | Example |
|--------|--------|---------|
| en-KE, en-NG | DD/MM/YYYY | 10/03/2026 |
| en-US | MM/DD/YYYY | 03/10/2026 |
| fr-FR | DD/MM/YYYY | 10/03/2026 |

**Implementation:** Use `Intl.DateTimeFormat` or a library (e.g., date-fns, dayjs) with locale.

### 8.3 Languages

| Language | Code | Priority Markets |
|----------|------|------------------|
| English | en | KE, NG, ZA, GH |
| Swahili | sw | KE, TZ |
| French | fr | Senegal, Côte d'Ivoire, DRC |
| Yoruba | yo | NG |
| Amharic | am | Ethiopia |
| Portuguese | pt | Angola, Mozambique |

**Implementation:** i18n keys for all labels; chart tooltips and axis labels localized.

---

## 9. UX & Visual Design Requirements

### 9.1 Palette

| Use | Colors |
|-----|--------|
| Primary gradients | Emerald→Cyan, Indigo→Violet |
| Accent (positive) | Green (#059669) |
| Accent (attention) | Amber (#d97706) |
| Accent (critical) | Red (#dc2626) |
| Background | Cream (#fffbeb), soft gradients |

### 9.2 Card Layout

- Rounded corners (12–16px)
- Subtle shadows; hover lift (translateY -4px)
- Padding: 1.5–2rem

### 9.3 Micro-Interactions

- Button ripples on click
- Chart load: staggered fade-in or draw animation
- Skeleton screens while fetching
- Hover: scale 1.02, shadow increase

### 9.4 Accessibility

- High-contrast mode toggle
- Colorblind-friendly palettes (avoid red/green only)
- Screen reader labels on all interactive elements
- Keyboard navigation for drill-down

### 9.5 Responsive

- Collapsible sidebar on mobile
- Stacked charts on small screens
- Touch-friendly drill-down (min 44px tap targets)
- Horizontal scroll for wide tables with sticky first column

---

## 10. Implementation Phases

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1 | Executive Summary KPIs + sparklines, click-through to filtered views | 2 weeks |
| 2 | Trend charts (multi-line, stacked area), date range filter, export | 2 weeks |
| 3 | Mediator Performance Grid, color-coded cells, row click → profile | 2 weeks |
| 4 | Geographic heatmap (Africa), country drill-down | 2–3 weeks |
| 5 | Africa-First analytics (mobile/desktop, language, offline sync) | 1–2 weeks |
| 6 | Clickable Report Library, Build Your Own Report | 2–3 weeks |
| 7 | Localization, accessibility, responsive polish | 1–2 weeks |

---

## 11. Technical Recommendations

| Component | Recommendation |
|-----------|----------------|
| Charting | Recharts (React), Chart.js, or Apache ECharts |
| Maps | Leaflet + GeoJSON, or Highcharts Maps |
| State | React Query for server state; Zustand/Context for filters |
| Export | jsPDF + csv-stringify for PDF/CSV |
| Animations | Framer Motion or CSS transitions |
| Skeletons | Custom or react-loading-skeleton |

---

## 12. Appendix: Existing Analytics Reference

Review `backend/app/api/analytics_dashboard.py` and `frontend/src/pages/AdminDashboardPage.jsx` for current analytics implementation. Extend rather than replace where possible.
