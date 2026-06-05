import os
import sys
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List

load_dotenv()
from langchain_google_genai import ChatGoogleGenerativeAI

class TestSchema(BaseModel):
    questions: List[str] = Field(description="List of questions")
    summary: str = Field(description="Summary")

api_key = os.getenv("GOOGLE_API_KEY")
print("Testing structured output on gemini-2.5-flash...")

try:
    llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", google_api_key=api_key)
    runnable = llm.with_structured_output(TestSchema)
    resp = runnable.invoke("Write 2 questions and a summary for a story about a boy named Jack.")
    print("Success! Structured response:")
    print(resp)
except Exception as e:
    print(f"Error: {e}")
