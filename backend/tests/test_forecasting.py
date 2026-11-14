"""Tests for demand forecasting module."""
import pytest
from app.ai.forecasting import _moving_average, _exponential_smoothing, _mae, _rmse
import numpy as np


def test_moving_average_basic():
    values = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0]
    result = _moving_average(values, window=3)
    assert len(result) == len(values)
    # Last value should be average of last 3
    assert abs(result[-1] - 60.0) < 0.01


def test_moving_average_short_series():
    values = [5.0, 10.0]
    result = _moving_average(values, window=7)
    assert len(result) == 2


def test_exponential_smoothing_basic():
    values = [10.0] * 10
    result = _exponential_smoothing(values, alpha=0.3)
    assert len(result) == 10
    # For constant series, smoothed should converge to same value
    assert abs(result[-1] - 10.0) < 1.0


def test_mae_perfect():
    actual = np.array([1.0, 2.0, 3.0])
    predicted = np.array([1.0, 2.0, 3.0])
    assert _mae(actual, predicted) == 0.0


def test_rmse_basic():
    actual = np.array([1.0, 2.0, 3.0])
    predicted = np.array([2.0, 2.0, 2.0])
    rmse = _rmse(actual, predicted)
    assert rmse > 0


def test_forecast_endpoint(client, admin_headers):
    # Forecast summary should return valid JSON
    resp = client.get("/api/v1/forecasts/summary/all", headers=admin_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
