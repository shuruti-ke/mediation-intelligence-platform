"""Payment orchestrator - Phase 4. Stripe, M-Pesa Daraja, manual receipting."""
import asyncio
import base64
import re
import uuid
from pathlib import Path
from datetime import datetime

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func

from app.api.deps import get_current_user, require_role
from app.core.config import get_settings
from app.core.database import get_db
from app.models.tenant import User, Tenant
from app.models.payment import Service, Invoice, PaymentTransaction, PaymentReceipt
from app.models.case import Case, CaseParty

router = APIRouter(prefix="/payments", tags=["payments"])

PAYMENT_METHODS = ("MPESA", "CASH", "CHEQUE", "EFT_RTGS")

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


class LineItemCreate(BaseModel):
    description: str
    quantity: float = 1.0
    unit_price_minor: int  # per unit in minor units (cents)


class InvoiceCreate(BaseModel):
    amount_minor_units: int  # total in minor units (cents)
    currency: str = "KES"
    description: str  # summary/purpose
    purpose: str | None = None  # e.g. mediation_session, consultation, retainer
    due_date: str | None = None  # YYYY-MM-DD
    case_id: uuid.UUID | None = None
    user_id: uuid.UUID | None = None  # Client to bill (or mediator for platform invoices)
    line_items: list[LineItemCreate] | None = None  # itemized breakdown
    invoice_type: str = "client"  # platform | client
    mediator_id: uuid.UUID | None = None  # For client invoices: earning mediator


class PaymentInitRequest(BaseModel):
    invoice_id: uuid.UUID
    provider: str  # mpesa, stripe
    phone: str | None = None  # For M-Pesa STK Push


class ServiceCreate(BaseModel):
    name: str
    description: str | None = None
    price_minor: int
    currency: str = "KES"
    service_type: str = "mediation"  # platform | mediation


class ServiceUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    price_minor: int | None = None
    currency: str | None = None
    is_active: bool | None = None
    service_type: str | None = None


# ─── Services CRUD (super_admin only) ────────────────────────────────────────

@router.get("/services")
async def list_services(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> list:
    """List all services for the tenant. Mediators need this for Create Invoice."""
    if not user.tenant_id:
        return []
    result = await db.execute(
        select(Service).where(Service.tenant_id == user.tenant_id).order_by(Service.name)
    )
    services = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "name": s.name,
            "description": s.description,
            "price_minor": s.price_minor,
            "price": s.price_minor / 100,
            "currency": s.currency,
            "is_active": s.is_active,
            "service_type": getattr(s, "service_type", None) or "mediation",
        }
        for s in services
    ]


@router.post("/services")
async def create_service(
    data: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Create a new service."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant required")
    svc_type = (data.service_type or "mediation").lower()
    if svc_type not in ("platform", "mediation"):
        svc_type = "mediation"
    svc = Service(
        tenant_id=user.tenant_id,
        service_type=svc_type,
        name=data.name,
        description=data.description,
        price_minor=data.price_minor,
        currency=data.currency,
    )
    db.add(svc)
    await db.flush()
    await db.refresh(svc)
    return {
        "id": str(svc.id),
        "name": svc.name,
        "description": svc.description,
        "price_minor": svc.price_minor,
        "price": svc.price_minor / 100,
        "currency": svc.currency,
        "is_active": svc.is_active,
    }


@router.put("/services/{service_id}")
async def update_service(
    service_id: uuid.UUID,
    data: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Update a service."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant required")
    result = await db.execute(
        select(Service).where(Service.id == service_id, Service.tenant_id == user.tenant_id)
    )
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    if data.name is not None:
        svc.name = data.name
    if data.description is not None:
        svc.description = data.description
    if data.price_minor is not None:
        svc.price_minor = data.price_minor
    if data.currency is not None:
        svc.currency = data.currency
    if data.is_active is not None:
        svc.is_active = data.is_active
    if data.service_type is not None:
        st = data.service_type.lower()
        if st in ("platform", "mediation"):
            svc.service_type = st
    await db.flush()
    await db.refresh(svc)
    return {
        "id": str(svc.id),
        "name": svc.name,
        "description": svc.description,
        "price_minor": svc.price_minor,
        "price": svc.price_minor / 100,
        "currency": svc.currency,
        "is_active": svc.is_active,
    }


@router.delete("/services/{service_id}")
async def delete_service(
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Deactivate a service."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant required")
    result = await db.execute(
        select(Service).where(Service.id == service_id, Service.tenant_id == user.tenant_id)
    )
    svc = result.scalar_one_or_none()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    svc.is_active = False
    await db.flush()
    return {"ok": True}


# ─── Billable users search (mediators, clients, trainees) ────────────────────

@router.get("/billable-users")
async def search_billable_users(
    q: str | None = Query(None, description="Search by name, email, user_id"),
    role: str | None = Query(None, description="Filter: mediator, client_individual, client_corporate, trainee"),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> list:
    """Search users for invoicing: mediators, clients, trainees."""
    if not user.tenant_id:
        return []
    roles = ["mediator", "client_individual", "client_corporate", "trainee"]
    if role and role in roles:
        roles = [role]
    qry = select(User).where(User.tenant_id == user.tenant_id, User.is_active == True)
    qry = qry.where(User.role.in_(roles))
    if q and len(q.strip()) >= 1:
        term = f"%{q.strip()}%"
        conds = [User.email.ilike(term), User.display_name.ilike(term)]
        if hasattr(User, "user_id"):
            conds.append(User.user_id.ilike(term))
        if hasattr(User, "phone"):
            conds.append(User.phone.ilike(term))
        qry = qry.where(or_(*conds))
    qry = qry.order_by(User.display_name.asc().nullslast()).limit(limit)
    result = await db.execute(qry)
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "user_id": getattr(u, "user_id", None),
            "display_name": u.display_name or u.email,
            "email": u.email,
            "phone": getattr(u, "phone", None),
            "country": getattr(u, "country", None),
            "role": u.role,
        }
        for u in users
    ]


@router.post("/invoices")
async def create_invoice(
    data: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Create invoice. Phase 4: Stripe + M-Pesa integration pending."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant required")

    due_dt = None
    if data.due_date:
        try:
            from datetime import datetime as dt
            due_dt = dt.strptime(data.due_date, "%Y-%m-%d")
        except ValueError:
            pass
    line_items_data = []
    if data.line_items:
        for li in data.line_items:
            line_items_data.append({
                "description": li.description,
                "quantity": li.quantity,
                "unit_price_minor": li.unit_price_minor,
                "amount_minor": int(li.quantity * li.unit_price_minor),
            })
    else:
        line_items_data = [{"description": data.description, "quantity": 1, "unit_price_minor": data.amount_minor_units, "amount_minor": data.amount_minor_units}]

    # invoice_type: platform (mediator pays platform) | client (client pays mediator)
    invoice_type = (data.invoice_type or "client").lower()
    if invoice_type not in ("platform", "client"):
        invoice_type = "client"
    mediator_id_val = data.mediator_id
    if user.role == "mediator":
        # Mediator creating invoice for client: always client type, mediator earns
        invoice_type = "client"
        mediator_id_val = user.id
    elif user.role == "super_admin" and invoice_type == "platform":
        mediator_id_val = None  # Platform invoice: user_id is the mediator being billed

    invoice = Invoice(
        tenant_id=user.tenant_id,
        invoice_type=invoice_type,
        mediator_id=mediator_id_val,
        user_id=data.user_id,
        case_id=data.case_id,
        invoice_number=generate_invoice_number(user.tenant_id),
        amount_minor_units=data.amount_minor_units,
        currency_code=data.currency,
        status="PENDING",
        due_date=due_dt,
        description_json={
            "purpose": data.purpose or "mediation_services",
            "summary": data.description,
            "line_items": line_items_data,
        },
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


class InvoiceUpdate(BaseModel):
    invoice_type: str | None = None  # platform | client
    mediator_id: uuid.UUID | None = None  # For client invoices


@router.patch("/invoices/{invoice_id}")
async def update_invoice(
    invoice_id: uuid.UUID,
    data: InvoiceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Update invoice type and mediator_id after creation. Super-admin only."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant required")
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == user.tenant_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if data.invoice_type is not None:
        it = data.invoice_type.lower()
        if it not in ("platform", "client"):
            raise HTTPException(status_code=400, detail="invoice_type must be platform or client")
        inv.invoice_type = it
        if it == "platform":
            inv.mediator_id = None
        else:
            inv.mediator_id = data.mediator_id
    await db.flush()
    await db.refresh(inv)
    return {
        "id": str(inv.id),
        "invoice_number": inv.invoice_number,
        "invoice_type": getattr(inv, "invoice_type", None) or "client",
        "mediator_id": str(inv.mediator_id) if inv.mediator_id else None,
    }


@router.get("/invoices/{invoice_id}/payments")
async def list_invoice_payments(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> list:
    """List payment receipts for an invoice."""
    if not user.tenant_id:
        return []
    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == user.tenant_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    result = await db.execute(
        select(PaymentReceipt).where(PaymentReceipt.invoice_id == invoice_id).order_by(PaymentReceipt.received_at.desc())
    )
    receipts = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "method": r.method,
            "amount_minor_units": r.amount_minor_units,
            "amount": r.amount_minor_units / 100,
            "currency": r.currency_code,
            "reference": r.reference,
            "has_attachment": bool(r.attachment_path),
            "received_at": r.received_at.isoformat() if r.received_at else None,
        }
        for r in receipts
    ]


@router.post("/invoices/{invoice_id}/payments")
async def record_payment(
    invoice_id: uuid.UUID,
    method: str = Form(..., description="MPESA, CASH, CHEQUE, or EFT_RTGS"),
    amount_minor_units: int = Form(..., description="Amount in minor units (cents)"),
    currency: str = Form("KES"),
    reference: str | None = Form(None, description="M-Pesa code, cheque number, or bank reference"),
    attachment: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
) -> dict:
    """Record a payment received against an invoice. Updates invoice status to PAID when fully paid."""
    method_upper = (method or "").strip().upper()
    if method_upper not in PAYMENT_METHODS:
        raise HTTPException(status_code=400, detail=f"method must be one of: {', '.join(PAYMENT_METHODS)}")

    result = await db.execute(select(Invoice).where(Invoice.id == invoice_id, Invoice.tenant_id == user.tenant_id))
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if inv.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Cannot record payment for cancelled invoice")
    if amount_minor_units <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    attachment_path = None
    attachment_name = None
    settings = get_settings()
    upload_dir = Path(settings.storage_path) / "payment_receipts"
    if attachment and attachment.filename:
        ext = Path(attachment.filename).suffix.lower()
        if ext not in {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"}:
            raise HTTPException(status_code=400, detail="Attachment must be PDF or image")
        upload_dir.mkdir(parents=True, exist_ok=True)
        file_id = uuid.uuid4().hex
        storage_path = str(upload_dir / f"{file_id}{ext}")
        content = await attachment.read()
        if len(content) > 10 * 1024 * 1024:  # 10MB
            raise HTTPException(status_code=413, detail="File too large (max 10MB)")
        with open(storage_path, "wb") as f:
            f.write(content)
        attachment_path = storage_path
        attachment_name = Path(attachment.filename).name

    receipt = PaymentReceipt(
        invoice_id=invoice_id,
        tenant_id=user.tenant_id,
        method=method_upper,
        amount_minor_units=amount_minor_units,
        currency_code=currency or "KES",
        reference=(reference or "").strip() or None,
        attachment_path=attachment_path,
        attachment_original_name=attachment_name,
        received_by_user_id=user.id,
    )
    db.add(receipt)
    await db.flush()

    total_paid = (
        await db.execute(
            select(func.coalesce(func.sum(PaymentReceipt.amount_minor_units), 0)).where(
                PaymentReceipt.invoice_id == invoice_id
            )
        )
    )
    total_paid_val = total_paid.scalar() or 0
    if total_paid_val >= inv.amount_minor_units:
        inv.status = "PAID"
    await db.flush()

    return {
        "id": str(receipt.id),
        "method": receipt.method,
        "amount_minor_units": receipt.amount_minor_units,
        "amount": receipt.amount_minor_units / 100,
        "currency": receipt.currency_code,
        "reference": receipt.reference,
        "has_attachment": bool(receipt.attachment_path),
        "received_at": receipt.received_at.isoformat() if receipt.received_at else None,
        "invoice_status": inv.status,
    }


@router.get("/receipts/{receipt_id}/attachment")
async def get_payment_attachment(
    receipt_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin", "mediator")),
):
    """Download payment attachment (cheque image or transaction proof)."""
    if not user.tenant_id:
        raise HTTPException(status_code=403, detail="Access denied")
    result = await db.execute(
        select(PaymentReceipt).where(PaymentReceipt.id == receipt_id, PaymentReceipt.tenant_id == user.tenant_id)
    )
    receipt = result.scalar_one_or_none()
    if not receipt:
        raise HTTPException(status_code=404, detail="Payment not found")
    if not receipt.attachment_path:
        raise HTTPException(status_code=404, detail="No attachment for this payment")
    path = Path(receipt.attachment_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Attachment file not found")
    return FileResponse(
        path,
        filename=receipt.attachment_original_name or "attachment",
        media_type="application/octet-stream",
    )


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
    user_ids = {i.user_id for i in invoices if i.user_id}
    users_map = {}
    if user_ids:
        u_result = await db.execute(select(User).where(User.id.in_(user_ids)))
        for u in u_result.scalars().all():
            users_map[u.id] = u
    # Sum payments per invoice
    invoice_ids = [i.id for i in invoices]
    paid_q = (
        select(PaymentReceipt.invoice_id, func.sum(PaymentReceipt.amount_minor_units).label("total"))
        .where(PaymentReceipt.invoice_id.in_(invoice_ids))
        .group_by(PaymentReceipt.invoice_id)
    )
    paid_result = await db.execute(paid_q)
    paid_map = {row.invoice_id: (row.total or 0) / 100 for row in paid_result.all()}

    out = []
    for i in invoices:
        u = users_map.get(i.user_id) if i.user_id else None
        total_paid = paid_map.get(i.id, 0)
        out.append({
            "id": str(i.id),
            "invoice_number": i.invoice_number,
            "invoice_type": getattr(i, "invoice_type", None) or "client",
            "user_id": str(i.user_id) if i.user_id else None,
            "user_name": u.display_name if u else None,
            "user_email": u.email if u else None,
            "amount": i.amount_minor_units / 100,
            "currency": i.currency_code,
            "status": i.status,
            "total_paid": total_paid,
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "created_at": i.created_at.isoformat(),
        })
    return out


class PlatformCommissionUpdate(BaseModel):
    platform_commission_pct: float = 0


@router.patch("/platform-commission")
async def update_platform_commission(
    data: PlatformCommissionUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Update platform commission % in tenant commercial_config."""
    if not user.tenant_id:
        raise HTTPException(status_code=400, detail="Tenant required")
    pct = max(0, min(100, data.platform_commission_pct))
    result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    commercial = dict(tenant.commercial_config or {})
    commercial["platform_commission_pct"] = pct
    tenant.commercial_config = commercial
    await db.flush()
    return {"platform_commission_pct": pct}


@router.get("/reconciliation")
async def get_reconciliation(
    mediator_id: uuid.UUID | None = Query(None, description="Filter by mediator for per-mediator payout"),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role("super_admin")),
) -> dict:
    """Two-tier reconciliation: funds from clients, funds from mediator (platform fees), mediator payout owed."""
    if not user.tenant_id:
        return {
            "funds_from_clients": 0,
            "funds_from_mediator": 0,
            "platform_commission_pct": 0,
            "platform_commission_amount": 0,
            "unpaid_platform_invoices": 0,
            "mediator_payout_owed": 0,
            "currency": "KES",
            "by_mediator": [],
        }
    # Platform commission % from tenant commercial_config
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == user.tenant_id))
    tenant = tenant_result.scalar_one_or_none()
    commercial = (tenant.commercial_config or {}) if tenant else {}
    commission_pct = float(commercial.get("platform_commission_pct", 0) or 0)

    base_inv = and_(Invoice.tenant_id == user.tenant_id, Invoice.invoice_type == "client")
    if mediator_id:
        base_inv = and_(base_inv, Invoice.mediator_id == mediator_id)

    # Funds from clients: total paid on client invoices (mediation fees)
    client_paid_q = (
        select(func.coalesce(func.sum(PaymentReceipt.amount_minor_units), 0))
        .select_from(PaymentReceipt)
        .join(Invoice, Invoice.id == PaymentReceipt.invoice_id)
        .where(base_inv)
    )
    _fc = (await db.execute(client_paid_q)).scalar()
    funds_from_clients_minor = int(float(_fc or 0))

    # Funds from mediator: total paid on platform invoices (platform access fees)
    platform_base = and_(Invoice.tenant_id == user.tenant_id, Invoice.invoice_type == "platform")
    if mediator_id:
        platform_base = and_(platform_base, Invoice.user_id == mediator_id)
    platform_paid_q = (
        select(func.coalesce(func.sum(PaymentReceipt.amount_minor_units), 0))
        .select_from(PaymentReceipt)
        .join(Invoice, Invoice.id == PaymentReceipt.invoice_id)
        .where(platform_base)
    )
    _fm = (await db.execute(platform_paid_q)).scalar()
    funds_from_mediator_minor = int(float(_fm or 0))

    commission_minor = int(funds_from_clients_minor * commission_pct / 100)
    gross_payout_minor = funds_from_clients_minor - commission_minor

    # Unpaid platform invoices (mediators owe platform) - offset from payout
    platform_unpaid_q = (
        select(Invoice.id, Invoice.user_id, Invoice.amount_minor_units)
        .where(
            Invoice.tenant_id == user.tenant_id,
            Invoice.invoice_type == "platform",
            Invoice.status == "PENDING",
        )
    )
    if mediator_id:
        platform_unpaid_q = platform_unpaid_q.where(Invoice.user_id == mediator_id)
    platform_invoices = (await db.execute(platform_unpaid_q)).all()
    platform_inv_ids = [r.id for r in platform_invoices]
    unpaid_platform_minor = 0
    paid_platform_map = {}
    if platform_inv_ids:
        paid_platform_q = (
            select(PaymentReceipt.invoice_id, func.sum(PaymentReceipt.amount_minor_units).label("total"))
            .where(PaymentReceipt.invoice_id.in_(platform_inv_ids))
            .group_by(PaymentReceipt.invoice_id)
        )
        paid_platform_map = {r.invoice_id: int(float(r.total or 0)) for r in (await db.execute(paid_platform_q)).all()}
    for r in platform_invoices:
        amt = int(float(r.amount_minor_units))
        paid = paid_platform_map.get(r.id, 0)
        unpaid_platform_minor += max(0, amt - paid)

    mediator_payout_minor = max(0, gross_payout_minor - unpaid_platform_minor)

    # Per-mediator breakdown (only when not filtering)
    by_mediator = []
    if not mediator_id:
        mediator_totals_q = (
            select(Invoice.mediator_id, func.sum(PaymentReceipt.amount_minor_units).label("total"))
            .select_from(PaymentReceipt)
            .join(Invoice, Invoice.id == PaymentReceipt.invoice_id)
            .where(Invoice.tenant_id == user.tenant_id, Invoice.invoice_type == "client", Invoice.mediator_id.isnot(None))
            .group_by(Invoice.mediator_id)
        )
        mediator_rows = (await db.execute(mediator_totals_q)).all()
        mediator_ids = [r.mediator_id for r in mediator_rows]
        users_map = {}
        if mediator_ids:
            u_res = await db.execute(select(User).where(User.id.in_(mediator_ids)))
            for u in u_res.scalars().all():
                users_map[u.id] = u
        # Unpaid platform invoices per mediator
        mediator_unpaid = {}
        for r in platform_invoices:
            mid = r.user_id
            if mid:
                amt = int(float(r.amount_minor_units))
                paid = paid_platform_map.get(r.id, 0)
                mediator_unpaid[mid] = mediator_unpaid.get(mid, 0) + max(0, amt - paid)

        for r in mediator_rows:
            u = users_map.get(r.mediator_id)
            tot = int(float(r.total or 0))
            comm = int(tot * commission_pct / 100)
            gross = tot - comm
            unpaid = mediator_unpaid.get(r.mediator_id, 0)
            payout = max(0, gross - unpaid)
            by_mediator.append({
                "mediator_id": str(r.mediator_id),
                "mediator_name": (u.display_name or u.email) if u else "Unknown",
                "funds_from_clients": tot / 100,
                "platform_commission": comm / 100,
                "unpaid_platform_invoices": unpaid / 100,
                "payout_owed": payout / 100,
            })

    return {
        "funds_from_clients": funds_from_clients_minor / 100,
        "funds_from_mediator": funds_from_mediator_minor / 100,
        "platform_commission_pct": commission_pct,
        "platform_commission_amount": commission_minor / 100,
        "unpaid_platform_invoices": unpaid_platform_minor / 100,
        "mediator_payout_owed": mediator_payout_minor / 100,
        "currency": "KES",
        "by_mediator": by_mediator,
    }


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
