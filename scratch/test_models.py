import os
import sys
from dotenv import load_dotenv
load_dotenv()

from langchain_google_genai import ChatGoogleGenerativeAI

models_to_try = [
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-1.5-pro",
    "gemini-2.5-pro"
]

api_key = os.getenv("GOOGLE_API_KEY")
print(f"API Key found (starts with): {api_key[:10] if api_key else 'None'}")

for m in models_to_try:
    print(f"Trying model: {m}")
    try:
        chat = ChatGoogleGenerativeAI(model=m, google_api_key=api_key)
        resp = chat.invoke("Say hello in one word.")
        print(f"Success! Response: {resp.content}")
        print(f"Use model: {m}")
        break
    except Exception as e:
        print(f"Error for {m}: {e}")
