"""Add facility verification, private documents, requests and revoked sessions.
Existing hospital, inventory, forecast and analytics tables are unchanged.
"""

from alembic import op
from app.models.verification import (
    FacilityRegistration,
    VerificationDocument,
    MedicineRequest,
    RevokedSession,
    central_mto_index,
)

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade():
    central_mto_index.create(op.get_bind(), checkfirst=True)
    for model in [
        FacilityRegistration,
        VerificationDocument,
        MedicineRequest,
        RevokedSession,
    ]:
        model.__table__.create(op.get_bind(), checkfirst=True)


def downgrade():
    central_mto_index.drop(op.get_bind(), checkfirst=True)
    for model in [
        RevokedSession,
        MedicineRequest,
        VerificationDocument,
        FacilityRegistration,
    ]:
        model.__table__.drop(op.get_bind(), checkfirst=True)
