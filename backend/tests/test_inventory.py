"""Tests for inventory calculations."""
from datetime import date, timedelta
from app.services.inventory_service import (
    categorize_batch_status,
    calculate_days_of_cover,
    calculate_surplus,
    calculate_shortage,
)


def test_expiry_normal():
    future = date.today() + timedelta(days=90)
    assert categorize_batch_status(future) == "normal"


def test_expiry_approaching():
    soon = date.today() + timedelta(days=50)
    assert categorize_batch_status(soon) == "approaching_expiry"


def test_expiry_critical():
    critical = date.today() + timedelta(days=20)
    assert categorize_batch_status(critical) == "critical"


def test_expiry_expired():
    past = date.today() - timedelta(days=5)
    assert categorize_batch_status(past) == "expired"


def test_days_of_cover_normal():
    assert calculate_days_of_cover(300, 10.0) == 30.0


def test_days_of_cover_zero_consumption():
    assert calculate_days_of_cover(100, 0.0) == float("inf")


def test_days_of_cover_zero_stock():
    assert calculate_days_of_cover(0, 0.0) == 0.0


def test_surplus_calculation():
    # 1000 available, 300 forecast, 100 safety, 50 committed
    assert calculate_surplus(1000, 300, 100, 50) == 550


def test_surplus_no_surplus():
    assert calculate_surplus(100, 300, 100, 0) == 0


def test_shortage_calculation():
    # Need 500 but only 200 available
    assert calculate_shortage(500, 200) == 300


def test_shortage_no_shortage():
    assert calculate_shortage(100, 500) == 0


def test_hospitals_endpoint(client, admin_headers):
    resp = client.get("/api/v1/hospitals", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_medicines_endpoint(client, admin_headers):
    resp = client.get("/api/v1/medicines", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_surplus_endpoint(client, admin_headers):
    resp = client.get("/api/v1/inventory/surplus", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        item = data[0]
        assert "hospital_id" in item
        assert "hospital_name" in item
        assert "medicine_id" in item
        assert "medicine_name" in item
        assert "available_stock" in item
        assert "forecast_demand" in item
        assert "safety_stock" in item
        assert "surplus" in item
        assert item["surplus"] > 0
        assert "days_of_cover" in item
        assert "urgency" in item
        assert item["urgency"] in ["critical", "high", "medium", "low"]


def test_shortages_endpoint(client, admin_headers):
    resp = client.get("/api/v1/inventory/shortages", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    if data:
        item = data[0]
        assert "hospital_id" in item
        assert "hospital_name" in item
        assert "medicine_id" in item
        assert "medicine_name" in item
        assert "available_stock" in item
        assert "forecast_demand" in item
        assert "safety_stock" in item
        assert "shortage" in item
        assert item["shortage"] > 0
        assert "days_of_cover" in item
        assert "urgency" in item
        assert item["urgency"] in ["critical", "high", "medium", "low"]
        assert "suggested_donors" in item
        assert isinstance(item["suggested_donors"], list)
        for donor in item["suggested_donors"]:
            assert "hospital_id" in donor
            assert "hospital_name" in donor
            assert "surplus" in donor
            assert donor["hospital_id"] != item["hospital_id"]


def test_refresh_statuses_endpoint(client, admin_headers):
    resp = client.post("/api/v1/inventory/refresh-statuses", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
