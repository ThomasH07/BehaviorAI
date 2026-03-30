import cv2
import mediapipe as mp
import os
import shutil

class Vision:
    def __init__(self):        
        #mediapipe
        #https://storage.googleapis.com/mediapipe-assets/documentation/mediapipe_face_landmark_fullsize.png
        self.mp_face_mesh = mp.solutions.face_mesh
        #mediapipe Face Mesh model
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            max_num_faces=1,
            refine_landmarks=True, #turns on iris tracking points
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )

    def log_distraction_to_db(self, timestamp: str, reason: str, frame_num: int):
        print(f" Time: {timestamp} | Frame: {frame_num} | Event: ({reason})")

    def check_focus(self, landmarks) -> str:
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

    def analyze_video_file(self, temp_filename: str):
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

        #loop through the video frame by frame
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret: #if frame was successfully read
                break 
            #get the exact time of the current frame in seconds
            video_time_sec = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0
            #mediapipe req RGB images, but opencv reads in BGR by default
            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(image_rgb)
            
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
            
                #checks the users head/eyes if they are distracted
                focus_state = self.check_focus(landmarks)

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
                        self.log_distraction_to_db(timestamp_str, focus_state, frame_idx)
                        
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
            
        cap.release()
        return analysis_results, distraction_count

#initialize the service for use in main.py
vision_service = Vision()