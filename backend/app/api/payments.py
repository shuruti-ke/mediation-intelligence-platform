"""Payment orchestrator - Phase 4. Stripe, M-Pesa Daraja."""
import asyncio
import base64
import re
import uuid
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User
from app.models.payment import Invoice, PaymentTransaction
from app.models.case import Case, CaseParty

router = APIRouter(prefix="/payments", tags=["payments"])

MPESA_SANDBOX_AUTH = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
MPESA_SANDBOX_STK = "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest"
MPESA_LIVE_AUTH = "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials"
MPESA_LIVE_STK = "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest"


def _normalize_phone(phone: str) -> str:
    """Normalize to 254XXXXXXXXX format."""
    digits = re.sub(r"\D", "", phone)
    if digits.startswith("0"):
        digits = "254" + digits[1:]
    elif not digits.startswith("254"):
        digits = "254" + digits
    return digits[:12]


def generate_invoice_number(tenant_id: uuid.UUID) -> str:
    """Generate unique invoice number: INV-YYYY-NNNN."""
    year = datetime.utcnow().year
    return f"INV-{year}-{uuid.uuid4().hex[:6].upper()}"


class InvoiceCreate(BaseModel):
    amount_minor_units: int  # cents or equivalent
    currency: str = "KES"
    description: str
    case_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None  # Client to bill (for client-scoped invoices)


class PaymentInitRequest(BaseModel):
    invoice_id: uuid.UUID
    provider: str  # mpesa, stripe
    phone: str | None = None  # For M-Pesa STK Push


@router.post("/invoices")
async def create_invoice(
    data: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Create invoice. Phase 4: Stripe + M-Pesa integration pending."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant required")

    invoice = Invoice(
        tenant_id=user.tenant_id,
        user_id=data.user_id,
        case_id=data.case_id,
        invoice_number=generate_invoice_number(user.tenant_id),
        amount_minor_units=data.amount_minor_units,
        currency_code=data.currency,
        status="PENDING",
        description_json={"line_items": [{"description": data.description}]},
    )
    db.add(invoice)
    await db.flush()
    await db.refresh(invoice)
    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "amount": data.amount_minor_units / 100,
        "currency": data.currency,
        "status": "PENDING",
    }


@router.post("/init")
async def init_payment(
    data: PaymentInitRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Initiate payment. M-Pesa STK Push or Stripe Checkout."""
    result = await db.execute(select(Invoice).where(Invoice.id == data.invoice_id))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.tenant_id != user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    is_client = user.role in ("client_individual", "client_corporate")
    if is_client:
        if invoice.user_id != user.id:
            cp = await db.execute(select(CaseParty).where(CaseParty.case_id == invoice.case_id, CaseParty.user_id == user.id))
            if not invoice.case_id or not cp.scalar_one_or_none():
                raise HTTPException(status_code=403, detail="Access denied")
    if invoice.status == "PAID":
        raise HTTPException(status_code=400, detail="Invoice already paid")

    txn = PaymentTransaction(
        invoice_id=invoice.id,
        provider="MPESA_DARAJA" if data.provider == "mpesa" else "STRIPE",
        amount_minor_units=invoice.amount_minor_units,
        currency_code=invoice.currency_code,
        status="INITIATED",
    )
    db.add(txn)
    await db.flush()

    settings = get_settings()

    # M-Pesa STK Push when mpesa + phone provided and credentials present
    if data.provider == "mpesa" and data.phone:
        if settings.m_pesa_consumer_key and settings.m_pesa_consumer_secret and settings.m_pesa_passkey:
            try:
                stk_result = await _mpesa_stk_push(
                    phone=data.phone,
                    amount_kes=invoice.amount_minor_units // 100,
                    account_ref=invoice.invoice_number[:12],
                    txn_id=str(txn.id),
                )
                if stk_result:
                    txn.provider_response_json = stk_result
                    txn.status = "PENDING_USER_PIN"
                    await db.flush()
                    return {
                        "transaction_id": str(txn.id),
                        "status": "PENDING_USER_PIN",
                        "message": "Enter PIN on your phone to complete payment.",
                        "provider": "mpesa",
                    }
            except Exception as e:
                txn.status = "FAILED"
                txn.failure_reason = str(e)
                await db.flush()
                raise HTTPException(status_code=502, detail=f"M-Pesa STK Push failed: {e}")
        # Stub when credentials missing
        return {
            "transaction_id": str(txn.id),
            "status": "PENDING_USER_PIN",
            "message": "Enter PIN on your phone to complete payment.",
            "provider": "mpesa",
        }

    # Stripe Checkout when stripe and credentials present
    if data.provider == "stripe":
        if settings.stripe_secret_key:
            try:
                checkout_url = await _stripe_checkout_session(
                    invoice=invoice,
                    txn_id=str(txn.id),
                )
                if checkout_url:
                    txn.status = "PENDING"
                    await db.flush()
                    return {
                        "transaction_id": str(txn.id),
                        "status": "PENDING",
                        "checkout_url": checkout_url,
                        "provider": "stripe",
                    }
            except Exception as e:
                txn.status = "FAILED"
                txn.failure_reason = str(e)
                await db.flush()
                raise HTTPException(status_code=502, detail=f"Stripe checkout failed: {e}")
        # Stub when credentials missing
        return {
            "transaction_id": str(txn.id),
            "status": "PENDING",
            "checkout_url": f"/pay/checkout/{txn.id}",
            "provider": "stripe",
        }

    return {"transaction_id": str(txn.id), "status": "INITIATED", "provider": data.provider}


async def _mpesa_stk_push(
    phone: str,
    amount_kes: int,
    account_ref: str,
    txn_id: str,
) -> dict | None:
    """Call M-Pesa Daraja STK Push. Returns response JSON or None."""
    settings = get_settings()
    auth_url = MPESA_SANDBOX_AUTH
    stk_url = MPESA_SANDBOX_STK
    if not settings.m_pesa_callback_url:
        return None
    # Get OAuth token
    auth_str = base64.b64encode(
        f"{settings.m_pesa_consumer_key}:{settings.m_pesa_consumer_secret}".encode()
    ).decode()
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            auth_url,
            headers={"Authorization": f"Basic {auth_str}"},
        )
        resp.raise_for_status()
        token_data = resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return None
        # Build STK Push payload
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        password_str = f"{settings.m_pesa_shortcode}{settings.m_pesa_passkey}{timestamp}"
        password_b64 = base64.b64encode(password_str.encode()).decode()
        payload = {
            "BusinessShortCode": settings.m_pesa_shortcode,
            "Password": password_b64,
            "Timestamp": timestamp,
            "TransactionType": "CustomerPayBillOnline",
            "Amount": amount_kes,
            "PartyA": _normalize_phone(phone),
            "PartyB": settings.m_pesa_shortcode,
            "PhoneNumber": _normalize_phone(phone),
            "CallBackURL": settings.m_pesa_callback_url,
            "AccountReference": account_ref[:12],
            "TransactionDesc": "Mediation",
        }
        stk_resp = await client.post(
            stk_url,
            headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
            json=payload,
        )
        stk_resp.raise_for_status()
        return stk_resp.json()


async def _stripe_checkout_session(invoice: Invoice, txn_id: str) -> str | None:
    """Create Stripe Checkout session. Returns checkout URL or None."""
    import stripe
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key
    base = settings.frontend_base_url.rstrip("/")
    desc = "Mediation services"
    if invoice.description_json and isinstance(invoice.description_json, dict):
        items = invoice.description_json.get("line_items") or []
        if items and isinstance(items[0], dict):
            desc = items[0].get("description") or desc

    def _create():
        return stripe.checkout.Session.create(
        payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": invoice.currency_code.lower(),
                        "product_data": {
                            "name": f"Invoice {invoice.invoice_number}",
                            "description": desc,
                        },
                        "unit_amount": invoice.amount_minor_units,
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=f"{base}/payments/success?session_id={{CHECKOUT_SESSION_ID}}&txn_id={txn_id}",
            cancel_url=f"{base}/payments/cancel?txn_id={txn_id}",
            metadata={"invoice_id": str(invoice.id), "txn_id": txn_id},
        )

    session = await asyncio.to_thread(_create)
    return session.url if session else None


@router.post("/webhooks/mpesa")
async def mpesa_webhook() -> dict:
    """M-Pesa Daraja callback. Verify signature, update transaction."""
    # TODO: Verify callback, parse result, update PaymentTransaction
    return {"status": "ok"}


@router.get("/invoices")
async def list_invoices(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
    status: str | None = None,
    user_id: uuid.UUID | None = None,  # Admin/mediator: filter by client
) -> list:
    """List invoices. Clients see only their own; admins/mediators see tenant invoices."""
    is_client = user.role in ("client_individual", "client_corporate")
    q = select(Invoice).where(Invoice.tenant_id == user.tenant_id)
    if is_client:
        client_cases = select(CaseParty.case_id).where(CaseParty.user_id == user.id)
        q = q.where(or_(
            Invoice.user_id == user.id,
            and_(Invoice.case_id.isnot(None), Invoice.case_id.in_(client_cases)),
        ))
    elif user_id:
        q = q.where(Invoice.user_id == user_id)
    if status:
        q = q.where(Invoice.status == status)
    q = q.order_by(Invoice.created_at.desc()).limit(50)
    result = await db.execute(q)
    invoices = result.scalars().all()
    return [
        {
            "id": str(i.id),
            "invoice_number": i.invoice_number,
            "amount": i.amount_minor_units / 100,
            "currency": i.currency_code,
            "status": i.status,
            "created_at": i.created_at.isoformat(),
        }
        for i in invoices
    ]


@router.get("/account-summary")
async def get_account_summary(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Balance due, total paid, invoice counts. For clients and admins."""
    from sqlalchemy import func
    is_client = user.role in ("client_individual", "client_corporate")
    base = select(Invoice).where(Invoice.tenant_id == user.tenant_id)
    if is_client:
        client_cases = select(CaseParty.case_id).where(CaseParty.user_id == user.id)
        base = base.where(or_(
            Invoice.user_id == user.id,
            and_(Invoice.case_id.isnot(None), Invoice.case_id.in_(client_cases)),
        ))
    pending_q = select(func.coalesce(func.sum(Invoice.amount_minor_units), 0)).select_from(Invoice).where(
        Invoice.tenant_id == user.tenant_id, Invoice.status == "PENDING"
    )
    if is_client:
        client_cases = select(CaseParty.case_id).where(CaseParty.user_id == user.id)
        pending_q = pending_q.where(or_(
            Invoice.user_id == user.id,
            and_(Invoice.case_id.isnot(None), Invoice.case_id.in_(client_cases)),
        ))
    pending_minor = (await db.execute(pending_q)).scalar() or 0
    paid_q = select(func.coalesce(func.sum(Invoice.amount_minor_units), 0)).select_from(Invoice).where(
        Invoice.tenant_id == user.tenant_id, Invoice.status == "PAID"
    )
    if is_client:
        client_cases = select(CaseParty.case_id).where(CaseParty.user_id == user.id)
        paid_q = paid_q.where(or_(
            Invoice.user_id == user.id,
            and_(Invoice.case_id.isnot(None), Invoice.case_id.in_(client_cases)),
        ))
    paid_minor = (await db.execute(paid_q)).scalar() or 0
    count_q = select(func.count(Invoice.id)).select_from(Invoice).where(Invoice.tenant_id == user.tenant_id)
    if is_client:
        client_cases = select(CaseParty.case_id).where(CaseParty.user_id == user.id)
        count_q = count_q.where(or_(
            Invoice.user_id == user.id,
            and_(Invoice.case_id.isnot(None), Invoice.case_id.in_(client_cases)),
        ))
    total_count = (await db.execute(count_q)).scalar() or 0
    pending_count_q = select(func.count(Invoice.id)).select_from(Invoice).where(
        Invoice.tenant_id == user.tenant_id, Invoice.status == "PENDING"
    )
    if is_client:
        client_cases = select(CaseParty.case_id).where(CaseParty.user_id == user.id)
        pending_count_q = pending_count_q.where(or_(
            Invoice.user_id == user.id,
            and_(Invoice.case_id.isnot(None), Invoice.case_id.in_(client_cases)),
        ))
    pending_count = (await db.execute(pending_count_q)).scalar() or 0
    return {
        "balance_due": pending_minor / 100,
        "total_paid": paid_minor / 100,
        "invoices_total": total_count,
        "invoices_pending": pending_count,
    }
