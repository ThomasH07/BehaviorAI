import subprocess
import os
import secrets
import hashlib
import random
import time 
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine, SessionLocal
import models
import schemas
from sqlalchemy.orm import Session
from passlib.context import CryptContext
#mediapipe
import shutil
import json
import asyncio
models.Base.metadata.create_all(bind=engine) # creates the tables in AWS RDS if they don't exist yet
from vision import vision_service
from gemini_service import gemini_service
from whisper_service import whisper_service
import imageio_ffmpeg
app = FastAPI()

cors_origins = os.getenv(
    "CORS_ORIGINS",
    "http://localhost:3000,http://127.0.0.1:3000,https://behavior-ai-frontend.vercel.app"
   
    ""
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SESSION_COOKIE_NAME = os.getenv("SESSION_COOKIE_NAME", "behaviorai_session")
SESSION_DURATION_DAYS = int(os.getenv("SESSION_DURATION_DAYS", "7"))
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", "false").lower() == "true"
MIN_PASSWORD_LENGTH = int(os.getenv("MIN_PASSWORD_LENGTH", "12"))
MAX_BCRYPT_BYTES = 72

FALLBACK_QUESTIONS = [
    "Tell me about a time you had to resolve a conflict within a team.",
    "Describe a situation where you had to learn something quickly to complete a task.",
    "Tell me about a time you took ownership of a mistake and what you did next.",
    "Describe a time you had to prioritize multiple urgent tasks.",
    "Tell me about a time you influenced someone without formal authority.",
]

def normalize_password(password: str) -> str:
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters long",
        )
    if len(password.encode("utf-8")) > MAX_BCRYPT_BYTES:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()
    return password

def hash_password(password: str) -> str:
    normalized = normalize_password(password)
    return pwd_context.hash(normalized)

def verify_password(plain_password: str, stored_password: str) -> tuple[bool, bool]:
    """
    Returns (is_valid, needs_upgrade).
    If the stored password is plaintext, it is treated as valid only on exact match.
    """
    normalized_password = normalize_password(plain_password)
    if pwd_context.identify(stored_password):
        valid = pwd_context.verify(normalized_password, stored_password)
        return valid, valid and pwd_context.needs_update(stored_password)
    if normalized_password == stored_password:
        return True, True
    return False, False

def set_session_cookie(response: Response, session_id: str, max_age_seconds: int) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=session_id,
        httponly=True,
        max_age=max_age_seconds,
        samesite="lax",
        secure=SESSION_COOKIE_SECURE,
    )

def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=SESSION_COOKIE_NAME)
@app.get("/")
async def root():
    return {"status": "Backend is running", "api_docs": "/docs"}

@app.post("/analyze-video")
def analyze_video(file: UploadFile = File(...)):
    #handle File IO
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    #call the Vision Service
    try:
        start_time = time.time() #Timer
        data, distractions = vision_service.analyze_video_file(temp_filename)
        vision_time = time.time() - start_time #Timer End
        print(f"MediaPipe (Vision) processing time: {vision_time:.2f} seconds") #Log Time
    finally:
        #clean up
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

    return {"status": "success", "data": data, "distractions": distractions}
    
@app.post("/transcribe")
async def process_behavior(file: UploadFile = File(...)):
    #paths for temporary processing
    temp_webm = f"temp_{file.filename}"
    temp_wav = temp_webm.replace(".webm", ".wav")
    
    try:
        #save incoming recording
        with open(temp_webm, "wb") as buffer:
            buffer.write(await file.read())
            
        ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        
        #use asyncio's subprocess so FFmpeg doesn't freeze the server
        process = await asyncio.create_subprocess_exec(
            ffmpeg_path, "-y", "-i", temp_webm, 
            "-vn", "-ar", "16000", "-ac", "1", temp_wav,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        #wait for FFmpeg to finish without blocking the event loop
        await process.communicate()

        start_time = time.time() #(Whisper + Groq)
        final_data = await whisper_service.transcribe_and_analyze(temp_wav)
        audio_text_time = time.time() - start_time #Timer End
        print(f"FasterWhisper & Groq processing time: {audio_text_time:.2f} seconds") #Log Time
        
        return {"status": "success", "data": final_data, "source": "local_whisper"}
    except Exception as e:
        print(f"Server Error: {e}")
        return JSONResponse(status_code=500, content={"message": str(e)})
    
    finally:
        #delete local temp files
        for f in [temp_webm, temp_wav]:
            if os.path.exists(f):
                os.remove(f)

@app.get("/api/questions/random")
def get_random_question():
    question = gemini_service.generate_behavioral_question()
    source = "gemini"
    if not question:
        question = random.choice(FALLBACK_QUESTIONS)
        source = "fallback"
    return {"status": "success", "question": question, "source": source}
# Ensures each API request gets its own connection that closes after use.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_current_user(request: Request, db: Session = Depends(get_db)) -> models.User:
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    auth_session = (
        db.query(models.AuthSession)
        .filter(models.AuthSession.session_id == session_id)
        .first()
    )
    if not auth_session or auth_session.revoked or auth_session.expires_at <= datetime.utcnow():
        raise HTTPException(status_code=401, detail="Session expired")
    user = db.query(models.User).filter(models.User.user_id == auth_session.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@app.post("/api/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Creates a new user account for BehaviorAI."""
    existing_email = db.query(models.User).filter(models.User.user_email == user.user_email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")
    existing_name = db.query(models.User).filter(models.User.user_name == user.user_name).first()
    if existing_name:
        raise HTTPException(status_code=409, detail="Username already taken")
    db_user = models.User(
        user_name=user.user_name,
        user_email=user.user_email,
        user_password=hash_password(user.user_password)
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.post("/api/auth/signup", response_model=schemas.UserOut)
def signup(payload: schemas.SignupRequest, response: Response, db: Session = Depends(get_db)):
    existing_email = db.query(models.User).filter(models.User.user_email == payload.user_email).first()
    if existing_email:
        raise HTTPException(status_code=409, detail="Email already registered")
    existing_name = db.query(models.User).filter(models.User.user_name == payload.user_name).first()
    if existing_name:
        raise HTTPException(status_code=409, detail="Username already taken")

    db_user = models.User(
        user_name=payload.user_name,
        user_email=payload.user_email,
        user_password=hash_password(payload.user_password),
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    session_id = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS)
    db_session = models.AuthSession(
        session_id=session_id,
        user_id=db_user.user_id,
        expires_at=expires_at,
        revoked=False,
    )
    db.add(db_session)
    db.commit()
    set_session_cookie(response, session_id, SESSION_DURATION_DAYS * 24 * 60 * 60)
    return db_user

@app.post("/api/auth/login", response_model=schemas.UserOut)
def login(payload: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.user_email == payload.user_email).first()
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    valid, needs_upgrade = verify_password(payload.user_password, db_user.user_password)
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if needs_upgrade:
        db_user.user_password = hash_password(payload.user_password)
        db.add(db_user)
        db.commit()

    session_id = secrets.token_urlsafe(32)
    expires_at = datetime.utcnow() + timedelta(days=SESSION_DURATION_DAYS)
    db_session = models.AuthSession(
        session_id=session_id,
        user_id=db_user.user_id,
        expires_at=expires_at,
        revoked=False,
    )
    db.add(db_session)
    db.commit()
    set_session_cookie(response, session_id, SESSION_DURATION_DAYS * 24 * 60 * 60)
    return db_user

@app.post("/api/auth/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    session_id = request.cookies.get(SESSION_COOKIE_NAME)
    if session_id:
        auth_session = (
            db.query(models.AuthSession)
            .filter(models.AuthSession.session_id == session_id)
            .first()
        )
        if auth_session:
            auth_session.revoked = True
            db.add(auth_session)
            db.commit()
    clear_session_cookie(response)
    return {"status": "ok"}

@app.get("/api/auth/me", response_model=schemas.UserOut)
def me(current_user: models.User = Depends(get_current_user)):
    return current_user

@app.post("/api/sessions/", response_model=schemas.Session)
def create_session(session: schemas.SessionCreate, db: Session = Depends(get_db)):
    """Starts a new interview session linked to a user."""
    db_session = models.Session(user_id=session.user_id)
    db.add(db_session)
    db.commit()
    db.refresh(db_session)
    return db_session

@app.post("/api/responses/", response_model=schemas.Response)
def create_response(response: schemas.ResponseCreate, db: Session = Depends(get_db)):
    db_response = models.Response(**response.model_dump()) # Convert Pydantic schema to SQLAlchemy model
    db.add(db_response)
    db.commit()
    db.refresh(db_response)
    return db_response


@app.get("/api/sessions/{user_id}/recent", response_model=schemas.SessionHistoryResponse)
def get_recent_sessions(user_id: int, db: Session = Depends(get_db)):
    sessions = (
        db.query(models.Session)
        .filter(models.Session.user_id == user_id)
        .order_by(models.Session.session_date.desc())
        .limit(5)
        .all()
    )

    payload = []
    for session in sessions:
        latest_response = (
            db.query(models.Response)
            .filter(models.Response.session_id == session.session_id)
            .order_by(models.Response.sequence_tag.desc())
            .first()
        )
        payload.append(
            schemas.SessionHistoryItem(
                session_id=session.session_id,
                session_date=session.session_date,
                question=(latest_response.interview_prompt if latest_response else "No question saved."),
                feedback=(latest_response.ai_feedback if latest_response else "No feedback saved yet."),
            )
        )

    return schemas.SessionHistoryResponse(user_id=user_id, sessions=payload)


@app.get("/api/sessions/{user_id}/{session_id}/detail", response_model=schemas.SessionDetailResponse)
def get_session_detail(user_id: int, session_id: int, db: Session = Depends(get_db)):
    session = (
        db.query(models.Session)
        .filter(models.Session.session_id == session_id, models.Session.user_id == user_id)
        .first()
    )

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    latest_response = (
        db.query(models.Response)
        .filter(models.Response.session_id == session_id)
        .order_by(models.Response.sequence_tag.desc())
        .first()
    )

    return schemas.SessionDetailResponse(
        session_id=session.session_id,
        session_date=session.session_date,
        question=(latest_response.interview_prompt if latest_response else "No question saved."),
        transcript=(latest_response.transcript if latest_response else None),
        ai_feedback=(latest_response.ai_feedback if latest_response else None),
        gaze_count=(latest_response.gaze_count if latest_response else None),
        stutter_count=(latest_response.stutter_count if latest_response else None),
    )


static_dir = os.path.join(os.getcwd(), "static")
inner_static = os.path.join(static_dir, "static")

# if os.path.exists(inner_static):
    # app.mount("/static", StaticFiles(directory=inner_static), name="static")


@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    file_path = os.path.join(static_dir, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index_path = os.path.join(static_dir, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"message": "React build not found"}