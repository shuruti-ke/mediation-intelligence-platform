"""Payment orchestrator - Phase 4. Stripe, M-Pesa Daraja."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.tenant import User
from app.models.payment import Invoice, PaymentTransaction

router = APIRouter(prefix="/payments", tags=["payments"])


def generate_invoice_number(tenant_id: uuid.UUID) -> str:
    """Generate unique invoice number: INV-YYYY-NNNN."""
    year = datetime.utcnow().year
    return f"INV-{year}-{uuid.uuid4().hex[:6].upper()}"


class InvoiceCreate(BaseModel):
    amount_minor_units: int  # cents or equivalent
    currency: str = "KES"
    description: str
    case_id: uuid.UUID | None = None


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

    # TODO: Call M-Pesa Daraja STK Push or Stripe Checkout
    if data.provider == "mpesa" and data.phone:
        return {
            "transaction_id": str(txn.id),
            "status": "PENDING_USER_PIN",
            "message": "Enter PIN on your phone to complete payment.",
            "provider": "mpesa",
        }
    if data.provider == "stripe":
        return {
            "transaction_id": str(txn.id),
            "status": "PENDING",
            "checkout_url": f"/pay/checkout/{txn.id}",  # Frontend would redirect to Stripe
            "provider": "stripe",
        }
    return {"transaction_id": str(txn.id), "status": "INITIATED", "provider": data.provider}


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
) -> list:
    """List invoices for tenant."""
    q = select(Invoice).where(Invoice.tenant_id == user.tenant_id)
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
