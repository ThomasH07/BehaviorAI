const base = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";


export type CreateSessionResponse = {
  session_id: number;
  user_id: number;
  session_date: string;
};

export type CreateResponsePayload = {
  session_id: number;
  interview_prompt: string;
  transcript: string;
  ai_feedback: string;
  gaze_count: number;
  stutter_count: number;
  pause_count: number;
};

export type RecentSessionItem = {
  session_id: number;
  session_date: string;
  question: string;
  feedback: string;
};

export type RecentSessionsResponse = {
  user_id: number;
  sessions: RecentSessionItem[];
};
export async function uploadRecordingBlob(file: Blob) {
  const formData = new FormData();
  formData.append("file", file, "recording.webm");

  // CRA uses REACT_APP_* env vars
  const res = await fetch(`${base}/analyze-video`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed (${res.status})`);
  }

  return await res.json();
}
export async function transcribeAudioBlob(file: Blob) {
  const formData = new FormData();
  formData.append("file", file, "audio_recording.webm");
  const res = await fetch(`${base}/transcribe`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Transcription failed (${res.status})`);
  }

  return await res.json();
}

export async function fetchRandomQuestion() {
  const res = await fetch(`${base}/api/questions/random`);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Question fetch failed (${res.status})`);
  }

  return await res.json();
}

export async function createSession(userId: number) {
  const res = await fetch(`${base}/api/sessions/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Create session failed (${res.status})`);
  }

  return (await res.json()) as CreateSessionResponse;
}

export async function createResponse(payload: CreateResponsePayload) {
  const res = await fetch(`${base}/api/responses/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Create response failed (${res.status})`);
  }

  return await res.json();
}

export async function fetchRecentSessions(userId: number) {
  const res = await fetch(`${base}/api/sessions/${userId}/recent`, {
    method: "GET",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Fetch recent sessions failed (${res.status})`);
  }

  return (await res.json()) as RecentSessionsResponse;
}