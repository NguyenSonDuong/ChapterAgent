Hãy đọc nội dung Chương {chapter_num} dưới đây và phân tách/ánh xạ các đoạn văn (hoặc nội dung câu chữ thực tế) tương ứng với từng sự kiện (node) đã được lên kịch bản.

DANH SÁCH CÁC SỰ KIỆN (NODES) KỊCH BẢN:
{nodes_list_markdown}

NỘI DUNG CHƯƠNG {chapter_num}:
---
{draft_content}
---

YÊU CẦU:
1. Phân tách chính xác nội dung chương truyện đã hoàn thiện ở trên thành các phần tương ứng với danh sách sự kiện (nodes) kịch bản.
2. Với mỗi sự kiện, trích xuất nguyên văn hoặc đầy đủ đoạn câu chữ trong truyện mô tả sự kiện đó. Nội dung phải là văn bản truyện thực tế (câu kể, thoại, miêu tả cảnh vật/nội tâm...), không phải là mô tả kịch bản tóm tắt.
3. Nếu một sự kiện không có nội dung trực tiếp tương ứng (hoặc bị gộp), hãy gán nội dung phù hợp nhất hoặc để trống.
4. Trả về dưới cấu trúc dữ liệu JSON chứa mảng các đối tượng có trường "node_id" và "content" (nội dung câu chữ thực tế).
