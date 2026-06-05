from typing import TypedDict, List, Dict, Any

class AgentState(TypedDict):
    story_uuid: str
    chapter_num: int
    user_idea: str
    model: str
    meta: Dict[str, Any]
    ledger: Dict[str, Any]
    analyzed_requirements: str
    draft_content: str
    revision_feedback: str
    auditor_feedback: str
    warnings: List[str]
    is_done: bool
