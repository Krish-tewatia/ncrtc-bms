from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_pw, create_token, current_user
from app.models.user import User
from app.schemas import Token, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])

@router.post("/login", response_model=Token)
def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form.username).first()
    if not user or not verify_pw(form.password, user.password_hash):
        raise HTTPException(401, "Invalid username or password")
    tok = create_token(user.username, user.role)
    return Token(access_token=tok, role=user.role,
                 username=user.username, full_name=user.full_name)

@router.get("/me", response_model=UserOut)
def me(u: User = Depends(current_user)):
    return u
