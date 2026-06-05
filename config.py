import os
from pathlib import Path
from dotenv import load_dotenv

# Load env variables (like GOOGLE_API_KEY)
load_dotenv()

# Define project directories
BASE_DIR = Path(__file__).resolve().parent
STORIES_DIR = BASE_DIR / "stories"

# Ensure stories directory exists
STORIES_DIR.mkdir(parents=True, exist_ok=True)

# temp draft file path (in the current working directory or base dir)
TEMP_DRAFT_PATH = BASE_DIR / "temp_draft.md"

def get_story_dir(story_uuid: str) -> Path:
    """Get the subdirectory for a specific story's chapters and states."""
    return STORIES_DIR / story_uuid

def get_chapters_dir(story_uuid: str) -> Path:
    """Get chapters directory for a story."""
    d = get_story_dir(story_uuid) / "chapters"
    d.mkdir(parents=True, exist_ok=True)
    return d

def get_states_dir(story_uuid: str) -> Path:
    """Get states directory for a story."""
    d = get_story_dir(story_uuid) / "states"
    d.mkdir(parents=True, exist_ok=True)
    return d

def get_meta_path(story_uuid: str) -> Path:
    """Get path to the meta.json file for a story."""
    return STORIES_DIR / f"{story_uuid}_meta.json"

def get_ledger_path(story_uuid: str) -> Path:
    """Get path to the global_ledger.json file for a story."""
    return STORIES_DIR / f"{story_uuid}_global_ledger.json"

def get_chapter_content_path(story_uuid: str, chapter_num: int) -> Path:
    """Get path to a specific chapter content file."""
    return get_chapters_dir(story_uuid) / f"chap_{chapter_num}_content.md"

def get_chapter_state_path(story_uuid: str, chapter_num: int) -> Path:
    """Get path to a specific chapter state file."""
    return get_states_dir(story_uuid) / f"chap_{chapter_num}_state.md"

def check_api_key() -> bool:
    """Verify that GOOGLE_API_KEY is configured."""
    return bool(os.getenv("GOOGLE_API_KEY"))
