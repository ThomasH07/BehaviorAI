import React, { useEffect, useRef, useState, useCallback } from "react";

import { uploadRecordingBlob } from "../api/media";

type Status = "idle" | "ready" | "recording" | "stopped" |"error"; //status of the media process
//status covers camera status (ready, error) and recording status (recording, stopped)
//could change later if we want to isolate and track camera and recording status separately, but for now this is sufficient


export default function MediaSetup() { //function to use the media setup process
    const videoRef = useRef<HTMLVideoElement | null>(null); //reference to the DOM element
    const streamRef = useRef<MediaStream | null>(null); //reference to the media stream stored from getUserMedia API
    const recorderRef = useRef<MediaRecorder | null>(null); //reference to the media recorder instance
    const chunksRef = useRef<BlobPart[]>([]); //reference to the stored pieces of the recorded media as the data arrives
    //using blobpart instead of blob because the data is stored in pieces and not as a whole until the recording is stopped
    //blobparts are things that combine to form a blob, which is the final recorded media file


    //UI components

    const [status, setStatus] = useState<Status>("idle"); //state to track the status of the media process
    const [errorMsg, setErrorMsg] = useState<string>(""); //state to store any error messages that may occur during the media process
    const [useMic, setUseMic] = useState<boolean>(true); //state to track whether the user wants to use the microphone for audio recording
    const [uploading, setUploading] = useState(false); //track uploading state for satetyling or disabling buttons during upload, and to provide user feedback if desired 
    //not using now but for future testing and toggling

    //Recorded output states
    const [recordedURL, setRecordedURL] = useState<string | null>(null); //state to store the URL of the recorded media file for playback or download
    //default state stores just a temp url like blob:http://localhost:3000/… but could be extended to store the file name or other metadata if needed
    const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null); //state to store the actual recorded media file as a BLOB for download or further processing

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
            if (event.data && event.data.size > 0) {
                chunksRef.current.push(event.data); //store the incoming data chunks in the ref array as they arrive during recording
            }
        };
        
        recorder.onstop = () => {
            const type = mimeType ?? "video/webm"; //use the selected mimetype or fallback to default webm if no specific mimetype was selected
            const blob = new Blob(chunksRef.current, { type }); //combine the recorded chunks into a single Blob representing the complete recorded media file

            //reset the chunks ref for the next recording session
            setRecordedBlob(blob); //store the recorded Blob in state for download or further processing
            const url = URL.createObjectURL(blob); //create a temporary URL for the recorded Blob to enable playback or download
            setRecordedURL(url); //store the recorded URL in state for use in the UI
            setStatus("stopped"); //update the status to stopped after the recording has been successfully processed and stored
            chunksRef.current = []; //reset the chunks ref for the next recording session
        };

        recorder.start(); //pass timeslice ms 
        setStatus("recording"); //update the status to recording after starting the recording process
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
        if (recordedURL) {
            URL.revokeObjectURL(recordedURL); //revoke any existing recorded URL to free up memory
            setRecordedURL(null); //clear the recorded URL state
        }
    },[recordedURL]);

    //cleanup on component unmount
    useEffect(() => {
        return () => {
            teardownMedia(); //ensure media resources are cleaned up when the component is unmounted to prevent memory leaks and free up camera/microphone resources
        };
    }, [teardownMedia]); //empty dependency array ensures this effect runs only once on mount and cleanup on unmount
    

    //upload to backend func
    const uploadRecording = async () => {
        if (!recordedBlob) {
            setErrorMsg("No recording available to upload."); //show an error message if there is no recorded blob to upload
            setStatus("error"); //update the status to error if there was an issue with uploading the recording
            return;
        }

        setErrorMsg(""); //clear any previous error messages
        
        try {
            const data = await uploadRecordingBlob(recordedBlob);
            console.log("Upload response:", data);
            setStatus("stopped"); //keep status as stopped after successful upload, or could introduce a new status like "uploaded" if we want to track that separately
        } catch (err) {
            const msg = err instanceof Error ? err.message : "An error occurred during upload.";
            setErrorMsg(msg); //set the error message state to show the error that occurred during the upload process
            setStatus("error"); //update the status to error if there was an issue with uploading the recording
        }
    };
            
 return (
    <div style={{ padding: 16, maxWidth: 900, margin: "0 auto" }}>
      <h2>Recorder Setup (local file)</h2>

      {!supported && (
        <p style={{ color: "crimson" }}>
          Missing support: <code>getUserMedia</code> or <code>MediaRecorder</code>.
        </p>
      )}

      <label style={{ display: "block", marginBottom: 10 }}>
        <input
          type="checkbox"
          checked={useMic}
          onChange={(e) => setUseMic(e.target.checked)}
          disabled={status === "ready" || status === "recording"}
        />{" "}
        Include microphone
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={setupMedia} disabled={!supported || status === "recording"}>
          Setup (ask permission)
        </button>

        <button onClick={startRecording} disabled={status !== "ready"}>
          Start recording
        </button>

        <button onClick={stopRecording} disabled={status !== "recording"}>
          Stop recording
        </button>

        <button onClick={uploadRecording} disabled={status !== "stopped" || !recordedBlob || uploading}>
            {uploading ? "Uploading..." : "Upload to backend"}
        </button>

        <button onClick={teardownMedia} disabled={status === "recording"}>
          Teardown (turn off cam/mic)
        </button>
      </div>

      <div style={{ marginBottom: 10 }}>
        <b>Status:</b> {status}
        {errorMsg && (
          <span style={{ color: "crimson" }}>
            {" "}
            — <b>Error:</b> {errorMsg}
          </span>
        )}
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {/* Live preview while recording */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Live preview</div>
          <video
            ref={videoRef}
            style={{ width: "100%", maxWidth: 720, background: "#000", borderRadius: 10 }}
            playsInline
            muted
          />
        </div>

        {/* Playback of recorded clip */}
        {recordedURL && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Recorded playback</div>
            <video
              src={recordedURL}
              controls
              style={{ width: "100%", maxWidth: 720, background: "#000", borderRadius: 10 }}
            />
            <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
              {recordedBlob && (
                <span style={{ opacity: 0.8 }}>
                  Size: {(recordedBlob.size / 1024 / 1024).toFixed(2)} MB
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}   
