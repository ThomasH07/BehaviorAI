import os
import time
from groq import AsyncGroq
from dotenv import load_dotenv
from gemini_service import GeminiService
load_dotenv()

GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
try:
    client = AsyncGroq(
        api_key=os.environ.get("GROQ_API_KEY"),
    )
    print("received Groq api key")
except Exception as e:
    print(f"Failed to initialize Groq Client. Is your API key set? Error: {e}")

async def analyze_behavior_data(behavior_context: str, model_name: str = GROQ_MODEL) -> str:
    try:
        start_time = time.time()
        chat_completion = await client.chat.completions.create(
            messages=[
                {   
                    
                    "role": "system",
                    "content": (
                        f"""       
                            Question: {GeminiService.last_question}
                            Act as a hiring manager. Evaluate the user's answer (provided in the next message) using the STAR method (Situation, Task, Action, Result).

                        
                            STRICT OUTPUT FORMAT:
                            Situation: [Context]
                            
                            Task: [Context]
                            
                            Action: [Context]
                            
                            Result: [Context]
                            
                            Improvement: [Context]
                            RULES:
                            1. Provide only the format above.
                            2. Do not include introductory text or conclusions.
                            3. Use exactly one empty line between sections.
                        """

                    )
                }, 
                {
                    "role": "user",
                    "content": f"Tracking data: {behavior_context}",
                }
            ],
            model=model_name,
            #temp = 0.1, makes the AI highly deterministic and strict, stopping it from "getting creative" with formatting.
            temperature=0.1, 
            max_tokens=1024,
        )
        print(f"chat completed{chat_completion}")
        end_time = time.time()
        print(f"Groq API generation time: {end_time - start_time:.2f} seconds")
        return chat_completion.choices[0].message.content

    except Exception as e:
        print(f"Groq API Error: {e}")
        return "An error occurred while analyzing the behavior data."