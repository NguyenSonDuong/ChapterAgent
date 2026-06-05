import os
import json
import time
import sys
from pathlib import Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field
from rich.console import Console
from rich.prompt import Prompt
from rich.panel import Panel

import src.core.config as config
from src.models.story import StoryMeta, GlobalLedger, ChapterState
from src.core.state import AgentState
from src.utils.helpers import ensure_string
from src.utils.llm import invoke_with_retry, check_cancellation
from src.utils.session_manager import session_manager, SessionCancelledError
from src.utils.socket_emitter import emit_event, emit_agent_log

console = Console()

# --- Pydantic Models for Structured LLM Outputs ---

class RequirementAnalysisResult(BaseModel):
    missing_info_questions: List[str] = Field(
        description="Danh sách các câu hỏi làm rõ ý tưởng còn thiếu hoặc mâu thuẫn. Để trống nếu thông tin đã đầy đủ."
    )
    analyzed_requirements: str = Field(
        description="Bản phân tích yêu cầu viết chương chi tiết: bối cảnh, diễn biến chính, nhân vật tham gia, và các nút thắt cần giải quyết/cài cắm."
    )

class AuditResult(BaseModel):
    warnings: List[str] = Field(
        description="Danh sách các cảnh báo về mâu thuẫn logic phát hiện được (ví dụ: nhân vật ở sai vị trí, vật phẩm thay đổi trạng thái vô lý, nhân vật đã chết xuất hiện...). Để trống nếu cốt truyện hoàn toàn hợp lệ."
    )
    auditor_feedback: str = Field(
        description="Nhận xét chi tiết của kiểm duyệt viên về tính hợp lý, tính nhất quán của cốt truyện và đề xuất sửa đổi nếu có."
    )

class ExtractedCharacter(BaseModel):
    name: str = Field(description="Tên của nhân vật mới (bắt buộc phải có tên cụ thể, nếu là nhân vật quần chúng không tên như 'thủ hạ', 'gã bảo vệ', 'tên cướp' thì bỏ qua)")
    role: str = Field(description="Vai trò dự kiến hoặc thực tế của nhân vật trong chương này (ví dụ: phản diện phụ, người qua đường giúp đỡ, kẻ thù mới...)")
    description: str = Field(description="Mô tả về nhân vật dựa trên nội dung chương (ngoại hình, vũ khí, hành động, thái độ)")
    appearance_context: str = Field(description="Hoàn cảnh gặp gỡ, thời điểm và sự kiện chính đang xảy ra ở chương này khi họ xuất hiện")

class NewCharactersExtraction(BaseModel):
    new_characters: List[ExtractedCharacter] = Field(default_factory=list, description="Danh sách các nhân vật mới xuất hiện lần đầu trong chương này. Để trống nếu không có nhân vật mới nào.")


# --- LangGraph Node Functions ---

def requirement_analyzer_node(state: AgentState) -> Dict[str, Any]:
    """Node 1: Requirement Analyzer
    Reads user idea & global ledger, prompts user interactively if details are missing.
    """
    check_cancellation(state["story_uuid"])
    console.print("\n[bold blue]=== [Node 1] Requirement Analyzer ===[/bold blue]")
    emit_agent_log(state["story_uuid"], f"=== [Bước 1] Phân tích Yêu cầu Sáng tác Chương {state['chapter_num']} ===")
    emit_agent_log(state["story_uuid"], f"Ý tưởng ban đầu: \"{state['user_idea']}\"")
    emit_agent_log(state["story_uuid"], "Đang nạp bối cảnh thế giới, danh sách nhân vật và đối chiếu Sổ cái toàn cục để kiểm tra tính logic...")
    
    session = session_manager.get_session(state["story_uuid"])
    if session:
        session.current_node = "requirement_analyzer"
        session.status = "running"
        emit_event("agent_status", {
            "story_uuid": state["story_uuid"],
            "chapter_num": state["chapter_num"],
            "status": "analyzing_requirements",
            "message": f"Đang phân tích yêu cầu cho Chương {state['chapter_num']}..."
        })
    
    user_idea = state["user_idea"]
    ledger = state["ledger"]
    meta = state["meta"]
    chapter_num = state["chapter_num"]
    
    # Format global ledger and meta context for LLM
    ledger_str = json.dumps(ledger, ensure_ascii=False, indent=2)
    meta_str = json.dumps(meta, ensure_ascii=False, indent=2)
    
    # Read previous chapter state if exists
    prev_state_str = "Chưa có chương trước (Đây là chương 1)."
    if chapter_num > 1:
        prev_state_path = config.get_chapter_state_path(state["story_uuid"], chapter_num - 1)
        if prev_state_path.exists():
            prev_state_str = prev_state_path.read_text(encoding="utf-8")

    loop_count = 0
    max_loops = 3
    current_idea = user_idea
    
    while loop_count < max_loops:
        prompt = f"""
Bạn là một chuyên gia phân tích kịch bản. Nhiệm vụ của bạn là phân tích ý tưởng viết Chương {chapter_num} của tác giả dưới đây, đối chiếu với bối cảnh truyện và tiến trình cốt truyện đã diễn ra để chuẩn bị bản yêu cầu viết chương chi tiết.

THÔNG TIN TRUYỆN:
{meta_str}

SỔ CÁI TOÀN CỤC (GLOBAL LEDGER):
{ledger_str}

TRẠNG THÁI CHƯƠNG TRƯỚC:
{prev_state_str}

Ý TƯỞNG CỦA TÁC GIẢ CHO CHƯƠNG {chapter_num}:
{current_idea}

Hãy phân tích và trả về kết quả cấu trúc:
1. Nếu ý tưởng còn sơ sài, thiếu logic cốt lõi (ví dụ: giải quyết mâu thuẫn thế nào, động cơ nhân vật, vị trí địa lý bị mâu thuẫn), hãy đưa ra các câu hỏi ngắn gọn để làm rõ trong `missing_info_questions`.
2. Nếu thông tin đã hòm hòm hoặc sau khi tác giả đã trả lời thêm, hãy tổng hợp bản yêu cầu chi tiết nhất trong `analyzed_requirements`.
"""
        result = invoke_with_retry(state, prompt, temperature=0.3, output_schema=RequirementAnalysisResult)
            
        # If there are missing info questions, ask user
        if result.missing_info_questions and loop_count < max_loops - 1:
            session = session_manager.get_session(state["story_uuid"])
            if session:
                emit_agent_log(state["story_uuid"], "Phát hiện thiếu thông tin cốt truyện. Đang gửi câu hỏi làm rõ đến giao diện...", level="warning")
                session.status = "waiting_clarification"
                emit_event("clarify_requirements", {
                    "story_uuid": state["story_uuid"],
                    "chapter_num": state["chapter_num"],
                    "questions": result.missing_info_questions
                })
                # Block until user provides input
                session.input_event.clear()
                # Wait for max 5 minutes (300 seconds)
                success = session.input_event.wait(timeout=300.0)
                check_cancellation(state["story_uuid"])
                if not success:
                    console.print("[yellow]Hết thời gian chờ phản hồi làm rõ. Tiếp tục quy trình...[/yellow]")
                    emit_agent_log(state["story_uuid"], "Hết thời gian chờ phản hồi làm rõ. Bỏ qua...", level="warning")
                    break
                user_answer = session.input_data
                session.input_data = None
                session.status = "running"
                if user_answer is None or not str(user_answer).strip():
                    break
                emit_agent_log(state["story_uuid"], f"Đã nhận câu trả lời bổ sung từ tác giả: \"{user_answer}\"")
            else:
                console.print("\n[bold yellow]Phân tích phát hiện thiếu thông tin hoặc cần làm rõ:[/bold yellow]")
                for q in result.missing_info_questions:
                    console.print(f" - {q}")
                
                console.print("\n[bold cyan]Hãy nhập câu trả lời bổ sung (hoặc nhấn Enter để bỏ qua và tiếp tục):[/bold cyan]")
                user_answer = input("> ")
                if not user_answer.strip():
                    # User skipped, break loop and accept current requirements
                    break
                
            current_idea += f"\n[Bổ sung của tác giả]: {user_answer}"
            loop_count += 1
        else:
            # No questions or maximum loops reached
            break
            
    console.print(Panel(result.analyzed_requirements, title=f"Yêu cầu Chương {chapter_num} đã được duyệt", border_style="green"))
    emit_agent_log(state["story_uuid"], f"Yêu cầu sáng tác Chương {chapter_num} đã được duyệt.")
    
    return {
        "analyzed_requirements": result.analyzed_requirements,
        "user_idea": current_idea # Keep track of the full expanded idea
    }


def story_drafter_node(state: AgentState) -> Dict[str, Any]:
    """Node 2: Story Drafter
    Generates the initial chapter draft based on context and analyzed requirements.
    """
    check_cancellation(state["story_uuid"])
    console.print("\n[bold blue]=== [Node 2] Story Drafter ===[/bold blue]")
    emit_agent_log(state["story_uuid"], f"=== [Bước 2] Sáng tác Bản nháp Chương {state['chapter_num']} ===")
    
    session = session_manager.get_session(state["story_uuid"])
    if session:
        session.current_node = "story_drafter"
        emit_event("agent_status", {
            "story_uuid": state["story_uuid"],
            "chapter_num": state["chapter_num"],
            "status": "drafting",
            "message": f"Đang sáng tác bản nháp cho Chương {state['chapter_num']}..."
        })
    console.print("Đang viết nháp chương... Vui lòng đợi trong giây lát.")
    emit_agent_log(state["story_uuid"], "Đang viết nháp chương... Vui lòng đợi trong giây lát (có thể mất 30-60 giây)...")
    
    meta = state["meta"]
    ledger = state["ledger"]
    reqs = state["analyzed_requirements"]
    chapter_num = state["chapter_num"]
    
    # Read previous chapter content to maintain flow style if possible
    prev_chapter_context = ""
    if chapter_num > 1:
        prev_content_path = config.get_chapter_content_path(state["story_uuid"], chapter_num - 1)
        if prev_content_path.exists():
            # Read last 1000 words to guide style
            content = prev_content_path.read_text(encoding="utf-8")
            prev_chapter_context = f"\nPHẦN CUỐI CHƯƠNG TRƯỚC (Để viết nối tiếp mượt mà):\n...\n{content[-2000:]}\n"

    prompt = f"""
Bạn là một nhà văn mạng tài ba. Hãy viết bản nháp cho Chương {chapter_num} của bộ truyện dựa trên cấu hình truyện và yêu cầu chi tiết dưới đây.

THÔNG TIN TRUYỆN:
- Tên truyện: {meta.get('name')}
- Tác giả cấu hình: Nhân vật: {json.dumps(meta.get('characters'), ensure_ascii=False)}, Bối cảnh: {meta.get('context')}, Phong cách hành văn: {meta.get('style')}
- Ràng buộc: Tối đa {meta.get('max_words_per_chapter')} từ cho chương này.

TIẾN TRÌNH CỐT TRUYỆN HIỆN TẠI (LỊCH SỬ):
{json.dumps(ledger.get('timeline'), ensure_ascii=False, indent=2)}
Các nút thắt chưa giải quyết: {json.dumps(ledger.get('unresolved_threads'), ensure_ascii=False)}
{prev_chapter_context}

YÊU CẦU CHI TIẾT CHO CHƯƠNG {chapter_num}:
{reqs}

Yêu cầu viết truyện:
1. Viết trực tiếp nội dung truyện bằng định dạng Markdown.
2. Tiêu đề chương viết ở dòng đầu tiên dạng `# Chương {chapter_num}: [Tên tiêu đề chương]`.
3. Tập trung miêu tả sâu sắc về bối cảnh, cảm xúc, biểu cảm, hội thoại và hành động. Đảm bảo đúng phong cách: {meta.get('style')}.
4. Không thêm lời bình luận cá nhân của AI vào đầu hoặc cuối bản viết. Chỉ trả về nội dung chương truyện.
"""
    
    response = invoke_with_retry(state, prompt, temperature=0.8)
    draft_content = ensure_string(response.content)
    emit_agent_log(state["story_uuid"], "Đã soạn thảo xong bản nháp ban đầu.")
        
    return {"draft_content": draft_content}


def human_review_node(state: AgentState) -> Dict[str, Any]:
    """Node 3: Human Review (Interactive Breakpoint)
    Saves draft to disk as temp_draft.md and asks user for feedback or 'Done'.
    """
    check_cancellation(state["story_uuid"])
    console.print("\n[bold blue]=== [Node 3] Human Review ===[/bold blue]")
    emit_agent_log(state["story_uuid"], f"=== [Bước 3] Tác giả duyệt Bản nháp Chương {state['chapter_num']} ===")
    
    draft_content = state["draft_content"]
    
    # Save the draft content to temp_draft.md
    try:
        config.TEMP_DRAFT_PATH.write_text(draft_content, encoding="utf-8")
    except Exception as e:
        console.print(f"[bold red]Không thể ghi file nháp tạm: {e}[/bold red]")
        
    session = session_manager.get_session(state["story_uuid"])
    if session:
        emit_agent_log(state["story_uuid"], "Đang chờ ý kiến phản hồi hoặc phê duyệt bản nháp...")
        session.current_node = "human_review"
        session.status = "waiting_review"
        emit_event("draft_review_needed", {
            "story_uuid": state["story_uuid"],
            "chapter_num": state["chapter_num"],
            "draft_content": draft_content
        })
        # Block until review feedback is submitted
        session.input_event.clear()
        success = session.input_event.wait(timeout=600.0) # 10 minutes timeout
        check_cancellation(state["story_uuid"])
        if not success:
            console.print("[yellow]Hết thời gian chờ duyệt bản nháp. Mặc định duyệt 'Done'.[/yellow]")
            emit_agent_log(state["story_uuid"], "Hết thời gian chờ duyệt bản nháp. Tự động phê duyệt bản nháp.", level="warning")
            feedback = "Done"
        else:
            feedback = session.input_data
            session.input_data = None
            session.status = "running"
            if feedback is None or not str(feedback).strip():
                feedback = "Done"
            emit_agent_log(state["story_uuid"], f"Nhận được phản hồi của tác giả: \"{feedback}\"")
    else:
        console.print("\n[bold cyan]================================================================================[/bold cyan]")
        console.print(f"[bold green][Thông báo][/bold green] Bản nháp Chương {state['chapter_num']} đã được cập nhật thành công.")
        console.print(f"Nội dung hiện tại đã được lưu tạm vào file: [bold yellow]{config.TEMP_DRAFT_PATH.absolute()}[/bold yellow]")
        console.print("Bạn hãy mở file này bằng Text Editor (VS Code, Notepad...) để đọc và đánh giá.")
        console.print("[bold cyan]================================================================================[/bold cyan]\n")
        
        feedback = Prompt.ask(
            "[bold magenta]Nhập yêu cầu chỉnh sửa của bạn[/bold magenta] (ví dụ: 'Viết đoạn cuối kịch tính hơn', 'Thêm thoại cho nhân vật A'),\n"
            "hoặc gõ [bold green]'Done'[/bold green] nếu đã ưng ý hoàn toàn"
        )
    
    return {"revision_feedback": str(feedback).strip()}


def reviser_node(state: AgentState) -> Dict[str, Any]:
    """Node 3.1: Reviser
    Edits draft_content based on user feedback and metadata.
    """
    check_cancellation(state["story_uuid"])
    console.print("\n[bold blue]=== [Node 3.1] Reviser ===[/bold blue]")
    emit_agent_log(state["story_uuid"], f"=== [Bước 3.1] Sửa đổi Bản nháp theo Yêu cầu ===")
    
    session = session_manager.get_session(state["story_uuid"])
    if session:
        session.current_node = "reviser"
        emit_event("agent_status", {
            "story_uuid": state["story_uuid"],
            "chapter_num": state["chapter_num"],
            "status": "revising",
            "message": f"Đang sửa đổi bản nháp Chương {state['chapter_num']} theo ý kiến tác giả..."
        })
    console.print("Đang tiến hành chỉnh sửa bản nháp theo yêu cầu của bạn...")
    emit_agent_log(state["story_uuid"], f"Đang tiến hành sửa đổi bản nháp theo phản hồi...")
    
    draft_content = state["draft_content"]
    feedback = state["revision_feedback"]
    meta = state["meta"]
    chapter_num = state["chapter_num"]
    
    prompt = f"""
Bạn là một biên tập viên xuất sắc. Nhiệm vụ của bạn là dựa vào bản nháp hiện tại của Chương {chapter_num} và yêu cầu chỉnh sửa của tác giả để viết lại bản nháp sao cho đáp ứng đúng yêu cầu đó mà không làm hỏng logic truyện.

YÊU CẦU CỦA TÁC GIẢ:
"{feedback}"

THÔNG TIN TRUYỆN (Để giữ đúng văn phong, nhân vật, bối cảnh):
- Tên truyện: {meta.get('name')}
- Nhân vật: {json.dumps(meta.get('characters'), ensure_ascii=False)}
- Phong cách hành văn: {meta.get('style')}
- Bối cảnh: {meta.get('context')}

BẢN NHÁP HIỆN TẠI:
---
{draft_content}
---

Hãy viết lại bản nháp này. Đảm bảo:
1. Sửa đổi đúng theo ý tác giả (thêm thắt chi tiết, sửa lời thoại, thay đổi nhịp điệu cốt truyện...).
2. Giữ nguyên định dạng Markdown của chương truyện (Tiêu đề bắt đầu bằng `# Chương {chapter_num}: [Tên]`).
3. Chỉ trả về nội dung chương truyện mới, không kèm theo lời bình luận hay giải thích.
"""
    response = invoke_with_retry(state, prompt, temperature=0.7)
    revised_content = ensure_string(response.content)
    emit_agent_log(state["story_uuid"], "Đã sửa đổi xong bản nháp.")
        
    return {"draft_content": revised_content}


def auditor_node(state: AgentState) -> Dict[str, Any]:
    """Node 4: Auditor
    Performs logic check against previous chapter's state and global ledger.
    """
    check_cancellation(state["story_uuid"])
    console.print("\n[bold blue]=== [Node 4] Auditor ===[/bold blue]")
    emit_agent_log(state["story_uuid"], f"=== [Bước 4] Kiểm duyệt Logic và Sự Nhất quán cốt truyện ===")
    
    session = session_manager.get_session(state["story_uuid"])
    if session:
        session.current_node = "auditor"
        emit_event("agent_status", {
            "story_uuid": state["story_uuid"],
            "chapter_num": state["chapter_num"],
            "status": "auditing",
            "message": f"Đang kiểm duyệt logic cốt truyện Chương {state['chapter_num']}..."
        })
    console.print("Đang kiểm duyệt logic và tính nhất quán của cốt truyện...")
    emit_agent_log(state["story_uuid"], "Đang đối chiếu bản nháp với Sổ cái Toàn cục và Chương trước...")
    
    draft_content = state["draft_content"]
    ledger = state["ledger"]
    meta = state["meta"]
    chapter_num = state["chapter_num"]
    
    # Read previous chapter state if exists
    prev_state_str = "Chưa có chương trước (Đây là chương 1)."
    if chapter_num > 1:
        prev_state_path = config.get_chapter_state_path(state["story_uuid"], chapter_num - 1)
        if prev_state_path.exists():
            prev_state_str = prev_state_path.read_text(encoding="utf-8")

    prompt = f"""
Bạn là một kiểm duyệt viên cốt truyện cực kỳ nghiêm khắc. Nhiệm vụ của bạn là đối chiếu bản nháp cuối cùng của Chương {chapter_num} với thông tin lịch sử truyện, sổ cái toàn cục, và đặc biệt là trạng thái chương trước đó để tìm ra các lỗi logic tiềm ẩn.

THÔNG TIN TRUYỆN:
- Nhân vật: {json.dumps(meta.get('characters'), ensure_ascii=False)}
- Bối cảnh chung: {meta.get('context')}

SỔ CÁI TOÀN CỤC (GLOBAL LEDGER):
{json.dumps(ledger, ensure_ascii=False, indent=2)}

TRẠNG THÁI CHƯƠNG TRƯỚC:
{prev_state_str}

NỘI DUNG CHƯƠNG MỚI:
---
{draft_content}
---

Hãy phân tích kỹ chương mới và chỉ ra các lỗi mâu thuẫn cốt truyện như:
- Sự thay đổi vô lý về vị trí địa lý của nhân vật (ví dụ: chương trước đang ở trong ngục, chương này tự nhiên đi dạo phố không lời giải thích).
- Sai lệch trạng thái vật phẩm (chương trước làm mất kiếm, chương này vẫn dùng kiếm đó).
- Quan hệ nhân vật thay đổi đột ngột không có tình tiết dẫn dắt.
- Nhân vật đã chết hoặc bị trọng thương bỗng nhiên khỏe mạnh bình thường.

Trả về kết quả có cấu trúc:
1. `warnings`: Danh sách các câu cảnh báo lỗi logic cụ thể, ngắn gọn. Nếu mọi thứ hợp lý, hãy để danh sách này rỗng.
2. `auditor_feedback`: Đánh giá tổng quan về chất lượng logic chương mới này.
"""
    result = invoke_with_retry(state, prompt, temperature=0.2, output_schema=AuditResult)
        
    if result.warnings:
        console.print("\n[bold red][CẢNH BÁO LOGIC PHÁT HIỆN TỪ AUDITOR]:[/bold red]")
        for w in result.warnings:
            console.print(f" ⚠️  {w}", style="yellow")
            emit_agent_log(state["story_uuid"], f"⚠️ Cảnh báo mâu thuẫn: {w}", level="warning")
        
        session = session_manager.get_session(state["story_uuid"])
        if session:
            emit_event("audit_warnings", {
                "story_uuid": state["story_uuid"],
                "chapter_num": state["chapter_num"],
                "warnings": result.warnings,
                "feedback": result.auditor_feedback
            })
    else:
        console.print("\n[bold green]✓ Kiểm duyệt logic thành công: Không phát hiện lỗi nhất quán cốt truyện.[/bold green]")
        emit_agent_log(state["story_uuid"], "✓ Kiểm duyệt logic thành công: Không phát hiện lỗi mâu thuẫn cốt truyện.")
        
    console.print(Panel(result.auditor_feedback, title="Đánh giá từ Auditor", border_style="cyan"))
    emit_agent_log(state["story_uuid"], f"Đánh giá từ Auditor: \"{result.auditor_feedback}\"")
    
    return {
        "warnings": result.warnings,
        "auditor_feedback": result.auditor_feedback
    }


def state_ledger_updater_node(state: AgentState) -> Dict[str, Any]:
    """Node 5: State & Ledger Updater
    Extracts structured ChapterState, saves files, updates global ledger, cleans up temp draft.
    """
    check_cancellation(state["story_uuid"])
    console.print("\n[bold blue]=== [Node 5] State & Ledger Updater ===[/bold blue]")
    emit_agent_log(state["story_uuid"], f"=== [Bước 5] Trích xuất Trạng thái & Cập nhật Sổ cái Toàn cục ===")
    
    session = session_manager.get_session(state["story_uuid"])
    if session:
        session.current_node = "updater"
        emit_event("agent_status", {
            "story_uuid": state["story_uuid"],
            "chapter_num": state["chapter_num"],
            "status": "updating",
            "message": f"Đang cập nhật trạng thái chương và sổ cái toàn cục..."
        })
    console.print("Đang trích xuất trạng thái và cập nhật sổ cái toàn cục...")
    emit_agent_log(state["story_uuid"], "Đang trích xuất tóm tắt, trạng thái nhân vật và nút thắt từ chương truyện mới...")
    
    draft_content = state["draft_content"]
    story_uuid = state["story_uuid"]
    chapter_num = state["chapter_num"]
    ledger = state["ledger"]
    
    # Generate ChapterState by analyzing draft_content
    prompt = f"""
Hãy phân tích chương truyện sau đây và trích xuất thông tin trạng thái theo mô hình ChapterState.

NỘI DUNG CHƯƠNG:
---
{draft_content}
---

Hãy điền đầy đủ:
1. `chapter_title`: Tiêu đề chương (loại bỏ phần '# Chương X:').
2. `summary`: Tóm tắt chi tiết 1-2 đoạn văn ngắn về diễn biến chính.
3. `character_statuses`: Trạng thái các nhân vật chính sau chương này (ví dụ: "Kim: Đã thoát khỏi hầm ngục, đang bị thương nhẹ ở vai trái, giữ bản đồ cổ").
4. `threads_resolved`: Danh sách các mối nối/bí ẩn đã được chương này giải đáp (ví dụ: "Tiết lộ kẻ phản bội là quản gia").
5. `threads_introduced`: Danh sách các nút thắt/manh mối mới mở ra (ví dụ: "Bản đồ cổ chỉ dẫn tới một ngôi đền vô danh ở phía Bắc").
"""
    chap_state = invoke_with_retry(state, prompt, temperature=0.2, output_schema=ChapterState)
        
    # 1. Ghi chap_[n]_content.md
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    try:
        content_path.write_text(draft_content, encoding="utf-8")
        console.print(f"✓ Đã ghi nội dung chương truyện vào: [bold green]{content_path}[/bold green]")
        emit_agent_log(story_uuid, f"✓ Đã lưu nội dung chương truyện vào file chap_{chapter_num}_content.md.")
    except Exception as e:
        console.print(f"[bold red]Lỗi ghi file nội dung chương: {e}[/bold red]")
        emit_agent_log(story_uuid, f"Lỗi lưu nội dung chương: {e}", level="error")
        
    # 2. Ghi chap_[n]_state.md
    state_path = config.get_chapter_state_path(story_uuid, chapter_num)
    try:
        # Save as formatted markdown for readability
        state_md = f"""# Cập nhật Trạng thái: {chap_state.chapter_title}
        
## Tóm tắt nội dung
{chap_state.summary}

## Trạng thái Nhân vật
"""
        for char_name, status in chap_state.character_statuses.items():
            state_md += f"- **{char_name}**: {status}\n"
            
        state_md += "\n## Nút thắt đã giải quyết\n"
        for tr in chap_state.threads_resolved:
            state_md += f"- {tr}\n"
            
        state_md += "\n## Nút thắt mới mở ra\n"
        for ti in chap_state.threads_introduced:
            state_md += f"- {ti}\n"
            
        state_path.write_text(state_md, encoding="utf-8")
        console.print(f"✓ Đã ghi trạng thái logic vào: [bold green]{state_path}[/bold green]")
        emit_agent_log(story_uuid, f"✓ Đã lưu trạng thái logic vào file chap_{chapter_num}_state.md.")
    except Exception as e:
        console.print(f"[bold red]Lỗi ghi file trạng thái chương: {e}[/bold red]")
        emit_agent_log(story_uuid, f"Lỗi lưu trạng thái chương: {e}", level="error")

    # 3. Cập nhật global_ledger.json
    ledger_model = GlobalLedger(**ledger)
    
    # Thêm chương vào timeline
    ledger_model.timeline.append({
        "chapter": chapter_num,
        "title": chap_state.chapter_title,
        "summary": chap_state.summary
    })
    
    # Cập nhật unresolved threads
    # Thêm các thread mới mở ra
    for ti in chap_state.threads_introduced:
        if ti not in ledger_model.unresolved_threads:
            ledger_model.unresolved_threads.append(ti)
            
    # Xóa các thread đã được giải quyết
    refine_prompt = f"""
Dựa trên danh sách các nút thắt chưa giải quyết cũ:
{json.dumps(ledger_model.unresolved_threads, ensure_ascii=False)}

And các nút thắt vừa được giải quyết trong chương mới này:
{json.dumps(chap_state.threads_resolved, ensure_ascii=False)}

Hãy trả về danh sách các nút thắt chưa giải quyết mới (cập nhật). Loại bỏ những cái đã được giải quyết hoặc không còn phù hợp. Chỉ trả về mảng JSON dạng chuỗi `["nút thắt 1", "nút thắt 2"]`. Không thêm gì khác.
"""
    refine_response = invoke_with_retry(state, refine_prompt, temperature=0.2)
    try:
        # Parse JSON
        content_text = ensure_string(refine_response.content).strip()
        if content_text.startswith("```json"):
            content_text = content_text.split("```json")[1].split("```")[0].strip()
        elif content_text.startswith("```"):
            content_text = content_text.split("```")[1].split("```")[0].strip()
        new_threads = json.loads(content_text)
        ledger_model.unresolved_threads = new_threads
    except Exception as e:
        # Fallback: remove direct matches
        for tr in chap_state.threads_resolved:
            if tr in ledger_model.unresolved_threads:
                ledger_model.unresolved_threads.remove(tr)
                
    # Ghi lại ledger.json
    ledger_path = config.get_ledger_path(story_uuid)
    try:
        ledger_path.write_text(ledger_model.model_dump_json(indent=2), encoding="utf-8")
        console.print(f"✓ Đã cập nhật Sổ cái Toàn cục: [bold green]{ledger_path}[/bold green]")
        emit_agent_log(story_uuid, "✓ Đã cập nhật Sổ cái Toàn cục.")
    except Exception as e:
        console.print(f"[bold red]Lỗi cập nhật file Sổ cái: {e}[/bold red]")
        emit_agent_log(story_uuid, f"Lỗi cập nhật Sổ cái Toàn cục: {e}", level="error")

    # 3.5 Tự động phát hiện và trích xuất nhân vật mới
    meta_data = state["meta"]
    existing_characters = meta_data.get("characters", [])
    existing_names = [c.get("name", "").strip() for c in existing_characters if c.get("name")]
    
    console.print("\n[bold cyan]Đang phân tích xem có nhân vật mới nào xuất hiện trong chương này hay không...[/bold cyan]")
    emit_agent_log(story_uuid, "Đang kiểm tra xem có nhân vật mới nào xuất hiện trong chương...")
    
    char_prompt = f"""
Hãy đọc nội dung Chương {chapter_num} của bộ truyện dưới đây và tìm xem có nhân vật MỚI nào (có tên riêng cụ thể) xuất hiện lần đầu trong chương này hay không.

THÔNG TIN TRUYỆN:
- Tên truyện: {meta_data.get('name')}
- Danh sách các nhân vật ĐÃ CÓ từ trước: {json.dumps(existing_names, ensure_ascii=False)}

NỘI DUNG CHƯƠNG {chapter_num}:
---
{draft_content}
---

YÊU CẦU:
1. Đối chiếu kỹ lưỡng các nhân vật xuất hiện trong chương với danh sách nhân vật ĐÃ CÓ.
2. Chỉ trích xuất các nhân vật MỚI xuất hiện lần đầu trong chương này mà chưa có trong danh sách đã có.
3. Bỏ qua các nhân vật không có tên cụ thể (ví dụ: "thủ hạ", "người qua đường", "tên cướp", "đám đông").
4. Bỏ qua các nhân vật có tên là cách gọi khác của các nhân vật đã có (ví dụ: "Linh Nhi" hoặc "Linh nhi" chính là "Chu Linh Nhi").
5. Mô tả hoàn cảnh gặp gỡ, thời điểm gặp gỡ và sự kiện chính đang xảy ra ở chương này khi họ xuất hiện trong `appearance_context`.
"""
    try:
        extraction_result = invoke_with_retry(state, char_prompt, temperature=0.2, output_schema=NewCharactersExtraction)
        new_extracted_chars = extraction_result.new_characters
    except Exception as e:
        console.print(f"[bold red]Lỗi khi trích xuất nhân vật mới: {e}[/bold red]")
        new_extracted_chars = []
        
    new_chars_to_add = []
    existing_names_lower = [name.lower() for name in existing_names]
    
    for ext_char in new_extracted_chars:
        ext_name = ext_char.name.strip()
        if not ext_name:
            continue
        ext_name_lower = ext_name.lower()
        
        # Lọc trùng substring / exact match với các nhân vật hiện tại
        is_duplicate = False
        for ex_name in existing_names_lower:
            if ext_name_lower == ex_name or ext_name_lower in ex_name or ex_name in ext_name_lower:
                is_duplicate = True
                break
                
        if not is_duplicate:
            # Tránh trùng lặp ngay trong danh sách mới trích xuất
            if any(c["name"].lower() == ext_name_lower for c in new_chars_to_add):
                continue
                
            new_char = {
                "name": ext_name,
                "role": ext_char.role,
                "description": ext_char.description,
                "first_chapter": chapter_num,
                "appearance_context": ext_char.appearance_context
            }
            new_chars_to_add.append(new_char)
            
    if new_chars_to_add:
        console.print(f"\n[bold green]✨ Phát hiện {len(new_chars_to_add)} nhân vật mới trong Chương {chapter_num}:[/bold green]")
        emit_agent_log(story_uuid, f"✨ Phát hiện {len(new_chars_to_add)} nhân vật mới:")
        for c in new_chars_to_add:
            console.print(f"  - [bold yellow]{c['name']}[/bold yellow] ({c['role']}): {c['description']}")
            console.print(f"    [dim]Hoàn cảnh gặp: {c['appearance_context']}[/dim]")
            emit_agent_log(story_uuid, f"  + {c['name']} ({c['role']}): {c['description']}")
            
        if "characters" not in meta_data:
            meta_data["characters"] = []
        meta_data["characters"].extend(new_chars_to_add)
        
        meta_path = config.get_meta_path(story_uuid)
        try:
            story_meta = StoryMeta(**meta_data)
            meta_path.write_text(story_meta.model_dump_json(indent=2), encoding="utf-8")
            console.print(f"✓ Đã tự động cập nhật thông tin nhân vật mới vào file cấu hình: [bold green]{meta_path}[/bold green]")
            emit_agent_log(story_uuid, "✓ Đã tự động cập nhật thông tin nhân vật mới vào file cấu hình.")
        except Exception as e:
            console.print(f"[bold red]Lỗi ghi file cấu hình truyện (meta.json): {e}[/bold red]")

    # 4. Xóa temp_draft.md
    if config.TEMP_DRAFT_PATH.exists():
        try:
            config.TEMP_DRAFT_PATH.unlink()
            console.print("✓ Đã dọn dẹp file nháp tạm temp_draft.md.")
        except Exception as e:
            console.print(f"[Warning] Không thể xóa file nháp tạm: {e}")
            
    session = session_manager.get_session(story_uuid)
    if session:
        emit_event("agent_status", {
            "story_uuid": story_uuid,
            "chapter_num": chapter_num,
            "status": "completed",
            "message": f"Hoàn thành sáng tác Chương {chapter_num}!"
        })
        emit_agent_log(story_uuid, f"🎉 Hoàn thành sáng tác Chương {chapter_num}!", level="success")
        session_manager.remove_session(story_uuid)
        
    return {"meta": meta_data, "is_done": True}
