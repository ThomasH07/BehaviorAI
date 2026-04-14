import os
from groq import AsyncGroq
from dotenv import load_dotenv

load_dotenv()

try:
    client = AsyncGroq(
        api_key=os.environ.get("GROQ_API_KEY"),
    )
    print("received Groq api key")
except Exception as e:
    print(f"Failed to initialize Groq Client. Is your API key set? Error: {e}")

async def analyze_behavior_data(behavior_context: str, model_name: str = "llama-3.1-8b-instant") -> str:
    try:
        chat_completion = await client.chat.completions.create(
            messages=[
                {
                    "role": "system",
                    "content": (
                        """                     
                            Act as a hiring manager. Please evaluate my answer using the STAR method (Situation, Task, Action, Result). 

                            The output should be short and concise in the following format at all times with a newline in between (DO NOT ADD ANYTHING ELSE):
                            '
                            Situation:
                            \n    
                            Task: 
                            \n
                            Action: 
                            \n
                            Result: 
                            \n
                            Improvement: 
                            '
                            
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
        return chat_completion.choices[0].message.content

    except Exception as e:
        print(f"Groq API Error: {e}")
        return "An error occurred while analyzing the behavior data."