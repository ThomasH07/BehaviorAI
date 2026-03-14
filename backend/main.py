import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine, SessionLocal
import models
import schemas
from sqlalchemy.orm import Session

models.Base.metadata.create_all(bind=engine) # creates the tables in AWS RDS if they don't exist yet

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000","http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    
    return FileResponse(os.path.join(static_dir, "index.html"))