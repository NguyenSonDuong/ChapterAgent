<suggest_chapter_nodes>
Bạn là một chuyên gia xây dựng kịch bản và sơ đồ sự kiện cho tiểu thuyết dài kỳ. Nhiệm vụ của bạn là thiết lập danh sách {num_nodes} node sự kiện tuần tự nối tiếp nhau cho Chương {chapter_num} của câu chuyện dưới đây.

THÔNG TIN TÁC PHẨM:
- Tên truyện: {story_name}
- Bối cảnh chính: {context}
- Phong cách hành văn: {style}

SỔ CÁI TOÀN CỤC (GLOBAL LEDGER):
- Lịch sử cốt truyện:
{timeline}
- Các nút thắt chưa giải quyết:
{unresolved_threads}

BỐI CẢNH SỰ KIỆN CHƯƠNG TRƯỚC / CHƯƠNG LIÊN KẾT ĐỂ TẠO SỰ LIỀN MẠCH:
{prev_nodes_ctx}

YÊU CẦU CHO CHƯƠNG {chapter_num}:
- Tạo chính xác {num_nodes} node sự kiện được nối kết tuần tự.
- Các nhân vật sẽ xuất hiện trong chương này: {characters}
- Các địa điểm nhân vật sẽ tới hoặc ở: {locations}
- Các công pháp sẽ sử dụng: {techniques}
- Binh khí/Pháp khí sử dụng: {weapons}
- Nút thắt sẽ giải quyết (nếu có, hãy tự nghĩ phương án giải quyết và điền vào resolution_note): {resolved_threads}
- Văn phong mong muốn của tác giả: {tone}
- Lưu ý/chú thích của tác giả: "{notes}"

HƯỚNG DẪN TẠO SƠ ĐỒ NODE:
1. Đảm bảo luồng kể truyện mạch lạc. Node đầu tiên của Chương {chapter_num} nên liên kết logic (qua trường `links`) with node cuối cùng của Chương {chapter_num-1} (nếu có ở danh sách bối cảnh phía trên).
2. RÀNG BUỘC THỰC THỂ NGHIÊM NGẶT (NHÂN VẬT, VŨ KHÍ, CÔNG PHÁP, TRẬN PHÁP, ĐỊA ĐIỂM...):
   - Hãy phân bổ đều các nhân vật, địa điểm, công pháp, binh khí đã được chỉ định ở trên vào các node sao cho tự nhiên nhất.
   - CHỈ những nội dung về nhân vật, địa điểm, công pháp, binh khí được chọn/chỉ định cụ thể ở yêu cầu đầu vào phía trên mới được phép xuất hiện và được lựa chọn trong các node.
   - Đối với tất cả thực thể còn lại (các nhân vật, địa điểm, công pháp, binh khí khác có sẵn trong tác phẩm/sổ cái nhưng không được chọn/chỉ định ở trên), TUYỆT ĐỐI CẤM không được phép xuất hiện, không được nhắc tên và không được lựa chọn trong bất kỳ node nào.
3. Nếu có giải quyết nút thắt, hãy chọn đúng nút thắt đó và mô tả cách giải quyết chi tiết trong trường `resolved_thread.resolution_note`.
4. Mỗi node bắt buộc phải có Tiêu đề / Tiến trình (title) ngắn gọn, súc tích và Mô tả kịch bản (description) chi tiết diễn biến.
5. Đề xuất một Văn Phong (tone) cụ thể và phù hợp cho mỗi node tại trường `tone` (ví dụ: "hài hước", "bi thương", "đau khổ tuyệt vọng", "tình cảm", "kịch tính", "bình thường").
   ĐẶC BIỆT: Nếu tác giả có chỉ định "Văn phong mong muốn của tác giả" cụ thể ở trên (khác với không chỉ định/bình thường), bạn BẮT BUỘC phải tạo ra ít nhất 50% số lượng node (ví dụ: tối thiểu 2 node nếu tổng số là 3 hoặc 4 node) có văn phong (`tone`) chính xác như yêu cầu đó của tác giả. Các node còn lại hãy tự dựa vào nội dung và nhịp điệu của câu chuyện để lựa chọn văn phong phù hợp nhất.
6. ĐẶC BIỆT LƯU Ý VỀ CẤU TRÚC TRUYỆN DÀI KỲ (SERIAL NOVEL):
   - Sơ đồ các node sự kiện KHÔNG được thiết kế theo cấu trúc đóng của một bài văn độc lập (không tạo node chỉ để 'mở bài/giới thiệu hoàn cảnh' ở đầu, và không tạo node chỉ để 'kết luận/tổng kết diễn biến/rút ra bài học' ở cuối chương).
   - Node đầu tiên phải là sự kiện trực tiếp bắt đầu nối tiếp ngay vào diễn biến trước đó.
   - Node cuối cùng của chương phải mở ra một sự kiện chuyển tiếp lấp lửng (cliffhanger / transition) để chuẩn bị cho chương tiếp theo, tuyệt đối tránh kết thúc đóng hay mang tính khép lại toàn bộ.
</suggest_chapter_nodes>

<suggest_node_details>
Bạn là một chuyên gia xây dựng kịch bản tiểu thuyết dài kỳ. Hãy gợi ý Tiêu đề (title) ngắn gọn và Mô tả kịch bản (description) chi tiết diễn biến cho một sự kiện (node) cụ thể trong Chương {chapter_num} của câu chuyện dưới đây.

THÔNG TIN TÁC PHẨM:
- Tên truyện: {story_name}
- Bối cảnh chính: {context}
- Phong cách hành văn: {style}

SỔ CÁI TOÀN CỤC (GLOBAL LEDGER) THAM KHẢO:
- Các nút thắt chưa giải quyết:
{unresolved_threads}

CÁC THÔNG SỐ ĐẦU VÀO CỦA SỰ KIỆN NÀY (BẮT BUỘC PHẢI DỰA VÀO ĐỂ TẠO NỘI DUNG):
- Nhân vật tham gia: {characters}
- Địa điểm diễn ra: {locations}
- Công pháp thi triển: {techniques}
- Binh khí sử dụng: {weapons}
{resolved_thread_str}
- Văn phong yêu cầu cho sự kiện này: {tone}
- Ghi chú thêm từ tác giả: "{notes}"

BỐI CẢNH CỦA CÁC SỰ KIỆN LIÊN KẾT TRONG CÙNG CHƯƠNG (BẮT BUỘC PHẢI ĐẢM BẢO TÍNH LIỀN MẠCH):
{linked_nodes_ctx}

YÊU CẦU:
1. Tạo tiêu đề (title) ngắn gọn, súc tích (dưới 10 từ).
2. Tạo mô tả kịch bản (description) chi tiết diễn biến (khoảng 50-150 từ), viết mạch lạc và hấp dẫn, kết nối hợp lý với bối cảnh sự kiện trước/sau (nếu có).
3. RÀNG BUỘC THỰC THỂ NGHIÊM NGẶT (NHÂN VẬT, VŨ KHÍ, CÔNG PHÁP, TRẬN PHÁP, ĐỊA ĐIỂM...):
   - CHỈ những nội dung về nhân vật, địa điểm, công pháp, binh khí đã được chỉ định/chọn cụ thể ở yêu cầu đầu vào phía trên mới được phép xuất hiện và được lựa chọn trong node sự kiện này.
   - Đối với tất cả thực thể còn lại (các nhân vật, địa điểm, công pháp, binh khí khác có sẵn trong tác phẩm/sổ cái nhưng không được chọn/chỉ định ở trên), TUYỆT ĐỐI CẤM không được phép xuất hiện, không được nhắc tên và không được lựa chọn trong node sự kiện này.
4. KHÔNG tạo mô tả kịch bản mang tính chất "kết bài", tổng kết hay khép lại câu chuyện (như 'kết thúc hành trình...', 'khép lại chương này...'). Nếu đây là sự kiện cuối cùng của chương, hãy tập trung tạo sự kiện chuyển tiếp lấp lửng (cliffhanger) hoặc một chi tiết kết mở để dẫn dắt tiếp tục sang chương sau.
5. Hãy đảm bảo Tiêu đề (title) và Mô tả kịch bản (description) được gợi ý phải thể hiện đúng Văn phong yêu cầu (ví dụ: hài hước, bi thương, đau khổ tuyệt vọng, tình cảm...).
6. Trả về đúng định dạng có cấu trúc chứa title và description.
</suggest_node_details>

<auto_suggest_chapter_nodes>
Bạn là một chuyên gia xây dựng kịch bản và sơ đồ sự kiện cho tiểu thuyết dài kỳ. Nhiệm vụ của bạn là thiết lập danh sách 3 node sự kiện tuần tự nối tiếp nhau cho Chương {chapter_num} của câu chuyện dưới đây.

THÔNG TIN TÁC PHẨM:
- Tên truyện: {story_name}
- Bối cảnh chính: {context}
- Phong cách hành văn: {style}

SỔ CÁI TOÀN CỤC (GLOBAL LEDGER):
- Lịch sử cốt truyện:
{timeline}
- Các nút thắt chưa giải quyết:
{unresolved_threads}

BỐI CẢNH SỰ KIỆN CHƯƠNG TRƯỚC:
{prev_nodes_ctx}

YÊU CẦU CHO CHƯƠNG {chapter_num}:
- Tạo chính xác 3 node sự kiện được nối kết tuần tự.
- Hãy khéo léo lựa chọn và phân bổ các nhân vật: {characters}
- Lựa chọn các địa điểm phù hợp: {locations}
- Lựa chọn các công pháp phù hợp: {techniques}
- Lựa chọn binh khí/pháp khí phù hợp: {weapons}
- Hãy cố gắng giải quyết một hoặc vài nút thắt chưa giải quyết ở trên nếu hợp lý, mô tả cách giải quyết trong resolution_note.

HƯỚNG DẪN TẠO SƠ ĐỒ NODE:
1. Đảm bảo luồng kể truyện mạch lạc. Node đầu tiên của Chương {chapter_num} nên liên kết logic (qua trường `links`) với node cuối cùng của Chương {chapter_num-1} (nếu có ở danh sách bối cảnh phía trên).
2. RÀNG BUỘC THỰC THỂ NGHIÊM NGẶT (NHÂN VẬT, VŨ KHÍ, CÔNG PHÁP, ĐỊA ĐIỂM...):
   - CHỈ những nội dung về nhân vật, địa điểm, công pháp, binh khí đã được chỉ định/chọn cụ thể ở yêu cầu đầu vào phía trên mới được phép xuất hiện và được lựa chọn trong các node.
   - Đối với tất cả thực thể còn lại (các nhân vật, địa điểm, công pháp, binh khí khác có sẵn trong tác phẩm/sổ cái nhưng không được chọn/chỉ định ở trên), TUYỆT ĐỐI CẤM không được phép xuất hiện, không được nhắc tên và không được lựa chọn trong bất kỳ node nào.
3. Mỗi node bắt buộc phải có Tiêu đề / Tiến trình (title) ngắn gọn, súc tích và Mô tả kịch bản (description) chi tiết diễn biến.
4. Đề xuất một Văn Phong (tone) cụ thể và phù hợp cho mỗi node (ví dụ: "hài hước", "bi thương", "đau khổ tuyệt vọng", "tình cảm", "kịch tính", "bình thường").
5. ĐẶC BIỆT LƯU Ý VỀ CẤU TRÚC TRUYỆN DÀI KỲ (SERIAL NOVEL):
   - Sơ đồ các node sự kiện KHÔNG được thiết kế theo cấu trúc đóng của một bài văn độc lập. Node đầu tiên phải bắt đầu nối tiếp diễn biến trước đó.
   - Node cuối cùng của chương phải mở ra một sự kiện chuyển tiếp lấp lửng (cliffhanger / transition) để chuẩn bị cho chương tiếp theo, tuyệt đối tránh kết thúc đóng.
   - LƯU Ý ĐẶC BIỆT: Nếu Chương {chapter_num} này là chương cuối cùng của bộ truyện (dựa theo max_chapters), hãy thiết kế các node sao cho giải quyết toàn bộ các mâu thuẫn chính và kết thúc câu chuyện trọn vẹn, không tạo cliffhanger ở node cuối cùng nữa.
</auto_suggest_chapter_nodes>
