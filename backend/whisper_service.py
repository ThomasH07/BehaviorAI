import os
import re
from typing import Any
import time

from faster_whisper import WhisperModel
from groq_service import analyze_behavior_data
from huggingface_hub import login

hf_token = os.getenv("HF_TOKEN")

if hf_token:
    login(token=hf_token)
else:
    print("Warning: HF_TOKEN not found in environment variables.")
    
class WhisperService:
    def __init__(self) -> None:
        self.model_size = os.getenv("WHISPER_MODEL_SIZE", "tiny")
        self.device = os.getenv("WHISPER_DEVICE", "cpu")
        self.compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
        self._model: WhisperModel | None = None

    def _get_model(self) -> WhisperModel:
        if self._model is None:
            self._model = WhisperModel(
                self.model_size,
                device=self.device,
                compute_type=self.compute_type,
            )
            print(
                f"Whisper Service Initialized with model={self.model_size}, "
                f"device={self.device}, compute_type={self.compute_type}"
            )
        return self._model

    async def transcribe_and_analyze(self, file_path: str) -> dict[str, Any]:
        model = self._get_model()
        
        whisper_start_time = time.time()
        segments, _ = model.transcribe(file_path, beam_size=2, vad_filter=True)
        segment_list = list(segments)
        whisper_end_time = time.time()
        print(f"FasterWhisper Transcription Time: {whisper_end_time - whisper_start_time:.2f} seconds")

        transcript = " ".join(seg.text.strip() for seg in segment_list).strip()
        lower_text = transcript.lower()

        filler_words = ["um", "uh", "like", "you know", "actually", "basically"]
        filler_count = sum(lower_text.count(word) for word in filler_words)

        tokens = re.findall(r"[a-zA-Z']+", lower_text)
        stutters = sum(1 for i in range(1, len(tokens)) if tokens[i] == tokens[i - 1])

        pauses: list[str] = []
        for i in range(1, len(segment_list)):
            gap = segment_list[i].start - segment_list[i - 1].end
            if gap >= 0.7:
                pauses.append(f"{segment_list[i].start:.2f}s")

        sentiment = "Neutral"
        positive_markers = {"confident", "excited", "great", "strong", "enjoy"}
        negative_markers = {"nervous", "worried", "stressed", "hard", "difficult"}
        positive_hits = sum(1 for token in tokens if token in positive_markers)
        negative_hits = sum(1 for token in tokens if token in negative_markers)
        if positive_hits > negative_hits:
            sentiment = "Positive"
        elif negative_hits > positive_hits:
            sentiment = "Negative"
        
        behavior_summary = (          
            f"Transcript: '{transcript}'\n"
            f"Stutters Detected: {stutters}\n"
            f"Filler Words Used: {filler_count}\n"
            f"Long Pauses: {len(pauses)}\n"
            f"Tone/Sentiment: {sentiment}"
        )
        
        groq_start_time = time.time()
        feedback = await analyze_behavior_data(behavior_context=behavior_summary)
        groq_end_time = time.time()
        print(f"Groq Analysis Time: {groq_end_time - groq_start_time:.2f} seconds")
        return {
            "transcript": transcript,
            "stutters": stutters,
            "filler_words": filler_count,
            "pauses": pauses,
            "sentiment": sentiment,
            "feedback": feedback,
        }


whisper_service = WhisperService()