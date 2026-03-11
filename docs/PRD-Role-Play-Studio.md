# Product Requirements Document: Role-Play Studio

**Version:** 1.0  
**Date:** March 2025  
**Product:** Mediation Intelligence Platform – Role-Play Studio  
**Status:** Draft for Review

---

## 1. Executive Summary

Role-Play Studio is an immersive, AI-powered mediation training simulation that enables mediators to practice skills in realistic, culturally relevant scenarios. It combines dynamic multi-role dialogue, real-time AI coaching, gamification, and Africa-first design to deliver a training experience that feels like a simulation—not a form.

**Core Value Proposition:** Bridge the gap between theory and practice by providing safe, repeatable, and culturally contextualized role-play experiences with actionable feedback.

---

## 2. User Journey Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    ROLE-PLAY STUDIO USER JOURNEY                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

  [Entry]                    [Selection]                 [Preparation]
     │                            │                            │
     ▼                            ▼                            ▼
┌─────────┐  ───────────►  ┌─────────────┐  ───────────►  ┌─────────────┐
│Dashboard│                │ Scenario    │                │ Briefing    │
│ / Home  │                │ Library    │                │ & Role      │
└─────────┘                │ (Browse,   │                │ Assignment  │
     │                     │  Filter,   │                └─────────────┘
     │                     │  Preview)  │                       │
     │                     └────────────┘                       │
     │                           │                              │
     │                     [Custom Builder]                      │
     │                     (Admin only)                          │
     │                                                           ▼
     │                    [Role Play Session]              ┌─────────────┐
     │                           │                         │ Chat UI     │
     │                           │                         │ • AI Parties │
     │                           │                         │ • Pause &   │
     │                           │                         │   Coach     │
     │                           │                         │ • Time      │
     │                           │                         │   Pressure   │
     │                           │                         └─────────────┘
     │                           │                                │
     │                           │                                ▼
     │                           │                         ┌─────────────┐
     │                           │                         │ Outcome     │
     │                           │                         │ (Resolved/  │
     │                           │                         │  Escalated) │
     │                           │                         └─────────────┘
     │                           │                                │
     │                           ▼                                ▼
     │                    [Debrief]                         ┌─────────────┐
     │                           │                         │ Post-Session│
     │                           │                         │ Debrief     │
     │                           │                         │ • Strengths  │
     │                           │                         │ • Improve   │
     │                           │                         │ • Quotes &   │
     │                           │                         │   Alts      │
     │                           │                         └─────────────┘
     │                           │                                │
     │                           ▼                                ▼
     │                    [Progress & Rewards]              ┌─────────────┐
     │                           │                         │ Skill Radar │
     │                           │                         │ Badges      │
     │                           │                         │ XP / Level  │
     │                           │                         └─────────────┘
     │                           │                                │
     │                           ▼                                ▼
     └──────────────────►  [Certificate]  ◄──────────────────────┘
                                │
                                ▼
                         ┌─────────────┐
                         │ Download    │
                         │ QR Verified │
                         └─────────────┘
```

### Journey Stages (Detailed)

| Stage | User Action | System Response |
|-------|-------------|-----------------|
| **1. Entry** | User navigates to Role-Play Studio from dashboard | Show overview, recent sessions, skill radar, recommended scenarios |
| **2. Selection** | Browse/filter scenarios by category, difficulty, region | Display scenario cards with preview, estimated duration, XP reward |
| **3. Preparation** | Select scenario, read briefing, choose difficulty (time pressure on/off) | Show context, parties, objectives, "Start" CTA |
| **4. Role Play** | Chat as Mediator with AI Parties; use Pause & Coach | Stream AI responses; log choices; trigger coaching tips; track metrics |
| **5. Outcome** | Reach resolution or escalation | Display outcome summary, path taken |
| **6. Debrief** | Review feedback | Show strengths, improvements, quote analysis, skill scores |
| **7. Progress** | View radar, badges, history | Update XP, level, unlock content |
| **8. Certificate** | Complete required scenarios | Generate PDF with QR; optional manager verification |

---

## 3. Scenario Library

### 3.1 Categories & Pre-Built Scenarios

| Category | Example Scenarios | Regional Variants |
|----------|------------------|-------------------|
| **Family** | Inheritance dispute, custody, elder care | Kenya (matrimonial property), Nigeria (extended family land) |
| **Commercial** | Contract breach, partnership dissolution | Nigeria (import/export), South Africa (B-BBEE) |
| **Land/Property** | Boundary dispute, eviction, title conflict | Kenya (succession), Uganda (mailo land) |
| **Employment** | Unfair dismissal, harassment, wage dispute | South Africa (employment equity), Ghana (labour law) |
| **Community** | Resource sharing, tribal/clan conflict, noise | East Africa (pastoral vs farmers), West Africa (chieftaincy) |

### 3.2 Difficulty Levels

| Level | Description | AI Behaviour |
|-------|-------------|---------------|
| **Beginner** | Cooperative parties, clear facts | Parties respond positively to basic techniques |
| **Intermediate** | Some resistance, hidden interests | Parties test mediator; require reframing |
| **Advanced** | Hostile, emotional, complex dynamics | Parties escalate; require advanced de-escalation |

### 3.3 Scenario Data Structure (JSON Schema)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "RolePlayScenario",
  "type": "object",
  "required": ["id", "title", "category", "difficulty", "region", "parties", "opening_state"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "title": { "type": "string" },
    "locale": { "type": "string", "default": "en" },
    "category": {
      "type": "string",
      "enum": ["family", "commercial", "land_property", "employment", "community"]
    },
    "difficulty": {
      "type": "string",
      "enum": ["beginner", "intermediate", "advanced"]
    },
    "region": {
      "type": "string",
      "enum": ["KE", "NG", "ZA", "GH", "UG", "TZ", "ET", "generic"]
    },
    "estimated_duration_minutes": { "type": "integer", "minimum": 5, "maximum": 60 },
    "xp_reward": { "type": "integer" },
    "parties": {
      "type": "array",
      "minItems": 2,
      "items": {
        "type": "object",
        "required": ["id", "role", "name", "profile"],
        "properties": {
          "id": { "type": "string" },
          "role": { "type": "string", "enum": ["complainant", "respondent"] },
          "name": { "type": "string" },
          "profile": {
            "type": "object",
            "properties": {
              "background": { "type": "string" },
              "interests": { "type": "array", "items": { "type": "string" } },
              "emotional_tendency": { "type": "string", "enum": ["calm", "neutral", "volatile", "defensive"] },
              "cultural_context": { "type": "string" }
            }
          }
        }
      }
    },
    "opening_state": {
      "type": "object",
      "properties": {
        "situation_summary": { "type": "string" },
        "initial_emotions": { "type": "object" },
        "dispute_summary": { "type": "string" }
      }
    },
    "branching_dialogue": {
      "type": "object",
      "description": "State machine for dialogue flow",
      "properties": {
        "nodes": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "type": { "enum": ["party_speech", "mediator_prompt", "joint_session", "caucus"] },
              "content": { "type": "string" },
              "triggers": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "condition": { "type": "string" },
                    "next_node": { "type": "string" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "ai_generation_hints": {
      "type": "object",
      "description": "Prompts for AI to generate dynamic responses",
      "properties": {
        "complainant_persona": { "type": "string" },
        "respondent_persona": { "type": "string" },
        "escalation_triggers": { "type": "array", "items": { "type": "string" } },
        "de_escalation_triggers": { "type": "array", "items": { "type": "string" } }
      }
    }
  }
}
```

### 3.4 Custom Scenario Builder (Admin)

- **UI:** Form + visual tree editor for branching dialogue
- **Fields:** Title, category, difficulty, region, party profiles, opening state
- **AI-Assisted:** "Generate scenario from template" using LLM
- **Export/Import:** JSON for sharing scenarios across tenants

---

## 4. Dynamic Role Play Engine

### 4.1 Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     ROLE-PLAY ENGINE                               │
├──────────────────────────────────────────────────────────────────┤
│  User (Mediator)  ◄────►  Chat UI  ◄────►  Session Orchestrator   │
│                                    │                              │
│                                    ▼                              │
│                          ┌─────────────────┐                      │
│                          │ AI Party Engine │                      │
│                          │ • Complainant   │                      │
│                          │ • Respondent    │                      │
│                          │ • Emotional     │                      │
│                          │   State Machine │                      │
│                          └─────────────────┘                      │
│                                    │                              │
│                                    ▼                              │
│                          ┌─────────────────┐                      │
│                          │ Choice Tracker  │                      │
│                          │ • Path taken    │                      │
│                          │ • Escalation    │                      │
│                          │ • Time spent    │                      │
│                          └─────────────────┘                      │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Multi-Role Simulation

- **User:** Always plays Mediator
- **AI:** Plays both Complainant and Respondent
- **Turn-taking:** Mediator speaks → Parties respond (or jointly)
- **Emotional state:** Each party has internal state (trust, anger, openness) that affects responses

### 4.3 Real-Time Dialogue

- **Chat interface:** Message bubbles, character avatars, emotion indicators
- **Streaming:** AI responses stream token-by-token
- **Context window:** Full session history + scenario context sent to LLM

### 4.4 Branching Paths

- **User choices** affect:
  - Party emotional state
  - Willingness to compromise
  - Outcome (resolved / escalated / withdrawn)
- **State machine:** Each party response is conditioned on current state + last mediator input

### 4.5 Time Pressure Option

- **Countdown timer:** e.g. 15 min for intermediate scenario
- **Visual:** Progress bar, optional sound when &lt; 2 min
- **Effect:** No penalty for overtime; used for stress simulation only

### 4.6 Pause & Coach

- **Trigger:** User clicks "Pause" or "Get Hint"
- **Behaviour:** AI returns coaching tip (e.g. "Consider reframing as open-ended question")
- **No penalty:** Tips do not affect session score (or optional "coached" flag)

---

## 5. AI Coaching Logic (Pseudocode)

### 5.1 When Tips Are Triggered

```python
# PSEUDOCODE: AI Coaching Logic

def should_trigger_coaching_tip(session_state, last_mediator_message):
    """
    Returns (trigger: bool, tip_type: str | None)
    """
    # 1. User explicitly requested hint
    if session_state.pause_requested:
        return (True, "hint_requested")

    # 2. Leading question detected
    if detect_leading_question(last_mediator_message):
        return (True, "leading_question")

    # 3. Closed question when open would help
    if detect_closed_question(last_mediator_message) and session_state.parties_stuck:
        return (True, "open_ended_suggestion")

    # 4. Escalation risk (e.g. parties becoming hostile)
    if session_state.emotional_tension > 0.8:
        return (True, "de_escalation")

    # 5. Missed opportunity for summarization
    if session_state.turn_count > 5 and not session_state.recent_summary:
        return (True, "summarize")

    # 6. Good moment for caucus
    if session_state.parties_stuck and session_state.turn_count > 3:
        return (True, "consider_caucus")

    return (False, None)


def get_coaching_tip(tip_type, context, locale="en"):
    """Return localized, context-specific tip."""
    tips = {
        "leading_question": "Consider reframing that as an open-ended question. "
                           "e.g. 'What would help you feel heard?' instead of 'Would that help?'",
        "open_ended_suggestion": "Use open-ended questions to invite deeper sharing. "
                                 "e.g. 'How did that affect you?' or 'What matters most to you here?'",
        "de_escalation": "Acknowledge emotions before problem-solving. "
                        "Try: 'I hear frustration. Let's take a moment to ensure we understand each other.'",
        "summarize": "This is a good moment to summarize what you've heard. "
                    "It shows active listening and helps parties feel heard.",
        "consider_caucus": "A private caucus might help. Parties may share more confidentially.",
        "hint_requested": "You asked for a hint. What would you like help with: "
                          "reframing, active listening, or managing emotions?"
    }
    return tips.get(tip_type, "Keep going. You're doing well.")
```

### 5.2 Post-Session Debrief Logic

```python
def generate_debrief(session_log):
    """
    Analyze session and produce:
    - strengths: list of (skill, score, quote)
    - improvements: list of (skill, score, quote, alternative_phrase)
    - overall_scores: dict of 8 competencies
    """
    # 1. Extract mediator utterances
    mediator_turns = [t for t in session_log if t.role == "mediator"]

    # 2. Score each competency (see Section 7)
    scores = {
        "active_listening": score_active_listening(mediator_turns),
        "neutrality": score_neutrality(mediator_turns),
        "empathy": score_empathy(mediator_turns),
        "open_ended_questions": score_open_ended(mediator_turns),
        "reframing": score_reframing(mediator_turns),
        "summarization": score_summarization(mediator_turns),
        "managing_emotions": score_emotion_management(session_log),
        "problem_solving": score_problem_solving(session_log),
    }

    # 3. Identify strengths (score >= 80%)
    strengths = [(k, v, find_exemplar_quote(k, mediator_turns)) 
                 for k, v in scores.items() if v >= 0.8]

    # 4. Identify improvements (score < 70%)
    improvements = [(k, v, find_weak_quote(k, mediator_turns), suggest_alternative(k, quote))
                    for k, v in scores.items() if v < 0.7]

    return {"strengths": strengths, "improvements": improvements, "scores": scores}
```

---

## 6. Scoring Algorithm for Mediation Competencies

### 6.1 Eight Core Competencies

| Competency | Definition | Measurement Approach |
|------------|------------|----------------------|
| **Active Listening** | Reflects back, paraphrases, asks clarifying questions | % of turns with reflection/paraphrase; absence of interrupting |
| **Neutrality** | Avoids taking sides, balanced language | Sentiment analysis; absence of bias keywords |
| **Empathy** | Acknowledges emotions, validates feelings | % of turns with emotion acknowledgment |
| **Open-Ended Questions** | Uses "what", "how", "tell me" vs "yes/no" | Ratio of open vs closed questions |
| **Reframing** | Rephrases negative into neutral/positive | % of negative party statements followed by reframe |
| **Summarization** | Periodically summarizes key points | Count of summaries per N turns |
| **Managing Emotions** | De-escalates when tension rises | Correlation of emotional tension with mediator interventions |
| **Problem-Solving** | Facilitates options, joint solutions | % of turns with option-generation or "what if" |

### 6.2 Scoring Formula (Pseudocode)

```python
def score_active_listening(mediator_turns):
    reflections = count_patterns(mediator_turns, ["it sounds like", "so you're saying", "if I understand"])
    clarifications = count_patterns(mediator_turns, ["can you clarify", "what do you mean", "how did that"])
    total = len(mediator_turns)
    if total == 0: return 0
    # Ideal: 1 reflection or clarification per 2-3 turns
    return min(1.0, (reflections + clarifications) / 2 / max(1, total / 3))
```

### 6.3 Skill Radar Chart

- **Axes:** 8 competencies, each 0–100%
- **User score:** Filled polygon
- **Benchmark:** "Top 10% in your region" as dashed outline (optional)

---

## 7. Gamification & Progress Tracking

### 7.1 XP & Levels

| Action | XP |
|--------|-----|
| Complete scenario (Beginner) | 50 |
| Complete scenario (Intermediate) | 100 |
| Complete scenario (Advanced) | 150 |
| First resolution | +25 |
| Under time pressure | +20 |
| Skill badge earned | +50 |

### 7.2 Skill Badges

| Badge | Condition |
|-------|-----------|
| **Neutrality Master** | 5 sessions with neutrality score ≥ 90% |
| **Empathy Champion** | 3 sessions with empathy score ≥ 85% |
| **Problem-Solver** | 3 resolutions in advanced scenarios |
| **Quick Resolver** | 2 resolutions under time pressure |
| **Africa-Ready** | Complete 1 scenario in each of 3 regions |

### 7.3 Progress Tracking UI

- **Skill radar:** 8-axis chart, updated after each session
- **Session history:** List with replay, outcome, scores
- **Certificate:** PDF with QR linking to verification URL (e.g. `/verify/{session_id}`)

### 7.4 Manager/Admin View

- **Team dashboard:** Aggregate skill radar, completion rates, gaps
- **Drill-down:** Per-user sessions, recommended scenarios

---

## 8. Localization Strategy

### 8.1 Languages (Priority)

| Priority | Language | Notes |
|----------|----------|-------|
| 1 | English | Default |
| 2 | Swahili | East Africa |
| 3 | French | Francophone Africa |
| 4 | Yoruba | Nigeria |
| 5 | Amharic | Ethiopia |
| 6 | Arabic | North Africa (future) |

### 8.2 Localization Scope

- **UI strings:** All buttons, labels, tips (i18n keys)
- **Scenario content:** Title, briefing, party profiles, opening state
- **AI personas:** System prompt instructs LLM to use regional names, idioms, dispute norms
- **Coaching tips:** Translated per locale

### 8.3 Cultural Variants

- **Names:** Region-specific (e.g. Kenya: "Wanjiku", "Otieno"; Nigeria: "Chidi", "Adaeze")
- **Dispute norms:** E.g. Kenya land inheritance (matrilineal vs patrilineal); Nigeria chieftaincy
- **Idioms:** Local expressions in AI responses (e.g. "Haraka haraka haina baraka" in Swahili)

---

## 9. Africa-First Considerations

### 9.1 Offline Mode

- **Download scenarios:** Store JSON + static assets in IndexedDB/Service Worker
- **Sync progress:** Queue session completions; sync when online
- **Conflict resolution:** Last-write-wins or server-authoritative

### 9.2 Mobile & Touch

- **Touch targets:** Min 44px
- **Swipe:** Navigate between chat and coach panel
- **Responsive:** Single column on mobile; stacked layout

### 9.3 Low Connectivity

- **Reduce payload:** Compress scenario JSON; lazy-load AI
- **Fallback:** Cached scenarios with simplified AI (e.g. rule-based) if API unavailable

---

## 10. UX & Visual Design

### 10.1 Theme

- **Primary gradient:** Purple (#8B5CF6) → Pink (#EC4899) for creativity
- **Secondary gradient:** Teal (#14B8A6) → Green (#22C55E) for growth
- **Accent:** Orange (#F97316) for CTAs

### 10.2 Gamification Elements

- **Progress bars:** XP to next level, scenario completion
- **Level badges:** Visual rank (e.g. Bronze → Silver → Gold Mediator)
- **Leaderboards:** Opt-in; anonymized or by team

### 10.3 Immersive UI

- **Full-screen mode:** Toggle for role-play session
- **Character avatars:** Illustrations with emotion indicators (calm, tense, hopeful)
- **Sound effects:** Optional (e.g. "message sent", "session complete")

### 10.4 Accessibility

- **Subtitles:** For any audio
- **Colorblind-friendly:** Use patterns + icons, not just color
- **Keyboard:** Full navigation support

---

## 11. Technical Architecture (High-Level)

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend (React)                                                 │
│  • RolePlayStudioPage, ScenarioLibrary, ChatSession, Debrief     │
│  • PWA + Offline scenarios                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  API (FastAPI)                                                    │
│  • POST /role-play/scenarios (list, get)                          │
│  • POST /role-play/sessions (create, stream)                      │
│  • POST /role-play/sessions/{id}/message (send, get AI reply)     │
│  • POST /role-play/sessions/{id}/pause (get coaching tip)         │
│  • POST /role-play/sessions/{id}/end (outcome, debrief)            │
│  • GET  /role-play/progress (radar, badges, history)              │
│  • GET  /role-play/certificates/{id} (download, verify)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Services                                                         │
│  • ScenarioService (CRUD, AI generation)                           │
│  • RolePlayEngine (session state, AI party responses)             │
│  • CoachingService (tip generation, debrief analysis)              │
│  • ScoringService (competency scores)                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  LLM (OpenAI / Anthropic / Local)                                 │
│  • Party persona responses                                        │
│  • Coaching tips                                                   │
│  • Debrief generation                                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Success Metrics

| Metric | Target |
|--------|--------|
| Session completion rate | > 70% |
| User returns within 7 days | > 40% |
| Average competency score improvement (3 sessions) | +15% |
| Debrief "helpful" rating | > 4.0/5 |
| Mobile usage | > 60% |
| Offline scenario downloads | > 20% of active users |

---

## 13. Appendix: Sample Scenario (Minimal JSON)

```json
{
  "id": "sc-001",
  "title": "Land Inheritance Dispute",
  "category": "land_property",
  "difficulty": "intermediate",
  "region": "KE",
  "parties": [
    {
      "id": "p1",
      "role": "complainant",
      "name": "Wanjiku",
      "profile": {
        "background": "Elder daughter; claims father promised land before death",
        "emotional_tendency": "volatile",
        "cultural_context": "Kikuyu; customary inheritance norms"
      }
    },
    {
      "id": "p2",
      "role": "respondent",
      "name": "Kamau",
      "profile": {
        "background": "Younger brother; holds title deed",
        "emotional_tendency": "defensive",
        "cultural_context": "Kikuyu; male succession tradition"
      }
    }
  ],
  "opening_state": {
    "situation_summary": "Siblings dispute 2-acre family plot in Kiambu.",
    "dispute_summary": "Wanjiku claims oral promise; Kamau has legal title."
  }
}
```

---

*End of PRD*
