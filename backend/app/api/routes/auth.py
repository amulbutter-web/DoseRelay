"""Authentication routes."""
import hashlib
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from app.models.verification import RevokedSession
from app.services.verification_service import check_account
from app.core.security import oauth2_scheme
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.core.security import (
    verify_password, get_password_hash,
    create_access_token, get_current_user,
)
from app.models.user import User
from app.schemas.user import LoginRequest, Token, UserCreate, UserResponse, UserUpdate, PasswordChange

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/login", response_model=Token)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(or_(User.email == data.email.lower(), User.username == data.email)).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
    check_account(db, user)
    if user.role == "mto":
        raise HTTPException(403, "Use MTO in the existing sidebar to sign in")
    token = create_access_token({"sub": str(user.id)})
    return Token(
        access_token=token,
        token_type="bearer",
        user=UserResponse.model_validate(user),
    )


@router.post("/register", response_model=UserResponse, status_code=201)
def register(data: UserCreate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if current_user.role != "network_admin":
        raise HTTPException(status_code=403, detail="Only Network Administrators can register users")
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    if data.role == "mto" and db.query(User).filter_by(role="mto").first():
        raise HTTPException(409, "The central MTO account already exists")
    user = User(
        email=data.email,
        username=data.username,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        role=data.role,
        hospital_id=data.hospital_id,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Account or central MTO already exists")
    db.refresh(user)
    return user


@router.get("/me", response_model=UserResponse)
def get_me(current_user=Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_me(data: UserUpdate, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    for field, value in data.model_dump(exclude_unset=True).items():
        if field not in ("is_active", "hospital_id"):  # don't allow self-deactivation
            setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@router.put("/me/password")
def change_password(data: PasswordChange, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    current_user.hashed_password = get_password_hash(data.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.post('/mto/login', response_model=Token)
def mto_login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.role == 'mto', or_(User.email == data.email.lower(), User.username == data.email)).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(401, 'Invalid MTO credentials')
    check_account(db, user)
    return Token(access_token=create_access_token({'sub': str(user.id), 'audience': 'mto'}), user=UserResponse.model_validate(user))

@router.post('/logout')
def logout(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    digest = hashlib.sha256(token.encode()).hexdigest()
    if not db.get(RevokedSession, digest):
        db.add(RevokedSession(id=digest)); db.commit()
    return {'message': 'Session ended'}
