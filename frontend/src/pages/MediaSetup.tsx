import React, { useEffect, useRef, useState, useCallback } from "react";

import type { AuthUser } from "../api/auth";
import {
  createResponse,
  createSession,
  fetchRandomQuestion,
  uploadRecordingBlob,
  transcribeAudioBlob,
} from "../api/media";
import ChatPanel, { type ChatMessage } from "../components/ChatPanel";
import InterviewPanel from "../components/InterviewPanel";

type Status = "idle" | "ready" | "recording" | "stopped" | "analyzed" | "error";
//status covers camera status (ready, error) and recording status (recording, stopped)
//could change later if we want to isolate and track camera and recording status separately, but for now this is sufficient

type MediaSetupProps = {
  user: AuthUser;
};

export default function MediaSetup({ user }: MediaSetupProps) { //function to use the media setup process
    const videoRef = useRef<HTMLVideoElement | null>(null); //reference to the DOM element
    const streamRef = useRef<MediaStream | null>(null); //reference to the media stream stored from getUserMedia API
    const recorderRef = useRef<MediaRecorder | null>(null); //reference to the media recorder instance
    const chunksRef = useRef<BlobPart[]>([]); //reference to the stored pieces of the recorded media as the data arrives
    //using blobpart instead of blob because the data is stored in pieces and not as a whole until the recording is stopped
    //blobparts are things that combine to form a blob, which is the final recorded media file




    //UI components
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);
    const [isSetupComplete, setIsSetupComplete] = useState(false);
    const displayName = user.user_name?.trim();
    const welcomeName = displayName ? displayName : "there";
    const initialGreeting = `Hi ${welcomeName} — I’ll post your interview questions, analysis, and coaching feedback here.`;

    const [messages, setMessages] = useState<ChatMessage[]>(() => [
      {
        id: 1,
        text: initialGreeting,
      },
    ]);
    const [status, setStatus] = useState<Status>("idle"); //state to track the status of the media process
    const [errorMsg, setErrorMsg] = useState<string>(""); //state to store any error messages that may occur during the media process
    const useMic = true; //state to track whether the user wants to use the microphone for audio recording (FOR NOW ALWAYS ASK)
    const [uploading, setUploading] = useState(false); //track uploading state for satetyling or disabling buttons during upload, and to provide user feedback if desired 
    //not using now but for future testing and toggling

    //Recorded output states
    const [recordedURL, setRecordedURL] = useState<string | null>(null); //state to store the URL of the recorded media file for playback or download
    //default state stores just a temp url like blob:http://localhost:3000/… but could be extended to store the file name or other metadata if needed
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null); //state to store the actual recorded media file as a BLOB for download or further processing

    const [analysisData, setAnalysisData] = useState<any[] | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<string>("");
    //support validation
    const [sessionEnded, setSessionEnded] = useState(false);

    const supported = 
    //strict bool conversion to ensure we get a true boolean value, not just a truthy or falsy value
        typeof window !== "undefined" && typeof navigator.mediaDevices !== "undefined" && typeof navigator.mediaDevices.getUserMedia === "function" && typeof MediaRecorder !== "undefined"; 
        //check if window is defined to ensure environment supports browser APIs
        //check if mediaDevices is supported in the browser
        //check if getUserMedia is supported in the browser
        //check if MediaRecorder is supported in the browser
        //if any of these are not supported, the media setup process cannot work and we should show an error message to the user

    //setup media stream and recorder
    const setupMedia = async () => {
        setSessionEnded(false);
        setAnalysisData(null);
      setCurrentQuestion("");
        setErrorMsg(""); //reset any previous error messages
        if (recordedURL) {
            URL.revokeObjectURL(recordedURL); //revoke the previous recorded URL to free up memory
            setRecordedURL(null); //reset the recorded URL state
        }
        setRecordedBlob(null); //reset the recorded blob state to clear any previous recording data
        setMicEnabled(useMic); //set the mic enabled state based on the current useMic value, which determines whether the audio stream will be requested from the user's microphone during media setup
        setCameraEnabled(true); //set the camera enabled state to true during media setup, as we are requesting the video stream from the user's camera and want the live preview to be visible by default
        setIsSetupComplete(true); //set the setup complete state to true after successfully setting up the media stream and recorder, which can be used to conditionally render UI elements or enable recording functionality in the InterviewPanel component
        try {
            //recording ONLY, not streaming to server
            
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true, //request video stream from the user's camera
                audio: useMic, //request audio stream from the user's microphone if useMic is true
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream; //set the video element's source to the media stream for live preview
                try { //browsers can autoplay video prev w/o UI interaction, some can block it
                    await videoRef.current.play(); //play the video element to start the live preview
                }
                catch (err) {
                    console.warn("Could not autoplay video preview:", err); //log a warning if the video preview could not autoplay, which can happen in some browsers due to autoplay policies
                } //nonfatal
            }
            setStatus("ready"); //update the status to ready after successfully setting up the media stream
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Couldn't access media devices";
            setErrorMsg(msg);
            setStatus("error"); //update the status to error if there was an issue 
            
        }
    }

    //start recording function
    const startRecording = () => {
        const stream = streamRef.current;
        setErrorMsg("");
        chunksRef.current = [];
        if (!stream) {
            setErrorMsg("No media stream available. Click 'Setup Media' first.");
            setStatus("error");
            return;
        }

        setCurrentQuestion("");

      fetchRandomQuestion()
        .then((questionRes) => {
          const questionText = questionRes?.question?.trim();
          if (questionText) {
            setCurrentQuestion(questionText);
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                text: `Question: ${questionText}`,
              },
            ]);
          }
        })
        .catch((err) => {
          console.warn("Question fetch failed:", err);
        });
        
        //revoke old recorded URL if it exists to free up memory before starting a new recording session
        if (recordedURL) {
            URL.revokeObjectURL(recordedURL);
            setRecordedURL(null);
        }
        setRecordedBlob(null);
        setAnalysisData(null);

        //pick mimetype based on browswer support
        const preferredTypes = [
            "video/webm;codecs=vp9,opus", //best quality but not supported in all browsers
            "video/webm;codecs=vp8,opus", //good quality and widely supported
            "video/webm", //fallback to default webm if specific codecs are not supported
        ];

        const mimeType = preferredTypes.find((t) => MediaRecorder.isTypeSupported(t)); //find the first supported mimetype from the preferred list
        //if no supported mimetype is found, the MediaRecorder will use the browser's default settings, which may not be optimal but should still work in most cases
        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); //create a new MediaRecorder instance with the media stream and the selected mimetype if available
        recorderRef.current = recorder; //temp store recorder instance in ref for later use

        recorder.ondataavailable = (event) => {
            // console.log("event data: "+ event.data.size);
            if (event.data && event.data.size > 0) {
                console.log("Data chunk received:", event.data.size);
                chunksRef.current.push(event.data); //store the incoming data chunks in the ref array as they arrive during recording
            }
        };
        
        recorder.onstop = () => {
          console.log("recorder.onstop fired");

          const type = mimeType ?? "video/webm";
          const blob = new Blob(chunksRef.current, { type });

          console.log("blob size after stop:", blob.size);

          if (blob.size > 0) {
              const newUrl = URL.createObjectURL(blob);
              setRecordedBlob(blob);
              setRecordedURL(newUrl);
              setStatus("stopped");
              console.log("setStatus -> stopped");
          } else {
              console.error("Recording failed: Blob is empty.");
              setStatus("error");
          }

          console.log("Recording stopped. Blob size:", blob.size);
        };

        recorder.start(); //pass timeslice ms 
        setStatus("recording"); //update the status to recording after starting the recording process
    };

    //mic 
    const toggleMic = () => {
      const stream = streamRef.current;
      if (!stream) return;

      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;

      const next = !audioTracks[0].enabled;
      audioTracks.forEach((track) => {
        track.enabled = next;
      });
      setMicEnabled(next);
    };
    //cam
    const toggleCamera = () => {
      const stream = streamRef.current;
      if (!stream) return;

      const videoTracks = stream.getVideoTracks();
      if (!videoTracks.length) return;

      const next = !videoTracks[0].enabled;
      videoTracks.forEach((track) => {
        track.enabled = next;
      });
      setCameraEnabled(next);
    };


        //stop w check 
      const stopRecording = () => {
          const recorder = recorderRef.current;
          console.log("STOP clicked");
          console.log("recorder state before stop:", recorder?.state);
          console.log("status before stop:", status);

          if (!recorder || recorder.state !== "recording") {
              setErrorMsg("No active recording to stop.");
              return;
          }

          recorder.stop();
      };

    const resetQuestion = () => {
        setErrorMsg("");
        setSessionEnded(false);

        if (recordedURL) {
            URL.revokeObjectURL(recordedURL);
            setRecordedURL(null);
        }

        setRecordedBlob(null);
        setAnalysisData(null);
        setCurrentQuestion("");
        chunksRef.current = [];
        setStatus("ready");
    };

    const endSession = async () => {
      const latestAnalysis = analysisData?.[0];

      if (latestAnalysis) {
        setUploading(true);
        setErrorMsg("");
        try {
          const session = await createSession(user.user_id);
          const pausesValue = latestAnalysis.pauses;
          const pauseCount = Array.isArray(pausesValue)
            ? pausesValue.length
            : typeof pausesValue === "number"
            ? pausesValue
            : 0;

          await createResponse({
            session_id: session.session_id,
            interview_prompt: currentQuestion || "Question not captured.",
            transcript: latestAnalysis.transcript || "",
            ai_feedback: latestAnalysis.feedback || "",
            gaze_count: latestAnalysis.distractions || 0,
            stutter_count: latestAnalysis.stutters || 0,
            pause_count: pauseCount,
          });
        } catch (err) {
          console.error("Session save failed:", err);
          setErrorMsg("Could not save this session. Please try End again.");
          setUploading(false);
          return;
        } finally {
          setUploading(false);
        }
      }

      setSessionEnded(true);
      teardownMedia();
    };

    //teardown media stream and recorder
    const teardownMedia = useCallback(() => {
        recorderRef.current = null;

        const stream = streamRef.current;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setStatus("idle");
        setErrorMsg("");
        setRecordedBlob(null);
        setMicEnabled(false);
        setCameraEnabled(false);
        setIsSetupComplete(false);
    }, []);

    useEffect(() => {
        return () => {
            if (recordedURL) {
                URL.revokeObjectURL(recordedURL);
            }
        };
    }, [recordedURL]);

    //upload to backend func
    const uploadRecording = async () => {
        if (!recordedBlob) {
            setErrorMsg("No recording available to upload."); //show an error message if there is no recorded blob to upload
            setStatus("error"); //update the status to error if there was an issue with uploading the recording
            return;
        }
        
        setErrorMsg(""); //clear any previous error messages
        setUploading(true);
        try {
          //sends the blob to the FastAPI /analyze-video endpoint
          const [visionRes, transcribeRes] = await Promise.all([
            uploadRecordingBlob(recordedBlob),
            transcribeAudioBlob(recordedBlob)
          ]);
          // console.log("Transcribe Result Object:", transcribeRes);
          if (transcribeRes.status === "success") {
            // 1. Backend now sends 'transcript' instead of 'text'
            const detectedText = transcribeRes.data?.transcript?.trim() || "(No speech detected)";
            const distractions = visionRes.distractions ?? 0;
            
            // 2. Access the new behavioral data Gemini is sending
            const sentiment = transcribeRes.data?.sentiment || "Neutral";
            const stutters = transcribeRes.data?.stutters || 0;
            const feedback = transcribeRes.data?.feedback || "";
            setAnalysisData([
              {
                transcript: transcribeRes.data?.transcript || "",
                sentiment: transcribeRes.data?.sentiment || "Neutral",
                stutters: transcribeRes.data?.stutters || 0,
                pauses: transcribeRes.data?.pauses || [],
                distractions: visionRes.distractions ?? 0,
                feedback: transcribeRes.data?.feedback || "",
              },
            ]);

        
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                text: 
                `Analysis complete!
                Your Response: ${detectedText}

                Behavioral Stats:
                • Stutters/Fillers: ${stutters}
                • Distractions: ${distractions}

                ${feedback}
                `.split('\n')                     
                .map(line => line.trimStart())  
                .join('\n'),
              },
            ]);
          setStatus("analyzed");
        }
      } catch (err) {
          console.error("error:", err);
          setStatus("error");
          setErrorMsg("Analysis failed.");
      } finally {
          setUploading(false);
      }
    };    
    useEffect(() => {
        return () => {
            teardownMedia(); //ensure media resources are cleaned up when the component is unmounted to prevent memory leaks and free up camera/microphone resources
        };
    }, [teardownMedia]); //empty dependency array ensures this effect runs only once on mount and cleanup on unmount  

    const statusColor =
      status === "recording"
        ? "#ef4444"
        : status === "ready"
        ? "#22c55e"
        : status === "analyzed"
        ? "#38bdf8"
        : status === "error"
        ? "#f97316"
        : "#64748b";
   return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "white",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.6fr 420px",
          gap: 20,
          alignItems: "stretch",
        }}
      >
        <InterviewPanel
          videoRef={videoRef}
          status={status}
          statusColor={statusColor}
          uploading={uploading}
          supported={supported}
          micEnabled={micEnabled}
          cameraEnabled={cameraEnabled}
          recordedURL={recordedURL}
          recordedBlob={recordedBlob}
          errorMsg={errorMsg}
          useMic={useMic}
          analysisData={analysisData}
          streamReady={!!streamRef.current}
          isSetupComplete={isSetupComplete}
          onSetup={setupMedia}
          onToggleMic={toggleMic}
          onToggleCamera={toggleCamera}
          onStart={startRecording}
          onStop={stopRecording}
          sessionEnded={sessionEnded}
          onAnalyze={uploadRecording}
          onReset={resetQuestion}
          onEnd={endSession}
        />

        <ChatPanel messages={messages} /> {/* RIGHT: FEEDBACK PANEL */}
      </div>
    </div>
  );
}



