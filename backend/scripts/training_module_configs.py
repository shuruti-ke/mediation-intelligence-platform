"""Full training module configs: interactive steps, scenarios, and learning outcomes."""

ORIENTATION_CONFIG = {
    "steps": [
        {
            "id": "intro",
            "type": "content",
            "content": """<h2>Welcome to the Mediation Intelligence Platform</h2>
<p>This platform supports mediators across Kenya and beyond with case management, online sessions, and AI-assisted tools. Your judgment, ethics, and skill drive outcomes—the platform supports, it does not replace.</p>
<h3>What you'll learn</h3>
<ul>
<li>How to use case management effectively</li>
<li>Best practices for data entry and privacy</li>
<li>When and how to document for handover</li>
<li>Your role vs. the platform's role</li>
</ul>""",
            "next": "s1",
        },
        {
            "id": "s1",
            "type": "scenario",
            "scenario": "You're setting up a new case. The system asks for dispute type, party names, contact details, and optional notes from the intake call.",
            "question": "How do you approach data entry?",
            "choices": [
                {"text": "Enter only what's necessary for the case file (names, dispute type, contact)", "next": "k1a", "feedback": "Good practice. Collect what you need to manage the case; avoid unnecessary personal data. This protects party privacy and keeps records focused."},
                {"text": "Add detailed notes from the intake call including party opinions", "next": "k1b", "feedback": "Notes help continuity—but ensure they're factual and not biased. Future mediators or co-mediators may read them. Avoid recording opinions as facts."},
                {"text": "Skip the system and keep notes in your own documents", "next": "k1b", "feedback": "Using the platform keeps records consistent and supports handover. If you must use external notes, ensure they align with organisational policy and data protection."},
            ],
        },
        {"id": "k1a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Use the platform to support your practice. Enter what serves the case; protect party privacy. Less can be more when it comes to personal data.</p>", "next": "s2"},
        {"id": "k1b", "type": "content", "content": "<p><strong>Key takeaway:</strong> The platform is a tool. Your ethics and discretion guide how you use it. Balance thoroughness with neutrality and privacy.</p>", "next": "s2"},
        {
            "id": "s2",
            "type": "scenario",
            "scenario": "A colleague will take over a case you've been mediating. The platform has case history, session notes, and party details.",
            "question": "What do you include in your handover notes?",
            "choices": [
                {"text": "Summarise progress, key interests, and agreed next steps—no personal opinions", "next": "k2a", "feedback": "Correct. Handover should support continuity without biasing the next mediator. Stick to facts, interests, and process."},
                {"text": "Include your assessment of which party is more reasonable", "next": "k2b", "feedback": "Assessments can bias the next mediator. Focus on interests, process, and outcomes. Let the next mediator form their own view."},
                {"text": "Leave minimal notes—the next mediator should start fresh", "next": "k2b", "feedback": "Some context helps. Parties expect continuity. Summarise facts and progress without opinions; the next mediator can build rapport independently."},
            ],
        },
        {"id": "k2a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Handover supports continuity. Document progress, interests, and process—not personal judgments. The next mediator stays neutral.</p>", "next": "s3"},
        {"id": "k2b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Notes serve the case and the organisation. Avoid bias; focus on what helps the next mediator facilitate effectively.</p>", "next": "s3"},
        {
            "id": "s3",
            "type": "scenario",
            "scenario": "You're preparing for an online mediation session. The platform offers video, scheduling, and document sharing. A party asks if they can use the platform to send messages directly to the other party outside the session.",
            "question": "How do you respond?",
            "choices": [
                {"text": "Explain that all communication should go through you or during scheduled sessions", "next": "k3a", "feedback": "Good. The mediator facilitates communication. Direct messaging between parties outside sessions can bypass the process and create confusion."},
                {"text": "Allow it if both parties agree", "next": "k3b", "feedback": "Even with consent, direct messaging can undermine the process. Recommend using the platform for scheduling and documents; dialogue happens in sessions."},
                {"text": "Suggest they use email instead", "next": "k3b", "feedback": "Email can create a written record that complicates mediation. Encourage parties to bring concerns to the next session. You facilitate; they decide."},
            ],
        },
        {"id": "k3a", "type": "content", "content": "<p><strong>Key takeaway:</strong> The platform supports sessions and documentation. You facilitate dialogue—parties communicate through the process, not around it.</p>", "next": "outro"},
        {"id": "k3b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Use the platform to structure communication. Your role is to create a safe, organised space for dialogue.</p>", "next": "outro"},
        {
            "id": "outro",
            "type": "content",
            "content": """<h3>Module complete</h3>
<p>You've learned how the platform supports case management, handover, and communication. Remember: the platform is a tool. Your neutrality, ethics, and skill remain at the centre of effective mediation.</p>
<p>Complete this module to earn CPD credits.</p>""",
            "next": None,
        },
    ],
    "learning_outcomes": ["platform_use", "privacy", "handover", "communication"],
}

ETHICS_CONFIG = {
    "steps": [
        {
            "id": "intro",
            "type": "content",
            "content": """<h2>Ethics in Mediation</h2>
<p>Mediation rests on trust. Parties must believe you are neutral, that their words stay confidential, and that they participate voluntarily with full understanding.</p>
<h3>Core principles</h3>
<ul>
<li><strong>Neutrality</strong> — You do not take sides or advise</li>
<li><strong>Confidentiality</strong> — What is said stays in mediation unless law or parties require otherwise</li>
<li><strong>Informed consent</strong> — Parties understand the process and can withdraw</li>
<li><strong>Power awareness</strong> — You create space for both parties to be heard</li>
</ul>""",
            "next": "s1",
        },
        {
            "id": "s1",
            "type": "scenario",
            "scenario": "A party reveals something in confidence during a caucus. Later, the other party demands to know what was said. They say: 'If you're neutral, you have to tell me.'",
            "question": "What would you do?",
            "choices": [
                {"text": "Explain that confidentiality applies to both parties and you cannot disclose", "next": "k1a", "feedback": "Correct. Confidentiality protects the process. You can acknowledge the other party's frustration without revealing content. Neutrality does not mean sharing confidential information."},
                {"text": "Suggest a caucus to discuss with each party separately", "next": "k1b", "feedback": "A caucus can help. You might use it to clarify ground rules or to explore whether the first party is willing to share—but never without their explicit consent."},
                {"text": "Share a general summary that doesn't reveal specifics", "next": "k1b", "feedback": "Even summaries can breach confidence. Unless the first party explicitly consents, do not share. Redirect to interests instead."},
            ],
        },
        {"id": "k1a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Confidentiality is non-negotiable unless the law requires disclosure (e.g. child protection, imminent harm) or parties agree. Consult your jurisdiction's regulations for specifics.</p>", "next": "s2"},
        {"id": "k1b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Confidentiality protects the process. Use caucuses to clarify, never to leak. When in doubt, err on the side of protecting what was shared.</p>", "next": "s2"},
        {
            "id": "s2",
            "type": "scenario",
            "scenario": "During intake, you realise one party is a distant relative. You've never discussed family matters with them, but the connection exists.",
            "question": "What do you do?",
            "choices": [
                {"text": "Disclose the connection to both parties and offer to withdraw if they prefer", "next": "k2a", "feedback": "Correct. Perceived or actual bias undermines trust. Disclose any connection that could affect neutrality. Let parties decide."},
                {"text": "Proceed—the connection is distant and won't affect your neutrality", "next": "k2b", "feedback": "Parties may perceive bias even if you believe you're neutral. Disclosure protects the process. If in doubt, disclose and offer to withdraw."},
                {"text": "Withdraw immediately without explaining", "next": "k2b", "feedback": "Withdrawal may be appropriate, but parties deserve an explanation. Disclose first; let them decide. Transparency builds trust."},
            ],
        },
        {"id": "k2a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Neutrality requires both actual and perceived impartiality. Disclose any connection that could affect trust. Parties decide whether to proceed.</p>", "next": "s3"},
        {"id": "k2b", "type": "content", "content": "<p><strong>Key takeaway:</strong> When in doubt, disclose. Parties have the right to a mediator they trust. Your reputation and the process depend on transparency.</p>", "next": "s3"},
        {
            "id": "s3",
            "type": "scenario",
            "scenario": "In an employment dispute, the employee seems intimidated. They agree to everything the manager suggests. You sense they may not be participating freely.",
            "question": "How do you respond?",
            "choices": [
                {"text": "Offer a private caucus to check in with the employee alone", "next": "k3a", "feedback": "Good. A caucus creates space for the less powerful party to speak freely. Check whether they understand the process and feel safe to participate."},
                {"text": "Ask both parties to confirm they're participating voluntarily", "next": "k3b", "feedback": "Asking in front of both parties may not elicit an honest answer. A private caucus is often more effective for power-imbalance concerns."},
                {"text": "Proceed—they said they agree", "next": "k3b", "feedback": "Agreement under pressure is not genuine consent. Your role is to create space for both parties. Consider a caucus or ground rules to address power dynamics."},
            ],
        },
        {"id": "k3a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Power imbalance is common in employment, family, and commercial disputes. Use caucuses, ground rules, and referrals when needed. Ensure genuine participation.</p>", "next": "s4"},
        {"id": "k3b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Informed consent means parties participate freely. Watch for signs of coercion or fear. Create space for the less powerful party to be heard.</p>", "next": "s4"},
        {
            "id": "s4",
            "type": "scenario",
            "scenario": "A party asks you for legal advice: 'Do I have a case if we don't settle?'",
            "question": "How do you respond?",
            "choices": [
                {"text": "Explain that you cannot give legal advice and suggest they consult a lawyer", "next": "k4a", "feedback": "Correct. Mediators facilitate; they do not advise. Direct parties to qualified professionals for legal, financial, or therapeutic advice."},
                {"text": "Give a general sense of what courts often do in similar cases", "next": "k4b", "feedback": "Even general information can be seen as advice. Stay in your role. Redirect to interests: 'What outcome would work for you?'"},
                {"text": "Tell them mediation is usually better than court", "next": "k4b", "feedback": "That may be true, but it can pressure them to settle. Focus on their interests and the process. Let them decide with proper information from their own advisers."},
            ],
        },
        {"id": "k4a", "type": "content", "content": "<p><strong>Key takeaway:</strong> You facilitate; you do not advise. Direct parties to lawyers, accountants, or counsellors when they need professional advice.</p>", "next": "outro"},
        {"id": "k4b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Maintain your role. Your job is to help parties communicate and find their own solutions—not to tell them what to do.</p>", "next": "outro"},
        {
            "id": "outro",
            "type": "content",
            "content": """<h3>Module complete</h3>
<p>You've explored confidentiality, neutrality, power imbalance, and the boundaries of your role. These principles underpin trust in mediation. Apply them consistently in your practice.</p>
<p>Complete this module to earn CPD credits.</p>""",
            "next": None,
        },
    ],
    "learning_outcomes": ["confidentiality", "neutrality", "informed_consent", "power_imbalance"],
}

ONLINE_MEDIATION_CONFIG = {
    "steps": [
        {
            "id": "intro",
            "type": "content",
            "content": """<h2>Online Mediation</h2>
<p>Online mediation offers flexibility and access, but poses unique challenges for rapport, non-verbal cues, and technical reliability.</p>
<h3>What you'll learn</h3>
<ul>
<li>Preparation before the session</li>
<li>Managing technical issues during mediation</li>
<li>Conducting caucuses online</li>
<li>Documentation and record-keeping</li>
</ul>""",
            "next": "s1",
        },
        {
            "id": "s1",
            "type": "scenario",
            "scenario": "A party's video freezes mid-sentence. They're clearly frustrated. The other party is waiting.",
            "question": "What do you do?",
            "choices": [
                {"text": "Pause and check if everyone can hear and see before continuing", "next": "k1a", "feedback": "Good. Technical issues affect trust. Address them calmly. A brief check-in maintains rapport and ensures no one feels excluded."},
                {"text": "Ask them to rejoin and continue once they're back", "next": "k1b", "feedback": "Rejoining may help, but acknowledge the disruption first. A brief pause and check-in shows you care about their experience."},
                {"text": "Suggest switching to phone as backup", "next": "k1b", "feedback": "Having a backup plan is best practice. Document the switch for the record. Ensure both parties agree and understand the change."},
            ],
        },
        {"id": "k1a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Technical reliability affects trust. Check in regularly: 'Can you both hear clearly?' Have a backup plan (phone, reschedule) agreed in advance.</p>", "next": "s2"},
        {"id": "k1b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Adapt when tech fails. Document changes; keep parties informed. A calm response reassures everyone.</p>", "next": "s2"},
        {
            "id": "s2",
            "type": "scenario",
            "scenario": "You need to hold a caucus with one party. The platform supports breakout rooms, but one party is on a phone and cannot use them.",
            "question": "How do you proceed?",
            "choices": [
                {"text": "Ask the other party to leave the call briefly; you'll call them back", "next": "k2a", "feedback": "Correct. Explain the process clearly. Ensure the party who leaves knows when to expect reconnection. Document that a caucus occurred."},
                {"text": "Skip the caucus and continue in joint session", "next": "k2b", "feedback": "Caucuses can be essential for power imbalance or sensitive issues. Find a workaround—e.g. separate calls, or a brief pause—rather than skipping the caucus."},
                {"text": "Use the chat to message the party privately", "next": "k2b", "feedback": "Chat may not be private depending on the platform. Verbal caucuses are clearer. Use a separate call if breakout rooms aren't available."},
            ],
        },
        {"id": "k2a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Caucuses work online with planning. Use breakout rooms when available; otherwise, separate calls. Document the process for the record.</p>", "next": "s3"},
        {"id": "k2b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Adapt the process to the technology. Ensure parties understand how caucuses will work before the session starts.</p>", "next": "s3"},
        {
            "id": "s3",
            "type": "scenario",
            "scenario": "A party joins from a busy café. You can hear background noise and other people talking. They say they can't find a quieter place.",
            "question": "What do you do?",
            "choices": [
                {"text": "Explain that privacy and focus are essential; suggest rescheduling", "next": "k3a", "feedback": "Correct. Mediation requires confidentiality and focus. A café is not appropriate. Rescheduling protects the process and both parties."},
                {"text": "Proceed but ask them to mute when not speaking", "next": "k3b", "feedback": "Background noise and lack of privacy undermine confidentiality. Other people may overhear. Reschedule for a private space."},
                {"text": "Ask the other party if they're comfortable continuing", "next": "k3b", "feedback": "The issue isn't just the other party's comfort—it's confidentiality and process integrity. Reschedule when the party can join from a private space."},
            ],
        },
        {"id": "k3a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Before the session, confirm both parties have a quiet, private space. Send a tech checklist. Reschedule if the environment isn't suitable.</p>", "next": "s4"},
        {"id": "k3b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Privacy and focus are non-negotiable. Set expectations in advance; don't compromise during the session.</p>", "next": "s4"},
        {
            "id": "s4",
            "type": "scenario",
            "scenario": "A party asks if they can record the session. The other party objects.",
            "question": "How do you respond?",
            "choices": [
                {"text": "Explain that recording requires consent from all parties; without it, no recording", "next": "k4a", "feedback": "Correct. Recording affects confidentiality and trust. All parties must agree. Set this as a ground rule at the start."},
                {"text": "Allow the objecting party to record for their own notes", "next": "k4b", "feedback": "Unequal recording creates imbalance. Either all agree or no one records. Document the decision in your notes."},
                {"text": "Suggest they take written notes instead", "next": "k4b", "feedback": "Written notes are fine if parties agree. The key is consent. If one party objects to recording, no recording. Clarify ground rules early."},
            ],
        },
        {"id": "k4a", "type": "content", "content": "<p><strong>Key takeaway:</strong> Set ground rules at the start: one person speaks at a time, no recording without consent. Align with your jurisdiction's requirements for online mediation.</p>", "next": "outro"},
        {"id": "k4b", "type": "content", "content": "<p><strong>Key takeaway:</strong> Record outcomes, not the dialogue. Ensure parties understand what will be documented and who has access.</p>", "next": "outro"},
        {
            "id": "outro",
            "type": "content",
            "content": """<h3>Module complete</h3>
<p>You've learned how to prepare for online sessions, manage technical issues, conduct caucuses, and maintain privacy. Online mediation requires extra attention to connection—both technical and human.</p>
<p>Complete this module to earn CPD credits.</p>""",
            "next": None,
        },
    ],
    "learning_outcomes": ["tech_prep", "caucuses_online", "privacy", "ground_rules"],
}

MODULE_CONFIGS = {
    "orientation": ORIENTATION_CONFIG,
    "ethics": ETHICS_CONFIG,
    "online_mediation_intro": ONLINE_MEDIATION_CONFIG,
}
