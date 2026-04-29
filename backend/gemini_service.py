import os
import google.generativeai as genai
from dotenv import load_dotenv
import traceback

#load variables from .env
load_dotenv()

class GeminiService:

    arrofquestions = [] 
    last_question = ""
    
    def __init__(self):

        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            print("error no api key")
            return
            
        genai.configure(api_key=self.api_key)
        
        #switched to the standard stable identifier to fix the 404 error
        self.model_name = "gemini-2.0-flash-lite"
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
            exclusion_list = ", ".join(self.arrofquestions) if self.arrofquestions else "None"

            prompt = (
                "Generate exactly one behavioral interview question. "
                "Output ONLY the question text. No quotes, no labels, no headers. "
                f"STRICT RULE: The question must be fundamentally different from: {self.arrofquestions}"
            )
            response = self.model.generate_content(prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=60,  #limits generation time
                    temperature=0.7
                ))
            if not response or not response.text:
                return None

            question = response.text.strip().replace('"', '')
            self.arrofquestions.append(question)
            self.last_question = question
            print(f"Array of past questions: {self.arrofquestions}")
            return question or None
        except Exception as e:
            error_str = str(e)
            print(f"GEMINI ERROR: {error_str}")
            return None
gemini_service = GeminiService()