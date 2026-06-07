import re
from typing import List

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


def parse_cultivation_score(cult_str: str, stages: List[str]) -> float:
    """Tính toán điểm số tu vi dựa trên danh sách hệ thống cấp bậc.
    Cấp bậc càng cao điểm số càng lớn.
    """
    if not cult_str:
        return -1.0
    cult_str = cult_str.strip().lower()
    
    # 1. Kiểm tra trạng thái "bán bộ" hoặc "nửa bước" (half-step)
    for idx, stage in enumerate(stages):
        stage_lower = stage.strip().lower()
        if (f"bán bộ {stage_lower}" in cult_str or 
            f"nửa bước {stage_lower}" in cult_str or 
            f"ban bo {stage_lower}" in cult_str or 
            f"nua buoc {stage_lower}" in cult_str):
            return float(idx) - 0.1
            
    # 2. Tìm cấp bậc lớn nhất phù hợp trong danh sách stages
    matched_idx = -1
    for idx in range(len(stages) - 1, -1, -1):
        stage_lower = stages[idx].strip().lower()
        if stage_lower in cult_str:
            matched_idx = idx
            break
            
    if matched_idx == -1:
        # Nếu không khớp với bất kỳ bậc nào trong hệ thống, trả về score -0.5 để đánh dấu custom
        return -0.5
        
    # 3. Tính điểm phụ (sub-stage) dựa trên các từ khóa và tầng/cấp
    sub_score = 0.0
    if "viên mãn" in cult_str or "vien man" in cult_str or "đỉnh phong" in cult_str or "dinh phong" in cult_str or "cực hạn" in cult_str or "cuc han" in cult_str:
        sub_score = 0.8
    elif "hậu kỳ" in cult_str or "hau ky" in cult_str or "late" in cult_str:
        sub_score = 0.6
    elif "trung kỳ" in cult_str or "trung ky" in cult_str or "mid" in cult_str:
        sub_score = 0.4
    elif "sơ kỳ" in cult_str or "so ky" in cult_str or "early" in cult_str:
        sub_score = 0.2
        
    # Tìm kiếm tầng/cấp số (ví dụ: tầng 5, cấp 3, trọng 2)
    num_match = re.search(r'(?:tầng|cấp|trọng|layer|tier|level|\s|^)(\d+)', cult_str)
    if num_match:
        try:
            val = int(num_match.group(1))
            # Mỗi tầng đóng góp một phần nhỏ (ví dụ: tầng 10 là +0.1, tối đa +0.19)
            sub_score += min(0.19, val * 0.01)
        except ValueError:
            pass
            
    return float(matched_idx) + sub_score


def is_higher_cultivation(old_cult: str, new_cult: str, stages: List[str]) -> bool:
    """Kiểm tra xem tu vi mới có cao hơn tu vi cũ không dựa trên hệ thống cấp bậc."""
    if not old_cult or not old_cult.strip():
        return True
    if not new_cult or not new_cult.strip():
        return False
        
    old_score = parse_cultivation_score(old_cult, stages)
    new_score = parse_cultivation_score(new_cult, stages)
    
    # Nếu cả hai đều không thuộc hệ thống cấp bậc, so sánh độ dài/khác biệt chuỗi hoặc cho phép cập nhật nếu khác nhau
    if old_score == -0.5 and new_score == -0.5:
        return old_cult.strip().lower() != new_cult.strip().lower()
        
    return new_score > old_score

