import sys, os
parent_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, parent_dir)

import os
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from backend.database import engine, Base, get_db
from backend.models import User, ScanHistory, ChatMessage
from backend import schemas
from backend import auth
from backend import scanner
from backend import ai_engine
from backend import reports
from backend import alerts
from backend.email_service import send_alert_email
from backend import twofa

from sqlalchemy import text

# Initialize database tables
Base.metadata.create_all(bind=engine)

# Add missing columns dynamically for backward compatibility
with engine.begin() as conn:
    if engine.dialect.name == "sqlite":
        cursor = conn.execute(text("PRAGMA table_info(chat_messages)"))
        columns = [row[1] for row in cursor.fetchall()]
        if "session_id" not in columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN session_id VARCHAR DEFAULT 'default'"))
    else:
        # PostgreSQL compatibility
        cursor = conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='chat_messages'"))
        columns = [row[0] for row in cursor.fetchall()]
        if "session_id" not in columns:
            conn.execute(text("ALTER TABLE chat_messages ADD COLUMN session_id VARCHAR DEFAULT 'default'"))

# Rate limiter setup
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Aegis AI Cybersecurity Assistant API",
    description="Backend API powering the Personal AI Cybersecurity Assistant platform.",
    version="1.0.0"
)

# Attach rate limiter and error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS
# Strictly allow local development origins, Chrome extension origins, and Production frontend (Vercel)
ALLOWED_ORIGIN_REGEX = os.getenv(
    "ALLOWED_ORIGIN_REGEX", 
    r"https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?|chrome-extension://.*|https://.*\.vercel\.app"
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=ALLOWED_ORIGIN_REGEX,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Content-Security-Policy"] = "default-src 'self' 'unsafe-inline' 'unsafe-eval' https://services.nvd.nist.gov https://unpkg.com"
    return response
app.include_router(alerts.router)

# --- HEALTH / GENERAL ENDPOINTS ---

def get_local_ip():
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('10.255.255.255', 1))
        IP = s.getsockname()[0]
    except Exception:
        IP = '127.0.0.1'
    finally:
        s.close()
    return IP

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "database": "connected"}

@app.get("/api/system/mobile-link")
def get_mobile_link():
    ip = get_local_ip()
    return {
        "local_ip": ip,
        "frontend_link": f"http://{ip}:5173",
        "backend_link": f"http://{ip}:8000"
    }


# --- AUTHENTICATION ROUTER ---

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if username is already registered
    existing_user = db.query(User).filter(User.username == user_in.username).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Account with this username already registered"
        )
    
    hashed_pwd = auth.get_password_hash(user_in.password)
    db_user = User(
        username=user_in.username,
        hashed_password=hashed_pwd,
        full_name=user_in.full_name,
        email=user_in.email
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/auth/login", response_model=schemas.Token)
@limiter.limit("5/minute")
def login_user(request: Request, login_in: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == login_in.username).first()
    if not user or not auth.verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = auth.create_access_token(
        data={"sub": user.username, "user_id": user.id}
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/auth/refresh", response_model=schemas.Token)
def refresh_token(current_user: User = Depends(auth.get_current_user)):
    # Issue a fresh access token for the same user
    new_token = auth.create_access_token(data={"sub": current_user.username, "user_id": current_user.id})
    return {"access_token": new_token, "token_type": "bearer"}

@app.get("/api/auth/profile", response_model=schemas.UserResponse)
def get_profile(current_user: User = Depends(auth.get_current_user)):
    return current_user

@app.patch("/api/auth/profile", response_model=schemas.UserResponse)
def update_profile(
    update_data: schemas.ProfileUpdate,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Update user's full name and email."""
    if update_data.full_name is not None:
        current_user.full_name = update_data.full_name
    if update_data.email is not None:
        current_user.email = update_data.email
    db.commit()
    db.refresh(current_user)
    return current_user



# --- URL SECURITY SCANNER ROUTER ---

@app.post("/api/scanner/scan", response_model=schemas.ScanResponse)
@limiter.limit("10/minute")
async def scan_url_endpoint(
    request: Request,
    scan_request: schemas.ScanRequest,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Perform heuristic scan
    scan_results = await scanner.scan_url(scan_request.url)
    
    # Generate AI explanation
    ai_exp = await ai_engine.generate_scan_explanation(
        url=scan_results["url"],
        risk=scan_results["risk"],
        score=scan_results["score"],
        issues=scan_results["issues"]
    )
    
    # Record to DB history
    db_scan = ScanHistory(
        user_id=current_user.id,
        url=scan_results["url"],
        risk=scan_results["risk"],
        score=scan_results["score"],
        issues=scan_results["issues"],
        ai_explanation=ai_exp
    )
    db.add(db_scan)
    db.commit()
    db.refresh(db_scan)

    # Send email alert if HIGH or CRITICAL risk detected
    if scan_results["risk"] in ("HIGH", "CRITICAL") and current_user.email:
        send_alert_email(
            to_email=current_user.email,
            url=scan_results["url"],
            risk=scan_results["risk"],
            score=scan_results["score"],
            issues=scan_results["issues"]
        )

    return db_scan

@app.get("/api/scanner/history", response_model=List[schemas.ScanResponse])
def get_scan_history(
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    scans = db.query(ScanHistory).filter(ScanHistory.user_id == current_user.id).order_by(ScanHistory.created_at.desc()).all()
    return scans

@app.get("/api/scanner/stats")
def get_scan_statistics(
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    scans = db.query(ScanHistory).filter(ScanHistory.user_id == current_user.id).all()
    
    total = len(scans)
    if total == 0:
        return {
            "total_scans": 0,
            "average_score": 100,
            "low_risk_count": 0,
            "medium_risk_count": 0,
            "high_risk_count": 0,
            "critical_risk_count": 0
        }
        
    avg_score = sum(s.score for s in scans) / total
    low_count = sum(1 for s in scans if s.risk == "LOW")
    med_count = sum(1 for s in scans if s.risk == "MEDIUM")
    high_count = sum(1 for s in scans if s.risk == "HIGH")
    crit_count = sum(1 for s in scans if s.risk == "CRITICAL")
    
    return {
        "total_scans": total,
        "average_score": round(avg_score, 1),
        "low_risk_count": low_count,
        "medium_risk_count": med_count,
        "high_risk_count": high_count,
        "critical_risk_count": crit_count
    }


# --- PDF REPORT GENERATOR ---

@app.get("/api/scanner/report/{scan_id}")
def get_pdf_report(
    scan_id: int,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Fetch scan record, ensuring it belongs to current user
    scan = db.query(ScanHistory).filter(
        ScanHistory.id == scan_id,
        ScanHistory.user_id == current_user.id
    ).first()
    
    if not scan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Security scan report not found."
        )
        
    pdf_buffer = reports.build_pdf_report(
        url=scan.url,
        risk=scan.risk,
        score=scan.score,
        issues=scan.issues or [],
        ai_explanation=scan.ai_explanation or "No AI explanation available."
    )
    
    filename = f"cybersecurity_report_{scan_id}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


# --- AI CHATBOT ROUTER ---

@app.get("/api/ai/chat/history", response_model=List[schemas.ChatMessage])
def get_chat_history(
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    messages = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id).order_by(ChatMessage.created_at.asc()).all()
    return messages

@app.post("/api/ai/chat", response_model=schemas.ChatResponse)
@limiter.limit("20/minute")
async def chatbot_endpoint(
    request: Request,
    chat_request: schemas.ChatRequest,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # 1. Save user message to DB
    user_msg = ChatMessage(
        user_id=current_user.id,
        sender="user",
        text=chat_request.message,
        session_id=chat_request.session_id
    )
    db.add(user_msg)
    db.commit()
    
    # 2. Get recent chat context from DB (last 10 messages) if history parameter is empty
    history_list = []
    if chat_request.history:
        history_list = [{"sender": msg.sender, "text": msg.text} for msg in chat_request.history]
    else:
        # Load from DB for this specific session only
        recent_msgs = db.query(ChatMessage).filter(
            ChatMessage.user_id == current_user.id,
            ChatMessage.session_id == chat_request.session_id
        ).order_by(ChatMessage.created_at.desc()).limit(11).all()
        
        recent_msgs.reverse()
        # Filter out the message we just saved at the very end
        history_list = [{"sender": m.sender, "text": m.text} for m in recent_msgs if m.id != user_msg.id]
        
    ai_response = await ai_engine.generate_chatbot_response(
        message=chat_request.message,
        history=history_list
    )
    
    # 3. Save AI response to DB
    ai_msg = ChatMessage(
        user_id=current_user.id,
        sender="ai",
        text=ai_response,
        session_id=chat_request.session_id
    )
    db.add(ai_msg)
    db.commit()
    
    return {"response": ai_response}

@app.delete("/api/ai/chat/clear")
def clear_chat_history(
    session_id: Optional[str] = None,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(ChatMessage).filter(ChatMessage.user_id == current_user.id)
    if session_id:
        query = query.filter(ChatMessage.session_id == session_id)
    query.delete()
    db.commit()
    return {"message": "Chat history cleared successfully"}


# --- VULNERABILITY EXPLAINER ROUTER ---

@app.post("/api/ai/explain-vulnerability", response_model=schemas.VulnerabilityExplainResponse)
async def explain_vulnerability_endpoint(
    request: schemas.VulnerabilityExplainRequest,
    current_user: User = Depends(auth.get_current_user)
):
    explanation = await ai_engine.generate_vulnerability_explanation(request.name)
    return explanation


# --- TWO-FACTOR AUTHENTICATION (2FA) ROUTER ---

@app.get("/api/auth/2fa/status", response_model=schemas.TwoFAStatusResponse)
def get_2fa_status(current_user: User = Depends(auth.get_current_user)):
    """Check if 2FA is enabled for the current user."""
    return {"totp_enabled": bool(current_user.totp_enabled)}

@app.post("/api/auth/2fa/setup", response_model=schemas.TwoFASetupResponse)
def setup_2fa(current_user: User = Depends(auth.get_current_user), db: Session = Depends(get_db)):
    """Generate a new 2FA secret and return QR code. User must verify before it is activated."""
    secret = twofa.generate_totp_secret()
    current_user.totp_secret = secret
    current_user.totp_enabled = 0  # Not yet confirmed
    db.commit()
    qr = twofa.generate_qr_base64(secret, current_user.username)
    return {"qr_code": qr, "secret": secret, "totp_enabled": False}

@app.post("/api/auth/2fa/verify")
def verify_and_enable_2fa(
    req: schemas.TwoFAVerifyRequest,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Verify OTP code and activate 2FA for the account."""
    if not current_user.totp_secret:
        raise HTTPException(status_code=400, detail="2FA setup not initiated. Call /api/auth/2fa/setup first.")
    if not twofa.verify_totp(current_user.totp_secret, req.code):
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please try again.")
    current_user.totp_enabled = 1
    db.commit()
    return {"message": "2FA enabled successfully", "totp_enabled": True}

@app.post("/api/auth/2fa/disable")
def disable_2fa(
    req: schemas.TwoFAVerifyRequest,
    current_user: User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """Disable 2FA after verifying the current OTP code."""
    if not current_user.totp_secret or not current_user.totp_enabled:
        raise HTTPException(status_code=400, detail="2FA is not currently enabled.")
    if not twofa.verify_totp(current_user.totp_secret, req.code):
        raise HTTPException(status_code=400, detail="Invalid OTP code. Cannot disable 2FA.")
    current_user.totp_enabled = 0
    current_user.totp_secret = None
    db.commit()
    return {"message": "2FA disabled successfully", "totp_enabled": False}

@app.post("/api/auth/login-2fa", response_model=schemas.Token)
@limiter.limit("5/minute")
def login_with_2fa(request: Request, login_in: schemas.LoginWithOTPRequest, db: Session = Depends(get_db)):
    """Login endpoint that supports 2FA. If 2FA is enabled, otp_code is required."""
    user = db.query(User).filter(User.username == login_in.username).first()
    if not user or not auth.verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    # If 2FA is enabled, verify OTP
    if user.totp_enabled:
        if not login_in.otp_code:
            raise HTTPException(status_code=401, detail="2FA_REQUIRED")
        if not twofa.verify_totp(user.totp_secret, login_in.otp_code):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    access_token = auth.create_access_token(data={"sub": user.username, "user_id": user.id})
    return {"access_token": access_token, "token_type": "bearer"}
