"""OR-Tools optimisation for medicine redistribution allocation."""
from typing import List, Dict, Optional

try:
    from ortools.linear_solver import pywraplp
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False

from sqlalchemy.orm import Session
from app.services.inventory_service import get_surplus_hospitals, get_shortage_hospitals


def optimise_allocations(db: Session) -> List[Dict]:
    """
    Use OR-Tools LP solver to optimise redistribution across all surplus/shortage pairs.
    Objective: minimise total unmet shortage.
    Returns list of allocation dicts: {donor, receiver, medicine_id, quantity, objective}.
    Falls back to greedy matching if OR-Tools is unavailable.
    """
    surpluses = get_surplus_hospitals(db)
    shortages = get_shortage_hospitals(db)

    if not surpluses or not shortages:
        return []

    if not ORTOOLS_AVAILABLE:
        return _greedy_allocations(surpluses, shortages)

    solver = pywraplp.Solver.CreateSolver("GLOP")
    if not solver:
        return _greedy_allocations(surpluses, shortages)

    # Decision variables: x[(donor_hid, receiver_hid, med_id)] = quantity to transfer
    variables: Dict = {}
    surplus_index: Dict = {}   # (hospital_id, medicine_id) -> surplus amount
    shortage_index: Dict = {}  # (hospital_id, medicine_id) -> shortage amount

    for s in surpluses:
        surplus_index[(s["hospital_id"], s["medicine_id"])] = s["surplus"]
    for sh in shortages:
        shortage_index[(sh["hospital_id"], sh["medicine_id"])] = sh["shortage"]

    # Create variables for each matching pair
    for s in surpluses:
        for sh in shortages:
            if s["medicine_id"] != sh["medicine_id"]:
                continue
            if s["hospital_id"] == sh["hospital_id"]:
                continue
            key = (s["hospital_id"], sh["hospital_id"], s["medicine_id"])
            cap = min(s["surplus"], sh["shortage"])
            if cap <= 0:
                continue
            var = solver.NumVar(0, cap, str(key))
            variables[key] = var

    if not variables:
        return _greedy_allocations(surpluses, shortages)

    # Constraints: don't exceed surplus
    for s in surpluses:
        sk = (s["hospital_id"], s["medicine_id"])
        relevant = [v for k, v in variables.items() if k[0] == sk[0] and k[2] == sk[1]]
        if relevant:
            solver.Add(solver.Sum(relevant) <= surplus_index[sk])

    # Objective: maximise total quantity transferred (= minimise shortage)
    solver.Maximize(solver.Sum(variables.values()))

    status = solver.Solve()
    results = []
    if status in (pywraplp.Solver.OPTIMAL, pywraplp.Solver.FEASIBLE):
        for (donor, receiver, med_id), var in variables.items():
            qty = int(var.solution_value())
            if qty > 0:
                results.append({
                    "donor_hospital_id": donor,
                    "receiver_hospital_id": receiver,
                    "medicine_id": med_id,
                    "quantity": qty,
                    "method": "ortools_lp",
                })
    return results


def _greedy_allocations(surpluses: List[Dict], shortages: List[Dict]) -> List[Dict]:
    """Greedy fallback: match by medicine_id, highest shortage first."""
    shortages_sorted = sorted(shortages, key=lambda x: x["shortage"], reverse=True)
    surplus_remaining: Dict = {(s["hospital_id"], s["medicine_id"]): s["surplus"] for s in surpluses}
    results = []

    for sh in shortages_sorted:
        remaining_need = sh["shortage"]
        for s in surpluses:
            if s["medicine_id"] != sh["medicine_id"]:
                continue
            if s["hospital_id"] == sh["hospital_id"]:
                continue
            key = (s["hospital_id"], s["medicine_id"])
            available = surplus_remaining.get(key, 0)
            if available <= 0:
                continue
            qty = min(available, remaining_need)
            if qty > 0:
                results.append({
                    "donor_hospital_id": s["hospital_id"],
                    "receiver_hospital_id": sh["hospital_id"],
                    "medicine_id": sh["medicine_id"],
                    "quantity": qty,
                    "method": "greedy",
                })
                surplus_remaining[key] = available - qty
                remaining_need -= qty
            if remaining_need <= 0:
                break
    return results
