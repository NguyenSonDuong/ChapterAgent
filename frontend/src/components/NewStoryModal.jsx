import React, { useState } from 'react';
import { X, UserPlus, Trash, Sparkles } from 'lucide-react';

export default function NewStoryModal({ onClose, onCreateStory }) {
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [style, setStyle] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [maxChapters, setMaxChapters] = useState(10);
  const [maxWords, setMaxWords] = useState(2000);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [characters, setCharacters] = useState([
    { name: '', role: 'Nam chính', description: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddCharacter = () => {
    setCharacters([...characters, { name: '', role: 'Phụ', description: '' }]);
  };

  const handleRemoveCharacter = (index) => {
    const updated = characters.filter((_, i) => i !== index);
    setCharacters(updated);
  };

  const handleCharacterChange = (index, field, value) => {
    const updated = [...characters];
    updated[index][field] = value;
    setCharacters(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !context.trim() || !style.trim()) {
      alert('Vui lòng điền các trường bắt buộc: Tên truyện, Bối cảnh, Phong cách');
      return;
    }

    setSubmitting(true);
    const storyData = {
      name: name.trim(),
      context: context.trim(),
      style: style.trim(),
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      max_chapters: parseInt(maxChapters) || 10,
      max_words_per_chapter: parseInt(maxWords) || 2000,
      model: model,
      characters: characters.filter(c => c.name.trim() !== '')
    };

    const success = await onCreateStory(storyData);
    setSubmitting(false);
    if (success) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-card glass">
        <div className="modal-header">
          <div className="modal-title-container">
            <Sparkles className="icon-sm text-cyan" />
            <h3>Khởi Tạo Tác Phẩm Mới</h3>
          </div>
          <button onClick={onClose} className="btn-close">
            <X className="icon-sm" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label required">Tên tác phẩm</label>
            <input 
              type="text" 
              className="form-input" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              placeholder="Ví dụ: Tiên Nghịch, Phàm Nhân Tu Tiên..."
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label required">Phong cách hành văn / Thể loại</label>
              <input 
                type="text" 
                className="form-input" 
                value={style} 
                onChange={e => setStyle(e.target.value)} 
                placeholder="Ví dụ: u tối, hài hước, trang nghiêm..."
                required
              />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Thẻ phân loại (tags, cách nhau bằng dấu phẩy)</label>
              <input 
                type="text" 
                className="form-input" 
                value={tagsStr} 
                onChange={e => setTagsStr(e.target.value)} 
                placeholder="Ví dụ: tiên hiệp, hệ thống, kiếm hiệp..."
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Bối cảnh chính thế giới / Cốt truyện chung</label>
            <textarea 
              className="form-textarea" 
              value={context} 
              onChange={e => setContext(e.target.value)} 
              placeholder="Mô tả bối cảnh thế giới tu tiên, xung đột chính, ma tộc hoành hành..."
              rows={3}
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">Model AI</label>
              <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
                <option value="gemini-2.5-flash">Gemini 2.5 Flash (Mặc định)</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="gemini-2.0-flash">Gemini 2 Flash (2.0)</option>
                <option value="gemini-2.0-flash-lite">Gemini 2 Flash Lite</option>
                <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
                <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                <option value="gemini-3.0-flash">Gemini 3 Flash</option>
                <option value="gemma-4-26b">Gemma 4 26B</option>
                <option value="gemma-4-31b">Gemma 4 31B</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
              </select>
            </div>
            <div className="form-group width-100">
              <label className="form-label">Số chương tối đa</label>
              <input 
                type="number" 
                className="form-input" 
                value={maxChapters} 
                onChange={e => setMaxChapters(e.target.value)}
              />
            </div>
            <div className="form-group width-100">
              <label className="form-label">Từ / Chương</label>
              <input 
                type="number" 
                className="form-input" 
                value={maxWords} 
                onChange={e => setMaxWords(e.target.value)}
              />
            </div>
          </div>

          {/* Characters Section */}
          <div className="characters-section">
            <div className="section-title-sm">
              <span>DANH SÁCH NHÂN VẬT BAN ĐẦU</span>
              <button 
                type="button" 
                onClick={handleAddCharacter} 
                className="btn-add-char"
              >
                <UserPlus className="icon-xs" /> Thêm nhân vật
              </button>
            </div>

            <div className="characters-inputs-list">
              {characters.map((char, index) => (
                <div key={index} className="character-input-card glass-light">
                  <div className="char-input-header">
                    <span className="char-index">Nhân vật #{index + 1}</span>
                    {characters.length > 1 && (
                      <button 
                        type="button" 
                        onClick={() => handleRemoveCharacter(index)} 
                        className="btn-delete-char"
                      >
                        <Trash className="icon-xs" />
                      </button>
                    )}
                  </div>
                  <div className="form-row">
                    <div className="form-group flex-1">
                      <input 
                        type="text" 
                        className="form-input-sm" 
                        value={char.name} 
                        onChange={e => handleCharacterChange(index, 'name', e.target.value)}
                        placeholder="Tên nhân vật"
                        required
                      />
                    </div>
                    <div className="form-group flex-1">
                      <input 
                        type="text" 
                        className="form-input-sm" 
                        value={char.role} 
                        onChange={e => handleCharacterChange(index, 'role', e.target.value)}
                        placeholder="Vai trò (Nam chính, Nữ chính, Phản diện...)"
                      />
                    </div>
                  </div>
                  <div className="form-group margin-top-xs">
                    <input 
                      type="text" 
                      className="form-input-sm" 
                      value={char.description} 
                      onChange={e => handleCharacterChange(index, 'description', e.target.value)}
                      placeholder="Mô tả tính cách, sức mạnh, ngoại hình..."
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-secondary">Hủy</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Đang tạo...' : 'Khởi tạo tác phẩm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
