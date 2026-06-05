from langgraph.graph import StateGraph, END
from src.core.state import AgentState
import src.agent.nodes as nodes

# Khởi tạo đồ thị trạng thái LangGraph
workflow = StateGraph(AgentState)

# Đăng ký các Nodes
workflow.add_node("requirement_analyzer", nodes.requirement_analyzer_node)
workflow.add_node("story_drafter", nodes.story_drafter_node)
workflow.add_node("human_review", nodes.human_review_node)
workflow.add_node("reviser", nodes.reviser_node)
workflow.add_node("auditor", nodes.auditor_node)
workflow.add_node("updater", nodes.state_ledger_updater_node)

# Đặt điểm bắt đầu (Entry Point)
workflow.set_entry_point("requirement_analyzer")

# Định nghĩa các cạnh liên kết đơn giản
workflow.add_edge("requirement_analyzer", "story_drafter")
workflow.add_edge("story_drafter", "human_review")
workflow.add_edge("reviser", "human_review")
workflow.add_edge("auditor", "updater")
workflow.add_edge("updater", END)

# Hàm kiểm tra logic rẽ nhánh có điều kiện sau Human Review (Node 3)
def route_after_human_review(state: AgentState) -> str:
    feedback = state.get("revision_feedback", "")
    # Nếu người dùng gõ Done (không phân biệt hoa thường), đi tiếp tới Auditor
    if feedback.strip().lower() == "done":
        return "auditor"
    # Ngược lại, nếu có phản hồi chỉnh sửa, quay về Reviser
    else:
        return "reviser"

# Cài đặt Conditional Edges cho vòng lặp Node 3 <-> Node 3.1
workflow.add_conditional_edges(
    "human_review",
    route_after_human_review,
    {
        "auditor": "auditor",
        "reviser": "reviser"
    }
)

# Biên dịch đồ thị
app = workflow.compile()
