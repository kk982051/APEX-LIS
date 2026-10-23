from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from database import get_db
from models import User

router = APIRouter(prefix="/auth", tags=["Authentication & Users"])

class LoginRequest(BaseModel):
    username: Optional[str] = None
    role: Optional[str] = None
    pin_code: str = "1234"

class UserUpdate(BaseModel):
    full_name: str
    title: Optional[str] = None
    email: Optional[str] = None
    pin_code: Optional[str] = None
    role: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    title: str
    email: Optional[str] = None
    is_active: bool

@router.get("/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(User).filter(User.is_active == True).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "full_name": u.full_name,
            "role": u.role,
            "title": u.title,
            "email": u.email,
            "is_active": u.is_active
        }
        for u in users
    ]

@router.post("/login")
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    query = db.query(User).filter(User.is_active == True)
    if payload.username:
        user = query.filter(User.username == payload.username).first()
    elif payload.role:
        user = query.filter(User.role == payload.role.upper()).first()
    else:
        raise HTTPException(status_code=400, detail="Must provide username or role")

    if not user:
        raise HTTPException(status_code=404, detail="User not found for given credentials")

    if payload.pin_code and user.pin_code and payload.pin_code != user.pin_code:
        raise HTTPException(status_code=401, detail="Invalid PIN code")

    return {
        "status": "SUCCESS",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "title": user.title,
            "email": user.email
        },
        "token": f"token_{user.username}_{user.role}"
    }

@router.put("/users/{user_id}")
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.full_name = payload.full_name
    if payload.title is not None:
        user.title = payload.title
    if payload.email is not None:
        user.email = payload.email
    if payload.pin_code is not None and payload.pin_code.strip():
        user.pin_code = payload.pin_code
    if payload.role is not None:
        user.role = payload.role.upper()

    db.commit()
    db.refresh(user)

    return {
        "status": "UPDATED",
        "user": {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "role": user.role,
            "title": user.title,
            "email": user.email
        }
    }
