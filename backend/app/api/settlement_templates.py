"""Settlement agreement templates - Phase 6a."""

FAMILY_TEMPLATE = {
    "title": "Family Mediation Settlement Agreement",
    "sections": [
        {
            "id": "parties",
            "title": "Parties",
            "content": "This agreement is entered into between the parties identified in the case file.",
        },
        {
            "id": "terms",
            "title": "Terms of Settlement",
            "content": "The parties agree to the following terms as resolved through mediation.",
        },
        {
            "id": "custody",
            "title": "Custody and Access (if applicable)",
            "content": "[To be completed based on mediation outcome]",
        },
        {
            "id": "support",
            "title": "Child/Spousal Support (if applicable)",
            "content": "[To be completed based on mediation outcome]",
        },
        {
            "id": "acknowledgment",
            "title": "Acknowledgment",
            "content": "The parties acknowledge that they have read and understood this agreement and sign voluntarily.",
        },
    ],
}

COMMERCIAL_TEMPLATE = {
    "title": "Commercial Mediation Settlement Agreement",
    "sections": [
        {
            "id": "parties",
            "title": "Parties",
            "content": "This agreement is entered into between the parties identified in the case file.",
        },
        {
            "id": "dispute",
            "title": "Dispute Summary",
            "content": "[Brief description of the commercial dispute]",
        },
        {
            "id": "terms",
            "title": "Settlement Terms",
            "content": "The parties agree to the following terms as resolved through mediation.",
        },
        {
            "id": "payment",
            "title": "Payment/Performance",
            "content": "[Payment schedule or performance obligations]",
        },
        {
            "id": "confidentiality",
            "title": "Confidentiality",
            "content": "The parties agree to keep the terms of this settlement confidential.",
        },
        {
            "id": "acknowledgment",
            "title": "Acknowledgment",
            "content": "The parties acknowledge that they have read and understood this agreement and sign voluntarily.",
        },
    ],
}

EMPLOYMENT_TEMPLATE = {
    "title": "Employment Mediation Settlement Agreement",
    "sections": [
        {
            "id": "parties",
            "title": "Parties",
            "content": "This agreement is entered into between the employer and employee identified in the case file.",
        },
        {
            "id": "dispute",
            "title": "Dispute Summary",
            "content": "[Brief description of the employment dispute]",
        },
        {
            "id": "terms",
            "title": "Settlement Terms",
            "content": "The parties agree to the following terms as resolved through mediation.",
        },
        {
            "id": "severance",
            "title": "Severance/Compensation (if applicable)",
            "content": "[To be completed based on mediation outcome]",
        },
        {
            "id": "references",
            "title": "References and Non-Disparagement (if applicable)",
            "content": "[To be completed based on mediation outcome]",
        },
        {
            "id": "acknowledgment",
            "title": "Acknowledgment",
            "content": "The parties acknowledge that they have read and understood this agreement and sign voluntarily.",
        },
    ],
}

TEMPLATES = {
    "family": FAMILY_TEMPLATE,
    "commercial": COMMERCIAL_TEMPLATE,
    "employment": EMPLOYMENT_TEMPLATE,
}
