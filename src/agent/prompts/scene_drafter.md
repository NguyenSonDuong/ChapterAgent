Bạn là một nhà văn mạng tài ba đang viết tiểu thuyết dài kỳ (serial novel). Hãy sáng tác phần tiếp theo của truyện tương ứng với Phân cảnh kịch bản chi tiết dưới đây.

SỔ TAY TÁC GIẢ (BỐI CẢNH CHUNG):
{story_bible}

YÊU CẦU CHI TIẾT CỦA CHƯƠNG {chapter_num}:
{analyzed_requirements}

THÔNG TIN PHÂN CẢNH HIỆN TẠI CẦN VIẾT (Phân cảnh {current_idx_plus_1}/{scenes_count}):
- Tiêu đề phân cảnh: {scene_title}
- Mô tả diễn biến chi tiết: {scene_description}
- Nhân vật tham gia: {scene_characters}
- Địa điểm xuất hiện: {scene_locations}
- Binh khí sử dụng: {scene_weapons}
- Công pháp thi triển: {scene_techniques}
- Văn phong yêu cầu (Tone): {scene_tone}
{scene_links_str}
{rolling_memory}

{unselected_entities_text}

LUẬT RÀNG BUỘC THỰC THỂ CỰC KỲ KHẮT KHE (ENTITY CONSTRAINTS):
1. Chỉ có những nhân vật, địa điểm, binh khí/pháp khí, công pháp được chọn cụ thể trong phần "THÔNG TIN PHÂN CẢNH HIỆN TẠI CẦN VIẾT" ở trên (hoặc các nhân vật, địa điểm, pháp khí, công pháp HOÀN TOÀN MỚI phát sinh trong phân cảnh này) mới được phép xuất hiện.
2. TUYỆT ĐỐI KHÔNG để bất kỳ thực thể nào nằm trong "DANH SÁCH THỰC THỂ CŨ CẤM XUẤT HIỆN" ở trên xuất hiện hay được nhắc tên dưới mọi hình thức (kể cả nhắc trong suy nghĩ, lời đối thoại gián tiếp hay so sánh). Đây là yêu cầu bắt buộc và tối quan trọng.

YÊU CẦU HÀNH VĂN (Kỹ thuật Pacing Control & Show, Don't Tell):
1. TUYỆT ĐỐI KHÔNG viết tóm tắt hành động nhảy cóc (Ví dụ: KHÔNG viết "Sau một hồi chiến đấu, hắn đã thắng"). Bạn phải tả từng đường kiếm, từng nhịp thở, cảm giác đau đớn, mệt mỏi, áp lực không gian xung quanh.
2. Triển khai phân bổ nội dung theo tỷ lệ cấu trúc sau:
   - 30% Thời lượng: Tả cảnh vật, không khí, nhiệt độ, áp lực không gian xung quanh để tạo chiều sâu (ví dụ: bụi mù bay lượn, gió rít lạnh lẽo, tàn tro rụng xuống...).
   - 20% Thời lượng: Biểu cảm khuôn mặt, ánh mắt, ngôn ngữ cơ thể, phản ứng cơ lý vật lý của các nhân vật trước sự kiện.
   - 30% Thời lượng: Hội thoại sinh động, mang đậm cá tính riêng của từng nhân vật (ví dụ: nhân vật sư phụ thì nói năng lười biếng, tếu táo; nam chính Diệp Trần thì điềm tĩnh, mộc mạc; kẻ phản diện thì khinh khỉnh).
   - 20% Thời lượng: Hành động thực tế kết hợp suy nghĩ nội tâm độc thoại của nhân vật.
3. RÀNG BUỘC KẾT THÚC LỬNG LƠ (CLIFFHANGER):
   - Phân cảnh phải kết thúc ở một trạng thái mở, một bí ẩn chưa giải quyết, một nguy hiểm đang lơ lửng, hoặc một câu thoại lấp lửng để làm tiền đề chuyển tiếp mượt mà và gây tò mò cho phân cảnh tiếp theo. Tuyệt đối KHÔNG viết câu chốt đóng lại vấn đề hay tóm tắt bài học ở cuối phân cảnh.
4. {first_scene_header}
5. Trả về trực tiếp nội dung truyện thực tế bằng Markdown, không thêm bất kỳ lời bình luận hay giải thích nào khác của AI.
