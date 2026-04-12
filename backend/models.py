from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"
    user_id = Column(Integer, primary_key=True, index=True)
    user_name = Column(String(50), unique=True, nullable=False)
    user_email = Column(String(50), unique=True, nullable=False)
    user_password = Column(String(255), nullable=False)
    
    sessions = relationship("Session", back_populates="owner")
    auth_sessions = relationship("AuthSession", back_populates="user")

class AuthSession(Base):
    __tablename__ = "auth_sessions"
    session_id = Column(String(128), primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, nullable=False, default=False)

    user = relationship("User", back_populates="auth_sessions")

class Session(Base):
    __tablename__ = "sessions"
    session_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    session_date = Column(DateTime, server_default=func.now())
    
    owner = relationship("User", back_populates="sessions")
    responses = relationship("Response", back_populates="parent_session")

class Response(Base):
    __tablename__ = "responses"
    response_id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.session_id"))
    interview_prompt = Column(Text)
    transcript = Column(Text)
    ai_feedback = Column(Text)
    gaze_count = Column(Integer, nullable=False, default=0)
    stutter_count = Column(Integer, nullable=False, default=0)
    pause_count = Column(Integer, nullable=False, default=0)
    sequence_tag = Column(DateTime, server_default=func.now())
    
    parent_session = relationship("Session", back_populates="responses")