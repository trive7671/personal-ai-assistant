from pydantic import BaseModel, EmailStr, HttpUrl, field_validator
from typing import List, Optional
from datetime import datetime, timezone
import re

# --- Authentication Schemas ---

class UserBase(BaseModel):
    username: str
    full_name: Optional[str] = None
    email: Optional[str] = None

class UserCreate(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters long')
        if not re.search(r'[A-Z]', v):
            raise ValueError('Password must contain at least one uppercase letter')
        if not re.search(r'[a-z]', v):
            raise ValueError('Password must contain at least one lowercase letter')
        if not re.search(r'\d', v):
            raise ValueError('Password must contain at least one digit')
        if not re.search(r'[@$!%*?&_#^-]', v):
            raise ValueError('Password must contain at least one special character')
        return v

class UserResponse(UserBase):
    id: int
    email: Optional[str] = None
    created_at: datetime

    @field_validator('created_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True

class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None


class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None
    user_id: Optional[int] = None


# --- URL Scanner Schemas ---

class ScanRequest(BaseModel):
    url: str

class ScanResponse(BaseModel):
    id: int
    url: str
    risk: str
    score: int
    issues: List[str]
    ai_explanation: Optional[str] = None
    created_at: datetime

    @field_validator('created_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True


# --- Vulnerability Explainer Schemas ---

class VulnerabilityExplainRequest(BaseModel):
    name: str

class VulnerabilityExplainResponse(BaseModel):
    name: str
    what_is_it: str
    how_attackers_use: str
    impact: str
    how_to_fix: str


# --- Chatbot Schemas ---

class ChatMessage(BaseModel):
    id: Optional[int] = None
    sender: str  # "user" or "ai"
    text: str
    session_id: Optional[str] = "default"
    created_at: Optional[datetime] = None

    @field_validator('created_at', mode='before')
    @classmethod
    def ensure_utc(cls, v):
        if isinstance(v, datetime) and v.tzinfo is None:
            return v.replace(tzinfo=timezone.utc)
        return v

    class Config:
        from_attributes = True

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    session_id: Optional[str] = "default"

class ChatResponse(BaseModel):
    response: str

# --- 2FA Schemas ---

class TwoFASetupResponse(BaseModel):
    qr_code: str          # base64 PNG
    secret: str           # raw secret (show once)
    totp_enabled: bool

class TwoFAVerifyRequest(BaseModel):
    code: str             # 6-digit OTP

class TwoFAStatusResponse(BaseModel):
    totp_enabled: bool

class LoginWithOTPRequest(BaseModel):
    username: str
    password: str
    otp_code: Optional[str] = None  # Required only if 2FA is enabled

