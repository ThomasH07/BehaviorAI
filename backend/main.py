import subprocess
import os
from fastapi import FastAPI, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine, SessionLocal
import models
import schemas
from sqlalchemy.orm import Session
#mediapipe
import shutil
import json
models.Base.metadata.create_all(bind=engine) # creates the tables in AWS RDS if they don't exist yet
from vision import vision_service
from gemini_service import gemini_service
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000","http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
@app.post("/analyze-video")
def analyze_video(file: UploadFile = File(...)):
    #handle File IO
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    #call the Vision Service
    try:
        data, distractions = vision_service.analyze_video_file(temp_filename)
    finally:
        #clean up
        if os.path.exists(temp_filename):
            os.remove(temp_filename)

    return {"status": "success", "data": data, "distractions": distractions}
    
@app.post("/transcribe")
def process_behavior(file: UploadFile = File(...)):
    #paths for temporary processing
    temp_webm = f"temp_{file.filename}"
    temp_wav = temp_webm.replace(".webm", ".wav")
    
    try:
        #save incoming recording
        with open(temp_webm, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        #fast FFmpeg conversion (No video, Mono, 16kHz)
        subprocess.run([
            "ffmpeg", "-y", "-i", temp_webm, 
            "-vn", "-ar", "16000", "-ac", "1", temp_wav
        ], check=True, capture_output=True)

        #call the Gemini Service
        raw_response = gemini_service.analyze_audio(temp_wav)
        
        if not raw_response:
            return JSONResponse(status_code=500, content={"message": "Gemini failed to process audio"})

        #clean up any Markdown wrappers (```json ... ```)
        cleaned_json = raw_response.replace("```json", "").replace("```", "").strip()
        
        #parse and return
        final_data = json.loads(cleaned_json)
        return {"status": "success", "data": final_data}

    except Exception as e:
        print(f"Server Error: {e}")
        return JSONResponse(status_code=500, content={"message": str(e)})
    
    finally:
        #delete local temp files
        for f in [temp_webm, temp_wav]:
            if os.path.exists(f):
                os.remove(f)
# Ensures each API request gets its own connection that closes after use.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Creates a new user account for BehaviorAI."""
    db_user = models.User(
        user_name=user.user_name,
        user_email=user.user_email,
        user_password=user.user_password  
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

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


static_dir = os.path.join(os.getcwd(), "static")
inner_static = os.path.join(static_dir, "static")

if os.path.exists(inner_static):
    app.mount("/static", StaticFiles(directory=inner_static), name="static")

@app.get("/{full_path:path}")
async def serve_react(full_path: str):
    file_path = os.path.join(static_dir, full_path)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index_path = os.path.join(static_dir, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return {"message": "React build not found"}
