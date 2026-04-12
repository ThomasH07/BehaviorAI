import React, { useEffect, useMemo, useState } from "react";
import MediaSetup from "./components/MediaSetup";
import {
  getCurrentUser,
  login,
  logout,
  signup,
  type AuthUser,
} from "./api/auth";

type AuthMode = "login" | "signup";
const MIN_PASSWORD_LENGTH = 12;

function AuthScreen({ onAuth }: { onAuth: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(
    () => (mode === "login" ? "Welcome back" : "Create your account"),
    [mode]
  );

  const subtitle = useMemo(
    () =>
      mode === "login"
        ? "Sign in to continue to your interview room"
        : "Sign up to start practicing with BehaviorAI",
    [mode]
  );

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
        return;
      }
      const user =
        mode === "login"
          ? await login(email.trim(), password)
          : await signup(name.trim(), email.trim(), password);
      onAuth(user);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Auth failed";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>
            BehaviorAI
          </div>
          <div style={{ color: "#94a3b8", fontSize: 14 }}>{subtitle}</div>
        </div>

        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{title}</div>
        </div>

        <form onSubmit={handleSubmit} style={formStackStyle}>
          {mode === "signup" && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
              autoComplete="name"
              required
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
            autoComplete="email"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />

          {error && <div style={errorStyle}>{error}</div>}

          <button type="submit" style={primaryBtn} disabled={submitting}>
            {submitting ? "Working..." : mode === "login" ? "Login" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          style={linkBtn}
          onClick={() => {
            setError(null);
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      try {
        const current = await getCurrentUser();
        if (active) {
          setUser(current);
        }
      } catch (err) {
        if (active) {
          const message = err instanceof Error ? err.message : "Auth check failed";
          setBootstrapError(message);
        }
      } finally {
        if (active) {
          setBootstrapping(false);
        }
      }
    }
    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  if (bootstrapping) {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>Checking session...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        {bootstrapError && (
          <div style={bannerStyle}>{bootstrapError}</div>
        )}
        <AuthScreen onAuth={setUser} />
      </>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={navStyle}>
        <div style={signedInWrapStyle}>
          <span style={signedInLabelStyle}>Signed in as</span>
          <span style={signedInPillStyle}>{user.user_name}</span>
        </div>
        <button
          type="button"
          style={linkBtn}
          onClick={async () => {
            await logout();
            setUser(null);
          }}
        >
          Logout
        </button>
      </div>
      <MediaSetup user={user} />
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top, #1e293b, #0f172a)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  boxSizing: "border-box",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: 420,
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 24,
  padding: 32,
  boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
  color: "white",
};

const formStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
  marginBottom: 12,
};

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

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#93c5fd",
  cursor: "pointer",
  fontSize: 13,
  width: "100%",
};

const errorStyle: React.CSSProperties = {
  color: "#fca5a5",
  background: "rgba(248, 113, 113, 0.15)",
  border: "1px solid rgba(248, 113, 113, 0.45)",
  padding: "10px 12px",
  borderRadius: 12,
  fontSize: 13,
};

const bannerStyle: React.CSSProperties = {
  position: "fixed",
  top: 20,
  left: "50%",
  transform: "translateX(-50%)",
  background: "#111827",
  color: "#fca5a5",
  border: "1px solid rgba(248, 113, 113, 0.5)",
  padding: "10px 16px",
  borderRadius: 999,
  zIndex: 10,
};

const navStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "12px 20px",
  background: "#0f172a",
  borderBottom: "1px solid #1f2937",
  color: "#e2e8f0",
};

const signedInWrapStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const signedInLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const signedInPillStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 999,
  padding: "6px 12px",
  fontSize: 14,
  fontWeight: 600,
  color: "#e2e8f0",
};