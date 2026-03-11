"""Should I Mediate? assessment analysis - AI or rule-based."""
from app.core.config import get_settings


def analyze_assessment(responses: dict) -> dict:
    """
    Analyze assessment responses. Uses OpenAI when API key is set, else rule-based.
    Returns: { recommendation, confidence, factors, next_step }
    """
    settings = get_settings()
    if settings.openai_api_key:
        return _analyze_with_ai(responses)
    return _analyze_rule_based(responses)


def _analyze_rule_based(responses: dict) -> dict:
    """Rule-based scoring and recommendation."""
    factors = []
    score = 0
    max_score = 0

    # Dispute type suitability (0-20)
    dispute_type = responses.get("dispute_type") or ""
    type_scores = {
        "employment": 18,
        "commercial": 18,
        "family": 16,
        "landlord_tenant": 17,
        "neighbour": 15,
        "community": 14,
        "consumer": 16,
        "other": 10,
    }
    dt_score = type_scores.get(dispute_type, 10)
    score += dt_score
    max_score += 20
    if dispute_type:
        factors.append(f"{dispute_type.replace('_', ' ').title()} disputes are well-suited to mediation")

    # Duration (longer = more likely to benefit)
    duration = responses.get("duration")
    if duration:
        dur_score = {"under_1_month": 3, "1_3_months": 6, "3_6_months": 10, "6_12_months": 12, "over_1_year": 15}
        score += dur_score.get(duration, 5)
        max_score += 15

    # Previous attempts
    prev_attempts = responses.get("previous_attempts")
    if prev_attempts == "none":
        factors.append("No prior attempts—mediation can be a good first step")
        score += 12
    elif prev_attempts == "informal":
        factors.append("Informal attempts suggest mediation may help formalize resolution")
        score += 10
    elif prev_attempts == "formal":
        factors.append("Formal attempts suggest structured mediation could help")
        score += 8
    max_score += 12

    # Other party awareness
    other_aware = responses.get("other_party_aware")
    if other_aware == "yes":
        score += 8
        factors.append("Other party aware—increases likelihood of successful mediation")
    elif other_aware == "unsure":
        score += 4
    max_score += 8

    # Primary goal
    goal = responses.get("primary_goal")
    goal_suitable = goal in ("relationship", "financial", "closure", "clarity")
    if goal_suitable:
        score += 10
        factors.append(f"Seeking {goal}—mediation supports this outcome")
    max_score += 10

    # Willingness to compromise (1-5 scale)
    willingness = responses.get("willingness_compromise", 3)
    if isinstance(willingness, str):
        willingness = int(willingness) if willingness.isdigit() else 3
    score += min(5, max(0, willingness)) * 2
    max_score += 10

    # Safety concerns
    safety = responses.get("safety_concerns")
    if safety == "yes":
        score -= 5
        factors.append("Safety concerns noted—we recommend discussing with a professional before mediation")
    elif safety == "no":
        score += 5
    max_score += 5

    # Urgency
    urgency = responses.get("urgency", "medium")
    if urgency == "high":
        factors.append("Urgent timeline—mediation is typically faster than litigation")
        score += 5
    max_score += 5

    # Calculate confidence and recommendation
    pct = (score / max_score * 100) if max_score > 0 else 50
    if pct >= 70:
        recommendation = (
            "Mediation is strongly recommended for your situation. Based on your responses, "
            "your dispute is well-suited to a confidential, structured mediation process. "
            "We'll connect you with a qualified mediator to discuss next steps."
        )
        confidence = "high"
    elif pct >= 50:
        recommendation = (
            "Mediation appears to be a good option for your dispute. "
            "A confidential intake session can help clarify whether mediation is the right path "
            "and what to expect. We recommend scheduling a free consultation."
        )
        confidence = "medium"
    else:
        recommendation = (
            "Mediation may be suitable, but we recommend a confidential consultation first. "
            "Our team can assess your specific situation and advise on the best path forward—"
            "whether mediation, another form of dispute resolution, or referral to another service."
        )
        confidence = "low"

    return {
        "recommendation": recommendation,
        "confidence": confidence,
        "factors": factors,
        "next_step": "Schedule a free, confidential consultation",
        "score_pct": round(pct),
    }


def _analyze_with_ai(responses: dict) -> dict:
    """AI-powered analysis using OpenAI. Falls back to rule-based if call fails."""
    try:
        import httpx
        from app.core.config import get_settings
        settings = get_settings()
        prompt = f"""You are a mediator assessment analyst. Analyze this dispute assessment for mediation suitability.

Responses (confidential - for analysis only):
{_format_responses(responses)}

Provide:
1. A personalized recommendation (2-4 sentences) on whether mediation is suitable
2. Confidence: high, medium, or low
3. Key factors (2-4 bullet points) from their responses
4. Next step (one short phrase)

CRITICAL: Never quote or cite any law. Do not invent laws or present them as real—the system cannot verify legal accuracy. Use only general principles. When legal matters arise, direct users to verified sources (e.g. Kenya Law at new.kenyalaw.org) or a qualified legal professional.

Respond in JSON: {{"recommendation": "...", "confidence": "high|medium|low", "factors": ["...", "..."], "next_step": "..."}}
"""
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {settings.openai_api_key}", "Content-Type": "application/json"},
            json={"model": "gpt-4o-mini", "messages": [{"role": "user", "content": prompt}], "max_tokens": 500},
            timeout=30,
        )
        if resp.status_code == 200:
            import json
            content = resp.json()["choices"][0]["message"]["content"]
            # Extract JSON from response
            start = content.find("{")
            if start >= 0:
                result = json.loads(content[start:content.rfind("}") + 1])
                result["next_step"] = result.get("next_step", "Schedule a free, confidential consultation")
                return result
    except Exception:
        pass
    return _analyze_rule_based(responses)


def _format_responses(r: dict) -> str:
    """Format responses for AI, excluding PII."""
    exclude = {"email", "phone", "consent_marketing", "consent_confidentiality"}
    return "\n".join(f"- {k}: {v}" for k, v in r.items() if k not in exclude and v is not None and v != "")
