"""
Demo data seeding script for DoseRelay.
All data is FICTIONAL and for demonstration purposes only.
Run: python -m app.scripts.seed_demo_data
"""
import sys
import os
import random
from datetime import date, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../../.."))

from app.db.base import SessionLocal, Base, engine
from app.core.security import get_password_hash
from app.models.user import User
from app.models.hospital import Hospital
from app.models.medicine import Medicine, MedicineBatch
from app.models.consumption import ConsumptionRecord
from app.models.transfer import Transfer, TransferRecommendation
from app.models.audit import AuditLog, Notification

# Seed deterministically
random.seed(42)


HOSPITALS = [
    {"name": "Metro General Hospital", "code": "MGH001", "address": "12 Marine Lines", "city": "Mumbai", "state": "Maharashtra", "latitude": 19.076, "longitude": 72.8777, "phone": "+91-22-1234-5678", "email": "admin@metrogen.in", "hospital_type": "general", "bed_count": 850},
    {"name": "City Care Medical Centre", "code": "CCMC002", "address": "45 Connaught Place", "city": "New Delhi", "state": "Delhi", "latitude": 28.6139, "longitude": 77.209, "phone": "+91-11-2345-6789", "email": "admin@citycare.in", "hospital_type": "specialty", "bed_count": 600},
    {"name": "Sunrise Health Institute", "code": "SHI003", "address": "88 MG Road", "city": "Bengaluru", "state": "Karnataka", "latitude": 12.9716, "longitude": 77.5946, "phone": "+91-80-3456-7890", "email": "admin@sunrisehealth.in", "hospital_type": "general", "bed_count": 500},
    {"name": "Coastal Medical Hospital", "code": "CMH004", "address": "23 Anna Salai", "city": "Chennai", "state": "Tamil Nadu", "latitude": 13.0827, "longitude": 80.2707, "phone": "+91-44-4567-8901", "email": "admin@coastalmed.in", "hospital_type": "specialty", "bed_count": 450},
    {"name": "Highland Regional Hospital", "code": "HRH005", "address": "56 FC Road", "city": "Pune", "state": "Maharashtra", "latitude": 18.5204, "longitude": 73.8567, "phone": "+91-20-5678-9012", "email": "admin@highland.in", "hospital_type": "general", "bed_count": 350},
]

MEDICINES = [
    {"name": "Amoxicillin 500mg", "generic_name": "Amoxicillin", "active_ingredient": "Amoxicillin trihydrate", "strength": "500mg", "dosage_form": "capsule", "category": "Antibiotic", "manufacturer": "Sun Pharma", "requires_cold_storage": False},
    {"name": "Metformin 850mg", "generic_name": "Metformin", "active_ingredient": "Metformin hydrochloride", "strength": "850mg", "dosage_form": "tablet", "category": "Antidiabetic", "manufacturer": "Cipla", "requires_cold_storage": False},
    {"name": "Atorvastatin 40mg", "generic_name": "Atorvastatin", "active_ingredient": "Atorvastatin calcium", "strength": "40mg", "dosage_form": "tablet", "category": "Cardiovascular", "manufacturer": "Ranbaxy", "requires_cold_storage": False},
    {"name": "Omeprazole 20mg", "generic_name": "Omeprazole", "active_ingredient": "Omeprazole", "strength": "20mg", "dosage_form": "capsule", "category": "Gastrointestinal", "manufacturer": "Dr. Reddy's", "requires_cold_storage": False},
    {"name": "Paracetamol 650mg", "generic_name": "Paracetamol", "active_ingredient": "Paracetamol", "strength": "650mg", "dosage_form": "tablet", "category": "Analgesic", "manufacturer": "GSK India", "requires_cold_storage": False},
    {"name": "Ciprofloxacin 500mg", "generic_name": "Ciprofloxacin", "active_ingredient": "Ciprofloxacin hydrochloride", "strength": "500mg", "dosage_form": "tablet", "category": "Antibiotic", "manufacturer": "Lupin", "requires_cold_storage": False},
    {"name": "Amlodipine 5mg", "generic_name": "Amlodipine", "active_ingredient": "Amlodipine besylate", "strength": "5mg", "dosage_form": "tablet", "category": "Cardiovascular", "manufacturer": "Pfizer India", "requires_cold_storage": False},
    {"name": "Insulin Glargine 100U/mL", "generic_name": "Insulin glargine", "active_ingredient": "Insulin glargine", "strength": "100 U/mL", "dosage_form": "injection", "category": "Antidiabetic", "manufacturer": "Sanofi India", "requires_cold_storage": True},
    {"name": "Salbutamol 100mcg", "generic_name": "Salbutamol", "active_ingredient": "Salbutamol sulphate", "strength": "100mcg", "dosage_form": "other", "category": "Respiratory", "manufacturer": "GSK India", "requires_cold_storage": False},
    {"name": "Pantoprazole 40mg", "generic_name": "Pantoprazole", "active_ingredient": "Pantoprazole sodium", "strength": "40mg", "dosage_form": "tablet", "category": "Gastrointestinal", "manufacturer": "Alkem", "requires_cold_storage": False},
    {"name": "Doxycycline 100mg", "generic_name": "Doxycycline", "active_ingredient": "Doxycycline hyclate", "strength": "100mg", "dosage_form": "capsule", "category": "Antibiotic", "manufacturer": "FDC Ltd", "requires_cold_storage": False},
    {"name": "Losartan 50mg", "generic_name": "Losartan", "active_ingredient": "Losartan potassium", "strength": "50mg", "dosage_form": "tablet", "category": "Cardiovascular", "manufacturer": "Ipca Labs", "requires_cold_storage": False},
    {"name": "Cetirizine 10mg", "generic_name": "Cetirizine", "active_ingredient": "Cetirizine hydrochloride", "strength": "10mg", "dosage_form": "tablet", "category": "Antihistamine", "manufacturer": "UCB India", "requires_cold_storage": False},
    {"name": "Metronidazole 400mg", "generic_name": "Metronidazole", "active_ingredient": "Metronidazole", "strength": "400mg", "dosage_form": "tablet", "category": "Antibiotic", "manufacturer": "Abbott India", "requires_cold_storage": False},
    {"name": "Prednisolone 10mg", "generic_name": "Prednisolone", "active_ingredient": "Prednisolone", "strength": "10mg", "dosage_form": "tablet", "category": "Corticosteroid", "manufacturer": "Systopic Labs", "requires_cold_storage": False},
    {"name": "Furosemide 40mg", "generic_name": "Furosemide", "active_ingredient": "Furosemide", "strength": "40mg", "dosage_form": "tablet", "category": "Diuretic", "manufacturer": "Neon Labs", "requires_cold_storage": False},
    {"name": "Ondansetron 4mg", "generic_name": "Ondansetron", "active_ingredient": "Ondansetron hydrochloride", "strength": "4mg", "dosage_form": "tablet", "category": "Antiemetic", "manufacturer": "Cadila Healthcare", "requires_cold_storage": False},
    {"name": "Aspirin 75mg", "generic_name": "Aspirin", "active_ingredient": "Acetylsalicylic acid", "strength": "75mg", "dosage_form": "tablet", "category": "Analgesic", "manufacturer": "Bayer India", "requires_cold_storage": False},
    {"name": "Clopidogrel 75mg", "generic_name": "Clopidogrel", "active_ingredient": "Clopidogrel bisulphate", "strength": "75mg", "dosage_form": "tablet", "category": "Cardiovascular", "manufacturer": "Sanofi India", "requires_cold_storage": False},
    {"name": "Azithromycin 500mg", "generic_name": "Azithromycin", "active_ingredient": "Azithromycin dihydrate", "strength": "500mg", "dosage_form": "tablet", "category": "Antibiotic", "manufacturer": "Cipla", "requires_cold_storage": False},
]

# Batch configurations: (hospital_idx, medicine_idx, quantity, days_offset_from_today, unit_price, status_override)
# days_offset: positive = future expiry, negative = already expired
BATCH_CONFIGS = [
    # MGH001 – mostly surplus in antibiotics, cardiovascular
    (0, 0, 2000, 180, 12.5, None),    # Amoxicillin – big surplus
    (0, 2, 1500, 240, 45.0, None),    # Atorvastatin – surplus
    (0, 4, 500,  90,  3.5, None),     # Paracetamol – normal
    (0, 6, 1200, 300, 55.0, None),    # Amlodipine – surplus
    (0, 9, 800,  45,  18.0, "approaching_expiry"),  # Pantoprazole approaching expiry
    (0, 14, 100, -10, 25.0, "expired"),  # Prednisolone – already expired (test case)
    (0, 17, 2500, 365, 2.0, None),    # Aspirin – surplus
    (0, 18, 600, 150, 180.0, None),   # Clopidogrel – normal
    # CCMC002 – shortage in several medicines
    (1, 0, 50,  180, 12.5, None),     # Amoxicillin – shortage
    (1, 1, 80,  200, 22.0, None),     # Metformin – shortage
    (1, 4, 200, 120, 3.5, None),      # Paracetamol – shortage
    (1, 5, 30,  90,  28.0, None),     # Ciprofloxacin – critical shortage
    (1, 7, 150, 60,  480.0, "approaching_expiry"),  # Insulin approaching expiry
    (1, 11, 400, 270, 42.0, None),    # Losartan – normal
    (1, 16, 200, 180, 95.0, None),    # Ondansetron – normal
    # SHI003 – mixed
    (2, 0, 300, 150, 12.5, None),     # Amoxicillin – normal
    (2, 1, 1800, 220, 22.0, None),    # Metformin – surplus
    (2, 3, 600, 180, 8.5, None),      # Omeprazole – normal
    (2, 5, 1200, 300, 28.0, None),    # Ciprofloxacin – surplus
    (2, 8, 400, 365, 65.0, None),     # Salbutamol – normal
    (2, 10, 50, 25, 15.0, "critical"), # Doxycycline – critical expiry
    (2, 13, 900, 240, 12.0, None),    # Metronidazole – surplus
    (2, 19, 600, 180, 25.0, None),    # Azithromycin – normal
    # CMH004 – shortage in antidiabetics, surplus in analgesics
    (3, 1, 50,  180, 22.0, None),     # Metformin – shortage
    (3, 4, 3000, 400, 3.5, None),     # Paracetamol – big surplus
    (3, 6, 100, 200, 55.0, None),     # Amlodipine – shortage
    (3, 7, 20,  40,  480.0, "critical"),  # Insulin – critical
    (3, 12, 800, 300, 9.5, None),     # Cetirizine – normal
    (3, 15, 500, 365, 35.0, None),    # Furosemide – normal
    (3, 17, 1800, 400, 2.0, None),    # Aspirin – surplus
    (3, 2, 50,  "recalled", 45.0, "recalled"),  # Atorvastatin – recalled (test case)
    # HRH005 – shortage in cardiovascular, normal otherwise
    (4, 2, 60,  180, 45.0, None),     # Atorvastatin – shortage
    (4, 3, 400, 220, 8.5, None),      # Omeprazole – normal
    (4, 6, 50,  200, 55.0, None),     # Amlodipine – shortage
    (4, 9, 300, 180, 18.0, None),     # Pantoprazole – normal
    (4, 11, 60, 150, 42.0, None),     # Losartan – shortage
    (4, 15, 700, 365, 35.0, None),    # Furosemide – surplus
    (4, 18, 350, 300, 180.0, None),   # Clopidogrel – normal
    (4, 19, 150, 20, 25.0, "quarantined"),  # Azithromycin – quarantined (test case)
]

# Consumption rates: average daily consumption per hospital per medicine (units/day)
# Pattern: hospital_idx -> medicine_idx -> avg_daily (with variability)
CONSUMPTION_RATES = {
    (0, 0): 8, (0, 2): 4, (0, 4): 15, (0, 6): 3, (0, 9): 6,
    (0, 14): 2, (0, 17): 10, (0, 18): 2,
    (1, 0): 12, (1, 1): 8, (1, 4): 20, (1, 5): 7, (1, 7): 3,
    (1, 11): 4, (1, 16): 3,
    (2, 0): 9, (2, 1): 5, (2, 3): 7, (2, 5): 4, (2, 8): 3,
    (2, 10): 2, (2, 13): 6, (2, 19): 4,
    (3, 1): 10, (3, 4): 5, (3, 6): 4, (3, 7): 4, (3, 12): 3,
    (3, 15): 2, (3, 17): 6, (3, 2): 3,
    (4, 2): 5, (4, 3): 4, (4, 6): 6, (4, 9): 4, (4, 11): 5,
    (4, 15): 2, (4, 18): 2, (4, 19): 3,
}


def seed():
    from app.core.config import settings
    if settings.APP_ENV != "development":
        raise RuntimeError("Demo seeding is disabled outside development")
    db = SessionLocal()
    try:
        # Skip if already seeded
        if db.query(Hospital).count() > 0:
            print("[SEED] Demo data already exists. Skipping.")
            return

        print("[SEED] Creating demo data...")

        # ── Hospitals ───────────────────────────────────────────────────────
        hospital_objs = []
        for h_data in HOSPITALS:
            h = Hospital(**h_data)
            db.add(h)
            hospital_objs.append(h)
        db.flush()
        print(f"[SEED] {len(hospital_objs)} hospitals created")

        # ── Medicines ───────────────────────────────────────────────────────
        medicine_objs = []
        for m_data in MEDICINES:
            m = Medicine(**m_data)
            db.add(m)
            medicine_objs.append(m)
        db.flush()
        print(f"[SEED] {len(medicine_objs)} medicines created")

        # ── Users ───────────────────────────────────────────────────────────
        users_data = [
            {"email": "admin@doserelay.com", "username": "admin", "password": "Admin@123",
             "full_name": "Dr. Rajan Mehta", "role": "network_admin", "hospital_id": None},
            {"email": "metro.admin@doserelay.com", "username": "metro_admin", "password": "Hospital@123",
             "full_name": "Dr. Priya Sharma", "role": "hospital_admin", "hospital_id": hospital_objs[0].id},
            {"email": "pharmacist@doserelay.com", "username": "pharmacist1", "password": "Pharma@123",
             "full_name": "Mr. Arjun Nair", "role": "pharmacist", "hospital_id": hospital_objs[0].id},
            {"email": "mto@doserelay.demo", "username": "mto@doserelay.demo", "password": __import__("os").environ.get("MTO_PASSWORD", "DoseRelay@MTO2026"),
             "full_name": "Ms. Kavita Patel", "role": "mto", "hospital_id": None},
            {"email": "logistics@doserelay.com", "username": "logistics1", "password": "Logistics@123",
             "full_name": "Mr. Suresh Kumar", "role": "logistics", "hospital_id": None},
            {"email": "ccmc.pharmacist@doserelay.com", "username": "pharmacist2", "password": "Pharma@123",
             "full_name": "Dr. Meena Joshi", "role": "pharmacist", "hospital_id": hospital_objs[1].id},
        ]
        user_objs = []
        for u_data in users_data:
            pwd = u_data.pop("password")
            u = User(hashed_password=get_password_hash(pwd), **u_data)
            db.add(u)
            user_objs.append(u)
        db.flush()
        print(f"[SEED] {len(user_objs)} users created")

        # ── Medicine Batches ─────────────────────────────────────────────────
        batch_objs = []
        batch_num = 1000
        for cfg in BATCH_CONFIGS:
            h_idx, m_idx, qty, days_or_status, price, status_override = cfg
            if h_idx >= len(hospital_objs) or m_idx >= len(medicine_objs):
                continue
            h = hospital_objs[h_idx]
            m = medicine_objs[m_idx]

            if status_override == "recalled":
                expiry_date = date.today() + timedelta(days=180)
                status = "recalled"
            elif isinstance(days_or_status, int):
                expiry_date = date.today() + timedelta(days=days_or_status)
                from app.services.inventory_service import categorize_batch_status
                status = status_override or categorize_batch_status(expiry_date)
            else:
                expiry_date = date.today() + timedelta(days=180)
                status = "normal"

            mfg = expiry_date - timedelta(days=random.randint(365, 730))
            batch = MedicineBatch(
                medicine_id=m.id,
                hospital_id=h.id,
                batch_number=f"DEMO-{batch_num:04d}",
                quantity=qty,
                reserved_quantity=0,
                manufacturing_date=mfg,
                expiry_date=expiry_date,
                unit_price=price,
                status=status,
            )
            db.add(batch)
            batch_objs.append(batch)
            batch_num += 1
        db.flush()
        print(f"[SEED] {len(batch_objs)} medicine batches created")

        # ── Consumption Records (90 days) ────────────────────────────────────
        consumption_count = 0
        today = date.today()
        for (h_idx, m_idx), avg_daily in CONSUMPTION_RATES.items():
            if h_idx >= len(hospital_objs) or m_idx >= len(medicine_objs):
                continue
            h = hospital_objs[h_idx]
            m = medicine_objs[m_idx]
            for day_offset in range(90, 0, -1):
                record_date = today - timedelta(days=day_offset)
                # Add realistic variation ±30%
                variation = random.uniform(0.7, 1.3)
                qty = max(0, int(avg_daily * variation))
                if qty > 0:
                    cr = ConsumptionRecord(
                        hospital_id=h.id,
                        medicine_id=m.id,
                        date=record_date,
                        quantity_consumed=qty,
                    )
                    db.add(cr)
                    consumption_count += 1
        db.flush()
        print(f"[SEED] {consumption_count} consumption records created")

        # ── Demo completed transfer ──────────────────────────────────────────
        # Find a valid batch from hospital 0 to demonstrate completed workflow
        if batch_objs:
            demo_batch = next(
                (b for b in batch_objs if b.hospital_id == hospital_objs[0].id
                 and b.status == "normal" and b.quantity >= 100),
                None
            )
            if demo_batch and len(medicine_objs) > 0:
                demo_transfer = Transfer(
                    donor_hospital_id=hospital_objs[0].id,
                    receiver_hospital_id=hospital_objs[1].id,
                    medicine_id=demo_batch.medicine_id,
                    batch_id=demo_batch.id,
                    quantity=200,
                    status="completed",
                    qr_code_token="demo-completed-qr-token-001",
                    mto_id=user_objs[3].id,
                    mto_notes="Approved. CCMC reported critical shortage.",
                    donor_pharmacist_id=user_objs[2].id,
                    donor_notes="Batch verified. Stock quality confirmed.",
                    receiver_pharmacist_id=user_objs[5].id,
                    receiver_notes="Received in good condition.",
                    received_quantity=200,
                    receipt_verified=True,
                    dispatch_date=today - timedelta(days=5),
                    estimated_delivery=today - timedelta(days=3),
                    actual_delivery=today - timedelta(days=2),
                )
                db.add(demo_transfer)
                # Reflect in stock
                demo_batch.quantity -= 200
                db.flush()
                print("[SEED] Demo completed transfer created")

        # ── Audit Logs ───────────────────────────────────────────────────────
        log_actions = [
            ("LOGIN", "user", user_objs[0].id, "Network admin logged in"),
            ("CREATE_HOSPITAL", "hospital", hospital_objs[0].id, f"Hospital {hospital_objs[0].name} registered"),
            ("INVENTORY_UPDATE", "batch", 1, "Batch status refreshed"),
        ]
        for action, etype, eid, detail in log_actions:
            db.add(AuditLog(user_id=user_objs[0].id, action=action, entity_type=etype, entity_id=eid, details=detail))

        db.commit()
        print("[SEED] ✅ Demo data seeding complete!")
        print("\n[SEED] Demo credentials:")
        print("  admin@doserelay.com       / Admin@123       (Network Admin)")
        print("  metro.admin@doserelay.com / Hospital@123    (Hospital Admin)")
        print("  pharmacist@doserelay.com  / Pharma@123      (Pharmacist)")
        print("  mto@doserelay.demo        / configured MTO_PASSWORD (MTO; development default documented)")
        print("  logistics@doserelay.com   / Logistics@123   (Logistics)")

    except Exception as e:
        db.rollback()
        print(f"[SEED] ❌ Error: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    Base.metadata.create_all(bind=engine)
    seed()
