import React, { useEffect, useRef } from "react";

export type ChatMessage = {
  id: number;
  text: string;
};

type ChatPanelProps = {
  messages: ChatMessage[];
};

export default function ChatPanel({ messages }: ChatPanelProps) {
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = messagesContainerRef.current;

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }, [messages]);

  return (
    <aside
      style={{
        background: "#111827",
        border: "1px solid #1f2937",
        borderRadius: 24,
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 100px)",
        minHeight: 0,
        position: "sticky",
        top: 20,
        alignSelf: "start",
        boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: 18,
          borderBottom: "1px solid #1f2937",
          background: "#0f172a",

          // keeps header from shrinking
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700 }}>AI Coach</div>
        <div style={{ color: "#94a3b8", fontSize: 14, marginTop: 4 }}>
          Questions, analysis, and interview feedback
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        style={{
          flex: 1,
          minHeight: 0,
          padding: 16,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 12,
          background: "#111827",
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              color: "#94a3b8",
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            The AI coach will post questions and feedback here.
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                alignSelf: "flex-start",
                maxWidth: "90%",
                padding: "12px 14px",
                borderRadius: 16,
                background: "#1e293b",
                color: "white",
                lineHeight: 1.5,
                fontSize: 14,
                whiteSpace: "pre-wrap",

                // prevents long text/URLs from stretching the box
                overflowWrap: "break-word",
              }}
            >
              {msg.text}
            </div>
          ))
        )}

      </div>
    </aside>
  );
}