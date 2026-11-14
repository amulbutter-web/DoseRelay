"""Initial schema – all tables.

Revision ID: 001
Revises: 
Create Date: 2024-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── hospitals ────────────────────────────────────────────────────────────
    op.create_table(
        'hospitals',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('address', sa.String(500), nullable=False),
        sa.Column('city', sa.String(100), nullable=False),
        sa.Column('state', sa.String(100), nullable=False),
        sa.Column('country', sa.String(100), server_default='India'),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('phone', sa.String(20), nullable=True),
        sa.Column('email', sa.String(255), nullable=True),
        sa.Column('hospital_type', sa.String(50), server_default='general'),
        sa.Column('bed_count', sa.Integer(), server_default='0'),
        sa.Column('status', sa.String(20), server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_hospitals_id', 'hospitals', ['id'], unique=False)
    op.create_index('ix_hospitals_code', 'hospitals', ['code'], unique=True)

    # ── users ────────────────────────────────────────────────────────────────
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_id', 'users', ['id'], unique=False)
    op.create_index('ix_users_email', 'users', ['email'], unique=True)
    op.create_index('ix_users_username', 'users', ['username'], unique=True)

    # ── medicines ────────────────────────────────────────────────────────────
    op.create_table(
        'medicines',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('generic_name', sa.String(255), nullable=True),
        sa.Column('active_ingredient', sa.String(255), nullable=True),
        sa.Column('strength', sa.String(100), nullable=True),
        sa.Column('dosage_form', sa.String(50), server_default='tablet'),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('manufacturer', sa.String(255), nullable=True),
        sa.Column('requires_cold_storage', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('controlled_substance', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_medicines_id', 'medicines', ['id'], unique=False)

    # ── medicine_batches ─────────────────────────────────────────────────────
    op.create_table(
        'medicine_batches',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('medicine_id', sa.Integer(), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=False),
        sa.Column('batch_number', sa.String(100), nullable=False),
        sa.Column('quantity', sa.Integer(), server_default='0', nullable=False),
        sa.Column('reserved_quantity', sa.Integer(), server_default='0', nullable=False),
        sa.Column('manufacturing_date', sa.Date(), nullable=True),
        sa.Column('expiry_date', sa.Date(), nullable=False),
        sa.Column('unit_price', sa.Float(), server_default='0.0', nullable=True),
        sa.Column('storage_temp_min', sa.Float(), nullable=True),
        sa.Column('storage_temp_max', sa.Float(), nullable=True),
        sa.Column('status', sa.String(30), server_default='normal'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id']),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('batch_number', 'hospital_id', 'medicine_id', name='uq_batch_hospital_medicine'),
    )
    op.create_index('ix_medicine_batches_id', 'medicine_batches', ['id'], unique=False)
    op.create_index('ix_medicine_batches_medicine_id', 'medicine_batches', ['medicine_id'], unique=False)
    op.create_index('ix_medicine_batches_hospital_id', 'medicine_batches', ['hospital_id'], unique=False)

    # ── consumption_records ──────────────────────────────────────────────────
    op.create_table(
        'consumption_records',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=False),
        sa.Column('medicine_id', sa.Integer(), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('quantity_consumed', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id']),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_consumption_records_id', 'consumption_records', ['id'], unique=False)
    op.create_index('ix_consumption_records_hospital_id', 'consumption_records', ['hospital_id'], unique=False)
    op.create_index('ix_consumption_records_medicine_id', 'consumption_records', ['medicine_id'], unique=False)

    # ── demand_forecasts ─────────────────────────────────────────────────────
    op.create_table(
        'demand_forecasts',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('hospital_id', sa.Integer(), nullable=False),
        sa.Column('medicine_id', sa.Integer(), nullable=False),
        sa.Column('forecast_date', sa.Date(), nullable=False),
        sa.Column('forecasted_quantity', sa.Float(), nullable=False),
        sa.Column('lower_bound', sa.Float(), nullable=True),
        sa.Column('upper_bound', sa.Float(), nullable=True),
        sa.Column('model_used', sa.String(100), nullable=True),
        sa.Column('mae', sa.Float(), nullable=True),
        sa.Column('rmse', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['hospital_id'], ['hospitals.id']),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_demand_forecasts_id', 'demand_forecasts', ['id'], unique=False)
    op.create_index('ix_demand_forecasts_hospital_id', 'demand_forecasts', ['hospital_id'], unique=False)
    op.create_index('ix_demand_forecasts_medicine_id', 'demand_forecasts', ['medicine_id'], unique=False)

    # ── transfer_recommendations ─────────────────────────────────────────────
    op.create_table(
        'transfer_recommendations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('donor_hospital_id', sa.Integer(), nullable=False),
        sa.Column('receiver_hospital_id', sa.Integer(), nullable=False),
        sa.Column('medicine_id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('recommended_quantity', sa.Integer(), nullable=False),
        sa.Column('reason', sa.Text(), nullable=False),
        sa.Column('eligibility_notes', sa.Text(), nullable=True),
        sa.Column('warnings', sa.Text(), nullable=True),
        sa.Column('priority', sa.String(20), server_default='medium'),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['batch_id'], ['medicine_batches.id']),
        sa.ForeignKeyConstraint(['donor_hospital_id'], ['hospitals.id']),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id']),
        sa.ForeignKeyConstraint(['receiver_hospital_id'], ['hospitals.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_transfer_recommendations_id', 'transfer_recommendations', ['id'], unique=False)

    # ── transfers ────────────────────────────────────────────────────────────
    op.create_table(
        'transfers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('recommendation_id', sa.Integer(), nullable=True),
        sa.Column('donor_hospital_id', sa.Integer(), nullable=False),
        sa.Column('receiver_hospital_id', sa.Integer(), nullable=False),
        sa.Column('medicine_id', sa.Integer(), nullable=False),
        sa.Column('batch_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(30), server_default='recommended'),
        sa.Column('qr_code_token', sa.String(255), nullable=True),
        sa.Column('mto_id', sa.Integer(), nullable=True),
        sa.Column('mto_notes', sa.Text(), nullable=True),
        sa.Column('donor_pharmacist_id', sa.Integer(), nullable=True),
        sa.Column('donor_approval_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('donor_notes', sa.Text(), nullable=True),
        sa.Column('receiver_pharmacist_id', sa.Integer(), nullable=True),
        sa.Column('receiver_approval_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('receiver_notes', sa.Text(), nullable=True),
        sa.Column('logistics_personnel_id', sa.Integer(), nullable=True),
        sa.Column('dispatch_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('estimated_delivery', sa.DateTime(timezone=True), nullable=True),
        sa.Column('actual_delivery', sa.DateTime(timezone=True), nullable=True),
        sa.Column('delivery_notes', sa.Text(), nullable=True),
        sa.Column('received_quantity', sa.Integer(), nullable=True),
        sa.Column('receipt_verified', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('cancellation_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['batch_id'], ['medicine_batches.id']),
        sa.ForeignKeyConstraint(['donor_hospital_id'], ['hospitals.id']),
        sa.ForeignKeyConstraint(['donor_pharmacist_id'], ['users.id']),
        sa.ForeignKeyConstraint(['logistics_personnel_id'], ['users.id']),
        sa.ForeignKeyConstraint(['medicine_id'], ['medicines.id']),
        sa.ForeignKeyConstraint(['mto_id'], ['users.id']),
        sa.ForeignKeyConstraint(['receiver_hospital_id'], ['hospitals.id']),
        sa.ForeignKeyConstraint(['receiver_pharmacist_id'], ['users.id']),
        sa.ForeignKeyConstraint(['recommendation_id'], ['transfer_recommendations.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('qr_code_token'),
    )
    op.create_index('ix_transfers_id', 'transfers', ['id'], unique=False)

    # ── audit_logs ───────────────────────────────────────────────────────────
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('entity_id', sa.Integer(), nullable=True),
        sa.Column('details', sa.Text(), nullable=True),
        sa.Column('ip_address', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_audit_logs_id', 'audit_logs', ['id'], unique=False)

    # ── notifications ────────────────────────────────────────────────────────
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('notification_type', sa.String(50), server_default='info'),
        sa.Column('is_read', sa.Boolean(), server_default=sa.text('false')),
        sa.Column('link', sa.String(500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_notifications_id', 'notifications', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_notifications_id', table_name='notifications')
    op.drop_table('notifications')
    op.drop_index('ix_audit_logs_id', table_name='audit_logs')
    op.drop_table('audit_logs')
    op.drop_index('ix_transfers_id', table_name='transfers')
    op.drop_table('transfers')
    op.drop_index('ix_transfer_recommendations_id', table_name='transfer_recommendations')
    op.drop_table('transfer_recommendations')
    op.drop_index('ix_demand_forecasts_medicine_id', table_name='demand_forecasts')
    op.drop_index('ix_demand_forecasts_hospital_id', table_name='demand_forecasts')
    op.drop_index('ix_demand_forecasts_id', table_name='demand_forecasts')
    op.drop_table('demand_forecasts')
    op.drop_index('ix_consumption_records_medicine_id', table_name='consumption_records')
    op.drop_index('ix_consumption_records_hospital_id', table_name='consumption_records')
    op.drop_index('ix_consumption_records_id', table_name='consumption_records')
    op.drop_table('consumption_records')
    op.drop_index('ix_medicine_batches_hospital_id', table_name='medicine_batches')
    op.drop_index('ix_medicine_batches_medicine_id', table_name='medicine_batches')
    op.drop_index('ix_medicine_batches_id', table_name='medicine_batches')
    op.drop_table('medicine_batches')
    op.drop_index('ix_medicines_id', table_name='medicines')
    op.drop_table('medicines')
    op.drop_index('ix_users_username', table_name='users')
    op.drop_index('ix_users_email', table_name='users')
    op.drop_index('ix_users_id', table_name='users')
    op.drop_table('users')
    op.drop_index('ix_hospitals_code', table_name='hospitals')
    op.drop_index('ix_hospitals_id', table_name='hospitals')
    op.drop_table('hospitals')
