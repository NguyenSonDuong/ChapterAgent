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
