import os
import json
import time
import sys
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

def classify_exception(e: Exception) -> int:
    """Phân loại exception của Google API thành HTTP status code tương ứng.
    Trả về status code (401, 403, 429, 500, 503, 504) hoặc 0 nếu không xác định.
    """
    err_str = str(e).lower()
    
    if hasattr(e, "status_code"):
        code = getattr(e, "status_code")
        if isinstance(code, int):
            return code
        try:
            return int(code)
        except Exception:
            pass
            
    class_name = e.__class__.__name__.lower()
    if "unauthenticated" in class_name or "api_key" in class_name:
        return 401
    elif "permissiondenied" in class_name:
        return 403
    elif "resourceexhausted" in class_name:
        return 429
    elif "internalservererror" in class_name:
        return 500
    elif "serviceunavailable" in class_name:
        return 503
        
    if "api key not valid" in err_str or "api_key_invalid" in err_str or "401" in err_str or "unauthorized" in err_str:
        return 401
    if "permission denied" in err_str or "403" in err_str or "forbidden" in err_str:
        return 403
    if "429" in err_str or "resource_exhausted" in err_str or "rate limit" in err_str or "too many requests" in err_str:
        return 429
    if "503" in err_str or "service unavailable" in err_str or "service_unavailable" in err_str:
        return 503
    if "504" in err_str or "gateway timeout" in err_str:
        return 504
    if "500" in err_str or "internal server error" in err_str or "internal_server_error" in err_str:
        return 500
        
    return 0

def update_env_api_key(new_key: str):
    env_path = Path(config.BASE_DIR) / ".env"
    lines = []
    key_found = False
    if env_path.exists():
        try:
            content = env_path.read_text(encoding="utf-8")
            for line in content.splitlines():
                if line.strip().startswith("GOOGLE_API_KEY="):
                    lines.append(f"GOOGLE_API_KEY={new_key}")
                    key_found = True
                else:
                    lines.append(line)
        except Exception:
            pass
    if not key_found:
        lines.append(f"GOOGLE_API_KEY={new_key}")
        
    try:
        env_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    except Exception as e:
        console.print(f"[bold red]Không thể cập nhật file .env: {e}[/bold red]")

def invoke_with_retry(state: AgentState, prompt, temperature: float = 0.7, output_schema = None):
    """Gọi API với cơ chế tự động thử lại và xử lý lỗi theo từng nhóm mã trạng thái HTTP.
    """
    auth_retries = 0
    server_retries = 0
    rate_limit_retries = 0
    
    while True:
        model_name = state.get("model", "gemini-1.5-flash")
        try:
            llm = get_llm(model_name, temperature)
            runnable = llm.with_structured_output(output_schema) if output_schema else llm
        except Exception as e:
            console.print(f"[bold red]Lỗi khi khởi tạo LLM: {e}[/bold red]")
            code = 401
            e_msg = str(e)
        else:
            code = 0
            e_msg = ""
            
        if code == 0:
            try:
                return runnable.invoke(prompt)
            except Exception as e:
                code = classify_exception(e)
                e_msg = str(e)
                
        if code in (401, 403):
            auth_retries += 1
            if auth_retries > 3:
                console.print(f"[bold red]❌ Lỗi xác thực API Gemini liên tục quá 3 lần. Hủy tiến trình sáng tác chương.[/bold red]")
                raise RuntimeError("Lỗi xác thực API Gemini quá 3 lần.")
                
            console.print(f"\n[bold red]⚠️ Lỗi xác thực (API Key không hợp lệ hoặc không có quyền truy cập - Lỗi {code}).[/bold red]")
            console.print(f"[bold yellow]Chi tiết lỗi: {e_msg}[/bold yellow]")
            console.print(f"[bold cyan]Nhập lại GOOGLE_API_KEY mới (Lần thử lại {auth_retries}/3):[/bold cyan]")
            
            new_key = Prompt.ask("API Key mới", password=True)
            if not new_key.strip():
                console.print("[bold red]API Key trống. Hủy tiến trình sáng tác.[/bold red]")
                raise RuntimeError("API Key trống.")
                
            os.environ["GOOGLE_API_KEY"] = new_key.strip()
            update_env_api_key(new_key.strip())
            console.print("[bold green]✓ Đã cập nhật API Key mới vào bộ nhớ và file .env. Đang thử lại...[/bold green]")
            
        elif code in (500, 503, 504):
            server_retries += 1
            if server_retries <= 3:
                console.print(f"[bold yellow]⚠️ Lỗi máy chủ Google ({code}): {e_msg}. Đang tự động thử lại lần {server_retries}/3 sau 10s...[/bold yellow]")
                time.sleep(10.0)
            else:
                console.print(f"\n[bold red]❌ Gặp lỗi máy chủ Google ({code}) liên tục sau 3 lần thử lại.[/bold red]")
                console.print("[bold yellow]Vui lòng chọn model AI khác để tiếp tục quy trình:[/bold yellow]")
                console.print(" 1. [bold cyan]gemini-1.5-flash[/bold cyan]")
                console.print(" 2. [bold cyan]gemini-1.5-pro[/bold cyan]")
                console.print(" 3. [bold cyan]gemini-2.0-flash[/bold cyan]")
                console.print(" 4. [bold cyan]gemini-2.5-flash[/bold cyan]")
                console.print(" 5. [bold cyan]gemini-2.5-pro[/bold cyan]")
                console.print(" 6. [bold cyan]Khác[/bold cyan] (Nhập thủ công)")
                
                model_choice = Prompt.ask("Chọn số thứ tự model", choices=["1", "2", "3", "4", "5", "6"], default="1")
                if model_choice == "1":
                    new_model = "gemini-1.5-flash"
                elif model_choice == "2":
                    new_model = "gemini-1.5-pro"
                elif model_choice == "3":
                    new_model = "gemini-2.0-flash"
                elif model_choice == "4":
                    new_model = "gemini-2.5-flash"
                elif model_choice == "5":
                    new_model = "gemini-2.5-pro"
                else:
                    new_model = Prompt.ask("Nhập tên model AI")
                    
                if new_model and new_model.strip():
                    new_model = new_model.strip()
                    state["model"] = new_model
                    if "meta" in state:
                        state["meta"]["model"] = new_model
                        story_uuid = state.get("story_uuid")
                        if story_uuid:
                            meta_path = config.get_meta_path(story_uuid)
                            try:
                                story_meta = StoryMeta(**state["meta"])
                                meta_path.write_text(story_meta.model_dump_json(indent=2), encoding="utf-8")
                                console.print(f"✓ Đã lưu model mới '{new_model}' vào file cấu hình: {meta_path}")
                            except Exception:
                                pass
                    console.print(f"[bold green]✓ Đã chuyển sang model '{new_model}'. Đang thử lại...[/bold green]")
                    server_retries = 0
                else:
                    raise RuntimeError(f"Lỗi máy chủ Google {code} và không chọn model mới.")
                    
        elif code == 429:
            rate_limit_retries += 1
            if rate_limit_retries <= 3:
                console.print(f"\n[bold yellow]⚠️ Lỗi quá giới hạn lưu lượng (Rate Limit - Lỗi 429).[/bold yellow]")
                console.print(f"[bold yellow]Chi tiết: {e_msg}[/bold yellow]")
                for sec in range(60, 0, -1):
                    sys.stdout.write(f"\rĐang chờ thử lại lần {rate_limit_retries}/3 sau quá tải: {sec} giây... ")
                    sys.stdout.flush()
                    time.sleep(1)
                sys.stdout.write("\r\n")
                console.print("[bold green]Bắt đầu thử lại...[/bold green]")
            else:
                console.print(f"\n[bold red]❌ Gặp lỗi Rate Limit (429) liên tục sau 3 lần chờ đợi.[/bold red]")
                console.print("[bold yellow]Vui lòng chọn model AI khác để tránh giới hạn lưu lượng hiện tại:[/bold yellow]")
                console.print(" 1. [bold cyan]gemini-1.5-flash[/bold cyan]")
                console.print(" 2. [bold cyan]gemini-1.5-pro[/bold cyan]")
                console.print(" 3. [bold cyan]gemini-2.0-flash[/bold cyan]")
                console.print(" 4. [bold cyan]gemini-2.5-flash[/bold cyan]")
                console.print(" 5. [bold cyan]gemini-2.5-pro[/bold cyan]")
                console.print(" 6. [bold cyan]Khác[/bold cyan] (Nhập thủ công)")
                
                model_choice = Prompt.ask("Chọn số thứ tự model", choices=["1", "2", "3", "4", "5", "6"], default="1")
                if model_choice == "1":
                    new_model = "gemini-1.5-flash"
                elif model_choice == "2":
                    new_model = "gemini-1.5-pro"
                elif model_choice == "3":
                    new_model = "gemini-2.0-flash"
                elif model_choice == "4":
                    new_model = "gemini-2.5-flash"
                elif model_choice == "5":
                    new_model = "gemini-2.5-pro"
                else:
                    new_model = Prompt.ask("Nhập tên model AI")
                    
                if new_model and new_model.strip():
                    new_model = new_model.strip()
                    state["model"] = new_model
                    if "meta" in state:
                        state["meta"]["model"] = new_model
                        story_uuid = state.get("story_uuid")
                        if story_uuid:
                            meta_path = config.get_meta_path(story_uuid)
                            try:
                                story_meta = StoryMeta(**state["meta"])
                                meta_path.write_text(story_meta.model_dump_json(indent=2), encoding="utf-8")
                                console.print(f"✓ Đã lưu model mới '{new_model}' vào file cấu hình: {meta_path}")
                            except Exception:
                                pass
                    console.print(f"[bold green]✓ Đã chuyển sang model '{new_model}'. Đang thử lại...[/bold green]")
                    rate_limit_retries = 0
                else:
                    raise RuntimeError("Lỗi giới hạn tốc độ 429 và không chọn model mới.")
                    
        else:
            console.print(f"[bold red]❌ Gặp lỗi không xác định từ API Gemini: {e_msg}[/bold red]")
            raise RuntimeError(f"Lỗi gọi API Gemini không xác định: {e_msg}")

def ensure_string(content) -> str:
    """Đảm bảo nội dung trả về từ AI là dạng chuỗi (string).
    Nếu là danh sách (list), gộp các phần tử lại thành chuỗi.
    """
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict):
                if "text" in part:
                    parts.append(part["text"])
                else:
                    parts.append(str(part))
            else:
                parts.append(str(part))
        return "".join(parts)
    return str(content)

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
    console.print("\n[bold blue]=== [Node 1] Requirement Analyzer ===[/bold blue]")
    
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
        
    return {"draft_content": revised_content}


def auditor_node(state: AgentState) -> Dict[str, Any]:
    """Node 4: Auditor
    Performs logic check against previous chapter's state and global ledger.
    """
    console.print("\n[bold blue]=== [Node 4] Auditor ===[/bold blue]")
    console.print("Đang kiểm duyệt logic và tính nhất quán của cốt truyện...")
    
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
            
    # Xóa các thread đã được giải quyết
    refine_prompt = f"""
Dựa trên danh sách các nút thắt chưa giải quyết cũ:
{json.dumps(ledger_model.unresolved_threads, ensure_ascii=False)}

Và các nút thắt vừa được giải quyết trong chương mới này:
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
    except Exception as e:
        console.print(f"[bold red]Lỗi cập nhật file Sổ cái: {e}[/bold red]")

    # 3.5 Tự động phát hiện và trích xuất nhân vật mới
    meta_data = state["meta"]
    existing_characters = meta_data.get("characters", [])
    existing_names = [c.get("name", "").strip() for c in existing_characters if c.get("name")]
    
    console.print("\n[bold cyan]Đang phân tích xem có nhân vật mới nào xuất hiện trong chương này hay không...[/bold cyan]")
    
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
        for c in new_chars_to_add:
            console.print(f"  - [bold yellow]{c['name']}[/bold yellow] ({c['role']}): {c['description']}")
            console.print(f"    [dim]Hoàn cảnh gặp: {c['appearance_context']}[/dim]")
            
        if "characters" not in meta_data:
            meta_data["characters"] = []
        meta_data["characters"].extend(new_chars_to_add)
        
        meta_path = config.get_meta_path(story_uuid)
        try:
            story_meta = StoryMeta(**meta_data)
            meta_path.write_text(story_meta.model_dump_json(indent=2), encoding="utf-8")
            console.print(f"✓ Đã tự động cập nhật thông tin nhân vật mới vào file cấu hình: [bold green]{meta_path}[/bold green]")
        except Exception as e:
            console.print(f"[bold red]Lỗi ghi file cấu hình truyện (meta.json): {e}[/bold red]")

    # 4. Xóa temp_draft.md
    if config.TEMP_DRAFT_PATH.exists():
        try:
            config.TEMP_DRAFT_PATH.unlink()
            console.print("✓ Đã dọn dẹp file nháp tạm temp_draft.md.")
        except Exception as e:
            console.print(f"[Warning] Không thể xóa file nháp tạm: {e}")
            
    return {"meta": meta_data, "is_done": True}
