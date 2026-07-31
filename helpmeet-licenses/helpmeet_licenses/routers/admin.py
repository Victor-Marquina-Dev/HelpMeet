import hmac
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Body, Depends, Header, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from helpmeet_licenses.config import settings
from helpmeet_licenses.database import get_db
from helpmeet_licenses.keys import generate_license_key
from helpmeet_licenses.models import Customer, License, Activation, LicenseEvent
from helpmeet_licenses.schemas import (
    CreateCustomerRequest, CustomerOut,
    CreateLicenseRequest, CreateLicenseResponse, LicenseOut, OkResponse,
    ReactivateRequest, CustomerWithLicenses,
)
from helpmeet_licenses.auth import hash_key
from helpmeet_licenses.email_service import send_license_key_email, send_admin_notify

router = APIRouter(prefix="/api/admin")

ADMIN_NOTIFY_EMAIL = settings.admin_notify_email

LICENSE_NOT_FOUND = "License not found"

def _require_admin(x_admin_key: str = Header(...)):
    if not hmac.compare_digest(x_admin_key, settings.admin_api_key):
        raise HTTPException(status_code=403, detail="Forbidden")

def _log_event(db: Session, license_id: int, event_type: str, metadata: dict = None):
    db.add(LicenseEvent(license_id=license_id, event_type=event_type, event_metadata=metadata or {}))

@router.post("/customers", response_model=CustomerOut)
def create_customer(req: CreateCustomerRequest, db: Session = Depends(get_db),
                    _=Depends(_require_admin)):
    customer = Customer(email=req.email, name=req.name)
    db.add(customer)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = db.query(Customer).filter(Customer.email == req.email).first()
        if existing:
            return existing
        raise HTTPException(status_code=409, detail="Email already exists")
    db.refresh(customer)
    return customer

@router.get("/customers", response_model=list[CustomerWithLicenses])
def list_customers(db: Session = Depends(get_db), _=Depends(_require_admin)):
    from sqlalchemy.orm import joinedload
    return db.query(Customer).options(joinedload(Customer.licenses)).all()

@router.post("/licenses", response_model=CreateLicenseResponse)
def create_license(req: CreateLicenseRequest, db: Session = Depends(get_db),
                   _=Depends(_require_admin)):
    key = generate_license_key()
    lic = License(
        customer_id=req.customer_id,
        key_hash=hash_key(key),
        key_last4=key[-4:],
        plan=req.plan,
        updates_until=req.updates_until,
        max_devices=req.max_devices,
    )
    db.add(lic)
    db.flush()
    _log_event(db, lic.id, "created")
    db.commit()
    db.refresh(lic)

    # Enviar la key por email al cliente y notificar al admin
    email_sent = False
    if lic.customer and lic.customer.email:
        _notify_key_async(lic.customer.email, key, lic.plan, lic.id)
        email_sent = True

    return CreateLicenseResponse(
        id=lic.id, license_key=key, key_last4=key[-4:], plan=lic.plan, email_sent=email_sent
    )

@router.get("/licenses", response_model=list[LicenseOut])
def list_licenses(plan: Optional[str] = None, status: Optional[str] = None,
                  db: Session = Depends(get_db), _=Depends(_require_admin)):
    q = db.query(License)
    if plan:
        q = q.filter(License.plan == plan)
    if status:
        q = q.filter(License.status == status)
    return q.all()

@router.get("/licenses/{license_id}", response_model=LicenseOut)
def get_license(license_id: int, db: Session = Depends(get_db), _=Depends(_require_admin)):
    lic = db.get(License, license_id)
    if not lic:
        raise HTTPException(status_code=404, detail=LICENSE_NOT_FOUND)
    return lic

@router.post("/licenses/{license_id}/revoke", response_model=OkResponse)
def revoke_license(license_id: int, db: Session = Depends(get_db), _=Depends(_require_admin)):
    lic = db.get(License, license_id)
    if not lic:
        raise HTTPException(status_code=404, detail=LICENSE_NOT_FOUND)
    lic.status = "revoked"
    lic.revoked_at = datetime.now(tz=timezone.utc)
    _log_event(db, lic.id, "revoked")
    db.commit()
    return OkResponse(ok=True)


@router.post("/licenses/{license_id}/reactivate", response_model=OkResponse)
def reactivate_license(
    license_id: int,
    req: Optional[ReactivateRequest] = Body(None),
    db: Session = Depends(get_db),
    _=Depends(_require_admin),
):
    """Reactivar una licencia revocada, opcionalmente cambiando el plan."""
    lic = db.get(License, license_id)
    if not lic:
        raise HTTPException(status_code=404, detail=LICENSE_NOT_FOUND)
    if lic.status != "revoked":
        raise HTTPException(status_code=400, detail="Solo licencias revocadas pueden reactivarse")

    old_plan = lic.plan
    new_plan = (req.plan if req and req.plan else old_plan) if req else old_plan
    lic.status = "active"
    lic.plan = new_plan
    lic.revoked_at = None
    _log_event(db, lic.id, "reactivated", {"old_plan": old_plan, "new_plan": new_plan})
    db.commit()
    return OkResponse(ok=True)


@router.get("/licenses/{license_id}/events")
def get_license_events(license_id: int, db: Session = Depends(get_db), _=Depends(_require_admin)):
    """Historial de eventos de una licencia (creada, revocada, reactivada, etc.)."""
    lic = db.get(License, license_id)
    if not lic:
        raise HTTPException(status_code=404, detail=LICENSE_NOT_FOUND)
    events = (
        db.query(LicenseEvent)
        .filter(LicenseEvent.license_id == license_id)
        .order_by(LicenseEvent.created_at.desc())
        .all()
    )
    return [
        {
            "id": e.id,
            "event_type": e.event_type,
            "metadata": e.event_metadata or {},
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in events
    ]


@router.post("/licenses/{license_id}/reset-devices", response_model=OkResponse)
def reset_devices(license_id: int, db: Session = Depends(get_db), _=Depends(_require_admin)):
    lic = db.get(License, license_id)
    if not lic:
        raise HTTPException(status_code=404, detail=LICENSE_NOT_FOUND)
    db.query(Activation).filter(
        Activation.license_id == license_id,
        Activation.status == "active"
    ).update({"status": "deactivated"})
    _log_event(db, license_id, "devices_reset")
    db.commit()
    return OkResponse(ok=True)


def _notify_key_async(customer_email: str, key: str, plan: str, license_id: int) -> None:
    """Envía la key al cliente y notifica al admin en background."""
    import threading
    threading.Thread(
        target=_send_key_notifications,
        args=(customer_email, key, plan, license_id),
        daemon=True,
    ).start()


def _send_key_notifications(customer_email: str, key: str, plan: str, license_id: int) -> None:
    """Envía email al cliente con su key y notifica al admin."""
    client_ok = send_license_key_email(customer_email, key, plan)
    admin_ok = send_admin_notify(customer_email, key, plan, license_id)
    if not client_ok and not admin_ok:
        return


@router.post("/licenses/{license_id}/generate-key")
def generate_key_for_license(license_id: int, db: Session = Depends(get_db), _=Depends(_require_admin)):
    """Genera nueva key, la envía por Gmail y la devuelve al panel."""
    lic = db.get(License, license_id)
    if not lic:
        raise HTTPException(status_code=404, detail=LICENSE_NOT_FOUND)
    if not lic.customer or not lic.customer.email:
        raise HTTPException(status_code=400, detail="No customer email")

    new_key = generate_license_key()
    lic.key_hash = hash_key(new_key)
    lic.key_last4 = new_key[-4:]
    _log_event(db, license_id, "key_generated")
    db.commit()

    customer_email = lic.customer.email
    plan_str = lic.plan

    _notify_key_async(customer_email, new_key, plan_str, license_id)

    return {
        "ok": True,
        "key": new_key,
        "email": customer_email,
        "plan": plan_str,
        "email_sent": True,
    }
