import threading
from typing import Dict, Any, Optional

class GenerationSession:
    """Represents an active LangGraph generation session for a story."""
    def __init__(self, story_uuid: str, chapter_num: int):
        self.story_uuid = story_uuid
        self.chapter_num = chapter_num
        self.input_event = threading.Event()
        self.input_data: Any = None
        self.status = "idle"         # idle, running, waiting_clarification, waiting_review, completed, error
        self.current_node: Optional[str] = None

class SessionManager:
    """Manages concurrent generation sessions in background threads."""
    def __init__(self):
        self._sessions: Dict[str, GenerationSession] = {}
        self._lock = threading.Lock()

    def create_session(self, story_uuid: str, chapter_num: int) -> GenerationSession:
        """Create and store a new generation session."""
        with self._lock:
            session = GenerationSession(story_uuid, chapter_num)
            self._sessions[story_uuid] = session
            return session

    def get_session(self, story_uuid: str) -> Optional[GenerationSession]:
        """Retrieve an active session by story UUID."""
        with self._lock:
            return self._sessions.get(story_uuid)

    def remove_session(self, story_uuid: str):
        """Remove a session when completed or failed."""
        with self._lock:
            if story_uuid in self._sessions:
                del self._sessions[story_uuid]

# Global session manager singleton
session_manager = SessionManager()
