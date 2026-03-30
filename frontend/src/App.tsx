import React, { useState } from "react";
import MediaSetup from "./components/MediaSetup";

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#111827",
          border: "1px solid #1f2937",
          borderRadius: 24,
          padding: 32,
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
          color: "white",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
            BehaviorAI
          </div>
          <div style={{ color: "#94a3b8", fontSize: 14 }}>
            Sign in to continue to your interview room
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input
            type="text"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />

          <button onClick={onLogin} style={primaryBtn}>
            Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  return isLoggedIn ? (
    <MediaSetup />
  ) : (
    <LoginScreen onLogin={() => setIsLoggedIn(true)} />
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#0f172a",
  border: "1px solid #334155",
  color: "white",
  borderRadius: 14,
  padding: "14px 16px",
  outline: "none",
  fontSize: 14,
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  background: "#2563eb",
  color: "white",
  border: "none",
  borderRadius: 999,
  padding: "14px 18px",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 15,
};