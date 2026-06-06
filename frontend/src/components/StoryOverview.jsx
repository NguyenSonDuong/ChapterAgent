import React, { useState } from 'react';
import { User, Tag, HelpCircle, History, BookOpen, UserCheck, Edit, Trash2, Plus, Check, X } from 'lucide-react';

export default function StoryOverview({ storyMeta, storyLedger, backendUrl, onRefreshDetails }) {
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  // Character States
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [newChar, setNewChar] = useState({ name: '', role: '', description: '', first_chapter: null, appearance_context: '' });
  const [editingCharName, setEditingCharName] = useState(null);
  const [editingChar, setEditingChar] = useState({ name: '', role: '', description: '', first_chapter: null, appearance_context: '' });

  // Unresolved Thread States
  const [isAddingThread, setIsAddingThread] = useState(false);
  const [newThreadText, setNewThreadText] = useState('');
  const [newThreadChapter, setNewThreadChapter] = useState('');
  const [editingThreadIndex, setEditingThreadIndex] = useState(null);
  const [editingThreadText, setEditingThreadText] = useState('');
  const [editingThreadChapter, setEditingThreadChapter] = useState('');

  // Resolved Thread States
  const [threadsTab, setThreadsTab] = useState('unresolved'); // unresolved, resolved
  const [resolvingThreadIndex, setResolvingThreadIndex] = useState(null);
  const [resolvingThreadNote, setResolvingThreadNote] = useState('');
  const [resolvingThreadChapter, setResolvingThreadChapter] = useState('');

  if (!storyMeta) {
    return (
      <div className="center-content">
        <p className="text-muted">Chọn hoặc tạo một bộ truyện từ thanh Sidebar để xem chi tiết</p>
      </div>
    );
  }

  const unresolved = storyLedger?.unresolved_threads || [];
  const timeline = storyLedger?.timeline || [];

  const isMainCharacter = (role) => {
    if (!role) return false;
    const normalized = role.trim().toLowerCase();
    return ['chính', 'nhân vật chính', 'main', 'protagonist'].includes(normalized);
  };

  // API Call: Save Model
  const handleSaveModel = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/model`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selectedModel })
      });
      if (res.ok) {
        setIsEditingModel(false);
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi cập nhật Model AI.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  // API Call: Add Thread
  const handleAddThread = async () => {
    if (!newThreadText.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/threads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          thread: newThreadText.trim(),
          chapter: newThreadChapter ? parseInt(newThreadChapter) : null
        })
      });
      if (res.ok) {
        setNewThreadText('');
        setNewThreadChapter('');
        setIsAddingThread(false);
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi thêm nút thắt.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  // API Call: Save Thread
  const handleSaveThread = async (index) => {
    if (!editingThreadText.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/threads/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          thread: editingThreadText.trim(),
          chapter: editingThreadChapter ? parseInt(editingThreadChapter) : null
        })
      });
      if (res.ok) {
        setEditingThreadIndex(null);
        setEditingThreadChapter('');
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi sửa nút thắt.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  // API Call: Delete Thread
  const handleDeleteThread = async (index) => {
    if (!confirm('Bạn có chắc muốn xóa nút thắt này không?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/threads/${index}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi xóa nút thắt.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  // API Call: Add Character
  const handleAddCharacter = async () => {
    if (!newChar.name.trim() || !newChar.role.trim()) {
      alert('Tên và vai trò nhân vật không được để trống.');
      return;
    }
    if (isMainCharacter(newChar.role)) {
      alert('Không thể thêm nhân vật chính mới tại đây.');
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChar.name.trim(),
          role: newChar.role.trim(),
          description: newChar.description.trim(),
          first_chapter: newChar.first_chapter ? parseInt(newChar.first_chapter) : null
        })
      });
      if (res.ok) {
        setIsAddingCharacter(false);
        setNewChar({ name: '', role: '', description: '', first_chapter: null, appearance_context: '' });
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi thêm nhân vật.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  // API Call: Save Character
  const handleSaveCharacter = async (oldName) => {
    if (!editingChar.name.trim() || !editingChar.role.trim()) {
      alert('Tên và vai trò nhân vật không được để trống.');
      return;
    }
    if (isMainCharacter(editingChar.role)) {
      alert('Không thể thay đổi vai trò thành nhân vật chính.');
      return;
    }
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/characters/${encodeURIComponent(oldName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingChar.name.trim(),
          role: editingChar.role.trim(),
          description: editingChar.description.trim(),
          first_chapter: editingChar.first_chapter ? parseInt(editingChar.first_chapter) : null
        })
      });
      if (res.ok) {
        setEditingCharName(null);
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi sửa nhân vật.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  // API Call: Delete Character
  const handleDeleteCharacter = async (name) => {
    if (!confirm(`Bạn có chắc muốn xóa nhân vật "${name}" không?`)) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/characters/${encodeURIComponent(name)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi xóa nhân vật.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  return (
    <div className="story-overview fade-in">
      <div className="overview-header glass">
        <h1 className="story-title">{storyMeta.name}</h1>
        <div className="story-meta-tags" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {isEditingModel ? (
            <div className="model-edit-inline" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <select 
                value={selectedModel} 
                onChange={(e) => setSelectedModel(e.target.value)}
                className="form-select-sm"
                style={{ background: '#121621', color: 'var(--text-primary)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '4px 10px', fontSize: '13px' }}
              >
                <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
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
              <button onClick={handleSaveModel} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Lưu">
                <Check className="icon-xs text-green" />
              </button>
              <button onClick={() => setIsEditingModel(false)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Hủy">
                <X className="icon-xs text-red" />
              </button>
            </div>
          ) : (
            <div className="model-badge-container" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="meta-badge model-badge">{storyMeta.model}</span>
              <button 
                onClick={() => { setIsEditingModel(true); setSelectedModel(storyMeta.model); }} 
                className="btn-icon" 
                style={{ width: '24px', height: '24px' }}
                title="Sửa Model AI mặc định"
              >
                <Edit className="icon-xs" />
              </button>
            </div>
          )}
          <span className="meta-badge word-badge">{storyMeta.max_words_per_chapter} từ/chương</span>
          <span className="meta-badge chapter-badge">Tối đa {storyMeta.max_chapters} chương</span>
        </div>
        <p className="story-description">{storyMeta.context}</p>
        <div className="story-tags-row">
          <Tag className="icon-xs text-cyan" />
          <div className="tags-container">
            {storyMeta.tags.map((tag, idx) => (
              <span key={idx} className="tag-item">{tag}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="overview-grid">
        {/* Left column: Characters */}
        <div className="overview-col glass">
          <div className="col-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserCheck className="icon-sm text-cyan" />
              <h3>Nhân Vật ({storyMeta.characters?.length || 0})</h3>
            </div>
          </div>

          <div className="characters-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '450px', paddingRight: '4px' }}>
            {(storyMeta.characters || []).map((char, index) => {
              const isMain = isMainCharacter(char.role);
              const isEditing = editingCharName === char.name;

              if (isEditing) {
                return (
                  <div key={index} className="character-card glass-light" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px' }}>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên nhân vật</label>
                      <input
                        type="text"
                        value={editingChar.name}
                        onChange={(e) => setEditingChar({ ...editingChar, name: e.target.value })}
                        style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Vai trò (ví dụ: phụ, phản diện, sư phụ,...)</label>
                      <input
                        type="text"
                        value={editingChar.role}
                        onChange={(e) => setEditingChar({ ...editingChar, role: e.target.value })}
                        style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mô tả chi tiết</label>
                      <textarea
                        value={editingChar.description}
                        onChange={(e) => setEditingChar({ ...editingChar, description: e.target.value })}
                        rows={2}
                        style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chương xuất hiện lần đầu</label>
                      <input
                        type="number"
                        value={editingChar.first_chapter || ''}
                        onChange={(e) => setEditingChar({ ...editingChar, first_chapter: e.target.value ? parseInt(e.target.value) : null })}
                        style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                      <button onClick={() => setEditingCharName(null)} className="btn-secondary-sm">Hủy</button>
                      <button onClick={() => handleSaveCharacter(char.name)} className="btn-primary-sm">Lưu</button>
                    </div>
                  </div>
                );
              }

              return (
                <div key={index} className="character-card glass-light" style={{ position: 'relative', borderRadius: '8px', padding: '14px', border: '1px solid var(--border-glass)' }}>
                  <div className="char-avatar-container" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div className="char-avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-glass-hover)', display: 'flex', alignItems: 'center', justify: 'center', color: isMain ? 'var(--color-yellow)' : 'var(--color-cyan)' }}>
                      <User className="icon-sm" />
                    </div>
                    <div className="char-name-role" style={{ flex: 1 }}>
                      <h4 className="char-name" style={{ fontSize: '14px', fontWeight: '600' }}>{char.name}</h4>
                      <span className="char-role" style={{ fontSize: '11px', color: isMain ? 'var(--color-yellow)' : 'var(--text-muted)' }}>
                        {char.role} {isMain && '(Nhân vật chính)'}
                      </span>
                    </div>
                    {!isMain && (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          onClick={() => { setEditingCharName(char.name); setEditingChar({ ...char }); }} 
                          className="btn-icon" 
                          style={{ width: '28px', height: '28px' }}
                          title="Sửa"
                        >
                          <Edit className="icon-xs" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCharacter(char.name)} 
                          className="btn-icon" 
                          style={{ width: '28px', height: '28px' }}
                          title="Xóa"
                        >
                          <Trash2 className="icon-xs text-red" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="char-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{char.description || 'Chưa có mô tả chi tiết.'}</p>
                  {char.first_chapter && (
                    <span className="char-first-chap" style={{ display: 'inline-block', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>Xuất hiện: Chương {char.first_chapter}</span>
                  )}
                </div>
              );
            })}

            {/* Form thêm nhân vật mới */}
            {isAddingCharacter ? (
              <div className="character-card glass-light" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px', marginBottom: '4px' }}>Thêm nhân vật mới</h4>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên nhân vật</label>
                  <input
                    type="text"
                    placeholder="Nhập tên..."
                    value={newChar.name}
                    onChange={(e) => setNewChar({ ...newChar, name: e.target.value })}
                    style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Vai trò (ví dụ: phụ, phản diện, sư phụ,...)</label>
                  <input
                    type="text"
                    placeholder="Nhập vai trò..."
                    value={newChar.role}
                    onChange={(e) => setNewChar({ ...newChar, role: e.target.value })}
                    style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mô tả ngắn</label>
                  <textarea
                    placeholder="Mô tả ngoại hình, tính cách..."
                    value={newChar.description}
                    onChange={(e) => setNewChar({ ...newChar, description: e.target.value })}
                    rows={2}
                    style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chương xuất hiện</label>
                  <input
                    type="number"
                    placeholder="Chương số..."
                    value={newChar.first_chapter || ''}
                    onChange={(e) => setNewChar({ ...newChar, first_chapter: e.target.value ? parseInt(e.target.value) : null })}
                    style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button onClick={() => setIsAddingCharacter(false)} className="btn-secondary-sm">Hủy</button>
                  <button onClick={handleAddCharacter} className="btn-primary-sm">Thêm</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => { setIsAddingCharacter(true); setNewChar({ name: '', role: '', description: '', first_chapter: null, appearance_context: '' }); }} 
                className="btn-secondary-sm" 
                style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                <Plus className="icon-xs" /> Thêm Nhân Vật Mới
              </button>
            )}

            {(!storyMeta.characters || storyMeta.characters.length === 0) && !isAddingCharacter && (
              <p className="text-muted text-center padding-md">Chưa có thông tin nhân vật</p>
            )}
          </div>
        </div>

        {/* Right column: Unresolved Threads */}
        <div className="overview-col glass">
          <div className="col-header">
            <HelpCircle className="icon-sm text-yellow" />
            <h3>Nút Thắt Cốt Truyện Chưa Giải Quyết ({unresolved.length})</h3>
          </div>
          <div className="unresolved-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '450px', paddingRight: '4px' }}>
            {unresolved.map((thread, index) => {
              const isEditing = editingThreadIndex === index;
              
              // Support both string (old data) and object (new data)
              const threadText = typeof thread === 'object' && thread !== null ? thread.thread : thread;
              const threadChapter = typeof thread === 'object' && thread !== null ? thread.chapter : null;

              return (
                <div key={index} className="unresolved-item glass-light" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid var(--color-yellow)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', gap: '12px', flex: 1, alignItems: 'flex-start' }}>
                      <span className="thread-number" style={{ color: 'var(--color-yellow)', fontWeight: '600', fontSize: '13px' }}>#{index + 1}</span>
                      {isEditing ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nội dung nút thắt</label>
                            <textarea
                              value={editingThreadText}
                              onChange={(e) => setEditingThreadText(e.target.value)}
                              className="form-control"
                              rows={2}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chương xuất hiện</label>
                            <input
                              type="number"
                              placeholder="Số chương..."
                              value={editingThreadChapter}
                              onChange={(e) => setEditingThreadChapter(e.target.value)}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px', outline: 'none' }}
                            />
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <p className="thread-text" style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: '1.5' }}>{threadText}</p>
                          {threadChapter !== null && threadChapter !== undefined && (
                            <span className="meta-badge chapter-badge" style={{ fontSize: '11px', padding: '2px 6px', background: 'rgba(234, 179, 8, 0.1)', borderColor: 'rgba(234, 179, 8, 0.2)', color: 'var(--color-yellow)', alignSelf: 'flex-start' }}>
                              Xuất hiện: Chương {threadChapter}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginLeft: '12px' }}>
                      {isEditing ? (
                        <>
                          <button onClick={() => handleSaveThread(index)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Lưu">
                            <Check className="icon-xs text-green" />
                          </button>
                          <button onClick={() => setEditingThreadIndex(null)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Hủy">
                            <X className="icon-xs text-red" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => { 
                              setEditingThreadIndex(index); 
                              setEditingThreadText(threadText); 
                              setEditingThreadChapter(threadChapter !== null ? String(threadChapter) : ''); 
                            }} 
                            className="btn-icon" 
                            style={{ width: '28px', height: '28px' }} 
                            title="Sửa"
                          >
                            <Edit className="icon-xs" />
                          </button>
                          <button onClick={() => handleDeleteThread(index)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Xóa">
                            <Trash2 className="icon-xs text-red" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Form thêm mới Thread */}
            {isAddingThread ? (
              <div className="unresolved-item glass-light" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid var(--color-yellow)' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Nội dung nút thắt</label>
                  <textarea
                    placeholder="Nhập nút thắt cốt truyện mới cần giải quyết..."
                    value={newThreadText}
                    onChange={(e) => setNewThreadText(e.target.value)}
                    className="form-control"
                    rows={2}
                    style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chương xuất hiện (Bỏ trống nếu không rõ)</label>
                  <input
                    type="number"
                    placeholder="Nhập số chương..."
                    value={newThreadChapter}
                    onChange={(e) => setNewThreadChapter(e.target.value)}
                    style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
                  <button onClick={() => { setIsAddingThread(false); setNewThreadChapter(''); setNewThreadText(''); }} className="btn-secondary-sm">Hủy</button>
                  <button onClick={handleAddThread} className="btn-primary-sm">Thêm</button>
                </div>
              </div>
            ) : (
              <button 
                onClick={() => setIsAddingThread(true)} 
                className="btn-secondary-sm" 
                style={{ width: '100%', marginTop: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
              >
                <Plus className="icon-xs" /> Thêm Nút Thắt Mới
              </button>
            )}

            {unresolved.length === 0 && !isAddingThread && (
              <div className="unresolved-empty">
                <p className="text-green">✓ Tất cả các nút thắt đã được giải quyết!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline Section */}
      <div className="overview-timeline-section glass">
        <div className="col-header">
          <History className="icon-sm text-cyan" />
          <h3>Tiến Trình Diễn Biến Cốt Truyện (Timeline)</h3>
        </div>

        {timeline.length === 0 ? (
          <div className="timeline-empty">
            <BookOpen className="icon-md text-muted" />
            <p>Chưa có chương nào được viết. Hãy chuyển sang tab "Sáng tác" để bắt đầu chương 1!</p>
          </div>
        ) : (
          <div className="timeline-flow">
            {timeline.map((item, index) => (
              <div key={index} className="timeline-node">
                <div className="timeline-badge">{item.chapter}</div>
                <div className="timeline-panel glass-light">
                  <div className="timeline-panel-header">
                    <h4>Chương {item.chapter}: {item.title}</h4>
                  </div>
                  <p className="timeline-panel-summary">{item.summary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
