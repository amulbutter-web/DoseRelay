# DoseRelay – Intelligent Medicine Redistribution and Inventory Optimisation Platform

> **⚠️ Disclaimer:** This is a decision-support and coordination platform for demonstration purposes. All data is fictional. Medicine transfers must comply with applicable laws, institutional policies, licensing requirements, storage conditions, and authorised approvals. This system does not replace regulatory authority or professional medical judgment.

## Overview

DoseRelay connects hospitals and healthcare institutions that have surplus medicine with hospitals experiencing shortages. The platform reduces avoidable medicine expiry and wastage through AI-powered demand forecasting, intelligent matching, and coordinated transfer workflows.

### Key Features

- **Hospital & Inventory Management** – Register hospitals, manage medicine inventory at batch level
- **Expiry Management** – Automatic categorization of batches by expiry status
- **AI Demand Forecasting** – Moving average and exponential smoothing with MAE/RMSE evaluation
- **Surplus & Shortage Detection** – Calculate days of cover, identify eligible surplus and critical shortages
- **Intelligent Matching** – AI-powered recommendation engine with Google OR-Tools optimization
- **Transfer Workflow** – Complete multi-step workflow with MTO coordination and pharmacist approvals
- **QR Code Tracking** – Unique QR codes for transfer verification
- **Analytics & Reporting** – Professional dashboards with CSV/PDF export
- **Role-Based Access** – Five distinct roles with appropriate permissions

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, Lucide React, Leaflet |
| Backend | Python FastAPI, SQLAlchemy, Pydantic, JWT Authentication |
| Database | PostgreSQL 15 |
| AI/ML | Pandas, NumPy, Scikit-learn, Statsmodels, Google OR-Tools |
| Infrastructure | Docker, Docker Compose |

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Git

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd dose-relay

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up --build
```

The application will be available at:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8000
- **API Documentation:** http://localhost:8000/docs

### Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Network Administrator | admin@doserelay.com | Admin@123 |
| Hospital Administrator | metro.admin@doserelay.com | Hospital@123 |
| Pharmacist | pharmacist@doserelay.com | Pharma@123 |
| Medicine Transfer Officer | mto@doserelay.com | Transfer@123 |
| Logistics Personnel | logistics@doserelay.com | Logistics@123 |

> All credentials are for demonstration purposes only.

## Application Modules

### A. Authentication & Role Management
Secure JWT-based authentication with five roles: Network Administrator, Hospital Administrator, Pharmacist, Medicine Transfer Officer (MTO), and Logistics Personnel. Each role sees only authorized modules.

### B. Dashboard
Live database-driven statistics including total hospitals, medicines, batches, shortage/surplus hospitals, expiry alerts, pending/completed transfers, and recent activities.

### C. Hospital Management
Hospital registration with location, contact info, inventory overview, and surplus/shortage analysis.

### D. Medicine Inventory
Batch-level inventory tracking with manufacturing/expiry dates, storage requirements, consumption history, and CSV upload.

### E. Expiry Management
Automatic categorization: Normal, Approaching Expiry, Critical, Expired, Quarantined, Recalled.

### F. AI Demand Forecasting
Historical consumption analysis with forecasted demand, confidence intervals, days of cover estimates, and model performance metrics (MAE, RMSE).

### G. Surplus & Shortage Detection
- **Days of Cover** = Available Stock / Average Daily Consumption
- **Surplus** = max(0, Available − Forecast Demand − Safety Stock − Committed)
- **Shortage** = max(0, Required − Available)

### H. Intelligent Matching & Optimisation
AI-powered recommendation engine with Google OR-Tools optimization considering urgency, proximity, expiry risk, and transport feasibility.

### I. MTO Dashboard
Dedicated dashboard for Medicine Transfer Officers to review recommendations, coordinate approvals, and manage transfers.

### J. Pharmacist Approvals
Separate donor and receiver pharmacist verification with timestamps, identity, comments, and audit history.

### K. Transfer Workflow
Complete status flow: Recommended → Pending MTO Review → Awaiting Donor Approval → Awaiting Receiver Approval → Approved → Ready for Dispatch → Dispatched → In Transit → Delivered → Receipt Verified → Completed.

### L. QR Code Tracking
Unique QR codes for approved transfers, enabling verification at each stage.

### M. Logistics Management
Transfer logistics with donor/receiver locations, dispatch/delivery tracking, and confirmation.

### N. Analytics & Reporting
Professional dashboards with transfer statistics, redistribution metrics, forecast performance, and CSV/PDF export.

## Project Structure

```
dose-relay/
├── docker-compose.yml
├── .env.example
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/
│   │   ├── env.py
│   │   └── versions/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── db/
│   │   │   └── base.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── hospital.py
│   │   │   ├── medicine.py
│   │   │   ├── consumption.py
│   │   │   ├── forecast.py
│   │   │   ├── transfer.py
│   │   │   └── audit.py
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── hospital.py
│   │   │   ├── medicine.py
│   │   │   ├── transfer.py
│   │   │   ├── forecast.py
│   │   │   └── analytics.py
│   │   ├── services/
│   │   │   ├── hospital_service.py
│   │   │   ├── medicine_service.py
│   │   │   ├── inventory_service.py
│   │   │   ├── transfer_service.py
│   │   │   └── analytics_service.py
│   │   ├── ai/
│   │   │   ├── forecasting.py
│   │   │   ├── matching.py
│   │   │   └── optimization.py
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── hospitals.py
│   │   │       ├── medicines.py
│   │   │       ├── inventory.py
│   │   │       ├── forecasts.py
│   │   │       ├── transfers.py
│   │   │       ├── analytics.py
│   │   │       └── notifications.py
│   │   ├── utils/
│   │   └── scripts/
│   │       └── seed_demo_data.py
│   └── tests/
│       ├── conftest.py
│       ├── test_auth.py
│       ├── test_inventory.py
│       ├── test_transfers.py
│       └── test_forecasting.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── App.tsx
│       ├── main.tsx
│       ├── index.css
│       ├── api/
│       ├── components/
│       │   ├── common/
│       │   ├── layout/
│       │   ├── charts/
│       │   └── forms/
│       ├── contexts/
│       ├── hooks/
│       ├── pages/
│       ├── types/
│       └── utils/
```

## API Documentation

The backend provides auto-generated API documentation:
- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/login | Login and receive JWT token |
| GET | /api/v1/auth/me | Get current user profile |
| GET | /api/v1/hospitals | List all hospitals |
| GET | /api/v1/medicines | List all medicines |
| GET | /api/v1/medicines/batches | List all batches |
| GET | /api/v1/inventory/surplus | Get surplus inventory |
| GET | /api/v1/inventory/shortages | Get shortage inventory |
| POST | /api/v1/forecasts/generate | Generate demand forecast |
| POST | /api/v1/transfers/recommendations/generate | Generate AI recommendations |
| POST | /api/v1/transfers | Create transfer |
| PUT | /api/v1/transfers/{id}/status | Update transfer status |
| GET | /api/v1/analytics/dashboard | Get dashboard statistics |

## Testing

### Backend Tests
```bash
cd backend
pytest tests/ -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

## Demonstration Workflow

### End-to-End Medicine Transfer

1. **Login** as Network Administrator (admin@doserelay.com / Admin@123)
2. **Dashboard** – View system overview with shortage and surplus hospitals
3. **Surplus & Shortages** – Identify hospitals with surplus and shortage
4. **Generate Recommendations** – Click "Generate Recommendations" to run AI matching
5. **Review Recommendations** – View AI-generated transfer recommendations with reasons
6. **Create Transfer** – Accept a recommendation to create a transfer
7. **Login as MTO** (mto@doserelay.com / Transfer@123)
8. **MTO Review** – Review and approve the transfer
9. **Login as Pharmacist** (pharmacist@doserelay.com / Pharma@123)
10. **Donor Approval** – Verify batch and approve release
11. **Receiver Approval** – Verify specifications and approve receipt
12. **Login as Logistics** (logistics@doserelay.com / Logistics@123)
13. **Dispatch** – Mark transfer as dispatched
14. **Delivery** – Update to in-transit, then delivered
15. **Receipt Verification** – Verify received quantity and complete transfer
16. **Analytics** – View updated statistics and transfer metrics

## Development

### Running Without Docker

**Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
# Ensure PostgreSQL is running and DATABASE_URL is set
alembic upgrade head
python -m app.scripts.seed_demo_data
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

## License

This project is for educational and demonstration purposes.

## Acknowledgments

- Built with FastAPI, React, PostgreSQL, and Google OR-Tools
- Medical icons from Lucide React
- Charts powered by Recharts
