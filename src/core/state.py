from typing import TypedDict, List, Dict, Any, Optional

class AgentState(TypedDict):
    story_uuid: str
    chapter_num: int
    user_idea: str
    original_user_idea: Any
    model: str
    meta: Dict[str, Any]
    ledger: Dict[str, Any]
    story_bible: str
    analyzed_requirements: str
    scenes_to_write: List[Dict[str, Any]]
    current_scene_index: int
    scene_drafts: List[str]
    draft_content: str
    revision_feedback: str
    auditor_feedback: str
    warnings: List[Dict[str, Any]]
    conflict_resolutions: List[Dict[str, Any]]
    verification_mode: str
    is_done: bool
    auto_mode: Optional[bool]
    max_chapters: Optional[int]
    target_words: Optional[int]
