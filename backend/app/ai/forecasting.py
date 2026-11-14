"""Demand forecasting using moving average and exponential smoothing."""
from datetime import date, timedelta
from typing import List, Tuple, Optional
import numpy as np

from sqlalchemy.orm import Session

from app.models.consumption import ConsumptionRecord
from app.models.forecast import DemandForecast
from app.models.medicine import MedicineBatch


def _get_consumption_series(
    db: Session, hospital_id: int, medicine_id: int, days: int = 90
) -> Tuple[List[date], List[float]]:
    """Fetch daily consumption as ordered (dates, quantities)."""
    since = date.today() - timedelta(days=days)
    records = (
        db.query(ConsumptionRecord)
        .filter(
            ConsumptionRecord.hospital_id == hospital_id,
            ConsumptionRecord.medicine_id == medicine_id,
            ConsumptionRecord.date >= since,
        )
        .order_by(ConsumptionRecord.date.asc())
        .all()
    )
    if not records:
        return [], []

    # Build complete date range filling gaps with 0
    start = records[0].date
    end = records[-1].date
    record_map = {r.date: float(r.quantity_consumed) for r in records}
    dates, quantities = [], []
    current = start
    while current <= end:
        dates.append(current)
        quantities.append(record_map.get(current, 0.0))
        current += timedelta(days=1)
    return dates, quantities


def _moving_average(values: List[float], window: int = 7) -> np.ndarray:
    """Compute simple moving average."""
    arr = np.array(values, dtype=float)
    if len(arr) < window:
        return np.full(len(arr), np.mean(arr))
    kernel = np.ones(window) / window
    smoothed = np.convolve(arr, kernel, mode="full")[: len(arr)]
    # fill initial NaN equivalent values
    for i in range(window - 1):
        smoothed[i] = np.mean(arr[: i + 1])
    return smoothed


def _exponential_smoothing(values: List[float], alpha: float = 0.3) -> np.ndarray:
    """Single exponential smoothing (Holt-Winters simple)."""
    arr = np.array(values, dtype=float)
    result = np.zeros_like(arr)
    result[0] = arr[0]
    for i in range(1, len(arr)):
        result[i] = alpha * arr[i] + (1 - alpha) * result[i - 1]
    return result


def _mae(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.mean(np.abs(actual - predicted)))


def _rmse(actual: np.ndarray, predicted: np.ndarray) -> float:
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def generate_forecast(
    db: Session,
    hospital_id: int,
    medicine_id: int,
    days_ahead: int = 30,
) -> List[DemandForecast]:
    """
    Generate demand forecasts for the next `days_ahead` days.
    Uses exponential smoothing; evaluates on a 20% holdout.
    Returns list of DemandForecast ORM objects (not yet committed).
    """
    dates, quantities = _get_consumption_series(db, hospital_id, medicine_id, days=90)

    if len(quantities) < 7:
        # Not enough data – use a flat average
        avg = float(np.mean(quantities)) if quantities else 1.0
        forecasts = []
        for i in range(days_ahead):
            fd = date.today() + timedelta(days=i + 1)
            forecasts.append(
                DemandForecast(
                    hospital_id=hospital_id,
                    medicine_id=medicine_id,
                    forecast_date=fd,
                    forecasted_quantity=avg,
                    lower_bound=max(0.0, avg * 0.7),
                    upper_bound=avg * 1.3,
                    model_used="flat_average",
                    mae=None,
                    rmse=None,
                )
            )
        return forecasts

    arr = np.array(quantities, dtype=float)
    n = len(arr)
    holdout_size = max(1, int(n * 0.2))
    train, test = arr[: n - holdout_size], arr[n - holdout_size :]

    # Fit exponential smoothing on train
    alpha = 0.3
    smoothed_train = _exponential_smoothing(train.tolist(), alpha=alpha)
    last_smoothed = smoothed_train[-1]

    # Reconstruct test predictions
    test_preds = np.full(len(test), last_smoothed)
    mae = _mae(test, test_preds)
    rmse = _rmse(test, test_preds)

    # Full series smoothing for final forecast base
    full_smoothed = _exponential_smoothing(arr.tolist(), alpha=alpha)
    base = full_smoothed[-1]
    std = float(np.std(arr))

    # Delete existing forecasts for this pair
    db.query(DemandForecast).filter(
        DemandForecast.hospital_id == hospital_id,
        DemandForecast.medicine_id == medicine_id,
        DemandForecast.forecast_date >= date.today(),
    ).delete()

    forecasts = []
    for i in range(days_ahead):
        fd = date.today() + timedelta(days=i + 1)
        # slight decay towards mean over horizon
        horizon_adjustment = 1.0 - (i / (days_ahead * 2))
        fq = max(0.0, base * horizon_adjustment)
        lb = max(0.0, fq - 1.5 * std)
        ub = fq + 1.5 * std

        f = DemandForecast(
            hospital_id=hospital_id,
            medicine_id=medicine_id,
            forecast_date=fd,
            forecasted_quantity=round(fq, 2),
            lower_bound=round(lb, 2),
            upper_bound=round(ub, 2),
            model_used="exponential_smoothing",
            mae=round(mae, 3),
            rmse=round(rmse, 3),
        )
        db.add(f)
        forecasts.append(f)

    db.commit()
    return forecasts
