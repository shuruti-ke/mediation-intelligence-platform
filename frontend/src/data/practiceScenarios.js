/** Practice scenarios: rich content for interactive training. Each links to Role-Play for practice. */
export const PRACTICE_SCENARIOS = [
  {
    id: "power-imbalance",
    title: "Power imbalance",
    summary: "An employee feels intimidated by their manager in a joint session. How do you create space for genuine dialogue?",
    disputeCategory: "employment",
    richContent: {
      overview: "Power imbalances are common in employment, family, and commercial disputes. One party may have more authority, resources, or confidence. As a mediator, you must create conditions where both can participate meaningfully.",
      keyChallenges: [
        "The less powerful party may withhold information or agree to terms they don't truly accept.",
        "The more powerful party may dominate the conversation or dismiss concerns.",
        "Joint sessions can feel unsafe for the less powerful party.",
      ],
      strategies: [
        "Use caucus (private sessions) to give the less powerful party space to speak freely.",
        "Set ground rules: one person speaks at a time; no interruptions; respect for all perspectives.",
        "Reflect and validate both parties' contributions equally.",
        "Consider seating arrangements and physical setup to reduce intimidation.",
      ],
      reflectionPrompts: [
        "How would you address the power imbalance between employee and manager?",
        "What questions might uncover interests beyond 'fair treatment'?",
        "When might you suggest a caucus (private session) with each party?",
      ],
      linkedResources: [
        { label: "Trainee Academy: Active Listening", path: "/training/trainee-academy", moduleHint: "module-1" },
        { label: "Ethics & Impartiality", path: "/training/modules", hint: "ethics" },
      ],
    },
  },
  {
    id: "cultural-sensitivity",
    title: "Cultural sensitivity",
    summary: "One party prefers indirect communication; the other expects direct answers. How do you bridge the gap?",
    disputeCategory: "family",
    richContent: {
      overview: "Cultural norms shape how people communicate, express emotion, and make decisions. In mediation, parties may come from different backgrounds—ethnic, generational, or professional. Bridging these gaps requires awareness and adaptability.",
      keyChallenges: [
        "Indirect communicators may find direct questions confrontational.",
        "Direct communicators may perceive indirectness as evasive or dishonest.",
        "Norms around eye contact, silence, and formality vary across cultures.",
      ],
      strategies: [
        "Learn about the parties' backgrounds when possible; ask about preferences.",
        "Offer multiple ways to participate: written notes, private caucus, or speaking through a trusted person.",
        "Use reframing to translate between communication styles.",
        "Allow time for silence; not everyone processes at the same pace.",
      ],
      reflectionPrompts: [
        "How might generational differences affect communication styles in family disputes?",
        "What would you do if one party expects you to take sides based on cultural norms?",
        "How do you balance respect for cultural norms with ensuring both parties are heard?",
      ],
      linkedResources: [
        { label: "Trainee Academy: Key Communication Techniques", path: "/training/trainee-academy", moduleHint: "module-2" },
        { label: "Community & Land Disputes", path: "/training/trainee-academy", moduleHint: "module-5" },
      ],
    },
  },
  {
    id: "hidden-interests",
    title: "Hidden interests",
    summary: "Both parties agree on a surface solution—but you suspect deeper needs aren't being addressed. What do you do?",
    disputeCategory: "commercial",
    richContent: {
      overview: "Surface agreements can mask unmet interests. Parties may agree quickly to end the process, but underlying needs—recognition, fairness, relationship—may go unaddressed. Durable agreements often require uncovering what really matters.",
      keyChallenges: [
        "Parties may not be aware of their own deeper interests.",
        "Asking too directly can feel intrusive or manipulative.",
        "A quick settlement may collapse later if interests are ignored.",
      ],
      strategies: [
        "Ask 'Why?' and 'What would that give you?' to explore beneath positions.",
        "Use hypotheticals: 'If you could have anything in this situation, what would it be?'",
        "Reality-test: 'If you both follow through on this, would you still feel [X]?'",
        "Summarise and check: 'It sounds like [interest] matters to you. Is that right?'",
      ],
      reflectionPrompts: [
        "How do you balance relationship preservation with accountability?",
        "How would you help parties move from positions to interests?",
        "What signals suggest an agreement may not hold?",
      ],
      linkedResources: [
        { label: "Trainee Academy: Interests vs Positions", path: "/training/trainee-academy", moduleHint: "module-4" },
        { label: "Reality Testing", path: "/training/trainee-academy", moduleHint: "module-4" },
      ],
    },
  },
];

export const getScenarioById = (id) => PRACTICE_SCENARIOS.find((s) => s.id === id);

const COMPLETION_KEY = "practiceScenarioCompleted";
export function getCompletedIds() {
  try {
    const raw = localStorage.getItem(COMPLETION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
