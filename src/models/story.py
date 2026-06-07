from pydantic import BaseModel, Field, model_validator
from typing import List, Dict, Any, Optional

class UnresolvedThread(BaseModel):
    thread: str = Field(description="Nội dung nút thắt")
    chapter: Optional[int] = Field(default=None, description="Chương xuất hiện")

    @model_validator(mode='before')
    @classmethod
    def convert_string_to_dict(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"thread": data, "chapter": None}
        return data

class ResolvedThread(BaseModel):
    thread: str = Field(description="Nội dung nút thắt")
    chapter_introduced: Optional[int] = Field(default=None, description="Chương xuất hiện")
    chapter_resolved: Optional[int] = Field(default=None, description="Chương giải quyết")
    resolution_note: Optional[str] = Field(default=None, description="Cách giải quyết / ghi chú")

    @model_validator(mode='before')
    @classmethod
    def convert_string_to_dict(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"thread": data, "chapter_introduced": None, "chapter_resolved": None, "resolution_note": None}
        return data

class LocationInfo(BaseModel):
    name: str = Field(description="Tên địa điểm")
    chapter: Optional[int] = Field(default=None, description="Chương xuất hiện")
    description: Optional[str] = Field(default=None, description="Mô tả địa điểm")

class WeaponInfo(BaseModel):
    name: str = Field(description="Tên binh khí / pháp khí")
    chapter: Optional[int] = Field(default=None, description="Chương xuất hiện")
    description: Optional[str] = Field(default=None, description="Mô tả binh khí / pháp khí")

class TechniqueInfo(BaseModel):
    name: str = Field(description="Tên công pháp")
    chapter: Optional[int] = Field(default=None, description="Chương xuất hiện")
    description: Optional[str] = Field(default=None, description="Mô tả công pháp")

class GlobalLedger(BaseModel):
    timeline: List[Dict[str, Any]] = Field(
        default_factory=list, 
        description="Lịch sử các chương đã diễn ra. Mỗi phần tử là dict chứa: chapter (int), title (str), summary (str)"
    )
    unresolved_threads: List[UnresolvedThread] = Field(
        default_factory=list, 
        description="Các mối nối, nút thắt hoặc chi tiết cốt truyện chưa được giải quyết"
    )
    resolved_threads: List[ResolvedThread] = Field(
        default_factory=list, 
        description="Các mối nối, nút thắt hoặc chi tiết cốt truyện đã được giải quyết"
    )
    locations: List[LocationInfo] = Field(
        default_factory=list, 
        description="Danh sách các địa điểm trong thế giới"
    )
    weapons: List[WeaponInfo] = Field(
        default_factory=list, 
        description="Danh sách các binh khí / pháp khí trong thế giới"
    )
    techniques: List[TechniqueInfo] = Field(
        default_factory=list, 
        description="Danh sách các công pháp trong thế giới"
    )

class CharacterInfo(BaseModel):
    name: str = Field(description="Tên nhân vật")
    role: str = Field(description="Vai trò trong câu chuyện (ví dụ: nhân vật chính, đối thủ, bạn bè)")
    description: str = Field(description="Mô tả đặc điểm ngoại hình, tính cách, tiểu sử")
    first_chapter: Optional[int] = Field(default=None, description="Chương đầu tiên nhân vật xuất hiện")
    appearance_context: Optional[str] = Field(default=None, description="Hoàn cảnh, thời điểm và sự kiện gặp gỡ lần đầu")
    visited_locations: List[str] = Field(default_factory=list, description="Địa điểm đã đi qua")
    active_weapon: Optional[str] = Field(default=None, description="Binh khí đang sử dụng")
    weapons_owned: List[str] = Field(default_factory=list, description="Các binh khí đang sở hữu")
    active_technique: Optional[str] = Field(default=None, description="Công pháp đang sử dụng")
    techniques_owned: List[str] = Field(default_factory=list, description="Các công pháp đang sở hữu")
    current_cultivation: Optional[str] = Field(default=None, description="Tu vi hiện tại")
    current_location: Optional[str] = Field(default=None, description="Địa điểm hiện tại")
    status: Optional[str] = Field(default="Mới xuất hiện", description="Trạng thái của nhân vật (Mới xuất hiện, Đang an toàn, Đang nguy hiểm, Nguy hiểm tính mạng, Đã chết)")

class CultivationStageInfo(BaseModel):
    name: str = Field(description="Tên bậc tu vi")
    description: Optional[str] = Field(default="", description="Mô tả về bậc tu vi")

    @model_validator(mode='before')
    @classmethod
    def convert_string_to_dict(cls, data: Any) -> Any:
        if isinstance(data, str):
            return {"name": data, "description": ""}
        return data

class StoryMeta(BaseModel):
    uuid: str = Field(description="UUID định danh duy nhất của câu chuyện")
    name: str = Field(description="Tên tác phẩm")
    characters: List[CharacterInfo] = Field(default_factory=list, description="Danh sách các nhân vật")
    context: str = Field(description="Bối cảnh thế giới và cốt truyện chính")
    style: str = Field(description="Phong cách và giọng điệu kể chuyện (ví dụ: u tối, hài hước, trang nghiêm)")
    tags: List[str] = Field(default_factory=list, description="Các thẻ phân loại truyện (tags)")
    max_chapters: int = Field(default=10, description="Số chương tối đa dự kiến")
    max_words_per_chapter: int = Field(default=2000, description="Giới hạn số từ tối đa mỗi chương")
    model: str = Field(default="gemini-2.5-flash", description="Model AI sử dụng cho câu chuyện")
    cultivation_stages: List[CultivationStageInfo] = Field(default_factory=list, description="Hệ thống cấp độ tu vi của thế giới")


class ChapterState(BaseModel):
    chapter_title: str = Field(description="Tiêu đề của chương")
    summary: str = Field(description="Tóm tắt nội dung chính diễn ra trong chương")
    character_statuses: Dict[str, str] = Field(
        default_factory=dict, 
        description="Trạng thái hiện tại của các nhân vật sau chương này (ví dụ: vị trí địa lý, hành trang, sức khỏe, tâm lý)"
    )
    threads_resolved: List[str] = Field(
        default_factory=list, 
        description="Các nút thắt đã được giải quyết hoặc hé lộ câu trả lời trong chương này"
    )
    threads_introduced: List[str] = Field(
        default_factory=list, 
        description="Các nút thắt, bí ẩn hoặc mối lo mới được mở ra trong chương này"
    )
