"""AI Chat endpoint using Groq."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import time
from collections import defaultdict
from datetime import datetime

from app.db.base import get_db
from app.core.config import settings
from app.core.security import get_current_user
from app.models.user import User

router = APIRouter(prefix="/chat", tags=["AI Chat"])

# Simple in-memory rate limiting: user_id -> list of timestamps
_rate_limit = defaultdict(list)
RATE_LIMIT = 20  # max per hour

SYSTEM_PROMPT = """You are the DoseRelay AI Assistant, a knowledgeable helper for the DoseRelay Intelligent Medicine Redistribution Platform.

DoseRelay is a healthcare platform that:
- Manages hospitals and their medicine inventory
- Tracks medicine batches with expiry dates  
- Detects surplus and shortage situations using AI
- Generates transfer recommendations to redistribute medicines
- Manages a complete transfer workflow: Recommended → Pending MTO Review → Awaiting Donor Approval → Awaiting Receiver Approval → Approved → Ready for Dispatch → Dispatched → In Transit → Delivered → Receipt Verification → Completed
- Provides demand forecasting using moving average and exponential smoothing
- Tracks logistics and QR-code-based transfer verification
- Provides analytics and reporting

Key roles:
- Network Administrator: full platform access
- Hospital Administrator: manages their hospital's inventory
- Pharmacist: approves medicine releases and receipts
- Medicine Transfer Officer (MTO): coordinates transfers, reviews recommendations
- Logistics Personnel: manages physical transfer logistics

Key formulas:
- Days of Cover = Available Stock / Average Daily Consumption
- Surplus = max(0, Available - Forecast Demand - Safety Stock - Committed)
- Shortage = max(0, Required - Available)

IMPORTANT: 
- Never approve transfers or authorize medicine release yourself
- For medical safety questions, direct users to authorized pharmacists
- When you have live database information, use it; otherwise provide guidance
- Be concise, professional, and helpful
"""

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_history: Optional[List[ChatMessage]] = []

class ChatResponse(BaseModel):
    response: str

def _check_rate_limit(user_id: int):
    now = time.time()
    hour_ago = now - 3600
    _rate_limit[user_id] = [t for t in _rate_limit[user_id] if t > hour_ago]
    if len(_rate_limit[user_id]) >= RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Max 20 messages per hour.")
    _rate_limit[user_id].append(now)

def _get_live_context(message: str, db: Session) -> str:
    """Fetch live DB data for context-aware answers."""
    msg_lower = message.lower()
    context_parts = []
    
    # Import here to avoid circular imports
    from app.models.hospital import Hospital
    from app.models.medicine import Medicine, MedicineBatch
    from app.models.transfer import Transfer, TransferRecommendation
    
    needs_shortage = any(w in msg_lower for w in ["shortage", "shortages", "lacking", "out of stock"])
    needs_surplus = any(w in msg_lower for w in ["surplus", "excess", "overflow"])
    needs_transfers = any(w in msg_lower for w in ["transfer", "in transit", "pending", "dispatched", "completed transfer"])
    needs_expiry = any(w in msg_lower for w in ["expir", "near-expiry", "approaching expiry", "expire"])
    needs_hospitals = any(w in msg_lower for w in ["hospital", "hospitals"])
    needs_batches = any(w in msg_lower for w in ["batch", "batches"])
    
    try:
        if needs_hospitals or needs_shortage or needs_surplus:
            hospitals = db.query(Hospital).filter(Hospital.status == "active").all()
            context_parts.append(f"Active hospitals ({len(hospitals)}): {', '.join(h.name for h in hospitals)}")
        
        if needs_shortage:
            # Count hospitals with critical/shortage batches
            critical_batches = db.query(MedicineBatch).filter(
                MedicineBatch.status.in_(["critical"])
            ).count()
            context_parts.append(f"Critical stock batches: {critical_batches}")
        
        if needs_expiry:
            from datetime import date, timedelta
            today = date.today()
            approaching = db.query(MedicineBatch).filter(
                MedicineBatch.expiry_date <= today + timedelta(days=60),
                MedicineBatch.expiry_date >= today,
                MedicineBatch.status.notin_(["recalled", "quarantined"])
            ).count()
            expired = db.query(MedicineBatch).filter(
                MedicineBatch.expiry_date < today
            ).count()
            context_parts.append(f"Batches approaching expiry (within 60 days): {approaching}, Expired batches: {expired}")
        
        if needs_transfers:
            in_transit = db.query(Transfer).filter(Transfer.status == "in_transit").count()
            pending = db.query(Transfer).filter(Transfer.status.in_(["pending_mto_review", "awaiting_donor_approval", "awaiting_receiver_approval"])).count()
            completed = db.query(Transfer).filter(Transfer.status == "completed").count()
            dispatched = db.query(Transfer).filter(Transfer.status == "dispatched").count()
            context_parts.append(f"Transfers - In Transit: {in_transit}, Pending approval: {pending}, Dispatched: {dispatched}, Completed: {completed}")
        
        if needs_batches and not needs_expiry:
            total = db.query(MedicineBatch).count()
            normal = db.query(MedicineBatch).filter(MedicineBatch.status == "normal").count()
            context_parts.append(f"Total medicine batches: {total}, Normal status: {normal}")
        
    except Exception as e:
        pass  # If DB query fails, still answer from knowledge
    
    if context_parts:
        return "\n\nLive platform data:\n" + "\n".join(f"- {c}" for c in context_parts)
    return ""

@router.post("", response_model=ChatResponse)
def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    _check_rate_limit(current_user.id)
    
    if not settings.GROQ_API_KEY or settings.GROQ_API_KEY == "gsk_placeholder_replace_with_real_key":
        raise HTTPException(
            status_code=503,
            detail="AI Assistant not configured. Please set GROQ_API_KEY in backend .env configuration."
        )
    
    try:
        from groq import Groq
    except ImportError:
        raise HTTPException(status_code=503, detail="Groq SDK not installed. Run: pip install groq")
    
    live_context = _get_live_context(request.message, db)
    system_with_context = SYSTEM_PROMPT + live_context + f"\n\nCurrent user: {current_user.full_name} (role: {current_user.role})"
    
    client = Groq(api_key=settings.GROQ_API_KEY)
    
    messages = [{"role": "system", "content": system_with_context}]
    # Add history (last 10 messages max)
    for msg in (request.conversation_history or [])[-10:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": request.message})
    
    try:
        completion = client.chat.completions.create(
            model=settings.GROQ_MODEL,
            messages=messages,
            max_tokens=1024,
            temperature=0.7,
        )
        return ChatResponse(response=completion.choices[0].message.content)
    except Exception as e:
        error_msg = str(e)
        if "rate_limit" in error_msg.lower():
            raise HTTPException(status_code=429, detail="Groq API rate limit hit. Please wait a moment.")
        elif "authentication" in error_msg.lower() or "api_key" in error_msg.lower():
            raise HTTPException(status_code=503, detail="Invalid Groq API key. Please check GROQ_API_KEY in backend configuration.")
        else:
            raise HTTPException(status_code=503, detail=f"AI service temporarily unavailable: {error_msg[:200]}")
