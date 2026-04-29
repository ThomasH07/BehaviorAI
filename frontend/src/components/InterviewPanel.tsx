import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import React, { useState, useEffect } from "react";
type Status = "idle" | "ready" | "recording" | "stopped" | "analyzed" | "error";

type InterviewPanelProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: Status;
  statusColor: string;
  uploading: boolean;
  supported: boolean;
  micEnabled: boolean;
  cameraEnabled: boolean;
  recordedURL: string | null;
  recordedBlob: Blob | null;
  errorMsg: string;
  useMic: boolean;
  analysisData: any[] | null;
  streamReady: boolean;
  isSetupComplete: boolean;
  sessionEnded: boolean;
  onSetup: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onStart: () => void;
  onStop: () => void;
  onAnalyze: () => void;
  onReset: () => void;
  onEnd: () => void;
};

export default function InterviewPanel({
  videoRef,
  status,
  statusColor,
  uploading,
  supported,
  micEnabled,
  cameraEnabled,
  recordedURL,
  recordedBlob,
  errorMsg,
  useMic,
  analysisData,
  streamReady,
  isSetupComplete,
  sessionEnded,
  onSetup,
  onToggleMic,
  onToggleCamera,
  onStart,
  onStop,
  onAnalyze,
  onReset,
  onEnd,
}: InterviewPanelProps) {
  const [timeLeft, setTimeLeft] = useState<number>(120); // 2 minutes
  useEffect(() => {
    //if we aren't recording, keep the timer reset and ready
    if (status !== "recording") {
      setTimeLeft(120);
      return;
    }

    //if time hits 0, trigger the stop function from props
    if (timeLeft <= 0) {
      console.log("4-minute limit reached. Auto-stopping...");
      onStop();
      return;
    }

    //tick down every second
    const intervalId = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [status, timeLeft, onStop]);
  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };
  return (
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>Interview Room</div>
          <div style={{ color: "#94a3b8", fontSize: 14 }}>
            Camera preview + controls
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
            {uploading ? "Uploading..." : !isSetupComplete ? "waiting for setup" : status}
          </div>
        </div>
      </div>

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
        {!isSetupComplete && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 30,
              background: "rgba(107, 114, 128, 0.55)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 24,
            }}
          >
            <div
              style={{
                width: "min(420px, 100%)",
                background: "rgba(15, 23, 42, 0.96)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 24,
                padding: 28,
                textAlign: "center",
                boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
              }}
            >
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  marginBottom: 10,
                  color: "#ffffff",
                }}
              >
                Ready to start?
              </div>

              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 15,
                  lineHeight: 1.6,
                  marginBottom: 20,
                }}
              >
                Allow camera and microphone access before entering the interview room.
              </div>

              <button
                onClick={onSetup}
                disabled={!supported || status === "recording"}
                style={{
                  background: supported ? "#2563eb" : "#475569",
                  color: "white",
                  border: "none",
                  borderRadius: 999,
                  padding: "13px 20px",
                  cursor: supported ? "pointer" : "not-allowed",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                {supported ? "Allow access" : "Not supported"}
              </button>
            </div>
          </div>
        )}

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
          <button
            onClick={onToggleMic}
            disabled={!isSetupComplete || !streamReady || sessionEnded}
            style={iconBtn}
            title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          >
            {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
          </button>

          <button
            onClick={onToggleCamera}
            disabled={!isSetupComplete || !streamReady || sessionEnded}
            style={iconBtn}
            title={cameraEnabled ? "Turn camera off" : "Turn camera on"}
          >
            {cameraEnabled ? <Video size={20} /> : <VideoOff size={20} />}
          </button>
        </div>
        {status === "recording" && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              zIndex: 40,
              background: "rgba(15, 23, 42, 0.8)", 
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 999,
              padding: "8px 16px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              backdropFilter: "blur(4px)",
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: timeLeft <= 30 ? "#ef4444" : "#cbd5e1",
                opacity: timeLeft <= 30 && timeLeft % 2 === 0 ? 0.4 : 1, 
                transition: "opacity 0.2s"
              }}
            />
            <span 
              style={{ 
                color: "#f7fafc", 
                fontFamily: "monospace", 
                fontSize: 16, 
                fontWeight: 600 
              }}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
        )}
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
              border: "1px solid rgba(255,255,255,0.08)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            {(status === "idle" || status === "ready") && (
              <button
                onClick={onStart}
                disabled={!supported || !streamReady || sessionEnded}
                style={primaryBtn}
              >
                Record
              </button>
            )}

            {status === "recording" && (
              <button
                onClick={onStop}
                disabled={sessionEnded}
                style={primaryBtn}
              >
                Stop
              </button>
            )}

            {status === "stopped" && (
              <>
                <button
                  onClick={onAnalyze}
                  disabled={!recordedBlob || uploading || sessionEnded}
                  style={controlBtn}
                >
                  {uploading ? "Analyzing..." : "Analyze"}
                </button>

                <button
                  onClick={onReset}
                  disabled={sessionEnded}
                  style={controlBtn}
                >
                  Re-record
                </button>
              </>
            )}

            {status === "analyzed" && (
              <button
                onClick={onReset}
                disabled={sessionEnded}
                style={controlBtn}
              >
                Next Question
              </button>
            )}

            <button
              onClick={onEnd}
              disabled={sessionEnded}
              style={dangerBtn}
            >
              End
            </button>
          </div>
        </div>
      </div>

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
            <div style={{ fontWeight: 700, marginBottom: 8 }}>
              Recorded Preview
            </div>
            <video
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

const iconBtn: React.CSSProperties = {
  width: 48,
  height: 48,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#1e293b",
  color: "white",
  border: "1px solid #334155",
  borderRadius: "50%",
  cursor: "pointer",
  fontWeight: 600,
};