from langgraph.graph import StateGraph, END
from src.core.state import AgentState
import src.agent.nodes as nodes

# Khởi tạo đồ thị trạng thái LangGraph
workflow = StateGraph(AgentState)

# Đăng ký các Nodes
workflow.add_node("story_bible_transformer", nodes.story_bible_transformer_node)
workflow.add_node("requirement_analyzer", nodes.requirement_analyzer_node)
workflow.add_node("scene_drafter", nodes.scene_drafter_node)
workflow.add_node("human_review", nodes.human_review_node)
workflow.add_node("reviser", nodes.reviser_node)
workflow.add_node("auditor", nodes.auditor_node)
workflow.add_node("updater", nodes.state_ledger_updater_node)

# Đặt điểm bắt đầu (Entry Point)
workflow.set_entry_point("story_bible_transformer")

# Định nghĩa các cạnh liên kết đơn giản
workflow.add_edge("story_bible_transformer", "requirement_analyzer")
workflow.add_edge("requirement_analyzer", "scene_drafter")
workflow.add_edge("reviser", "human_review")
workflow.add_edge("updater", END)

# Hàm kiểm tra logic vòng lặp Phân cảnh (Scene-by-Scene Loop)
def route_after_scene_drafter(state: AgentState) -> str:
    current_idx = state.get("current_scene_index", 0)
    scenes = state.get("scenes_to_write", [])
    if current_idx < len(scenes):
        return "scene_drafter"
    else:
        return "human_review"

# Hàm kiểm tra logic rẽ nhánh có điều kiện sau Human Review
def route_after_human_review(state: AgentState) -> str:
    feedback = state.get("revision_feedback", "")
    fb_clean = feedback.strip().lower()
    
    if fb_clean == "done":
        return "auditor"
        
    # Check if feedback is a JSON command
    try:
        import json
        fb_data = json.loads(feedback)
        action = fb_data.get("action")
        if action == "verify_nodes":
            return "auditor"
        elif action == "publish":
            return "updater"
        elif action == "revise_node":
            return "reviser"
    except Exception:
        pass
        
    return "reviser"

# Hàm kiểm tra logic rẽ nhánh có điều kiện sau Auditor
def route_after_auditor(state: AgentState) -> str:
    warnings = state.get("warnings", [])
    if warnings:
        if state.get("verification_mode") == "node_by_node":
            return "human_review"
        return "reviser"
    else:
        return "updater"

# Cài đặt Conditional Edges cho các vòng lặp rẽ nhánh
workflow.add_conditional_edges(
    "scene_drafter",
    route_after_scene_drafter,
    {
        "scene_drafter": "scene_drafter",
        "human_review": "human_review"
    }
)

workflow.add_conditional_edges(
    "human_review",
    route_after_human_review,
    {
        "auditor": "auditor",
        "reviser": "reviser",
        "updater": "updater"
    }
)

workflow.add_conditional_edges(
    "auditor",
    route_after_auditor,
    {
        "reviser": "reviser",
        "updater": "updater",
        "human_review": "human_review"
    }
)

# Biên dịch đồ thị
app = workflow.compile()
