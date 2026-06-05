import os
import time
import sys
from pathlib import Path
from langchain_google_genai import ChatGoogleGenerativeAI
from rich.console import Console
from rich.prompt import Prompt
from rich.panel import Panel

import src.core.config as config
from src.models.story import StoryMeta
from src.core.state import AgentState
from src.utils.session_manager import session_manager, SessionCancelledError
from src.utils.socket_emitter import emit_event, emit_agent_log

console = Console()

def check_cancellation(story_uuid: str):
    if not story_uuid:
        return
    session = session_manager.get_session(story_uuid)
    if session and session.cancel_event.is_set():
        raise SessionCancelledError("Tiến trình sáng tác đã bị hủy bởi người dùng.")

def get_llm(model_name: str = "gemini-2.5-flash", temperature: float = 0.7):
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY environment variable not set. Please check your .env file.")
    if not model_name:
        model_name = "gemini-2.5-flash"
    return ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        google_api_key=api_key
    )

def classify_exception(e: Exception) -> int:
    """Phân loại exception của Google API thành HTTP status code tương ứng.
    Trả về status code (401, 403, 404, 429, 500, 503, 504) hoặc 0 nếu không xác định.
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
    if "404" in err_str or "not found" in err_str or "not_found" in err_str or "notfound" in err_str:
        return 404
        
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
    story_uuid = state.get("story_uuid")
    check_cancellation(story_uuid)
    
    auth_retries = 0
    server_retries = 0
    rate_limit_retries = 0
    
    while True:
        check_cancellation(story_uuid)
        model_name = state.get("model", "gemini-2.5-flash")
        try:
            llm = get_llm(model_name, temperature)
            runnable = llm.with_structured_output(output_schema) if output_schema else llm
        except Exception as e:
            console.print(f"[bold red]Lỗi khi khởi tạo LLM: {e}[/bold red]")
            code = classify_exception(e)
            if code == 0:
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
                
        # Check if we should trigger Socket.IO model select
        story_uuid = state.get("story_uuid")
        session = session_manager.get_session(story_uuid) if story_uuid else None
        should_socket_model_change = session is not None and (
            code == 404 or 
            (code == 429 and rate_limit_retries >= 3) or
            (code in (500, 503, 504) and server_retries >= 3)
        )
        
        if should_socket_model_change:
            emit_agent_log(story_uuid, f"Lỗi AI ({code}): {e_msg}. Gửi yêu cầu đổi model tới giao diện...", level="error")
            session.status = "waiting_model_change"
            emit_event("llm_error_select_model", {
                "story_uuid": story_uuid,
                "error": e_msg,
                "current_model": model_name
            })
            session.input_event.clear()
            success = session.input_event.wait(timeout=300.0)
            check_cancellation(story_uuid)
            if success and session.input_data:
                new_model = str(session.input_data).strip()
                session.input_data = None
                session.status = "running"
                
                state["model"] = new_model
                if "meta" in state:
                    state["meta"]["model"] = new_model
                    meta_path = config.get_meta_path(story_uuid)
                    try:
                        story_meta = StoryMeta(**state["meta"])
                        meta_path.write_text(story_meta.model_dump_json(indent=2), encoding="utf-8")
                        emit_agent_log(story_uuid, f"✓ Đã cập nhật cấu hình model mới: {new_model}")
                    except Exception as meta_err:
                        emit_agent_log(story_uuid, f"Lỗi cập nhật cấu hình model: {meta_err}", level="warning")
                
                emit_agent_log(story_uuid, f"Chuyển sang model '{new_model}'. Đang thử lại...", level="info")
                rate_limit_retries = 0
                server_retries = 0
                auth_retries = 0
                continue
            else:
                emit_agent_log(story_uuid, "Hết thời gian chờ đổi model hoặc không nhận được model hợp lệ.", level="error")
                raise RuntimeError(f"Lỗi AI ({code}) và không chọn model mới qua socket.")
                
        if code in (401, 403):
            auth_retries += 1
            if auth_retries > 3:
                console.print(f"[bold red]❌ Lỗi xác thực API Gemini liên tục quá 3 lần. Hủy tiến trình sáng tác chương.[/bold red]")
                if story_uuid:
                    emit_agent_log(story_uuid, f"Lỗi xác thực API Gemini liên tục quá 3 lần. Hủy tiến trình sáng tác chương.", level="error")
                raise RuntimeError("Lỗi xác thực API Gemini quá 3 lần.")
                
            if sys.stdin is None or not sys.stdin.isatty():
                if story_uuid:
                    emit_agent_log(story_uuid, f"Lỗi xác thực API Gemini ({code}). Chi tiết: {e_msg}", level="error")
                raise RuntimeError(f"Lỗi xác thực API Gemini {code}. Chi tiết: {e_msg}")
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
                if story_uuid:
                    emit_agent_log(story_uuid, f"⚠️ Lỗi máy chủ Google ({code}): {e_msg}. Đang tự động thử lại lần {server_retries}/3 sau 10s...", level="warning")
                for _ in range(10):
                    check_cancellation(story_uuid)
                    time.sleep(1.0)
            else:
                console.print(f"\n[bold red]❌ Gặp lỗi máy chủ Google ({code}) liên tục sau 3 lần thử lại.[/bold red]")
                if story_uuid:
                    emit_agent_log(story_uuid, f"❌ Gặp lỗi máy chủ Google ({code}) liên tục sau 3 lần thử lại.", level="error")
                if sys.stdin is None or not sys.stdin.isatty():
                    raise RuntimeError(f"Lỗi máy chủ Google {code} liên tục sau 3 lần thử lại. Chi tiết: {e_msg}")
                console.print("[bold yellow]Vui lòng chọn model AI khác để tiếp tục quy trình:[/bold yellow]")
                console.print(" 1. [bold cyan]gemini-1.5-flash[/bold cyan]")
                console.print(" 2. [bold cyan]gemini-1.5-pro[/bold cyan]")
                console.print(" 3. [bold cyan]gemini-2.0-flash[/bold cyan]")
                console.print(" 4. [bold cyan]gemini-2.5-flash[/bold cyan]")
                console.print(" 5. [bold cyan]gemini-2.5-pro[/bold cyan]")
                console.print(" 6. [bold cyan]Khác[/bold cyan] (Nhập thủ công)")
                
                model_choice = Prompt.ask("Chọn số thứ tự model", choices=["1", "2", "3", "4", "5", "6"], default="4")
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
                if story_uuid:
                    emit_agent_log(story_uuid, f"Cảnh báo: Lỗi quá giới hạn lưu lượng (Rate Limit 429). Đang tự động đếm ngược thử lại lần {rate_limit_retries}/3...", level="warning")
                for sec in range(60, 0, -1):
                    check_cancellation(story_uuid)
                    sys.stdout.write(f"\rĐang chờ thử lại lần {rate_limit_retries}/3 sau quá tải: {sec} giây... ")
                    sys.stdout.flush()
                    time.sleep(1)
                sys.stdout.write("\r\n")
                console.print("[bold green]Bắt đầu thử lại...[/bold green]")
            else:
                console.print(f"\n[bold red]❌ Gặp lỗi Rate Limit (429) liên tục sau 3 lần chờ đợi.[/bold red]")
                if story_uuid:
                    emit_agent_log(story_uuid, f"❌ Gặp lỗi Rate Limit (429) liên tục sau 3 lần chờ đợi.", level="error")
                if sys.stdin is None or not sys.stdin.isatty():
                    raise RuntimeError(f"Lỗi giới hạn tốc độ API Gemini (429) liên tục sau 3 lần thử lại. Chi tiết: {e_msg}")
                console.print("[bold yellow]Vui lòng chọn model AI khác để tránh giới hạn lưu lượng hiện tại:[/bold yellow]")
                console.print(" 1. [bold cyan]gemini-1.5-flash[/bold cyan]")
                console.print(" 2. [bold cyan]gemini-1.5-pro[/bold cyan]")
                console.print(" 3. [bold cyan]gemini-2.0-flash[/bold cyan]")
                console.print(" 4. [bold cyan]gemini-2.5-flash[/bold cyan]")
                console.print(" 5. [bold cyan]gemini-2.5-pro[/bold cyan]")
                console.print(" 6. [bold cyan]Khác[/bold cyan] (Nhập thủ công)")
                
                model_choice = Prompt.ask("Chọn số thứ tự model", choices=["1", "2", "3", "4", "5", "6"], default="4")
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
                    
        elif code == 404:
            if sys.stdin is None or not sys.stdin.isatty():
                if story_uuid:
                    emit_agent_log(story_uuid, f"Lỗi model AI không tồn tại (404). Chi tiết: {e_msg}", level="error")
                raise RuntimeError(f"Lỗi model AI không tồn tại (404) trong môi trường không có TTY. Chi tiết: {e_msg}")
            
            console.print(f"\n[bold red]❌ Gặp lỗi model AI không tồn tại (404): {e_msg}[/bold red]")
            console.print("[bold yellow]Vui lòng chọn model AI khác để tiếp tục quy trình:[/bold yellow]")
            console.print(" 1. [bold cyan]gemini-1.5-flash[/bold cyan]")
            console.print(" 2. [bold cyan]gemini-1.5-pro[/bold cyan]")
            console.print(" 3. [bold cyan]gemini-2.0-flash[/bold cyan]")
            console.print(" 4. [bold cyan]gemini-2.5-flash[/bold cyan]")
            console.print(" 5. [bold cyan]gemini-2.5-pro[/bold cyan]")
            console.print(" 6. [bold cyan]Khác[/bold cyan] (Nhập thủ công)")
            
            model_choice = Prompt.ask("Chọn số thứ tự model", choices=["1", "2", "3", "4", "5", "6"], default="4")
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
                server_retries = 0
                auth_retries = 0
                continue
            else:
                raise RuntimeError("Lỗi model 404 và không chọn model mới.")
        else:
            console.print(f"[bold red]❌ Gặp lỗi không xác định từ API Gemini: {e_msg}[/bold red]")
            if story_uuid:
                emit_agent_log(story_uuid, f"❌ Gặp lỗi không xác định từ API Gemini: {e_msg}", level="error")
            raise RuntimeError(f"Lỗi gọi API Gemini không xác định: {e_msg}")
