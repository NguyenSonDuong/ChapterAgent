import os
import json
from pathlib import Path
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field

from langchain_google_genai import ChatGoogleGenerativeAI
from rich.console import Console
from rich.prompt import Prompt
from rich.panel import Panel

import config
from models import StoryMeta, GlobalLedger, ChapterState
from state import AgentState

console = Console()

# Initialize Gemini LLM
# We use gemini-1.5-flash by default as it is fast and supports structured output
def get_llm(model_name: str = "gemini-1.5-flash", temperature: float = 0.7):
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable not set. Please check your .env file.")
    if not model_name:
        model_name = "gemini-1.5-flash"
    return ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        google_api_key=api_key
    )

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


# --- LangGraph Node Functions ---

def requirement_analyzer_node(state: AgentState) -> Dict[str, Any]:
    """Node 1: Requirement Analyzer
    Reads user idea & global ledger, prompts user interactively if details are missing.
    """
    console.print("\n[bold blue]=== [Node 1] Requirement Analyzer ===[/bold blue]")
    
    llm = get_llm(state.get("model", "gemini-1.5-flash"), temperature=0.3)
    structured_llm = llm.with_structured_output(RequirementAnalysisResult)
    
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
        try:
            result = structured_llm.invoke(prompt)
        except Exception as e:
            console.print(f"[bold red]Lỗi khi gọi API Gemini phân tích yêu cầu: {e}[/bold red]")
            # Fallback
            result = RequirementAnalysisResult(
                missing_info_questions=[],
                analyzed_requirements=f"Viết chương {chapter_num} dựa trên ý tưởng: {current_idea}"
            )
            
        # If there are missing info questions, ask user
        if result.missing_info_questions and loop_count < max_loops - 1:
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
    
    return {
        "analyzed_requirements": result.analyzed_requirements,
        "user_idea": current_idea # Keep track of the full expanded idea
    }


def story_drafter_node(state: AgentState) -> Dict[str, Any]:
    """Node 2: Story Drafter
    Generates the initial chapter draft based on context and analyzed requirements.
    """
    console.print("\n[bold blue]=== [Node 2] Story Drafter ===[/bold blue]")
    console.print("Đang viết nháp chương... Vui lòng đợi trong giây lát.")
    
    llm = get_llm(state.get("model", "gemini-1.5-flash"), temperature=0.8)
    
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
    
    try:
        response = llm.invoke(prompt)
        draft_content = response.content
    except Exception as e:
        console.print(f"[bold red]Lỗi khi gọi API Gemini để viết nháp: {e}[/bold red]")
        draft_content = f"# Chương {chapter_num}: Tiêu đề tạm thời\n\n(Lỗi tạo bản thảo: {e})"
        
    return {"draft_content": draft_content}


def human_review_node(state: AgentState) -> Dict[str, Any]:
    """Node 3: Human Review (Interactive Breakpoint)
    Saves draft to disk as temp_draft.md and asks user for feedback or 'Done'.
    """
    console.print("\n[bold blue]=== [Node 3] Human Review ===[/bold blue]")
    
    draft_content = state["draft_content"]
    
    # Save the draft content to temp_draft.md
    try:
        config.TEMP_DRAFT_PATH.write_text(draft_content, encoding="utf-8")
    except Exception as e:
        console.print(f"[bold red]Không thể ghi file nháp tạm: {e}[/bold red]")
        
    console.print("\n[bold cyan]================================================================================[/bold cyan]")
    console.print(f"[bold green][Thông báo][/bold green] Bản nháp Chương {state['chapter_num']} đã được cập nhật thành công.")
    console.print(f"Nội dung hiện tại đã được lưu tạm vào file: [bold yellow]{config.TEMP_DRAFT_PATH.absolute()}[/bold yellow]")
    console.print("Bạn hãy mở file này bằng Text Editor (VS Code, Notepad...) để đọc và đánh giá.")
    console.print("[bold cyan]================================================================================[/bold cyan]\n")
    
    feedback = Prompt.ask(
        "[bold magenta]Nhập yêu cầu chỉnh sửa của bạn[/bold magenta] (ví dụ: 'Viết đoạn cuối kịch tính hơn', 'Thêm thoại cho nhân vật A'),\n"
        "hoặc gõ [bold green]'Done'[/bold green] nếu đã ưng ý hoàn toàn"
    )
    
    return {"revision_feedback": feedback.strip()}


def reviser_node(state: AgentState) -> Dict[str, Any]:
    """Node 3.1: Reviser
    Edits draft_content based on user feedback and metadata.
    """
    console.print("\n[bold blue]=== [Node 3.1] Reviser ===[/bold blue]")
    console.print("Đang tiến hành chỉnh sửa bản nháp theo yêu cầu của bạn...")
    
    llm = get_llm(state.get("model", "gemini-1.5-flash"), temperature=0.7)
    
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
    try:
        response = llm.invoke(prompt)
        revised_content = response.content
    except Exception as e:
        console.print(f"[bold red]Lỗi khi gọi API Gemini để chỉnh sửa: {e}[/bold red]")
        revised_content = draft_content # Keep original on failure
        
    return {"draft_content": revised_content}


def auditor_node(state: AgentState) -> Dict[str, Any]:
    """Node 4: Auditor
    Performs logic check against previous chapter's state and global ledger.
    """
    console.print("\n[bold blue]=== [Node 4] Auditor ===[/bold blue]")
    console.print("Đang kiểm duyệt logic và tính nhất quán của cốt truyện...")
    
    llm = get_llm(state.get("model", "gemini-1.5-flash"), temperature=0.2)
    structured_llm = llm.with_structured_output(AuditResult)
    
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
    try:
        result = structured_llm.invoke(prompt)
    except Exception as e:
        console.print(f"[bold red]Lỗi khi gọi API Gemini để kiểm duyệt: {e}[/bold red]")
        result = AuditResult(
            warnings=[],
            auditor_feedback=f"Không thể thực hiện kiểm duyệt logic tự động do lỗi hệ thống: {e}"
        )
        
    if result.warnings:
        console.print("\n[bold red][CẢNH BÁO LOGIC PHÁT HIỆN TỪ AUDITOR]:[/bold red]")
        for w in result.warnings:
            console.print(f" ⚠️  {w}", style="yellow")
    else:
        console.print("\n[bold green]✓ Kiểm duyệt logic thành công: Không phát hiện lỗi nhất quán cốt truyện.[/bold green]")
        
    console.print(Panel(result.auditor_feedback, title="Đánh giá từ Auditor", border_style="cyan"))
    
    return {
        "warnings": result.warnings,
        "auditor_feedback": result.auditor_feedback
    }


def state_ledger_updater_node(state: AgentState) -> Dict[str, Any]:
    """Node 5: State & Ledger Updater
    Extracts structured ChapterState, saves files, updates global ledger, cleans up temp draft.
    """
    console.print("\n[bold blue]=== [Node 5] State & Ledger Updater ===[/bold blue]")
    console.print("Đang trích xuất trạng thái và cập nhật sổ cái toàn cục...")
    
    llm = get_llm(state.get("model", "gemini-1.5-flash"), temperature=0.2)
    structured_llm = llm.with_structured_output(ChapterState)
    
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
    try:
        chap_state = structured_llm.invoke(prompt)
    except Exception as e:
        console.print(f"[bold red]Lỗi khi trích xuất trạng thái chương: {e}[/bold red]")
        # Fallback
        chap_state = ChapterState(
            chapter_title=f"Chương {chapter_num}",
            summary="Chương truyện đã được tạo nhưng gặp lỗi khi trích xuất trạng thái tự động.",
            character_statuses={},
            threads_resolved=[],
            threads_introduced=[]
        )
        
    # 1. Ghi chap_[n]_content.md
    content_path = config.get_chapter_content_path(story_uuid, chapter_num)
    try:
        content_path.write_text(draft_content, encoding="utf-8")
        console.print(f"✓ Đã ghi nội dung chương truyện vào: [bold green]{content_path}[/bold green]")
    except Exception as e:
        console.print(f"[bold red]Lỗi ghi file nội dung chương: {e}[/bold red]")
        
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
    except Exception as e:
        console.print(f"[bold red]Lỗi ghi file trạng thái chương: {e}[/bold red]")

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
            
    # Xóa các thread đã được giải quyết (so khớp tương đối hoặc trực tiếp)
    # Vì so khớp trực tiếp có thể khó chính xác tuyệt đối, ta dùng LLM lọc lại hoặc xóa trực tiếp nếu trùng lặp hoàn toàn
    # Để an toàn và đơn giản, ta xóa các thread có tên trùng khớp, hoặc ta có thể dùng Gemini để lọc lại unresolved threads
    # Hãy cập nhật đơn giản: loại bỏ các mối nối trùng khớp chính xác hoặc dùng LLM cập nhật lại
    # Chúng ta sẽ dùng một prompt LLM đơn giản để tinh chỉnh danh sách unresolved_threads của sổ cái
    refine_prompt = f"""
Dựa trên danh sách các nút thắt chưa giải quyết cũ:
{json.dumps(ledger_model.unresolved_threads, ensure_ascii=False)}

Và các nút thắt vừa được giải quyết trong chương mới này:
{json.dumps(chap_state.threads_resolved, ensure_ascii=False)}

Hãy trả về danh sách các nút thắt chưa giải quyết mới (cập nhật). Loại bỏ những cái đã được giải quyết hoặc không còn phù hợp. Chỉ trả về mảng JSON dạng chuỗi `["nút thắt 1", "nút thắt 2"]`. Không thêm gì khác.
"""
    try:
        refine_response = llm.invoke(refine_prompt)
        # Parse JSON
        content_text = refine_response.content.strip()
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
    except Exception as e:
        console.print(f"[bold red]Lỗi cập nhật file Sổ cái: {e}[/bold red]")

    # 4. Xóa temp_draft.md
    if config.TEMP_DRAFT_PATH.exists():
        try:
            config.TEMP_DRAFT_PATH.unlink()
            console.print("✓ Đã dọn dẹp file nháp tạm temp_draft.md.")
        except Exception as e:
            console.print(f"[Warning] Không thể xóa file nháp tạm: {e}")
            
    return {"is_done": True}
