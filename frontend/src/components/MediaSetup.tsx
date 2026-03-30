import React, { useEffect, useRef, useState, useCallback } from "react";

import { uploadRecordingBlob, transcribeAudioBlob } from "../api/media";

type Status = "idle" | "ready" | "recording" | "stopped" |"error"; //status of the media process
//status covers camera status (ready, error) and recording status (recording, stopped)
//could change later if we want to isolate and track camera and recording status separately, but for now this is sufficient

type ChatMessage = { //Inidivudal structure for msg
  id: number;
  role: "user" | "assistant";
  text: string;
};

export default function MediaSetup() { //function to use the media setup process
    const videoRef = useRef<HTMLVideoElement | null>(null); //reference to the DOM element
    const streamRef = useRef<MediaStream | null>(null); //reference to the media stream stored from getUserMedia API
    const recorderRef = useRef<MediaRecorder | null>(null); //reference to the media recorder instance
    const chunksRef = useRef<BlobPart[]>([]); //reference to the stored pieces of the recorded media as the data arrives
    //using blobpart instead of blob because the data is stored in pieces and not as a whole until the recording is stopped
    //blobparts are things that combine to form a blob, which is the final recorded media file




    //UI components
    const playbackVideoRef = useRef<HTMLVideoElement | null>(null);
    const [micEnabled, setMicEnabled] = useState(true);
    const [cameraEnabled, setCameraEnabled] = useState(true);

    const [chatInput, setChatInput] = useState("");
    const [messages, setMessages] = useState<ChatMessage[]>([
      {
        id: 1,
        role: "assistant",
        text: "Hi Derek — I’m ready to help. Start your recording or ask for feedback here.",
      },
    ]);
    const [status, setStatus] = useState<Status>("idle"); //state to track the status of the media process
    const [errorMsg, setErrorMsg] = useState<string>(""); //state to store any error messages that may occur during the media process
    const [useMic, setUseMic] = useState<boolean>(true); //state to track whether the user wants to use the microphone for audio recording
    const [uploading, setUploading] = useState(false); //track uploading state for satetyling or disabling buttons during upload, and to provide user feedback if desired 
    //not using now but for future testing and toggling

    //Recorded output states
    const [recordedURL, setRecordedURL] = useState<string | null>(null); //state to store the URL of the recorded media file for playback or download
    //default state stores just a temp url like blob:http://localhost:3000/… but could be extended to store the file name or other metadata if needed
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null); //state to store the actual recorded media file as a BLOB for download or further processing

    const [analysisData, setAnalysisData] = useState<any[] | null>(null);
    //support validation

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
        setErrorMsg(""); //reset any previous error messages
        setRecordedBlob(null); //reset any previous recorded blob
        if (recordedURL) {
            URL.revokeObjectURL(recordedURL); //revoke the previous recorded URL to free up memory
            setRecordedURL(null); //reset the recorded URL state
        }
        setRecordedBlob(null); //reset the recorded blob state to clear any previous recording data
        setMicEnabled(useMic); //set the mic enabled state based on the current useMic value, which determines whether the audio stream will be requested from the user's microphone during media setup
        setCameraEnabled(true); //set the camera enabled state to true during media setup, as we are requesting the video stream from the user's camera and want the live preview to be visible by default

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
        
        //revoke old recorded URL if it exists to free up memory before starting a new recording session
        if (recordedURL) {
            URL.revokeObjectURL(recordedURL);
            setRecordedURL(null);
        }
        setRecordedBlob(null);

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
            const type = mimeType ?? "video/webm"; //use the selected mimetype or fallback to default webm if no specific mimetype was selected
            const blob = new Blob(chunksRef.current, { type }); //combine the recorded chunks into a single Blob representing the complete recorded media file
            if (blob.size > 0) {
              setRecordedBlob(blob); //store the recorded Blob in state for download or further processing
              setRecordedURL(URL.createObjectURL(blob)); //store the recorded URL in state for use in the UI
              setStatus("stopped"); //update the status to stopped after the recording has been successfully processed and stored
              console.log("Blob ready! Size:", blob.size);
            } else {
                console.error("Recording failed: Blob is empty.");
                setStatus("error");
            }
            //reset the chunks ref for the next recording session
            // setRecordedBlob(blob); //store the recorded Blob in state for download or further processing
            // const url = URL.createObjectURL(blob); //create a temporary URL for the recorded Blob to enable playback or download
            // setRecordedURL(url); //store the recorded URL in state for use in the UI
            // setStatus("stopped"); //update the status to stopped after the recording has been successfully processed and stored
            // chunksRef.current = []; //reset the chunks ref for the next recording session
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

    const sendMessage = () => {
      const trimmed = chatInput.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: Date.now(),
        role: "user",
        text: trimmed,
      };

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "Placeholder LLM response — connect this to your backend/chat endpoint next.",
        },
      ]);

      setChatInput("");
    };

        //stop w check 
    const stopRecording = () => {
        const recorder = recorderRef.current;
        if (!recorder || recorder.state !== "recording") {
            setErrorMsg("No active recording to stop.");
            return;
        }
          recorder.stop(); //stop the recording process, which will trigger the onstop event to process and store the recorded media
    };

    //teardown media stream and recorder
    const teardownMedia = useCallback(() => {
        recorderRef.current = null; //clear the recorder ref
        const stream = streamRef.current;
        if (stream) {
            stream.getTracks().forEach((track) => track.stop()); //stop all tracks of the media stream to release the camera and microphone resources
            streamRef.current = null; //clear the stream ref
        }
        // can reduce this to:
        // const stream = await navigator.mediaDevices.getUserMedia({
        // audio: true,
        // video: false,
        // });
        // if needed for whisper, reducing file size and speeds uploads


        if (videoRef.current) {
            videoRef.current.srcObject = null; //clear the video element's source to stop the live preview
        }
        setStatus("idle"); //reset the status to idle after tearing down the media setup
        setErrorMsg(""); //clear any error messages
        setRecordedBlob(null); //clear any recorded blob
        setMicEnabled(false); //reset mic enabled state
        setCameraEnabled(false); //reset camera enabled state
        if (recordedURL) {
            URL.revokeObjectURL(recordedURL); //revoke any existing recorded URL to free up memory
            setRecordedURL(null); //clear the recorded URL state
        }
    },[recordedURL]);

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
        
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now(),
                role: "assistant",
                text: `Analysis complete! 
                       I heard: "${detectedText}"
                       
                       Behavioral Stats:
                       • Sentiment: ${sentiment}
                       • Stutters/Fillers: ${stutters}
                       • Distractions: ${distractions}
                       
                       Coach Feedback: ${feedback}`,
              },
            ]);
        }
      } catch (err) {
          console.error("error:", err);
      } finally {
          setUploading(false);
      }
    };    
    useEffect(() => {
        return () => {
            teardownMedia(); //ensure media resources are cleaned up when the component is unmounted to prevent memory leaks and free up camera/microphone resources
        };
    }, []); //empty dependency array ensures this effect runs only once on mount and cleanup on unmount  

    const statusColor =
      status === "recording"
        ? "#ef4444"
        : status === "ready"
        ? "#22c55e"
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
        {/* LEFT: VIDEO AREA */}
        <div
          style={{
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: 24,
            padding: 16,
            display: "flex",
            flexDirection: "column",
            minHeight: 720,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          }}
        >
          {/* top bar */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          {/* LEFT SIDE: title/subtitle */}
          <div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>Interview Room</div>
            <div style={{ color: "#94a3b8", fontSize: 14 }}>
              Camera preview + controls
            </div>
          </div>

          {/* RIGHT SIDE: status pill + user icon */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {/* switched: kept only ONE status pill */}
            <div
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 999,
                padding: "8px 12px",
                fontSize: 13,
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: statusColor,
                  display: "inline-block",
                }}
              />
              {uploading ? "Uploading..." : status}
            </div>

            {/* switched: added user icon button */}
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: "50%",
                background: "#1e293b",
                border: "1px solid #334155",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                color: "#e2e8f0",
                cursor: "pointer",
              }}
              title="User Profile"
            >
              👤
            </div>
          </div>
        </div>

          {/* video box */}
          <div
            style={{
              position: "relative",
              flex: 1,
              borderRadius: 22,
              overflow: "hidden",
              background: "#000",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                background: "#000",
                display: cameraEnabled ? "block" : "none",
              }}
            />

            {!cameraEnabled && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  background:
                    "linear-gradient(135deg, rgba(15,23,42,1), rgba(30,41,59,1))",
                  color: "#cbd5e1",
                  fontSize: 20,
                  fontWeight: 600,
                }}
              >
                Camera is off
              </div>
            )}

            {/* small badges */}
            <div
              style={{
                position: "absolute",
                top: 16,
                left: 16,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  background: "rgba(0,0,0,0.45)",
                  // backdropFilter: "blur(8px)",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                {micEnabled ? "Mic on" : "Mic off"}
              </div>

              <div
                style={{
                  background: "rgba(0,0,0,0.45)",
                  // backdropFilter: "blur(8px)",
                  borderRadius: 999,
                  padding: "8px 12px",
                  fontSize: 13,
                }}
              >
                {cameraEnabled ? "Camera on" : "Camera off"}
              </div>
            </div>

            {/* bottom control bar */}
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                bottom: 16,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 12,
                  borderRadius: 999,
                  background: "rgba(15,23,42,0.8)",
                  // backdropFilter: "blur(14px)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <button onClick={setupMedia} disabled={!supported || status === "recording"} style={controlBtn}>
                  Setup
                </button>

                <button onClick={toggleMic} disabled={!streamRef.current} style={controlBtn}>
                  {micEnabled ? "Mute" : "Unmute"}
                </button>

                <button onClick={toggleCamera} disabled={!streamRef.current} style={controlBtn}>
                  {cameraEnabled ? "Cam Off" : "Cam On"}
                </button>

                <button onClick={startRecording} disabled={status !== "ready"} style={primaryBtn}>
                  Record
                </button>

                <button onClick={stopRecording} disabled={status !== "recording"} style={controlBtn}>
                  Stop
                </button>

                <button
                  onClick={uploadRecording}
                  disabled={status === "recording" || !recordedBlob || uploading}
                  style={controlBtn}
                >
                  {uploading ? "Uploading..." : "Analyze"}
                </button>

                <button onClick={teardownMedia} disabled={status === "recording"} style={dangerBtn}>
                  End
                </button>
              </div>
            </div>
          </div>

          {/* footer area under video */}
          <div
            style={{
              marginTop: 14,
              display: "grid",
              gridTemplateColumns: recordedURL ? "1fr 1fr" : "1fr",
              gap: 14,
            }}
          >
            <div
              style={{
                background: "#0f172a",
                borderRadius: 18,
                border: "1px solid #1f2937",
                padding: 14,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Session Info</div>
              <div style={{ color: "#cbd5e1", fontSize: 14, lineHeight: 1.6 }}>
                <div>Status: {status}</div>
                <div>Microphone requested: {useMic ? "Yes" : "No"}</div>
                <div>Backend analysis: {analysisData ? "Available" : "Not yet"}</div>
                {errorMsg && <div style={{ color: "#fca5a5" }}>Error: {errorMsg}</div>}
              </div>
            </div>

            {recordedURL && (
              <div
                style={{
                  background: "#0f172a",
                  borderRadius: 18,
                  border: "1px solid #1f2937",
                  padding: 14,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Recorded Preview</div>
                <video
                  ref={playbackVideoRef}
                  src={recordedURL}
                  controls
                  style={{
                    width: "100%",
                    maxHeight: 180,
                    background: "#000",
                    borderRadius: 12,
                  }}
                />
                {recordedBlob && (
                  <div style={{ marginTop: 8, color: "#94a3b8", fontSize: 13 }}>
                    Size: {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: CHAT PANEL */}
        <aside
          style={{
            background: "#111827",
            border: "1px solid #1f2937",
            borderRadius: 24,
            display: "flex",
            flexDirection: "column",
            minHeight: 720,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: 18,
              borderBottom: "1px solid #1f2937",
              background: "#0f172a",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>AI Assistant</div>
            <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
              Live coaching, feedback, and analysis chat
            </div>
          </div>

          <div
            style={{
              flex: 1,
              padding: 16,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              background: "#111827",
            }}
          >
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                  padding: "12px 14px",
                  borderRadius: 16,
                  background: msg.role === "user" ? "#2563eb" : "#1e293b",
                  color: "white",
                  lineHeight: 1.5,
                  fontSize: 14,
                }}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div
            style={{
              padding: 16,
              borderTop: "1px solid #1f2937",
              background: "#0f172a",
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") sendMessage();
                }}
                placeholder="Ask the LLM for feedback..."
                style={{
                  flex: 1,
                  background: "#111827",
                  border: "1px solid #334155",
                  color: "white",
                  borderRadius: 12,
                  padding: "12px 14px",
                  outline: "none",
                }}
              />
              <button onClick={sendMessage} style={primaryBtn}>
                Send
              </button>
            </div>

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <button
                style={chipBtn}
                onClick={() =>
                  setChatInput("Give me a quick summary of my interview performance.")
                }
              >
                Performance summary
              </button>
              <button
                style={chipBtn}
                onClick={() =>
                  setChatInput("What distractions did you detect in this session?")
                }
              >
                Distractions
              </button>
              <button
                style={chipBtn}
                onClick={() =>
                  setChatInput("How can I improve eye contact and body language?")
                }
              >
                Improvement tips
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

const controlBtn: React.CSSProperties = {
  background: "#1e293b",
  color: "white",
  border: "1px solid #334155",
  borderRadius: 999,
  padding: "12px 16px",
  cursor: "pointer",
  fontWeight: 600,
};

const primaryBtn: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 700,
};

const dangerBtn: React.CSSProperties = {
  background: "#dc2626",
  color: "white",
  border: "none",
  borderRadius: 999,
  padding: "12px 18px",
  cursor: "pointer",
  fontWeight: 700,
};

const chipBtn: React.CSSProperties = {
  background: "#1e293b",
  color: "#e2e8f0",
  border: "1px solid #334155",
  borderRadius: 999,
  padding: "8px 12px",
  cursor: "pointer",
  fontSize: 13,
};