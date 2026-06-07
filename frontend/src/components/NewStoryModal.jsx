import React, { useState } from 'react';
import { X, UserPlus, Trash, Sparkles, ArrowUp, ArrowDown, Plus } from 'lucide-react';

export default function NewStoryModal({ onClose, onCreateStory }) {
  const [name, setName] = useState('');
  const [context, setContext] = useState('');
  const [style, setStyle] = useState('');
  const [tagsStr, setTagsStr] = useState('');
  const [maxChapters, setMaxChapters] = useState(10);
  const [maxWords, setMaxWords] = useState(2000);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [cultivationStages, setCultivationStages] = useState([
    { name: 'Luyện Khí', description: 'Giai đoạn tích lũy linh khí vào cơ thể.' },
    { name: 'Trúc Cơ', description: 'Xây dựng nền móng tu tiên vững chắc.' },
    { name: 'Kim Đan', description: 'Nguyên anh ngưng tụ linh khí thành thực thể Kim Đan.' },
    { name: 'Nguyên Anh', description: 'Hóa hình linh hồn thành Nguyên Anh.' },
    { name: 'Hóa Thần', description: 'Linh hồn giao hòa cùng trời đất.' }
  ]);
  const [newStageName, setNewStageName] = useState('');
  const [newStageDesc, setNewStageDesc] = useState('');
  const [characters, setCharacters] = useState([
    { name: '', role: 'Nam chính', description: '', current_cultivation: '' }
  ]);
  const [submitting, setSubmitting] = useState(false);

  const handleAddStage = () => {
    if (newStageName.trim()) {
      setCultivationStages([...cultivationStages, {
        name: newStageName.trim(),
        description: newStageDesc.trim()
      }]);
      setNewStageName('');
      setNewStageDesc('');
    }
  };

  const handleMoveStage = (index, direction) => {
    const newStages = [...cultivationStages];
    if (direction === 'up' && index > 0) {
      [newStages[index], newStages[index - 1]] = [newStages[index - 1], newStages[index]];
    } else if (direction === 'down' && index < newStages.length - 1) {
      [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];
    }
    setCultivationStages(newStages);
  };

  const handleDeleteStage = (index) => {
    setCultivationStages(cultivationStages.filter((_, i) => i !== index));
  };

  const handleAddCharacter = () => {
    setCharacters([...characters, { name: '', role: 'Phụ', description: '', current_cultivation: '' }]);
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
      cultivation_stages: cultivationStages,
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

          <div className="form-group">
            <label className="form-label">Hệ thống tu vi thế giới (Bậc từ thấp đến cao)</label>
            <div className="cultivation-manager glass-light" style={{ border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '12px', background: 'rgba(255, 255, 255, 0.01)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div className="stages-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', paddingRight: '4px' }}>
                {cultivationStages.map((stage, idx) => (
                  <div key={idx} className="stage-item-row" style={{ display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', padding: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Cấp {idx + 1}:</span>
                        <span style={{ fontSize: '13px', color: '#fff', fontWeight: '600' }}>{stage.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button 
                          type="button" 
                          onClick={() => handleMoveStage(idx, 'up')} 
                          disabled={idx === 0}
                          style={{ border: 'none', background: 'transparent', cursor: idx === 0 ? 'not-allowed' : 'pointer', color: idx === 0 ? 'rgba(255, 255, 255, 0.1)' : 'var(--text-secondary)', padding: '2px' }}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleMoveStage(idx, 'down')} 
                          disabled={idx === cultivationStages.length - 1}
                          style={{ border: 'none', background: 'transparent', cursor: idx === cultivationStages.length - 1 ? 'not-allowed' : 'pointer', color: idx === cultivationStages.length - 1 ? 'rgba(255, 255, 255, 0.1)' : 'var(--text-secondary)', padding: '2px' }}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleDeleteStage(idx)} 
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444', padding: '2px', marginLeft: '4px' }}
                        >
                          <Trash size={14} />
                        </button>
                      </div>
                    </div>
                    {stage.description && (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', paddingLeft: '8px', borderLeft: '2px solid rgba(0, 242, 254, 0.3)' }}>
                        {stage.description}
                      </div>
                    )}
                  </div>
                ))}
                {cultivationStages.length === 0 && (
                  <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '10px' }}>Chưa có bậc tu vi nào. Hãy thêm ở dưới.</p>
                )}
              </div>
              
              <div className="add-stage-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input 
                    type="text" 
                    value={newStageName} 
                    onChange={e => setNewStageName(e.target.value)} 
                    placeholder="Tên cấp bậc mới (ví dụ: Hóa Thần)" 
                    style={{ flex: 1, background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px' }}
                  />
                  <button 
                    type="button" 
                    onClick={handleAddStage}
                    className="btn-primary-sm" 
                    style={{ padding: '6px 12px', borderRadius: '6px', fontSize: '12px', background: 'var(--color-cyan)', color: '#10141f', border: 'none', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                  >
                    <Plus size={12} /> Thêm
                  </button>
                </div>
                <input 
                  type="text" 
                  value={newStageDesc} 
                  onChange={e => setNewStageDesc(e.target.value)} 
                  placeholder="Mô tả về cấp bậc tu vi này..." 
                  style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px 10px', fontSize: '12px' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddStage();
                    }
                  }}
                />
              </div>
            </div>
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
                        placeholder="Vai trò (Nam chính, Nữ chính...)"
                      />
                    </div>
                    <div className="form-group flex-1">
                      <input 
                        type="text" 
                        className="form-input-sm" 
                        value={char.current_cultivation || ''} 
                        onChange={e => handleCharacterChange(index, 'current_cultivation', e.target.value)}
                        placeholder="Tu vi ban đầu (ví dụ: Luyện Khí tầng 1)"
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
