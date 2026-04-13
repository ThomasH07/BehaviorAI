import React from "react";
import { type AuthUser } from "../api/auth";

type HeaderProps = {
  user: AuthUser;
  onLogout: () => void | Promise<void>;
  onProfileClick?: () => void;
};

export default function Header({
  user,
  onLogout,
  onProfileClick,
}: HeaderProps) {
  return (
    <div style={navStyle}>
      <div style={signedInWrapStyle}>
        <button
          type="button"
          style={userIconButtonStyle}
          onClick={onProfileClick}
          title="Open profile"
        >
          {user.user_name.charAt(0).toUpperCase()}
        </button>

        <span style={userNameStyle}>{user.user_name}</span>
      </div>

      <button type="button" style={linkBtn} onClick={onLogout}>
        Logout
      </button>
    </div>
  );
}

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

const userIconButtonStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid #1f2937",
  background: "#111827",
  color: "#e2e8f0",
  cursor: "pointer",
  fontSize: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const userNameStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#e2e8f0",
};

const linkBtn: React.CSSProperties = {
  background: "transparent",
  border: "none",
  color: "#93c5fd",
  cursor: "pointer",
  fontSize: 13,
};