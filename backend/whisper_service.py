import os
import re
from typing import Any

from faster_whisper import WhisperModel


class WhisperService:
    def __init__(self) -> None:
        self.model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
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

    def transcribe_and_analyze(self, file_path: str) -> dict[str, Any]:
        model = self._get_model()
        segments, _ = model.transcribe(file_path, beam_size=5, vad_filter=True)
        segment_list = list(segments)

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

        feedback = (
            "Local transcription mode is active. Keep answers concise and use STAR format "
            "(Situation, Task, Action, Result) with a clear outcome."
        )

        return {
            "transcript": transcript,
            "stutters": stutters,
            "filler_words": filler_count,
            "pauses": pauses,
            "sentiment": sentiment,
            "feedback": feedback,
        }


whisper_service = WhisperService()
