# Since models.py uses Integer for primary keys, Text for feedback, etc, want to ensure the data coming from your frontend (MediaPipe, whsiper, etc.) is the right type.

from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import List, Optional

# USER SCHEMAS 
class UserBase(BaseModel):
    user_name: str
    user_email: EmailStr

class UserCreate(UserBase):
    user_password: str

class User(UserBase):
    user_id: int

    class Config:
        from_attributes = True

class UserOut(UserBase):
    user_id: int

    class Config:
        from_attributes = True

class SignupRequest(BaseModel):
    user_name: str
    user_email: EmailStr
    user_password: str

class LoginRequest(BaseModel):
    user_email: EmailStr
    user_password: str

class AuthStatus(BaseModel):
    authenticated: bool
    user: Optional[UserOut] = None

# RESPONSE SCHEMAS 
class ResponseBase(BaseModel):
    interview_prompt: str
    transcript: str
    ai_feedback: str
    gaze_count: int
    stutter_count: int
    pause_count: int

class ResponseCreate(ResponseBase):
    session_id: int

class Response(ResponseBase):
    response_id: int
    sequence_tag: datetime

    class Config:
        from_attributes = True

# SESSION SCHEMAS 
class SessionBase(BaseModel):
    user_id: int

class SessionCreate(SessionBase):
    pass

class Session(SessionBase):
    session_id: int
    session_date: datetime
    responses: List[Response] = []

    class Config:
        from_attributes = True


class SessionHistoryItem(BaseModel):
    session_id: int
    session_date: datetime
    question: str
    feedback: str


class SessionHistoryResponse(BaseModel):
    user_id: int
    sessions: List[SessionHistoryItem]