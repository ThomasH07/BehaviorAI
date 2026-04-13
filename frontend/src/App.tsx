import React, { useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import MediaSetup from "./pages/MediaSetup";
import Login from "./pages/Login";
import UserInfo from "./pages/UserInfo";
import Header from "./components/Header";
import { logout, type AuthUser } from "./api/auth";

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const navigate = useNavigate();

  if (!user) {
    return <Login onAuth={setUser} />;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header
        user={user}
        onLogout={async () => {
          await logout();
          setUser(null);
        }}
        onProfileClick={() => navigate("/user-info")}
      />

      <Routes>
        <Route path="/" element={<MediaSetup user={user} />} />
        <Route path="/user-info" element={<UserInfo user={user} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}


