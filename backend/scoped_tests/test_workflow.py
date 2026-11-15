import os, json

os.environ["DATABASE_URL"] = "sqlite://"
from datetime import date, timedelta, datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient
from app.main import app
from app.db.base import Base, get_db
from app.models.user import User
from app.models.medicine import Medicine, MedicineBatch
from app.models.verification import FacilityRegistration
from app.core.security import get_password_hash


@pytest.fixture()
def setup():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    def db():
        with Session() as s:
            yield s

    app.dependency_overrides[get_db] = db
    with Session() as s:
        for role in ["network_admin", "mto", "logistics"]:
            s.add(
                User(
                    email=role + "@test.com",
                    username=role,
                    full_name=role,
                    role=role,
                    hashed_password=get_password_hash("TestPassword123!"),
                )
            )
        s.commit()
    client = TestClient(app)

    def login(role, mto=False):
        response = client.post(
            "/api/v1/auth/" + ("mto/login" if mto else "login"),
            json={"email": role + "@test.com", "password": "TestPassword123!"},
        )
        assert response.status_code == 200, response.text
        return {"Authorization": "Bearer " + response.json()["access_token"]}

    yield client, Session, login
    app.dependency_overrides.clear()
    engine.dispose()


def signup(client, name, nin):
    data = dict(
        name=name,
        facility_type="pharmacy",
        address="123 Hospital Road",
        state="Tamil Nadu",
        district="Chennai",
        city="Chennai",
        pin_code="600001",
        phone="9000000000",
        email=name + "@test.com",
        nin=nin,
        representative="Test Owner",
        pharmacist_name="Test Pharmacist",
        pharmacist_registration="REG-123",
        contact_information="9000000000",
        licence_number="DL-123",
        licence_type="Retail",
        issuing_authority="State Drugs Control",
        licence_validity=str(date.today() + timedelta(days=365)),
        password="TestPassword123!",
        confirm_password="TestPassword123!",
    )
    response = client.post(
        "/api/v1/registration/signup",
        data={"payload": json.dumps(data)},
        files={
            "nin_document": ("nin.pdf", b"%PDF-1.4 test", "application/pdf"),
            "licence_document": ("licence.pdf", b"%PDF-1.4 test", "application/pdf"),
        },
    )
    return response


def approve(client, admin, row):
    return client.put(
        f"/api/v1/registration/{row['id']}/review",
        headers=admin,
        json=dict(
            nin_status="NIN VERIFIED",
            licence_status="PASSED",
            registration_status="REGISTRATION APPROVED",
            official_nin=row["nin"],
            official_name=row["data"]["name"],
            official_address=row["data"]["address"],
            official_reference="Official district register checked by administrator",
            notes="NIN record and separate drug licence checked",
        ),
    )


def test_registration_and_permissions(setup):
    c, S, login = setup
    admin = login("network_admin")
    assert (
        c.get("/api/v1/registration/nin-status").json()["status"] == "NIN NOT ENTERED"
    )
    assert (
        c.get("/api/v1/registration/nin-status?nin=123").json()["status"]
        == "INVALID NIN FORMAT"
    )
    assert signup(c, "receiver", "1234567890").status_code == 201
    assert signup(c, "duplicate", "1234567890").status_code == 409
    assert (
        c.post(
            "/api/v1/auth/login",
            json={"email": "receiver@test.com", "password": "TestPassword123!"},
        ).status_code
        == 403
    )
    row = c.get("/api/v1/registration", headers=admin).json()[0]
    assert approve(c, admin, row).status_code == 200
    receiver = login("receiver")
    assert c.get("/api/v1/registration", headers=receiver).status_code == 403
    assert (
        c.put(
            "/api/v1/transfers/1/mto-review", headers=receiver, json={"approved": True}
        ).status_code
        == 403
    )
    assert (
        c.post(
            "/api/v1/auth/login",
            json={"email": "mto@test.com", "password": "TestPassword123!"},
        ).status_code
        == 403
    )
    mto = login("mto", True)
    assert (
        c.post(
            "/api/v1/auth/register",
            headers=admin,
            json={
                "email": "second@test.com",
                "username": "second",
                "password": "TestPassword123!",
                "full_name": "Second",
                "role": "mto",
            },
        ).status_code
        == 409
    )
    assert c.post("/api/v1/auth/logout", headers=mto).status_code == 200
    assert c.get("/api/v1/auth/me", headers=mto).status_code == 401
    with S() as s:
        r = s.query(FacilityRegistration).first()
        r.licence_status = "FAILED"
        s.commit()
    assert c.get("/api/v1/auth/me", headers=receiver).status_code == 403


def prepare(setup):
    c, S, login = setup
    admin = login("network_admin")
    for name, nin in [("receiver", "1234567890"), ("donor", "1234567891")]:
        assert signup(c, name, nin).status_code == 201
    rows = c.get("/api/v1/registration", headers=admin).json()
    for row in rows:
        assert approve(c, admin, row).status_code == 200
    receiver = login("receiver")
    donor = login("donor")
    mto = login("mto", True)
    logistics = login("logistics")
    with S() as s:
        donor_id = (
            s.query(User).filter_by(username="donor@test.com").first().hospital_id
        )
        receiver_id = (
            s.query(User).filter_by(username="receiver@test.com").first().hospital_id
        )
        med = Medicine(
            name="Paracetamol",
            active_ingredient="Paracetamol",
            strength="500 mg",
            dosage_form="tablet",
        )
        s.add(med)
        s.flush()
        batch = MedicineBatch(
            hospital_id=donor_id,
            medicine_id=med.id,
            batch_number="B-001",
            quantity=100,
            reserved_quantity=0,
            expiry_date=date.today() + timedelta(days=180),
            status="normal",
        )
        s.add(batch)
        s.commit()
        bid = batch.id
        mid = med.id
    request = c.post(
        "/api/v1/requests",
        headers=receiver,
        json=dict(
            medicine_name="Paracetamol",
            active_ingredient="Paracetamol",
            strength="500 mg",
            dosage_form="tablet",
            quantity=30,
            required_delivery_date=str(date.today() + timedelta(days=3)),
            storage_capability="Dry secure storage",
            reason="Supply shortage",
        ),
    )
    assert request.status_code == 201, request.text
    return (
        c,
        S,
        receiver,
        donor,
        mto,
        logistics,
        bid,
        mid,
        receiver_id,
        request.json()["id"],
    )


def offer(c, donor, rid, bid, quantity=20):
    return c.post(
        f"/api/v1/requests/{rid}/offer",
        headers=donor,
        json=dict(
            batch_id=bid,
            quantity=quantity,
            expiry_date=str(date.today() + timedelta(days=180)),
            storage_conditions="Dry storage below 25C",
            remarks="Surplus checked",
        ),
    )


def test_ordered_workflow_inventory_and_tracking(setup):
    c, S, receiver, donor, mto, logistics, bid, mid, receiver_id, rid = prepare(setup)
    result = offer(c, donor, rid, bid)
    assert result.status_code == 200, result.text
    tid = result.json()["transfer_id"]
    url = f"/api/v1/transfers/{tid}"
    assert offer(c, donor, rid, bid).status_code == 409
    assert c.get("/api/v1/transfers", headers=logistics).json() == []
    with S() as s:
        assert s.get(MedicineBatch, bid).reserved_quantity == 20
    assert c.put(
        url + "/status", headers=logistics, json={"status": "dispatched"}
    ).status_code in (400, 403)
    assert c.put(
        url + "/status", headers=receiver, json={"status": "completed"}
    ).status_code in (400, 403)
    result = c.put(
        url + "/mto-review",
        headers=mto,
        json={"approved": True, "notes": "Evidence and requirements reviewed"},
    )
    assert result.status_code == 200, result.text
    t = result.json()
    assert (
        t["status"] == "ready_for_dispatch"
        and t["transfer_reference"]
        and t["qr_code_token"]
        and t["mto_approved_at"]
    )
    assert len(c.get("/api/v1/transfers", headers=logistics).json()) == 1
    assert c.get(url + "/qr-code", headers=receiver).content.startswith(b"\x89PNG")
    assert (
        c.get(
            "/api/v1/transfers/verify/" + t["qr_code_token"], headers=receiver
        ).status_code
        == 200
    )
    assert (
        c.put(
            url + "/shipment",
            headers=receiver,
            json=dict(
                status="dispatched",
                timestamp=datetime.now(timezone.utc).isoformat(),
                remarks="test",
            ),
        ).status_code
        == 403
    )
    for status in ["dispatched", "in_transit", "delivered"]:
        data = dict(
            status=status,
            timestamp=datetime.now(timezone.utc).isoformat(),
            transporter="Verified carrier",
            tracking_reference="TRK-01",
            receiving_person="Receiving Pharmacist",
            remarks="Manual location and condition update",
        )
        result = c.put(url + "/shipment", headers=logistics, json=data)
        assert result.status_code == 200, result.text
    assert result.json()["status"] == "received_awaiting_verification"
    receipt = dict(
        received_quantity=20,
        medicine_name="Paracetamol",
        batch_number="B-001",
        expiry_date=str(date.today() + timedelta(days=180)),
        packaging_ok=True,
        storage_transport_ok=True,
        notes="All physical checks passed",
    )
    assert c.put(url + "/receipt", headers=donor, json=receipt).status_code == 403
    assert (
        c.put(
            url + "/receipt",
            headers=receiver,
            json={
                **receipt,
                "discrepancy": True,
                "notes": "Packaging discrepancy for review",
            },
        ).json()["status"]
        == "received_awaiting_verification"
    )
    result = c.put(url + "/receipt", headers=receiver, json=receipt)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "completed"
    assert c.put(url + "/receipt", headers=receiver, json=receipt).status_code == 400
    with S() as s:
        assert s.get(MedicineBatch, bid).quantity == 80
        assert s.get(MedicineBatch, bid).reserved_quantity == 0
        target = (
            s.query(MedicineBatch)
            .filter_by(hospital_id=receiver_id, medicine_id=mid, batch_number="B-001")
            .one()
        )
        assert target.quantity == 20
    logs = c.get(url + "/audit-logs", headers=receiver).json()
    for stage in [
        "REQUEST_CREATED",
        "DONOR_APPROVED",
        "FINAL_APPROVED",
        "READY_FOR_DISPATCH",
        "DISPATCHED",
        "IN_TRANSIT",
        "DELIVERED",
        "RECEIVED_AWAITING_VERIFICATION",
        "COMPLETED",
    ]:
        assert any(l["action"] == stage and l["created_at"] for l in logs)


@pytest.mark.parametrize(
    "bad_status", ["expired", "recalled", "quarantined", "damaged"]
)
def test_unsafe_stock_blocked(setup, bad_status):
    c, S, receiver, donor, mto, logistics, bid, mid, receiver_id, rid = prepare(setup)
    with S() as s:
        s.get(MedicineBatch, bid).status = bad_status
        s.commit()
    assert offer(c, donor, rid, bid).status_code == 409


@pytest.mark.parametrize("action", ["reject", "cancel", "correction"])
def test_reservation_release(setup, action):
    c, S, receiver, donor, mto, logistics, bid, mid, receiver_id, rid = prepare(setup)
    tid = offer(c, donor, rid, bid).json()["transfer_id"]
    url = f"/api/v1/transfers/{tid}"
    if action == "reject":
        result = c.put(
            url + "/mto-review",
            headers=mto,
            json={"approved": False, "notes": "Insufficient evidence"},
        )
    elif action == "cancel":
        result = c.put(
            url + "/status",
            headers=receiver,
            json={"status": "cancelled", "notes": "Request no longer required"},
        )
    else:
        result = c.put(
            url + "/mto-followup",
            headers=mto,
            json={"action": "correction", "notes": "Correct documentation"},
        )
    assert result.status_code == 200, result.text
    with S() as s:
        assert s.get(MedicineBatch, bid).reserved_quantity == 0


def test_documents_return_to_mto(setup):
    c, S, receiver, donor, mto, logistics, bid, mid, receiver_id, rid = prepare(setup)
    tid = offer(c, donor, rid, bid).json()["transfer_id"]
    url = f"/api/v1/transfers/{tid}"
    assert (
        c.put(
            url + "/mto-followup",
            headers=mto,
            json={"action": "documents", "notes": "Upload transport evidence"},
        ).status_code
        == 200
    )
    assert (
        c.put(url + "/mto-review", headers=mto, json={"approved": True}).status_code
        == 400
    )
    result = c.post(
        url + "/documents",
        headers=donor,
        data={"notes": "Transport evidence attached"},
        files={"file": ("evidence.pdf", b"%PDF-1.4 evidence", "application/pdf")},
    )
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "awaiting_mto_review"


@pytest.mark.parametrize(
    "case", ["expired_date", "reserved", "over_quantity", "wrong_spec"]
)
def test_offer_validation(setup, case):
    c, S, receiver, donor, mto, logistics, bid, mid, receiver_id, rid = prepare(setup)
    with S() as s:
        if case == "expired_date":
            s.get(MedicineBatch, bid).expiry_date = date.today() - timedelta(days=1)
        if case == "reserved":
            s.get(MedicineBatch, bid).reserved_quantity = 90
        if case == "wrong_spec":
            s.get(Medicine, mid).strength = "250 mg"
        s.commit()
    result = offer(c, donor, rid, bid, 31 if case == "over_quantity" else 20)
    assert result.status_code in (400, 409), result.text


def test_correction_replaces_offer_and_reserves_once(setup):
    c, S, receiver, donor, mto, logistics, bid, mid, receiver_id, rid = prepare(setup)
    tid = offer(c, donor, rid, bid).json()["transfer_id"]
    url = f"/api/v1/transfers/{tid}"
    assert (
        c.put(
            url + "/mto-followup",
            headers=mto,
            json={
                "action": "correction",
                "notes": "Correct offered quantity and transport conditions",
            },
        ).status_code
        == 200
    )
    payload = dict(
        batch_id=bid,
        quantity=10,
        expiry_date=str(date.today() + timedelta(days=180)),
        storage_conditions="Dry locked transport at 20C",
        remarks="Corrected available quantity",
    )
    result = c.put(url + "/correction", headers=donor, json=payload)
    assert result.status_code == 200, result.text
    assert (
        result.json()["quantity"] == 10
        and result.json()["status"] == "awaiting_mto_review"
    )
    assert c.put(url + "/correction", headers=donor, json=payload).status_code == 400
    with S() as s:
        assert s.get(MedicineBatch, bid).reserved_quantity == 10

def test_inventory_refresh_preserves_damaged_hold(setup):
    from app.services.inventory_service import update_batch_statuses
    c,S,receiver,donor,mto,logistics,bid,mid,receiver_id,rid=prepare(setup)
    with S() as s:
        s.get(MedicineBatch,bid).status='damaged';s.commit()
        update_batch_statuses(s)
        assert s.get(MedicineBatch,bid).status=='damaged'
    assert offer(c,donor,rid,bid).status_code==409
