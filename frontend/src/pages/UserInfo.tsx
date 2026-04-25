import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AuthUser } from "../api/auth";
import {
  fetchRecentSessions,
  fetchSessionDetail,
  type RecentSessionItem,
  type SessionDetailResponse,
} from "../api/media";

type UserInfoProps = {
  user: AuthUser;
};

type RawSession = {
  id: number;
  createdAt: string;
  question: string;
};

type FormattedSession = {
  id: number;
  date: string;
  question: string;
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
    }));
}

export default function UserInfo({ user }: UserInfoProps) {
  const navigate = useNavigate();
  const [rawSessions, setRawSessions] = useState<RawSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [hoveredSessionId, setHoveredSessionId] = useState<number | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [detailCache, setDetailCache] = useState<Record<number, SessionDetailResponse>>({});

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

  useEffect(() => {
    if (selectedSessionId === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedSessionId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selectedSessionId]);

  const openSessionDetail = async (sessionId: number) => {
    setHoveredSessionId(null);
    setSelectedSessionId(sessionId);
    setModalError("");

    if (detailCache[sessionId]) {
      return;
    }

    setModalLoading(true);
    try {
      const detail = await fetchSessionDetail(user.user_id, sessionId);
      setDetailCache((prev) => ({
        ...prev,
        [sessionId]: detail,
      }));
    } catch (err) {
      console.error("Failed loading session detail:", err);
      setModalError("Could not load this session detail right now.");
    } finally {
      setModalLoading(false);
    }
  };

  const closeSessionDetail = () => {
    setSelectedSessionId(null);
  };

  const recentSessions = formatRecentSessions(rawSessions);
  const selectedSessionDetail =
    selectedSessionId !== null ? detailCache[selectedSessionId] : undefined;

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
              <div
                key={session.id}
                style={{
                  ...sessionCardStyle,
                  ...(hoveredSessionId === session.id ? sessionCardHoverStyle : {}),
                }}
                onClick={() => openSessionDetail(session.id)}
                onMouseEnter={() => setHoveredSessionId(session.id)}
                onMouseLeave={() => setHoveredSessionId(null)}
                onMouseUp={(event) => {
                  event.currentTarget.blur();
                }}
                onBlur={() => {
                  setHoveredSessionId((prev) => (prev === session.id ? null : prev));
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openSessionDetail(session.id);
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <div style={sessionHeaderStyle}>
                  <span style={sessionBadgeStyle}>Session {session.id}</span>
                  <span style={sessionDateStyle}>{session.date}</span>
                </div>

                <div style={sessionSectionStyle}>
                  <div style={miniLabelStyle}>Question</div>
                  <div style={sessionTextStyle}>{session.question}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedSessionId !== null ? (
        <div style={modalBackdropStyle} onClick={closeSessionDetail}>
          <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={modalTitleStyle}>Session {selectedSessionId} Detail</h2>
              <button type="button" style={modalCloseButtonStyle} onClick={closeSessionDetail}>
                ✕
              </button>
            </div>

            <div style={modalBodyStyle}>
              {modalLoading ? <div style={statusTextStyle}>Loading session detail...</div> : null}
              {!modalLoading && modalError ? <div style={statusTextStyle}>{modalError}</div> : null}

              {!modalLoading && !modalError && selectedSessionDetail ? (
                <>
                  <div style={detailListStyle}>
                    <div style={detailItemStyle}>
                      <span style={detailLabelStyle}>Session Date</span>
                      <span style={detailValueStyle}>{formatSessionDate(selectedSessionDetail.session_date)}</span>
                    </div>

                    {selectedSessionDetail.gaze_count !== null ? (
                      <div style={detailItemStyle}>
                        <span style={detailLabelStyle}>Gaze Count</span>
                        <span style={detailValueStyle}>{selectedSessionDetail.gaze_count}</span>
                      </div>
                    ) : null}

                    {selectedSessionDetail.stutter_count !== null ? (
                      <div style={detailItemStyle}>
                        <span style={detailLabelStyle}>Stutter Count</span>
                        <span style={detailValueStyle}>{selectedSessionDetail.stutter_count}</span>
                      </div>
                    ) : null}
                  </div>

                  {selectedSessionDetail.transcript ? (
                    <div style={modalSectionStyle}>
                      <div style={miniLabelStyle}>Transcript</div>
                      <div style={modalTranscriptStyle}>{selectedSessionDetail.transcript}</div>
                    </div>
                  ) : null}

                  {selectedSessionDetail.ai_feedback ? (
                    <div style={modalSectionStyle}>
                      <div style={miniLabelStyle}>AI Feedback</div>
                      <div style={sessionFeedbackStyle}>{selectedSessionDetail.ai_feedback}</div>
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
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
  borderColor: "#1f2937",
  borderRadius: 18,
  padding: 18,
  cursor: "pointer",
  outline: "none",
  transform: "translateY(0)",
  boxShadow: "none",
  transition: "transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease",
};

const sessionCardHoverStyle: React.CSSProperties = {
  transform: "translateY(-2px)",
  borderColor: "#3b82f6",
  boxShadow: "0 12px 28px rgba(59, 130, 246, 0.18)",
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

const modalBackdropStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 80,
  background: "rgba(2, 6, 23, 0.74)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
};

const modalCardStyle: React.CSSProperties = {
  width: "min(760px, 100%)",
  maxHeight: "90vh",
  overflow: "auto",
  background: "#07132b",
  border: "1px solid #1f2937",
  borderRadius: 20,
  boxShadow: "0 24px 60px rgba(2, 6, 23, 0.55)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 18px",
  borderBottom: "1px solid rgba(148, 163, 184, 0.2)",
};

const modalTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  color: "#f8fafc",
};

const modalCloseButtonStyle: React.CSSProperties = {
  border: "1px solid #334155",
  background: "#111827",
  color: "#e2e8f0",
  borderRadius: 8,
  width: 34,
  height: 34,
  cursor: "pointer",
  fontSize: 16,
  lineHeight: 1,
};

const modalBodyStyle: React.CSSProperties = {
  padding: 18,
};

const detailListStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 10,
  marginBottom: 18,
};

const detailItemStyle: React.CSSProperties = {
  background: "#0b1733",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: "10px 12px",
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const detailLabelStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const detailValueStyle: React.CSSProperties = {
  color: "#f8fafc",
  fontSize: 14,
  fontWeight: 600,
};

const modalSectionStyle: React.CSSProperties = {
  marginTop: 16,
};

const modalTranscriptStyle: React.CSSProperties = {
  color: "#e2e8f0",
  fontSize: 14,
  lineHeight: 1.6,
  whiteSpace: "pre-wrap",
  background: "#0b1733",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 12,
};

const statusTextStyle: React.CSSProperties = {
  color: "#94a3b8",
  fontSize: 14,
  lineHeight: 1.6,
};