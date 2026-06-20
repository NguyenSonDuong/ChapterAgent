Dựa trên danh sách các nút thắt chưa giải quyết cũ (mỗi nút thắt có nội dung "thread" và chương xuất hiện "chapter"):
{old_threads_markdown}

Các nút thắt vừa được giải quyết trong chương {chapter_num} mới này:
{threads_resolved_markdown}

Các nút thắt mới được giới thiệu trong chương {chapter_num} này:
{threads_introduced_markdown}

Hãy cập nhật danh sách các nút thắt chưa giải quyết:
1. Loại bỏ những nút thắt cũ đã được giải quyết ở chương này hoặc không còn phù hợp.
2. Giữ lại các nút thắt cũ chưa được giải quyết và GIỮ NGUYÊN chương xuất hiện ban đầu của chúng (không thay đổi "chapter" của chúng).
3. Thêm các nút thắt mới được giới thiệu trong chương này với chương xuất hiện "chapter" là {chapter_num}.

Trả về mảng JSON chứa các đối tượng có thuộc tính "thread" và "chapter" (số nguyên hoặc null) dưới dạng:
[
  {"thread": "nội dung nút thắt", "chapter": {chapter_num}},
  ...
]
Chỉ trả về JSON, không thêm bất kỳ văn bản giải thích hay markdown code block nào.
