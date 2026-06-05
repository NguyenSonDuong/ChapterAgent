# Trợ lý Sáng tác Truyện dài kỳ (Serial Novel Agent) với LangGraph & Gemini

Hệ thống trợ lý sáng tác truyện dài kỳ (chương hồi) sử dụng **LangGraph** để xây dựng quy trình sáng tác nhiều bước (multi-step workflow) kết hợp sự phản hồi của con người (Human-in-the-loop) và mô hình ngôn ngữ lớn **Google Gemini** nhằm đảm bảo chất lượng văn phong, tính liên tục và tính nhất quán logic của toàn bộ tác phẩm.

Dự án hỗ trợ cả hai chế độ tương tác: chạy dòng lệnh truyền thống (**CLI**) và cung cấp dịch vụ giao tiếp qua **REST API & Socket.IO** thời gian thực để kết nối với ReactJS frontend.

---

## 📌 Mục đích dự án

Khi viết một bộ truyện dài kỳ (ví dụ: tiểu thuyết mạng, truyện chữ nhiều chương), tác giả thường gặp phải các vấn đề lớn:
1. **Thiếu nhất quán logic:** Quên mất chi tiết ở các chương trước (ví dụ: nhân vật ở chương 2 đã mất kiếm nhưng chương 5 lại rút kiếm chiến đấu; nhân vật đã đi xa nhưng chương sau bỗng xuất hiện trong thành mà không có dẫn dắt).
2. **Quản lý cốt truyện phức tạp:** Khó theo dõi các mối nối, bí ẩn, hoặc nút thắt cốt truyện chưa được giải quyết (*unresolved threads*).
3. **Mất kiểm soát văn phong:** AI viết truyện thường dễ bị lạc tông giọng (*style/tone*) hoặc viết quá chung chung, thiếu miêu tả nội tâm sâu sắc.

Dự án này được thiết kế để giải quyết những thách thức trên bằng cách cung cấp một quy trình sáng tác khép kín:
* **Phân tích ý tưởng chủ động:** Phân tích ý tưởng của tác giả, tự động hỏi lại nếu thiếu thông tin cốt lõi để hoàn thiện đề cương chi tiết cho chương.
* **Biên tập & Chỉnh sửa tương tác:** Lưu bản nháp vào file tạm hoặc gửi qua Socket.IO để tác giả tự do chỉnh sửa và đưa phản hồi lặp đi lặp lại cho đến khi ưng ý.
* **Kiểm duyệt logic nghiêm ngặt (Audit):** Đối chiếu bản viết với sổ cái toàn cục và trạng thái chương trước để đưa ra cảnh báo mâu thuẫn cốt truyện.
* **Tự động hóa quản lý trạng thái:** Tự động trích xuất tóm tắt chương, cập nhật trạng thái nhân vật (vị trí, hành trang, sức khỏe), phát hiện nhân vật mới và cập nhật sổ cái câu chuyện.

---

## 📂 Cấu trúc thư mục dự án

```text
ChapterAgent/
├── main.py               # Giao diện dòng lệnh (CLI) tương tác chính với tác giả
├── requirements.txt      # Khai báo các thư viện phụ thuộc của dự án
├── src/                  # Thư mục chứa mã nguồn chính (Modularized)
│   ├── __init__.py
│   ├── core/             # Cấu hình hệ thống và trạng thái dùng chung
│   │   ├── __init__.py
│   │   ├── config.py     # Quản lý đường dẫn file/thư mục và cấu hình hệ thống
│   │   └── state.py      # Định nghĩa AgentState (trạng thái truyền trong LangGraph)
│   ├── models/           # Định nghĩa cấu trúc dữ liệu Pydantic
│   │   ├── __init__.py
│   │   └── story.py      # Định nghĩa các mô hình CharacterInfo, StoryMeta, GlobalLedger, ChapterState
│   ├── agent/            # Xử lý luồng đi và các Node trong đồ thị LangGraph
│   │   ├── __init__.py
│   │   ├── nodes.py      # Logic xử lý tại các Nodes (Tích hợp CLI và Socket.IO)
│   │   └── graph.py      # Sơ đồ và biên dịch StateGraph
│   ├── api/              # Module chứa API Web server (Flask + Socket.IO)
│   │   ├── __init__.py
│   │   └── app.py        # Định nghĩa các API endpoints và Socket.IO event handlers
│   └── utils/            # Các tiện ích bổ trợ dùng chung
│       ├── __init__.py
│       ├── llm.py        # Quản lý gọi LLM, xử lý lỗi API và tự động thử lại (retry)
│       ├── helpers.py    # Các hàm trợ giúp chuyển đổi kiểu dữ liệu
│       ├── session_manager.py # Quản lý các phiên chạy ngầm LangGraph bất đồng bộ
│       └── socket_emitter.py  # Helper phát Socket.IO events tránh import vòng
└── stories/              # Thư mục chứa dữ liệu các bộ truyện đang sáng tác
    └── <story_uuid>/     # Thư mục cụ thể của từng bộ truyện (định danh bằng UUID)
        ├── <uuid>_meta.json            # Cấu hình bối cảnh, nhân vật chính, phong cách...
        ├── <uuid>_global_ledger.json   # Sổ cái toàn cục (timeline, nút thắt chưa giải quyết)
        ├── chapters/                   # Lưu nội dung truyện của các chương
        │   ├── chap_1_content.md
        │   └── chap_2_content.md
        └── states/                     # Lưu chi tiết trạng thái logic của từng chương
            ├── chap_1_state.md
            └── chap_2_state.md
```

---

## ⚙️ Quy trình hoạt động (Workflow)

Hệ thống hoạt động theo một đồ thị trạng thái có hướng và rẽ nhánh điều kiện được xây dựng trên LangGraph:

```mermaid
graph TD
    Start([Bắt đầu sáng tác chương mới]) --> Node1[Requirement Analyzer<br>Phân tích & Tương tác làm rõ ý tưởng]
    Node1 --> Node2[Story Drafter<br>Viết bản nháp chương dạng Markdown]
    Node2 --> Node3[Human Review<br>Lưu file temp_draft.md để tác giả duyệt]
    Node3 --> Cond{Tác giả gõ 'Done'?}
    Cond -- Không (Nhập ý kiến chỉnh sửa) --> Node3_1[Reviser<br>Chỉnh sửa bản nháp theo yêu cầu]
    Node3_1 --> Node3
    Cond -- Có ('Done') --> Node4[Auditor<br>Kiểm duyệt logic & tính nhất quán]
    Node4 --> Node5[State & Ledger Updater<br>Trích xuất trạng thái, lưu file & cập nhật sổ cái]
    Node5 --> End([Hoàn thành chương])
```

---

## 🌐 Danh sách REST APIs & Sự kiện Socket.IO

Dịch vụ Web Flask chạy mặc định trên cổng `5000` phục vụ giao diện ReactJS.

### 1. REST API Endpoints (CRUD)

| Phương thức | Đường dẫn API | Chức năng |
| :--- | :--- | :--- |
| **GET** | `/api/stories` | Lấy danh sách các truyện hiện có |
| **GET** | `/api/stories/<uuid>` | Lấy chi tiết thông tin cấu hình truyện (`meta`) |
| **POST** | `/api/stories` | Tạo mới một câu chuyện |
| **PUT** | `/api/stories/<uuid>` | Cập nhật thông tin cấu hình truyện |
| **GET** | `/api/stories/<uuid>/ledger` | Xem sổ cái cốt truyện (`timeline` & nút thắt) |
| **PUT** | `/api/stories/<uuid>/ledger` | Cập nhật sổ cái thủ công |
| **GET** | `/api/stories/<uuid>/chapters` | Liệt kê các chương và trạng thái file của chúng |
| **GET** | `/api/stories/<uuid>/chapters/<num>`| Xem nội dung (`content`) và trạng thái (`state`) chương |
| **PUT** | `/api/stories/<uuid>/chapters/<num>`| Lưu thay đổi thủ công nội dung chương |
| **DELETE**| `/api/stories/<uuid>/chapters/<num>`| Xóa chương khỏi ổ đĩa và cập nhật timeline sổ cái |
| **POST** | `/api/stories/<uuid>/chapters/generate`| Kích hoạt tiến trình sáng tác chương tiếp theo trong background thread |

### 2. Sự kiện Socket.IO (Real-time Events)

Hỗ trợ đồng bộ hóa dữ liệu hai chiều bất đồng bộ khi đang chạy LangGraph:

* **Server phát đi (Emits):**
  * `agent_status`: Gửi tiến trình hiện tại. Data: `{ story_uuid, chapter_num, status, message }`
    * Các trạng thái (`status`): `analyzing_requirements`, `drafting`, `waiting_review`, `revising`, `auditing`, `updating`, `completed`, `error`.
  * `clarify_requirements`: Yêu cầu làm rõ ý tưởng khi phát hiện thiếu thông tin. Data: `{ story_uuid, chapter_num, questions: [] }`
  * `draft_review_needed`: Gửi bản viết nháp để tác giả duyệt và nhận ý kiến đóng góp. Data: `{ story_uuid, chapter_num, draft_content }`
  * `audit_warnings`: Gửi các cảnh báo logic phát hiện được sau bước kiểm duyệt. Data: `{ story_uuid, chapter_num, warnings: [], feedback }`

* **Client gửi lên (Listens):**
  * `submit_clarification`: Gửi câu trả lời làm rõ yêu cầu. Data: `{ story_uuid, answers }`
  * `submit_review_feedback`: Gửi nhận xét sửa đổi nháp truyện (hoặc gửi từ khóa `"Done"` để đồng ý đi tiếp). Data: `{ story_uuid, feedback }`

---

## 🚀 Hướng dẫn Cài đặt & Sử dụng

### 1. Chuẩn bị môi trường
Yêu cầu hệ thống đã cài đặt Python (phiên bản khuyến nghị từ 3.10 trở lên).

Cài đặt các thư viện phụ thuộc vào môi trường ảo `.venv`:
```bash
# Tạo môi trường ảo (nếu chưa có)
python -m venv .venv
# Hoặc dùng uv:
uv venv

# Cài đặt thư viện phụ thuộc
.\.venv\Scripts\pip install -r requirements.txt
# Hoặc dùng uv:
uv pip install -r requirements.txt
```

### 2. Thiết lập cấu hình
Tạo file `.env` tại thư mục gốc của dự án và điền khóa API Gemini của bạn:
```env
GOOGLE_API_KEY=your_gemini_api_key_here
```

### 3. Các lệnh chạy chính (sử dụng Python trong `.venv`)

* **Khởi chạy Flask Web API & Socket.IO server (Dành cho giao diện ReactJS):**
  ```powershell
  .\.venv\Scripts\python.exe main.exe serve --port 5000
  # Hoặc:
  .\.venv\Scripts\python.exe main.py serve --port 5000 --host 127.0.0.1
  ```

* **Khởi tạo truyện mới (Dòng lệnh CLI):**
  ```powershell
  .\.venv\Scripts\python.exe main.py init
  ```

* **Sáng tác chương tiếp theo (Dòng lệnh CLI):**
  ```powershell
  .\.venv\Scripts\python.exe main.py write
  ```

* **Xem sổ cái của truyện (Dòng lệnh CLI):**
  ```powershell
  .\.venv\Scripts\python.exe main.py ledger
  ```

* **Thay đổi model AI sử dụng cho truyện (Dòng lệnh CLI):**
  ```powershell
  .\.venv\Scripts\python.exe main.py set-model
  ```
