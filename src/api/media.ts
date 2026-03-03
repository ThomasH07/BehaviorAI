// src/api/media.ts
export async function uploadRecordingBlob(file: Blob) {
  const formData = new FormData();
  formData.append("file", file, "recording.webm");

  // CRA uses REACT_APP_* env vars
  const base = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";

  const res = await fetch(`${base}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Upload failed (${res.status})`);
  }

  return res.json();
}