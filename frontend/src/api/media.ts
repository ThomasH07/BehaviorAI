const base = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000";
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