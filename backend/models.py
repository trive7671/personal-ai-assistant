from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from backend.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    email = Column(String, nullable=True)  # For email alerts
    totp_secret = Column(String, nullable=True)   # 2FA secret
    totp_enabled = Column(Integer, default=0)     # 0=disabled, 1=enabled
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    scans = relationship("ScanHistory", back_populates="owner", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="owner", cascade="all, delete-orphan")


class ScanHistory(Base):
    __tablename__ = "scan_histories"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, index=True, nullable=False)
    risk = Column(String, nullable=False)  # LOW / MEDIUM / HIGH / CRITICAL
    score = Column(Integer, nullable=False)  # 0-100
    issues = Column(JSON, nullable=True)  # List of issues: ["Missing HTTPS", ...]
    ai_explanation = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="scans")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(String, default="default", nullable=False) # Groups chats
    sender = Column(String, nullable=False)  # "user" or "ai"
    text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    owner = relationship("User", back_populates="chat_messages")
