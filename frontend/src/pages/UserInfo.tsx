import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AuthUser } from "../api/auth";
import { fetchRecentSessions, type RecentSessionItem } from "../api/media";

type UserInfoProps = {
  user: AuthUser;
};

type RawSession = {
  id: number;
  createdAt: string;
  question: string;
  feedback: string;
};

type FormattedSession = {
  id: number;
  date: string;
  question: string;
  feedback: string;
};

function formatSessionDate(dateString: string): string {
  const date = new Date(dateString);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

function formatRecentSessions(sessions: RawSession[]): FormattedSession[] {
  return sessions
    .slice()
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    .slice(0, 5)
    .map((session) => ({
      id: session.id,
      date: formatSessionDate(session.createdAt),
      question: session.question,
      feedback: session.feedback,
    }));
}

export default function UserInfo({ user }: UserInfoProps) {
  const navigate = useNavigate();
  const [rawSessions, setRawSessions] = useState<RawSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let alive = true;

    const loadRecent = async () => {
      setLoading(true);
      setErrorMsg("");
      try {
        const res = await fetchRecentSessions(user.user_id);
        if (!alive) {
          return;
        }
        const mapped = (res.sessions || []).map((session: RecentSessionItem) => ({
          id: session.session_id,
          createdAt: session.session_date,
          question: session.question,
          feedback: session.feedback,
        }));
        setRawSessions(mapped);
      } catch (err) {
        console.error("Failed loading recent sessions:", err);
        if (alive) {
          setErrorMsg("Could not load recent sessions right now.");
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    };

    loadRecent();

    return () => {
      alive = false;
    };
  }, [user.user_id]);

  const recentSessions = formatRecentSessions(rawSessions);

  return (
    <div style={pageStyle}>
      <div style={topBarStyle}>
        <button
          type="button"
          style={backButtonStyle}
          onClick={() => navigate("/")}
        >
          ← Back
        </button>
      </div>

      <div style={contentGridStyle}>
        <div style={panelStyle}>
          <h1 style={titleStyle}>User Info</h1>

          <div style={infoBlockStyle}>
            <h2 style={sectionTitleStyle}>Profile</h2>

            <div style={infoRowStyle}>
              <span style={labelStyle}>Username</span>
              <span style={valueStyle}>{user.user_name}</span>
            </div>

            <div style={infoRowStyle}>
              <span style={labelStyle}>Role</span>
              <span style={valueStyle}>Candidate</span>
            </div>
          </div>
        </div>

        <div style={panelStyle}>
          <h1 style={titleStyle}>Recent Sessions</h1>

          <div style={sessionsWrapStyle}>
            {loading ? <div style={statusTextStyle}>Loading recent sessions...</div> : null}
            {!loading && errorMsg ? <div style={statusTextStyle}>{errorMsg}</div> : null}
            {!loading && !errorMsg && recentSessions.length === 0 ? (
              <div style={statusTextStyle}>No sessions yet. Complete an interview to see history.</div>
            ) : null}
            {recentSessions.map((session) => (
              <div key={session.id} style={sessionCardStyle}>
                <div style={sessionHeaderStyle}>
                  <span style={sessionBadgeStyle}>Session {session.id}</span>
                  <span style={sessionDateStyle}>{session.date}</span>
                </div>

                <div style={sessionSectionStyle}>
                  <div style={miniLabelStyle}>Question</div>
                  <div style={sessionTextStyle}>{session.question}</div>
                </div>

                <div style={sessionSectionStyle}>
                  <div style={miniLabelStyle}>Feedback</div>
                  <div style={sessionFeedbackStyle}>{session.feedback}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#020617",
  padding: "24px 32px 32px",
  color: "#e2e8f0",
  boxSizing: "border-box",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "flex-start",
  marginBottom: 20,
};

const backButtonStyle: React.CSSProperties = {
  background: "#111827",
  border: "1px solid #1f2937",
  color: "#e2e8f0",
  borderRadius: 999,
  padding: "10px 16px",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 0.85fr) minmax(420px, 1.4fr)",
  gap: 24,
  alignItems: "start",
};

const panelStyle: React.CSSProperties = {
  background: "#07132b",
  border: "1px solid #1f2937",
  borderRadius: 24,
  padding: 24,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
};

const titleStyle: React.CSSProperties = {
  margin: "0 0 22px 0",
  fontSize: 24,
  fontWeight: 700,
  color: "#f8fafc",
};

const infoBlockStyle: React.CSSProperties = {
  background: "#0b1733",
  border: "1px solid #1f2937",
  borderRadius: 18,
  padding: 18,
  marginBottom: 18,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px 0",
  color: "#93c5fd",
  fontSize: 18,
  fontWeight: 700,
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 0",
  borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
};

const labelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 14,
};

const valueStyle: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: 14,
  fontWeight: 600,
};

const sessionsWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const sessionCardStyle: React.CSSProperties = {
  background: "#0b1733",
  border: "1px solid #1f2937",
  borderRadius: 18,
  padding: 18,
};

const sessionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 14,
};

const sessionBadgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  borderRadius: 999,
  padding: "6px 10px",
  background: "#111827",
  border: "1px solid #334155",
  color: "#e2e8f0",
  fontSize: 13,
  fontWeight: 700,
};

const sessionDateStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 13,
};

const sessionSectionStyle: React.CSSProperties = {
  marginBottom: 12,
};

const miniLabelStyle: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: "#60a5fa",
  marginBottom: 6,
};

const sessionTextStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: 14,
  fontWeight: 600,
  lineHeight: 1.5,
};

const sessionFeedbackStyle: React.CSSProperties = {
  color: "#cbd5e1",
  fontSize: 14,
  lineHeight: 1.6,
};

const statusTextStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 14,
  lineHeight: 1.6,
};