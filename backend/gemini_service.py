import os
import google.generativeai as genai
from dotenv import load_dotenv
import traceback

# Load variables from .env
load_dotenv()

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            print("error no api key")
            return
            
        genai.configure(api_key=self.api_key)
        
        # Switched to the standard stable identifier to fix the 404 error
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
            #If 404 persists, it may be due to regional restrictions or API versioning
            if "404" in error_str:
                print("💡 TIP: Verify your API key is from Google AI Studio and has access to Gemini 1.5 Flash.")
            return None

gemini_service = GeminiService()