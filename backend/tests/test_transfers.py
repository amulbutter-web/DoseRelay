"""Tests for transfer workflow and status transitions."""
import pytest
from app.services.transfer_service import validate_transition, VALID_TRANSITIONS
from fastapi import HTTPException


def test_valid_transition_mto_review():
    validate_transition("recommended", "pending_mto_review")  # Should not raise


def test_valid_transition_to_donor_approval():
    validate_transition("pending_mto_review", "awaiting_donor_approval")


def test_valid_transition_complete_flow():
    flow = [
        ("pending_mto_review", "awaiting_donor_approval"),
        ("awaiting_donor_approval", "awaiting_receiver_approval"),
        ("awaiting_receiver_approval", "approved"),
        ("approved", "ready_for_dispatch"),
        ("ready_for_dispatch", "dispatched"),
        ("dispatched", "in_transit"),
        ("in_transit", "delivered"),
        ("delivered", "receipt_verified"),
        ("receipt_verified", "completed"),
    ]
    for current, next_s in flow:
        validate_transition(current, next_s)  # none should raise


def test_invalid_transition():
    with pytest.raises(HTTPException) as exc_info:
        validate_transition("recommended", "completed")
    assert exc_info.value.status_code == 400


def test_invalid_transition_from_completed():
    with pytest.raises(HTTPException):
        validate_transition("completed", "pending_mto_review")


def test_all_terminal_states():
    for terminal in ("rejected", "cancelled", "completed"):
        allowed = VALID_TRANSITIONS.get(terminal, [])
        assert allowed == [], f"{terminal} should have no allowed transitions"


def test_transfers_list(client, admin_headers):
    resp = client.get("/api/v1/transfers", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_recommendations_list(client, admin_headers):
    resp = client.get("/api/v1/transfers/recommendations", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
