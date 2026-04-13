import os
import google.generativeai as genai
from dotenv import load_dotenv
import traceback

#load variables from .env
load_dotenv()

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            print("error no api key")
            return
            
        genai.configure(api_key=self.api_key)
        
        #switched to the standard stable identifier to fix the 404 error
        self.model_name = "gemini-2.5-flash"
        try:
            self.model = genai.GenerativeModel(self.model_name)
            print(f"Gemini Service Initialized with {self.model_name}")
        except Exception as e:
            print(f"Warning initializing model: {e}")

    def analyze_audio(self, file_path: str):
        if not self.api_key:
            return "Error: API Key missing."

        try:
            #upload to Google's temporary storage
            audio_file = genai.upload_file(path=file_path)
            
            #optimized prompt for behavioral coaching
            prompt = """
            Analyze this interview audio.
            Return ONLY a JSON object with these keys:
            {
              "transcript": "string",
              "stutters": number,
              "filler_words": number,
              "pauses": ["timestamp"],
              "sentiment": "string",
              "feedback": "string"
            }
            Do not include any extra text.
            """

            #generate content
            response = self.model.generate_content([prompt, audio_file])
            
            #cleanup
            genai.delete_file(audio_file.name)

            if not response or not response.text:
                return None

            return response.text

        except Exception as e:
            error_str = str(e)
            print(f"GEMINI ERROR: {error_str}")
            return None

    def generate_behavioral_question(self) -> str | None:
        if not self.api_key or not getattr(self, "model", None):
            return None

        try:
            prompt = (
                "Generate one concise behavioral interview question. "
                "Return only the question text, no quotes or extra text."
            )
            response = self.model.generate_content(prompt)
            if not response or not response.text:
                return None

            question = response.text.strip()
            if question.startswith("\"") and question.endswith("\""):
                question = question[1:-1].strip()
            return question or None
        except Exception as e:
            error_str = str(e)
            print(f"GEMINI ERROR: {error_str}")
            return None

gemini_service = GeminiService()