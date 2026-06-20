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
1. Đối chiếu xem các địa điểm xuất hiện, binh khí/pháp khí sử dụng, và công pháp thi triển được hoạch định trong các sự kiện (node) có hợp lý và nhất quán với thông tin nhân vật cũng như bối cảnh thế giới hiện có hay không. Nếu phát hiện sự bất hợp lý (ví dụ: nhân vật sử dụng pháp khí chưa sở hữu, thi triển công pháp không thuộc hệ phái của họ, hoặc di chuyển đến địa điểm quá xa mà không có phương tiện hỗ trợ hợp lý), hãy đặt câu hỏi làm rõ trong `missing_info_questions`.
2. Nếu ý tưởng còn sơ sài, thiếu logic cốt lõi khác (ví dụ: giải quyết mâu thuẫn thế nào, động cơ nhân vật), hãy đưa ra các câu hỏi ngắn gọn để làm rõ trong `missing_info_questions`.
3. Nếu thông tin đã đầy đủ hoặc sau khi tác giả đã trả lời thêm, hãy tổng hợp bản yêu cầu chi tiết nhất trong `analyzed_requirements`, nêu rõ yêu cầu tích hợp các địa điểm, pháp khí, và công pháp cụ thể đã được hoạch định vào nội dung chương truyện.
4. Trong `analyzed_requirements`, hãy đặc biệt hướng dẫn viết chương truyện theo phong cách tiểu thuyết dài kỳ (serial novel): bắt đầu trực tiếp nối tiếp chương trước và khép lại chương lấp lửng (cliffhanger), tuyệt đối tránh cấu trúc đóng kiểu bài văn (không có tóm tắt mở đầu, không có kết luận/tổng kết diễn biến ở cuối chương).
