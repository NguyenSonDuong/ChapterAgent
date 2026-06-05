import sys
import io

# Đảm bảo UTF-8 cho Windows console để hiển thị tiếng Việt không bị lỗi
if sys.platform.startswith('win'):
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    except Exception:
        pass

import os
import uuid
import json
import argparse
from pathlib import Path
from typing import Dict, Any, List

from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt, IntPrompt
from rich.columns import Columns


import src.core.config as config
import src.models.story as models
from src.agent.graph import app
from src.core.state import AgentState

console = Console()

def check_env():
    """Verify setup environment."""
    if not config.check_api_key():
        console.print("[bold red]CẢNH BÁO: Không tìm thấy GOOGLE_API_KEY trong file .env hoặc biến môi trường.[/bold red]")
        console.print("Vui lòng tạo file [bold yellow].env[/bold yellow] tại thư mục gốc dự án và định nghĩa:")
        console.print("  [bold green]GOOGLE_API_KEY=your_gemini_api_key_here[/bold green]")
        sys.exit(1)

def show_banner():
    console.print("\n[bold cyan]=======================================================[/bold cyan]")
    console.print("[bold yellow]      TRÌNH TRỢ LÝ SÁNG TÁC TRUYỆN DÀI KỲ LANGGRAPH    [/bold yellow]")
    console.print("[bold cyan]=======================================================[/bold cyan]\n")

def handle_init(args):
    """Command to initialize a new story."""
    show_banner()
    console.print("[bold green]=== Khởi tạo truyện mới ===[/bold green]\n")
    
    name = Prompt.ask("1. Nhập tên truyện")
    context = Prompt.ask("2. Nhập bối cảnh chính của thế giới / cốt truyện chung")
    style = Prompt.ask("3. Nhập phong cách kể chuyện (ví dụ: u tối, hài hước, trinh thám, thơ mộng)")
    tags_str = Prompt.ask("4. Nhập các nhãn phân loại (ngăn cách bởi dấu phẩy, ví dụ: tiên hiệp, hệ thống, kiếm hiệp)")
    tags = [t.strip() for t in tags_str.split(",") if t.strip()]
    
    max_chapters = IntPrompt.ask("5. Số chương tối đa dự kiến", default=10)
    max_words_per_chapter = IntPrompt.ask("6. Số từ giới hạn tối đa mỗi chương", default=2000)
    
    # Model selection
    console.print("\n[bold yellow]7. Lựa chọn Model AI sử dụng cho truyện:[/bold yellow]")
    console.print("   1. [bold cyan]gemini-2.5-flash[/bold cyan] (Mặc định - Thế hệ mới nhất - Tối ưu hiệu suất và tốc độ)")
    console.print("   2. [bold cyan]gemini-1.5-flash[/bold cyan] (Cũ - Nhanh, rẻ, phù hợp viết nháp)")
    console.print("   3. [bold cyan]gemini-1.5-pro[/bold cyan] (Thông minh - Phù hợp lập luận phức tạp và biên tập)")
    console.print("   4. [bold cyan]gemini-2.0-flash[/bold cyan] (Thế hệ mới - Nhanh và cải tiến)")
    console.print("   5. [bold cyan]gemini-2.5-pro[/bold cyan] (Thế hệ mới nhất - Chất lượng cao nhất)")
    console.print("   6. [bold cyan]Khác[/bold cyan] (Nhập tên model thủ công)")
    
    model_choice = Prompt.ask("   Chọn số thứ tự model hoặc nhấn Enter để dùng mặc định", choices=["1", "2", "3", "4", "5", "6", ""], default="1")
    if model_choice == "1" or model_choice == "":
        model_name = "gemini-2.5-flash"
    elif model_choice == "2":
        model_name = "gemini-1.5-flash"
    elif model_choice == "3":
        model_name = "gemini-1.5-pro"
    elif model_choice == "4":
        model_name = "gemini-2.0-flash"
    elif model_choice == "5":
        model_name = "gemini-2.5-pro"
    else:
        model_name = Prompt.ask("   Nhập tên model AI mong muốn (ví dụ: gemini-2.5-flash)")
        if not model_name.strip():
            model_name = "gemini-2.5-flash"
            
    # Character setup
    characters = []
    console.print("\n[bold yellow]5. Thiết lập Nhân vật (Nhập trống phần tên nhân vật để kết thúc):[/bold yellow]")
    while True:
        c_name = Prompt.ask("   - Tên nhân vật")
        if not c_name.strip():
            break
        c_role = Prompt.ask(f"     Vai trò của {c_name} (chính, phụ, phản diện, sư phụ...)")
        c_desc = Prompt.ask(f"     Mô tả ngắn về {c_name} (tính cách, vũ khí, sức mạnh...)")
        characters.append(models.CharacterInfo(name=c_name, role=c_role, description=c_desc))
        console.print(f"[dim]     => Đã thêm nhân vật {c_name}[/dim]")
        
    story_uuid = str(uuid.uuid4())
    
    # Create models
    meta = models.StoryMeta(
        uuid=story_uuid,
        name=name,
        characters=characters,
        context=context,
        style=style,
        tags=tags,
        max_chapters=max_chapters,
        max_words_per_chapter=max_words_per_chapter,
        model=model_name
    )
    
    ledger = models.GlobalLedger(
        timeline=[],
        unresolved_threads=["Bắt đầu cuộc phiêu lưu của nhân vật."]
    )
    
    # Save files
    meta_path = config.get_meta_path(story_uuid)
    ledger_path = config.get_ledger_path(story_uuid)
    
    try:
        # Create directories
        config.get_chapters_dir(story_uuid)
        config.get_states_dir(story_uuid)
        
        meta_path.write_text(meta.model_dump_json(indent=2), encoding="utf-8")
        ledger_path.write_text(ledger.model_dump_json(indent=2), encoding="utf-8")
        
        console.print(f"\n[bold green]✓ Tạo truyện thành công![/bold green]")
        console.print(f"UUID của truyện: [bold yellow]{story_uuid}[/bold yellow]")
        console.print(f"File Meta lưu tại: {meta_path}")
        console.print(f"File Sổ cái lưu tại: {ledger_path}")
    except Exception as e:
        console.print(f"[bold red]Lỗi khi lưu dữ liệu truyện: {e}[/bold red]")

def handle_list(args):
    """Command to list all stories."""
    show_banner()
    console.print("[bold green]=== Danh sách truyện đang sáng tác ===[/bold green]\n")
    
    meta_files = list(config.STORIES_DIR.glob("*_meta.json"))
    if not meta_files:
        console.print("[yellow]Chưa có truyện nào được tạo. Dùng lệnh `init` để tạo mới.[/yellow]")
        return
        
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Tên Truyện", style="cyan", width=30)
    table.add_column("UUID / ID", style="yellow")
    table.add_column("Số Chương tối đa", justify="right")
    table.add_column("Nhãn (Tags)", style="green")
    
    for f in meta_files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            table.add_row(
                data.get("name", "Không rõ tên"),
                data.get("uuid", "Không rõ uuid"),
                str(data.get("max_chapters", 10)),
                ", ".join(data.get("tags", []))
            )
        except Exception:
            pass
            
    console.print(table)

def select_story_interactively() -> str:
    """Helper to let user select a story from terminal list."""
    meta_files = list(config.STORIES_DIR.glob("*_meta.json"))
    if not meta_files:
        console.print("[yellow]Chưa có truyện nào được tạo. Dùng lệnh `init` để tạo mới.[/yellow]")
        return ""
        
    console.print("Chọn truyện từ danh sách dưới đây:")
    stories = []
    for idx, f in enumerate(meta_files):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            stories.append((data.get("uuid"), data.get("name")))
            console.print(f" [{idx + 1}] [bold cyan]{data.get('name')}[/bold cyan] (ID: {data.get('uuid')[:8]}...)")
        except Exception:
            pass
            
    choice = IntPrompt.ask("Nhập số thứ tự truyện", choices=[str(i+1) for i in range(len(stories))])
    return stories[choice - 1][0]

def handle_write(args):
    """Command to write next chapter."""
    show_banner()
    
    story_uuid = args.uuid
    if not story_uuid:
        story_uuid = select_story_interactively()
        if not story_uuid:
            return
            
    # Load story meta
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        console.print(f"[bold red]Lỗi: Không tìm thấy truyện có UUID {story_uuid}[/bold red]")
        return
        
    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        console.print(f"[bold red]Lỗi đọc file meta: {e}[/bold red]")
        return
        
    # Load story ledger
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        # Initialize ledger if missing
        ledger_data = {"timeline": [], "unresolved_threads": ["Khởi đầu cốt truyện"]}
    else:
        try:
            ledger_data = json.loads(ledger_path.read_text(encoding="utf-8"))
        except Exception as e:
            console.print(f"[bold red]Lỗi đọc file sổ cái: {e}[/bold red]")
            return
            
    # Determine next chapter number
    chapters_dir = config.get_chapters_dir(story_uuid)
    existing_chapters = list(chapters_dir.glob("chap_*_content.md"))
    
    # Extract numbers from chap_x_content.md
    chap_nums = []
    for c in existing_chapters:
        try:
            # chap_X_content.md -> X
            num = int(c.name.split("_")[1])
            chap_nums.append(num)
        except Exception:
            pass
            
    next_chap_num = max(chap_nums) + 1 if chap_nums else 1
    
    if next_chap_num > meta_data.get("max_chapters", 10):
        console.print(f"[bold yellow]Cảnh báo: Bộ truyện này đã đạt giới hạn tối đa ({meta_data.get('max_chapters')} chương).[/bold yellow]")
        if not Prompt.ask("Bạn vẫn muốn tiếp tục viết chương tiếp theo?", choices=["y", "n"], default="y") == "y":
            return
            
    # Resolve model to use
    selected_model = getattr(args, "model", None) or meta_data.get("model") or os.getenv("GEMINI_MODEL") or "gemini-2.5-flash"
    
    console.print(f"Bắt đầu quy trình sáng tác [bold green]Chương {next_chap_num}[/bold green] của bộ truyện '[bold cyan]{meta_data.get('name')}[/bold cyan]'.")
    console.print(f"Model AI sử dụng: [bold yellow]{selected_model}[/bold yellow]")
    user_idea = Prompt.ask("Nhập ý tưởng sơ bộ của bạn cho chương này")
    
    # Initialize LangGraph input state
    initial_state: AgentState = {
        "story_uuid": story_uuid,
        "chapter_num": next_chap_num,
        "user_idea": user_idea,
        "model": selected_model,
        "meta": meta_data,
        "ledger": ledger_data,
        "analyzed_requirements": "",
        "draft_content": "",
        "revision_feedback": "",
        "auditor_feedback": "",
        "warnings": [],
        "is_done": False
    }
    
    # Run the workflow
    console.print("\n[bold green]>>> ĐANG KHỞI CHẠY LANGGRAPH WORKFLOW... <<<[/bold green]")
    try:
        final_state = app.invoke(initial_state)
        console.print("\n[bold green]🎉 Hoàn thành sáng tác Chương {} thành công![/bold green]".format(next_chap_num))
        
        # Display summary of written chapter
        content_path = config.get_chapter_content_path(story_uuid, next_chap_num)
        if content_path.exists():
            console.print(f"Nội dung chương lưu tại: [bold yellow]{content_path.absolute()}[/bold yellow]")
    except Exception as e:
        console.print(f"\n[bold red]Lỗi trong quá trình chạy LangGraph Workflow: {e}[/bold red]")
        import traceback
        traceback.print_exc()

def handle_ledger(args):
    """Show global ledger details."""
    story_uuid = args.uuid
    if not story_uuid:
        story_uuid = select_story_interactively()
        if not story_uuid:
            return
            
    ledger_path = config.get_ledger_path(story_uuid)
    if not ledger_path.exists():
        console.print("[bold red]Không tìm thấy sổ cái cho truyện này.[/bold red]")
        return
        
    try:
        ledger = json.loads(ledger_path.read_text(encoding="utf-8"))
    except Exception as e:
        console.print(f"[bold red]Lỗi đọc sổ cái: {e}[/bold red]")
        return
        
    show_banner()
    console.print(f"[bold green]=== Sổ Cái Toàn Cục (ID: {story_uuid[:8]}...) ===[/bold green]\n")
    
    # Unresolved threads panel
    threads_text = ""
    for idx, t in enumerate(ledger.get("unresolved_threads", [])):
        threads_text += f"[bold yellow]{idx+1}.[/bold yellow] {t}\n"
    if not threads_text:
        threads_text = "[green]Tất cả các nút thắt đã được giải quyết![/green]"
    console.print(Panel(threads_text.strip(), title="Nút thắt chưa giải quyết", border_style="yellow"))
    
    # Timeline table
    console.print("\n[bold cyan]Tiến trình Cốt truyện (Timeline):[/bold cyan]")
    table = Table(show_header=True, header_style="bold magenta")
    table.add_column("Chương", justify="right", style="dim", width=8)
    table.add_column("Tiêu đề Chương", style="cyan", width=25)
    table.add_column("Tóm tắt nội dung chính", style="white")
    
    for item in ledger.get("timeline", []):
        table.add_row(
            str(item.get("chapter")),
            item.get("title", f"Chương {item.get('chapter')}"),
            item.get("summary", "Không có tóm tắt.")
        )
    console.print(table)

def handle_meta(args):
    """Show metadata of story."""
    story_uuid = args.uuid
    if not story_uuid:
        story_uuid = select_story_interactively()
        if not story_uuid:
            return
            
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        console.print("[bold red]Không tìm thấy cấu hình cho truyện này.[/bold red]")
        return
        
    try:
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        console.print(f"[bold red]Lỗi đọc cấu hình: {e}[/bold red]")
        return
        
    show_banner()
    console.print(f"[bold green]=== Thông tin cấu hình: {meta.get('name')} ===[/bold green]\n")
    console.print(f"  [bold cyan]UUID:[/bold cyan] {meta.get('uuid')}")
    console.print(f"  [bold cyan]Model AI:[/bold cyan] [bold yellow]{meta.get('model', 'gemini-2.5-flash')}[/bold yellow]")
    console.print(f"  [bold cyan]Bối cảnh:[/bold cyan] {meta.get('context')}")
    console.print(f"  [bold cyan]Phong cách kể chuyện:[/bold cyan] {meta.get('style')}")
    console.print(f"  [bold cyan]Nhãn (Tags):[/bold cyan] {', '.join(meta.get('tags', []))}")
    console.print(f"  [bold cyan]Chương tối đa:[/bold cyan] {meta.get('max_chapters')}")
    console.print(f"  [bold cyan]Số từ giới hạn/chương:[/bold cyan] {meta.get('max_words_per_chapter')}")
    
    console.print("\n[bold yellow]Danh sách nhân vật:[/bold yellow]")
    for char in meta.get("characters", []):
        console.print(f"  - [bold green]{char.get('name')}[/bold green] ({char.get('role')}): {char.get('description')}")

def handle_set_model(args):
    """Command to change the AI model of a story."""
    show_banner()
    console.print("[bold green]=== Thay đổi model AI của truyện ===[/bold green]\n")
    
    story_uuid = args.uuid
    if not story_uuid:
        story_uuid = select_story_interactively()
        if not story_uuid:
            return
            
    meta_path = config.get_meta_path(story_uuid)
    if not meta_path.exists():
        console.print(f"[bold red]Lỗi: Không tìm thấy cấu hình truyện có UUID {story_uuid}[/bold red]")
        return
        
    try:
        meta_data = json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        console.print(f"[bold red]Lỗi đọc file cấu hình: {e}[/bold red]")
        return
        
    current_model = meta_data.get("model", "gemini-2.5-flash")
    console.print(f"Truyện hiện tại: [bold cyan]{meta_data.get('name')}[/bold cyan]")
    console.print(f"Model hiện tại: [bold yellow]{current_model}[/bold yellow]\n")
    
    model_name = args.model
    if not model_name:
        console.print("[bold yellow]Chọn model AI mới:[/bold yellow]")
        console.print(" 1. [bold cyan]gemini-2.5-flash[/bold cyan]")
        console.print(" 2. [bold cyan]gemini-1.5-flash[/bold cyan]")
        console.print(" 3. [bold cyan]gemini-1.5-pro[/bold cyan]")
        console.print(" 4. [bold cyan]gemini-2.0-flash[/bold cyan]")
        console.print(" 5. [bold cyan]gemini-2.5-pro[/bold cyan]")
        console.print(" 6. [bold cyan]Khác[/bold cyan] (Nhập thủ công)")
        
        model_choice = Prompt.ask("Chọn số thứ tự model", choices=["1", "2", "3", "4", "5", "6"], default="1")
        if model_choice == "1":
            model_name = "gemini-2.5-flash"
        elif model_choice == "2":
            model_name = "gemini-1.5-flash"
        elif model_choice == "3":
            model_name = "gemini-1.5-pro"
        elif model_choice == "4":
            model_name = "gemini-2.0-flash"
        elif model_choice == "5":
            model_name = "gemini-2.5-pro"
        else:
            model_name = Prompt.ask("Nhập tên model AI mong muốn")
            
    if not model_name or not model_name.strip():
        console.print("[yellow]Bỏ qua thay đổi model.[/yellow]")
        return
        
    # Update model in metadata
    meta_data["model"] = model_name.strip()
    
    try:
        # Validate through StoryMeta Pydantic model
        story_meta = models.StoryMeta(**meta_data)
        meta_path.write_text(story_meta.model_dump_json(indent=2), encoding="utf-8")
        console.print(f"\n[bold green]✓ Cập nhật model thành công![/bold green]")
        console.print(f"Model mới cho truyện là: [bold yellow]{story_meta.model}[/bold yellow]")
    except Exception as e:
        console.print(f"[bold red]Lỗi khi ghi file cấu hình mới: {e}[/bold red]")

def handle_serve(args):
    """Command to run the Flask API & Socket.IO server."""
    from src.api.app import app as flask_app, socketio
    console.print(f"[bold green]=== Khởi chạy Flask & Socket.IO server ===[/bold green]")
    console.print(f"Địa chỉ: [bold yellow]http://{args.host}:{args.port}[/bold yellow]")
    console.print(f"Phục vụ APIs và kết nối Socket.IO thời gian thực...")
    socketio.run(flask_app, host=args.host, port=args.port, debug=False, allow_unsafe_werkzeug=True)

def main():
    check_env()
    
    parser = argparse.ArgumentParser(description="Trợ lý Sáng tác Truyện dài kỳ sử dụng LangGraph & Gemini")
    subparsers = parser.add_subparsers(dest="command", help="Các lệnh chức năng")
    
    # init
    subparsers.add_parser("init", help="Khởi tạo một truyện dài kỳ mới")
    
    # list
    subparsers.add_parser("list", help="Liệt kê toàn bộ các truyện đang sáng tác")
    
    # write
    write_parser = subparsers.add_parser("write", help="Sáng tác chương tiếp theo của truyện")
    write_parser.add_argument("--uuid", type=str, help="UUID của truyện cần viết")
    write_parser.add_argument("--model", type=str, help="Model AI sử dụng (ví dụ: gemini-1.5-flash, gemini-1.5-pro)")
    
    # ledger
    ledger_parser = subparsers.add_parser("ledger", help="Xem sổ cái cốt truyện (timeline & các nút thắt)")
    ledger_parser.add_argument("--uuid", type=str, help="UUID của truyện")
    
    # meta
    meta_parser = subparsers.add_parser("meta", help="Xem thông tin chi tiết cấu hình truyện")
    meta_parser.add_argument("--uuid", type=str, help="UUID của truyện")
    
    # set-model
    set_model_parser = subparsers.add_parser("set-model", help="Thay đổi model AI của truyện")
    set_model_parser.add_argument("--uuid", type=str, help="UUID của truyện")
    set_model_parser.add_argument("--model", type=str, help="Tên model AI mới")

    # serve
    serve_parser = subparsers.add_parser("serve", help="Khởi chạy Flask API & Socket.IO server")
    serve_parser.add_argument("--port", type=int, default=5000, help="Cổng chạy server (mặc định: 5000)")
    serve_parser.add_argument("--host", type=str, default="127.0.0.1", help="Địa chỉ host (mặc định: 127.0.0.1)")
    
    args = parser.parse_args()
    
    if args.command == "init":
        handle_init(args)
    elif args.command == "list":
        handle_list(args)
    elif args.command == "write":
        handle_write(args)
    elif args.command == "ledger":
        handle_ledger(args)
    elif args.command == "meta":
        handle_meta(args)
    elif args.command == "set-model":
        handle_set_model(args)
    elif args.command == "serve":
        handle_serve(args)
    else:
        # Default behavior: list and write
        show_banner()
        parser.print_help()

if __name__ == "__main__":
    main()
