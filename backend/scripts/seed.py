"""Seed database with initial tenant and super_admin user."""
import asyncio
import uuid

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select

# Add parent to path
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import Base
from app.core.config import get_settings
from app.core.security import get_password_hash
from app.models import Tenant, User, Case, UsageMeteringEvent, AnalyticsEvent, Document, KnowledgeBaseDocument, KnowledgeBaseChunk, JudiciarySearchCache, TrainingModule, TrainingModuleConfig


async def seed():
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        result = await session.execute(select(Tenant).limit(1))
        tenant = result.scalar_one_or_none()

        if not tenant:
            tenant = Tenant(
                name="Mediation Focus",
                data_residency_region="af-south-1",
                commercial_config={
                    "payment_methods_enabled": False,
                    "ai_features_enabled": True,
                    "branding": {},
                },
            )
            session.add(tenant)
            await session.flush()

            user = User(
                email="admin@mediationfocus.co.ke",
                hashed_password=get_password_hash("admin123"),
                display_name="Super Admin",
                role="super_admin",
                tenant_id=tenant.id,
            )
            session.add(user)
            mediator = User(
                email="mediator@mediationfocus.co.ke",
                hashed_password=get_password_hash("mediator123"),
                display_name="Test Mediator",
                role="mediator",
                tenant_id=tenant.id,
            )
            session.add(mediator)
            await session.flush()
            print("Seeded: tenant, super_admin (admin@mediationfocus.co.ke / admin123), mediator (mediator@mediationfocus.co.ke / mediator123)")

        # Phase 5: Seed induction modules (if none exist)
        mod_result = await session.execute(select(TrainingModule).limit(1))
        if not mod_result.scalar_one_or_none():
            modules_data = [
                (
                    "orientation",
                    "Orientation",
                    "Welcome to the Mediation Intelligence Platform. Learn the basics of the system.",
                    """<h2>Welcome to the Platform</h2>
<p>This platform supports mediators across Kenya and beyond with case management, online sessions, and AI-assisted tools. Understanding its structure helps you maintain neutrality and efficiency.</p>
<h3>Key features</h3>
<ul><li><strong>Case management</strong> — Track disputes from intake through resolution</li>
<li><strong>Online mediation</strong> — Secure video sessions with built-in documentation</li>
<li><strong>Knowledge base</strong> — Access Kenya's mediation framework and best practices</li>
<li><strong>CPD tracking</strong> — Log your continuing professional development</li></ul>
<h3>Your role</h3>
<p>As a mediator, you remain neutral while facilitating dialogue. The platform is a tool—your judgment, ethics, and skill drive outcomes. Use it to support parties, not to replace your professional discretion.</p>""",
                ),
                (
                    "ethics",
                    "Ethics in Mediation",
                    "Core ethical principles: neutrality, confidentiality, informed consent.",
                    """<h2>Ethics in Mediation</h2>
<p>Mediation rests on trust. Parties must believe you are neutral, that their words stay confidential, and that they participate voluntarily with full understanding.</p>
<h3>Neutrality</h3>
<p>You do not take sides. You do not advise. You facilitate dialogue so parties can find their own solutions. If you cannot remain neutral—e.g. due to a conflict of interest—you must withdraw.</p>
<h3>Confidentiality</h3>
<p>What is said in mediation stays in mediation, unless the law requires disclosure (e.g. child protection, imminent harm) or parties agree otherwise. Explain this clearly at the outset.</p>
<h3>Informed consent</h3>
<p>Parties must understand the process, their rights, and that they can withdraw at any time. Adapt your explanation to their literacy and context. In Kenya, cultural norms may affect how consent is expressed—ensure it is genuine.</p>
<h3>Power imbalance</h3>
<p>Employment, family, and commercial disputes often involve unequal power. Your role is to create space for both parties to be heard. Consider caucuses, ground rules, and referrals when appropriate.</p>""",
                ),
                (
                    "online_mediation_intro",
                    "Online Mediation Intro",
                    "Best practices for conducting mediation sessions online.",
                    """<h2>Online Mediation</h2>
<p>Online mediation has become essential. It offers flexibility and access, but also poses unique challenges for rapport, non-verbal cues, and technical reliability.</p>
<h3>Before the session</h3>
<ul><li>Confirm both parties have stable internet and a quiet, private space</li>
<li>Send a short tech checklist (camera, mic, browser)</li>
<li>Agree on a backup plan (phone, reschedule) if connection fails</li></ul>
<h3>During the session</h3>
<ul><li>Set ground rules: one person speaks at a time, no recording without consent</li>
<li>Check in regularly: "Can you both hear clearly?"</li>
<li>Compensate for limited non-verbal cues: invite parties to name their emotions, use pauses</li>
<li>Use breakout rooms (or separate calls) for caucuses when needed</li></ul>
<h3>Documentation</h3>
<p>Record outcomes, not the dialogue. Ensure parties understand what will be documented and who has access. Align with your jurisdiction's requirements for online mediation.</p>""",
                ),
            ]
            for i, (slug, title, desc, content) in enumerate(modules_data):
                mod = TrainingModule(
                    tenant_id=tenant.id,
                    slug=slug,
                    title=title,
                    description=desc,
                    content_html=content,
                    order_index=i,
                )
                session.add(mod)
            await session.flush()
            print("Seeded: 3 training modules")

        # Seed interactive configs for modules (branching, different experiences, same outcomes)
        cfg_result = await session.execute(select(TrainingModuleConfig).limit(1))
        if not cfg_result.scalar_one_or_none():
            mods = (await session.execute(select(TrainingModule).where(TrainingModule.slug.in_(["ethics", "orientation", "online_mediation_intro"])))).scalars().all()
            for mod in mods:
                if mod.slug == "ethics":
                    config = {
                        "steps": [
                            {"id": "intro", "type": "content", "content": "<p>Mediation rests on trust. Parties must believe you are neutral, that their words stay confidential, and that they participate voluntarily.</p>", "next": "s1"},
                            {"id": "s1", "type": "scenario", "scenario": "A party reveals something in confidence, then the other party demands to know what was said. They say: 'If you're neutral, you have to tell me.'", "question": "What would you do?", "choices": [
                                {"text": "Explain that confidentiality applies to both parties and you cannot disclose", "next": "out1", "feedback": "Correct. Confidentiality protects the process. You can acknowledge the other party's frustration without revealing content."},
                                {"text": "Suggest a caucus to discuss with each party separately", "next": "out2", "feedback": "A caucus can help. You might use it to clarify ground rules or to explore whether the first party is willing to share—but never without their consent."},
                                {"text": "Share a general summary that doesn't reveal specifics", "next": "out2", "feedback": "Even summaries can breach confidence. Unless the first party explicitly consents, do not share. Redirect to interests instead."},
                            ]},
                            {"id": "out1", "type": "content", "content": "<p><strong>Key takeaway:</strong> Confidentiality is non-negotiable unless the law requires disclosure (e.g. child protection, imminent harm) or parties agree. Consult your jurisdiction's regulations for specifics.</p>", "next": "outro"},
                            {"id": "out2", "type": "content", "content": "<p><strong>Key takeaway:</strong> Confidentiality protects the process. Use caucuses to clarify, never to leak. When in doubt, err on the side of protecting what was shared.</p>", "next": "outro"},
                            {"id": "outro", "type": "content", "content": "<p>All paths lead to the same principle: maintain confidentiality unless disclosure is legally required or explicitly consented to.</p>"},
                        ],
                        "learning_outcomes": ["confidentiality", "neutrality"],
                    }
                elif mod.slug == "orientation":
                    config = {
                        "steps": [
                            {"id": "intro", "type": "content", "content": "<p>This platform supports mediators with case management, online sessions, and tools. Your judgment drives outcomes—the platform supports, it does not replace.</p>", "next": "s1"},
                            {"id": "s1", "type": "scenario", "scenario": "You're setting up a new case. The system asks for dispute type and party details.", "question": "How do you approach data entry?", "choices": [
                                {"text": "Enter only what's necessary for the case file", "next": "out1", "feedback": "Good practice. Collect what you need; avoid unnecessary PII."},
                                {"text": "Add detailed notes from the intake call", "next": "out2", "feedback": "Notes help—but ensure they're factual and not biased. Future mediators may read them."},
                                {"text": "Skip the system and use your own notes", "next": "out2", "feedback": "Using the platform keeps records consistent and supports handover. Balance your workflow with organizational needs."},
                            ]},
                            {"id": "out1", "type": "content", "content": "<p><strong>Key takeaway:</strong> Use the platform to support your practice. Enter what serves the case; protect party privacy.</p>", "next": "outro"},
                            {"id": "out2", "type": "content", "content": "<p><strong>Key takeaway:</strong> The platform is a tool. Your ethics and discretion guide how you use it.</p>", "next": "outro"},
                            {"id": "outro", "type": "content", "content": "<p>You've completed this module. The platform supports neutrality and efficiency—you remain in control.</p>"},
                        ],
                        "learning_outcomes": ["platform_use", "privacy"],
                    }
                else:
                    config = {
                        "steps": [
                            {"id": "intro", "type": "content", "content": "<p>Online mediation offers flexibility but poses challenges for rapport and non-verbal cues.</p>", "next": "s1"},
                            {"id": "s1", "type": "scenario", "scenario": "A party's video freezes mid-sentence. They're clearly frustrated.", "question": "What do you do?", "choices": [
                                {"text": "Pause and check if everyone can hear and see", "next": "out1", "feedback": "Good. Technical issues affect trust. Address them calmly."},
                                {"text": "Ask them to rejoin and continue", "next": "out2", "feedback": "Rejoining may help, but acknowledge the disruption. A brief check-in maintains rapport."},
                                {"text": "Suggest switching to phone as backup", "next": "out2", "feedback": "Having a backup plan is best practice. Document the switch for the record."},
                            ]},
                            {"id": "out1", "type": "content", "content": "<p><strong>Key takeaway:</strong> Technical reliability affects trust. Check in regularly; have a backup plan.</p>", "next": "outro"},
                            {"id": "out2", "type": "content", "content": "<p><strong>Key takeaway:</strong> Adapt when tech fails. Document changes; keep parties informed.</p>", "next": "outro"},
                            {"id": "outro", "type": "content", "content": "<p>Online mediation requires extra attention to connection—both technical and human.</p>"},
                        ],
                        "learning_outcomes": ["online_best_practices"],
                    }
                session.add(TrainingModuleConfig(module_id=mod.id, config_json=config))
            print("Seeded: interactive module configs")

        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
