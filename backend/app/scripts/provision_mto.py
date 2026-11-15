"""Administrator-operated prototype provisioning: python -m app.scripts.provision_mto."""

import os, getpass
from app.db.base import Base, engine, SessionLocal
import app.models
import app.models.verification
from app.models.user import User
from app.core.security import get_password_hash
from app.core.config import settings


def main():
    Base.metadata.create_all(engine)
    password = os.getenv("MTO_PASSWORD") or getpass.getpass(
        "Central MTO password (use supplied development password for the prototype): "
    )
    if len(password) < 12:
        raise SystemExit("Use at least 12 characters")
    with SessionLocal() as db:
        existing = db.query(User).filter_by(role="mto").all()
        if len(existing) > 1:
            raise SystemExit(
                "Multiple MTO accounts exist; administrator must reconcile them first."
            )
        email = os.getenv(
            "MTO_EMAIL",
            "mto@doserelay.demo" if settings.APP_ENV == "development" else "",
        )
        if not email:
            raise SystemExit("MTO_EMAIL required in production")
        if existing:
            u = existing[0]
            u.email = email
            u.username = email
            u.hashed_password = get_password_hash(password)
            u.is_active = True
        else:
            db.add(
                User(
                    email=email,
                    username=email,
                    full_name="Central Medicine Transfer Officer",
                    role="mto",
                    hashed_password=get_password_hash(password),
                )
            )
        db.commit()
    print("One central MTO account provisioned.")


if __name__ == "__main__":
    main()
