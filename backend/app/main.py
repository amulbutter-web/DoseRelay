"""DoseRelay FastAPI Application."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.base import Base, engine
from app.api.routes import auth, hospitals, medicines, inventory, forecasts, transfers, analytics, notifications, chat

# Import all models so SQLAlchemy can register them
import app.models  # noqa: F401
import app.models.verification
from app.api.routes import registration, requests

app = FastAPI(
    title="DoseRelay API",
    description="Intelligent Medicine Redistribution and Inventory Optimisation Platform",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
PREFIX = "/api/v1"
app.include_router(auth.router, prefix=PREFIX)
app.include_router(registration.router, prefix=PREFIX)
app.include_router(requests.router, prefix=PREFIX)
app.include_router(hospitals.router, prefix=PREFIX)
app.include_router(medicines.router, prefix=PREFIX)
app.include_router(inventory.router, prefix=PREFIX)
app.include_router(forecasts.router, prefix=PREFIX)
app.include_router(transfers.router, prefix=PREFIX)
app.include_router(analytics.router, prefix=PREFIX)
app.include_router(notifications.router, prefix=PREFIX)
app.include_router(chat.router, prefix=PREFIX)


@app.on_event("startup")
def on_startup():
    """Create all tables on startup (Alembic handles migrations in production)."""
    Base.metadata.create_all(bind=engine)
    from app.models.verification import central_mto_index
    central_mto_index.create(bind=engine, checkfirst=True)


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME, "version": "1.0.0"}


@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs",
        "health": "/health",
    }
