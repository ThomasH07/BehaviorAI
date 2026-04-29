import cv2
import mediapipe as mp

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
        #callibration
        self.baseline = {"yaw": 0.5, "iris": 0.5}
        self.calibrating = True
        self.calibration_data = {"yaw": [], "iris": []}

    def log_distraction_to_db(self, timestamp: str, reason: str, frame_num: int):
        print(f" Time: {timestamp} | Frame: {frame_num} | Event: ({reason})")

    def check_focus(self, landmarks) -> str:
        try:
            #head turn
            nose_x = landmarks[1].x
            left_cheek_x = landmarks[234].x
            right_cheek_x = landmarks[454].x
            
            face_width = right_cheek_x - left_cheek_x
            raw_yaw = (nose_x - left_cheek_x) / face_width if face_width != 0 else 0.5

            #eye movement
            left_iris_x = landmarks[468].x
            inner_eye_x = landmarks[133].x
            outer_eye_x = landmarks[33].x
            
            eye_width = inner_eye_x - outer_eye_x
            raw_iris = (left_iris_x - outer_eye_x) / eye_width if eye_width != 0 else 0.5

            #calibration logic
            if self.calibrating:
                self.calibration_data["yaw"].append(raw_yaw)
                self.calibration_data["iris"].append(raw_iris)
                
                #after 45 frames (~1.5 seconds at 30fps), set the baseline
                if len(self.calibration_data["yaw"]) >= 45:
                    self.baseline["yaw"] = sum(self.calibration_data["yaw"]) / 45
                    self.baseline["iris"] = sum(self.calibration_data["iris"]) / 45
                    self.calibrating = False
                    print(f"CALIBRATION COMPLETE: Yaw={self.baseline['yaw']:.2f}, Iris={self.baseline['iris']:.2f}")
                return "Calibrating..."

            #compare raw values to baseline
            #head movement (Detection sensitivity adjusted to 0.15 deviation)
            if raw_yaw < (self.baseline["yaw"] - 0.18):
                return "Head turned far left"
            elif raw_yaw > (self.baseline["yaw"] + 0.18):
                return "Head turned far right"

            #eye movement
            if raw_iris < (self.baseline["iris"] - 0.12):
                return "Eyes darted left"
            elif raw_iris > (self.baseline["iris"] + 0.12):
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
        focus_state = "Focused"

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

            #mediaPipe doesn't need high-res for landmarks, and smaller images process much faster.
            height, width = frame.shape[:2]
            if width > 640:
                scale = 640 / width
                frame = cv2.resize(frame, (640, int(height * scale)))

            image_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = self.face_mesh.process(image_rgb)
            
            current_focus_state = "Face not visible" 
            if results.multi_face_landmarks:
                face_landmarks = results.multi_face_landmarks[0].landmark
                current_focus_state = self.check_focus(face_landmarks)
            
            focus_state = current_focus_state

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
                    if duration >= 1.0 and not logged_this_distraction:
                        distraction_count += 1
                        
                        # MM:SS
                        mm = int(video_time_sec // 60)
                        ss = int(video_time_sec % 60)
                        self.log_distraction_to_db(f"{mm:02d}:{ss:02d}", focus_state, frame_idx)
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