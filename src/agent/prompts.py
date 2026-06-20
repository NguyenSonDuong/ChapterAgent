import os
from pathlib import Path

# The prompts folder is located in the same directory as this file
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"

def load_prompt(filename: str) -> str:
    """Loads a prompt template from a markdown file in the prompts directory."""
    path = PROMPTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Prompt template file not found: {path}")
    return path.read_text(encoding="utf-8")
