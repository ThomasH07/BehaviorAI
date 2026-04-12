const base = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

export type AuthUser = {
  user_id: number;
  user_name: string;
  user_email: string;
};

export async function signup(userName: string, email: string, password: string) {
  const res = await fetch(`${base}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      user_name: userName,
      user_email: email,
      user_password: password,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Signup failed (${res.status})`);
  }

  return (await res.json()) as AuthUser;
}

export async function login(email: string, password: string) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ user_email: email, user_password: password }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Login failed (${res.status})`);
  }

  return (await res.json()) as AuthUser;
}

export async function logout() {
  const res = await fetch(`${base}/api/auth/logout`, {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Logout failed (${res.status})`);
  }

  return await res.json();
}

export async function getCurrentUser() {
  const res = await fetch(`${base}/api/auth/me`, {
    method: "GET",
    credentials: "include",
  });

  if (!res.ok) {
    if (res.status === 401) {
      return null;
    }
    const text = await res.text();
    throw new Error(text || `Auth check failed (${res.status})`);
  }

  return (await res.json()) as AuthUser;
}
