import os
from fastapi import FastAPI, Depends, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from database import engine, SessionLocal
import models
import schemas
from sqlalchemy.orm import Session
#mediapipe
import shutil
import cv2
import mediapipe as mp
import datetime
import time
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

#mediapipe
#https://storage.googleapis.com/mediapipe-assets/documentation/mediapipe_face_landmark_fullsize.png
mp_face_mesh = mp.solutions.face_mesh
# mp_drawing = mp.solutions.drawing_utils          
# mp_drawing_styles = mp.solutions.drawing_styles

def log_distraction_to_db(timestamp: str, reason: str, frame_num: int):
    print(f" Time: {timestamp} | Frame: {frame_num} | Event: ({reason})")

def check_focus(landmarks) -> str:
    try:
        #head turn
        nose_x = landmarks[1]["x"]
        left_cheek_x = landmarks[234]["x"]
        right_cheek_x = landmarks[454]["x"]
        #calculate the total width of the face in pixels
        face_width = right_cheek_x - left_cheek_x
        if face_width != 0:
            #calculate where the nose is relative to the face width looking straight = 0.5, closer to 0 = turned left, closer to 1 = turned right
            head_yaw_ratio = (nose_x - left_cheek_x) / face_width
           
            if head_yaw_ratio < 0.25:
                return "Head turned far left"
            elif head_yaw_ratio > 0.75:
                return "Head turned far right"

        #eye movement left_eye_boundary_landmarks
        left_iris_x = landmarks[468]["x"]
        inner_eye_x = landmarks[133]["x"]
        outer_eye_x = landmarks[33]["x"]
        #calculate the total width of the eye opening
        eye_width = inner_eye_x - outer_eye_x
        if eye_width != 0:
            #calculate where the iris is relative to the eye width.
            iris_ratio = (left_iris_x - outer_eye_x) / eye_width
            #lowered/Raised bounds to make it sensitive to slight glances
            if iris_ratio < 0.35:
                return "Eyes darted left"
            elif iris_ratio > 0.65:
                return "Eyes darted right"
    except IndexError:
        return "Face not fully visible"
    return "Focused"

@app.post("/analyze-video")
async def analyze_video(file: UploadFile = File(...)):
    print(f"Received file: {file.filename}")
    #save the file locally so opencv can read it
    temp_filename = f"temp_{file.filename}"
    with open(temp_filename, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    #open file in opencv
    cap = cv2.VideoCapture(temp_filename)
    #variables to store data and send back
    analysis_results = []
    frame_idx = 0
    distraction_count = 0
    #track how long a user has been continuously distracted
    currently_distracted = False
    distraction_start_time = 0.0
    logged_this_distraction = False
    # mediapipe Face Mesh model
    with mp_face_mesh.FaceMesh(
        max_num_faces=1,
        refine_landmarks=True, #turns on iris tracking points
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    ) as face_mesh:
        #loop through the video frame by frame
        while cap.isOpened():
            
            ret, frame = cap.read()
            if not ret: #if frame was successfully read
                break 
            #get the exact time of the current frame in seconds
            video_time_sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            #mediapipe req RGB images, but opencv reads in BGR by default
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(image_rgb)
            
            focus_state = "Face not visible" #default state if no face is found
            
            if results.multi_face_landmarks:
                landmarks = []
                h, w, _ = frame.shape
                #convert MediaPipe's normalized coordinates into actual pixel coordinates
                for lm in results.multi_face_landmarks[0].landmark:
                    landmarks.append({
                        "x": int(lm.x * w), 
                        "y": int(lm.y * h), 
                    })
                
                #math logic
                #checks the users head/eyes if they are distracted
                focus_state = check_focus(landmarks)

            #distraction logic
            if focus_state != "Focused":
                if not currently_distracted:
                    #they just looked away start timer
                    currently_distracted = True
                    distraction_start_time = video_time_sec
                    logged_this_distraction = False
                else:
                    #still looking away and check how long it's been
                    duration = video_time_sec - distraction_start_time
                    
                    #if it has been 2 seconds, and we haven't logged it yet
                    if duration >= 2.0 and not logged_this_distraction:
                        distraction_count += 1
                        
                        # MM:SS
                        mm = int(video_time_sec // 60)
                        ss = int(video_time_sec % 60)
                        timestamp_str = f"{mm:02d}:{ss:02d}"
                        #log to database
                        log_distraction_to_db(timestamp_str, focus_state, frame_idx)
                        
                        #mark as logged so we don't log again if they keep looking away for 10+ seconds
                        logged_this_distraction = True 
            else:
                #they looked back at the screen
                currently_distracted = False
                distraction_start_time = 0.0
                logged_this_distraction = False

            #append to data array
            analysis_results.append({
                "frame": frame_idx,
                "time_sec": round(video_time_sec, 2),
                "state": focus_state
            })
            
            frame_idx += 1
    #release the video memory and delete temp file
    cap.release()
    if os.path.exists(temp_filename):
        os.remove(temp_filename)
    return {"status": "success", "data": analysis_results, "distractions": distraction_count}