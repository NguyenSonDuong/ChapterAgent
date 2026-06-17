import json

def to_meta_markdown(meta: dict) -> str:
    """Chuyển đổi dữ liệu meta nhân vật và bối cảnh sang định dạng văn bản Markdown."""
    if not meta:
        return "Không có thông tin bối cảnh."
    
    lines = []
    lines.append(f"Tên tác phẩm: {meta.get('name', 'Không rõ')}")
    lines.append(f"Bối cảnh thế giới: {meta.get('context', 'Không rõ')}")
    lines.append(f"Phong cách kể chuyện: {meta.get('style', 'Không rõ')}")
    
    tags = meta.get("tags", [])
    if tags:
        lines.append(f"Nhãn phân loại: {', '.join(tags)}")
        
    stages = meta.get("cultivation_stages", [])
    if stages:
        lines.append("\nHỆ THỐNG CẤP ĐỘ TU VI TRONG THẾ GIỚI:")
        for idx, stage in enumerate(stages):
            if isinstance(stage, dict):
                name = stage.get("name", "")
                desc = stage.get("description", "")
            else:
                name = getattr(stage, "name", str(stage))
                desc = getattr(stage, "description", "")
            if desc:
                lines.append(f"  - Cấp {idx + 1}: {name} ({desc})")
            else:
                lines.append(f"  - Cấp {idx + 1}: {name}")
                
    chars = meta.get("characters", [])
    if chars:
        lines.append("\nDANH SÁCH NHÂN VẬT VÀ TRẠNG THÁI HIỆN TẠI:")
        for idx, char in enumerate(chars):
            if isinstance(char, dict):
                c_name = char.get("name", "Không rõ")
                c_role = char.get("role", "Không rõ")
                c_desc = char.get("description", "")
                c_cult = char.get("current_cultivation") or "Không rõ"
                c_loc = char.get("current_location") or "Không rõ"
                c_weapon = char.get("active_weapon") or "Không có"
                c_weapons_owned = char.get("weapons_owned", [])
                c_tech = char.get("active_technique") or "Không có"
                c_techs_owned = char.get("techniques_owned", [])
                c_visited = char.get("visited_locations", [])
                c_status = char.get("status") or "Mới xuất hiện"
            else:
                c_name = getattr(char, "name", "Không rõ")
                c_role = getattr(char, "role", "Không rõ")
                c_desc = getattr(char, "description", "")
                c_cult = getattr(char, "current_cultivation", "Không rõ") or "Không rõ"
                c_loc = getattr(char, "current_location", "Không rõ") or "Không rõ"
                c_weapon = getattr(char, "active_weapon", "Không có") or "Không có"
                c_weapons_owned = getattr(char, "weapons_owned", [])
                c_tech = getattr(char, "active_technique", "Không có") or "Không có"
                c_techs_owned = getattr(char, "techniques_owned", [])
                c_visited = getattr(char, "visited_locations", [])
                c_status = getattr(char, "status", "Mới xuất hiện") or "Mới xuất hiện"
                
            lines.append(f"\n  {idx + 1}. Nhân vật: {c_name}")
            lines.append(f"     * Vai trò: {c_role}")
            lines.append(f"     * Mô tả đặc điểm, tính cách: {c_desc}")
            lines.append(f"     * Tu vi hiện tại: {c_cult}")
            lines.append(f"     * Địa điểm hiện tại: {c_loc}")
            lines.append(f"     * Trạng thái sức khỏe/tính mạng: {c_status}")
            lines.append(f"     * Binh khí đang sử dụng: {c_weapon}")
            if c_weapons_owned:
                w_owned_str = ", ".join([str(w) for w in c_weapons_owned])
                lines.append(f"     * Các binh khí sở hữu: {w_owned_str}")
            lines.append(f"     * Chiêu thức/Công pháp đang dùng: {c_tech}")
            if c_techs_owned:
                t_owned_str = ", ".join([str(t) for t in c_techs_owned])
                lines.append(f"     * Các công pháp đã học: {t_owned_str}")
            if c_visited:
                visited_str = ", ".join([str(l) for l in c_visited])
                lines.append(f"     * Địa điểm đã đi qua: {visited_str}")
                
    return "\n".join(lines)


def to_ledger_markdown(ledger: dict) -> str:
    """Chuyển đổi dữ liệu sổ cái (ledger) cốt truyện sang định dạng văn bản Markdown."""
    if not ledger:
        return "Không có thông tin sổ cái cốt truyện."
        
    lines = []
    
    locs = ledger.get("locations", [])
    if locs:
        lines.append("DANH SÁCH CÁC ĐỊA ĐIỂM TRONG THẾ GIỚI:")
        for loc in locs:
            if isinstance(loc, dict):
                name = loc.get("name", "")
                desc = loc.get("description", "")
            else:
                name = getattr(loc, "name", str(loc))
                desc = getattr(loc, "description", "")
            lines.append(f"  - {name}: {desc}")
            
    weapons = ledger.get("weapons", [])
    if weapons:
        lines.append("\nDANH SÁCH PHÁP KHÍ / BINH KHÍ TRONG THẾ GIỚI:")
        for w in weapons:
            if isinstance(w, dict):
                name = w.get("name", "")
                desc = w.get("description", "")
            else:
                name = getattr(w, "name", str(w))
                desc = getattr(w, "description", "")
            lines.append(f"  - {name}: {desc}")
            
    techs = ledger.get("techniques", [])
    if techs:
        lines.append("\nDANH SÁCH CÔNG PHÁP VÀ CHIÊU THỨC TRONG THẾ GIỚI:")
        for t in techs:
            if isinstance(t, dict):
                name = t.get("name", "")
                desc = t.get("description", "")
            else:
                name = getattr(t, "name", str(t))
                desc = getattr(t, "description", "")
            lines.append(f"  - {name}: {desc}")
            
    timeline = ledger.get("timeline", [])
    if timeline:
        lines.append("\nTÓM TẮT DIỄN BIẾN CÁC CHƯƠNG TRƯỚC:")
        lines.append(to_timeline_markdown(timeline))
            
    unresolved = ledger.get("unresolved_threads", [])
    if unresolved:
        lines.append("\nCÁC NÚT THẮT / BÍ ẨN CỐT TRUYỆN CHƯA GIẢI QUYẾT:")
        for idx, ut in enumerate(unresolved):
            if isinstance(ut, dict):
                thread_text = ut.get("thread", "")
                chap = ut.get("chapter")
            else:
                thread_text = getattr(ut, "thread", str(ut))
                chap = getattr(ut, "chapter", None)
            if chap:
                lines.append(f"  - Nút thắt {idx + 1} (xuất hiện ở Chương {chap}): {thread_text}")
            else:
                lines.append(f"  - Nút thắt {idx + 1}: {thread_text}")
                
    resolved = ledger.get("resolved_threads", [])
    if resolved:
        lines.append("\nCÁC NÚT THẮT CỐT TRUYỆN ĐÃ ĐƯỢC GIẢI QUYẾT:")
        for idx, rt in enumerate(resolved):
            if isinstance(rt, dict):
                thread_text = rt.get("thread", "")
                chap_intro = rt.get("chapter_introduced")
                chap_res = rt.get("chapter_resolved")
                note = rt.get("resolution_note", "")
            else:
                thread_text = getattr(rt, "thread", str(rt))
                chap_intro = getattr(rt, "chapter_introduced", None)
                chap_res = getattr(rt, "chapter_resolved", None)
                note = getattr(rt, "resolution_note", "")
            intro_str = f"xuất hiện ở Chương {chap_intro}, " if chap_intro else ""
            res_str = f"được giải quyết ở Chương {chap_res}" if chap_res else "đã được giải quyết"
            lines.append(f"  - {thread_text} ({intro_str}{res_str})")
            if note:
                lines.append(f"    Ghi chú cách giải quyết: {note}")
                
    return "\n".join(lines)


def to_story_bible(meta: dict, ledger: dict) -> str:
    """
    Chuyển đổi dữ liệu cấu trúc thành văn bản văn học thuần túy (không dấu ngoặc JSON, không UUID, không tọa độ x/y)
    để LLM tập trung chú ý tốt nhất (Story Bible Transformer).
    """
    lines = []
    lines.append("=== SỔ TAY TÁC GIẢ (STORY BIBLE) ===")
    lines.append(to_meta_markdown(meta))
    lines.append(to_ledger_markdown(ledger))
    return "\n".join(lines)


def to_unresolved_threads_markdown(threads: list) -> str:
    """Chuyển đổi danh sách nút thắt chưa giải quyết sang định dạng Markdown."""
    if not threads:
        return "Không có nút thắt nào chưa giải quyết."
    lines = []
    for idx, ut in enumerate(threads):
        if isinstance(ut, dict):
            thread_text = ut.get("thread", "")
            chap = ut.get("chapter")
        else:
            thread_text = getattr(ut, "thread", str(ut))
            chap = getattr(ut, "chapter", None)
        if chap:
            lines.append(f"  - Nút thắt {idx + 1} (xuất hiện ở Chương {chap}): {thread_text}")
        else:
            lines.append(f"  - Nút thắt {idx + 1}: {thread_text}")
    return "\n".join(lines)


def to_nodes_list_markdown(nodes_list: list) -> str:
    """Chuyển đổi kịch bản sự kiện (nodes) dạng list sang Markdown."""
    if not nodes_list:
        return "Không có sự kiện nào."
    lines = []
    for idx, n in enumerate(nodes_list):
        title = n.get("title") or n.get("title", "Không tiêu đề")
        desc = n.get("description") or n.get("description", "Không mô tả")
        node_id = n.get("id", "")
        lines.append(f"  - Sự kiện [{node_id}]: {title}")
        lines.append(f"    Mô tả diễn biến: {desc}")
    return "\n".join(lines)


def to_characters_markdown(characters: list) -> str:
    """Chuyển đổi danh sách nhân vật sang Markdown rút gọn."""
    if not characters:
        return "Không có nhân vật nào."
    lines = []
    for idx, c in enumerate(characters):
        if isinstance(c, dict):
            name = c.get("name", "Không rõ")
            role = c.get("role", "Không rõ")
            desc = c.get("description", "")
            cult = c.get("current_cultivation")
            loc = c.get("current_location")
            status = c.get("status")
        else:
            name = getattr(c, "name", "Không rõ")
            role = getattr(c, "role", "Không rõ")
            desc = getattr(c, "description", "")
            cult = getattr(c, "current_cultivation", None)
            loc = getattr(c, "current_location", None)
            status = getattr(c, "status", None)
            
        details = []
        if role:
            details.append(f"vai trò: {role}")
        if cult:
            details.append(f"tu vi: {cult}")
        if loc:
            details.append(f"địa điểm hiện tại: {loc}")
        if status:
            details.append(f"trạng thái: {status}")
        if desc:
            details.append(f"mô tả: {desc}")
            
        details_str = f" ({', '.join(details)})" if details else ""
        lines.append(f"  - {name}{details_str}")
    return "\n".join(lines)


def to_simple_list_markdown(items: list) -> str:
    """Chuyển đổi list thô sang gạch đầu dòng Markdown."""
    if not items:
        return "Không có"
    return "\n".join([f"  - {item}" for item in items])


def to_timeline_markdown(timeline: list) -> str:
    """Chuyển đổi danh sách lịch sử chương truyện (timeline) sang định dạng Markdown."""
    if not timeline:
        return "Không có lịch sử chương trước."
    lines = []
    for item in timeline:
        lines.append(f"  - Chương {item.get('chapter', '?')}: {item.get('title', 'Không rõ tiêu đề')}")
        lines.append(f"    Mô tả diễn biến chính: {item.get('summary', 'Không có mô tả.')}")
    return "\n".join(lines)
