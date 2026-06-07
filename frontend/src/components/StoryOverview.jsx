import React, { useState } from 'react';
import { User, Tag, HelpCircle, History, BookOpen, UserCheck, Edit, Trash2, Plus, Check, X, Sparkles, Sword, Shield, Book, MapPin } from 'lucide-react';

export default function StoryOverview({ storyMeta, storyLedger, backendUrl, onRefreshDetails }) {
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');

  // Character States
  const [isAddingCharacter, setIsAddingCharacter] = useState(false);
  const [newChar, setNewChar] = useState({ 
    name: '', role: '', description: '', first_chapter: null, appearance_context: '',
    current_cultivation: '', active_weapon: '', weapons_owned: '', active_technique: '', techniques_owned: '', visited_locations: ''
  });
  const [editingCharName, setEditingCharName] = useState(null);
  const [editingChar, setEditingChar] = useState({ 
    name: '', role: '', description: '', first_chapter: null, appearance_context: '',
    current_cultivation: '', active_weapon: '', weapons_owned: '', active_technique: '', techniques_owned: '', visited_locations: ''
  });

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

  // Left column general tab
  const [leftTab, setLeftTab] = useState('characters'); // characters, world

  // World ledger inline forms
  const [worldSection, setWorldSection] = useState('locations'); // locations, weapons, techniques
  
  // Add item form states
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({ name: '', chapter: '', description: '' });
  const [isAddingWeapon, setIsAddingWeapon] = useState(false);
  const [newWeapon, setNewWeapon] = useState({ name: '', chapter: '', description: '' });
  const [isAddingTechnique, setIsAddingTechnique] = useState(false);
  const [newTechnique, setNewTechnique] = useState({ name: '', chapter: '', description: '' });

  // Edit item form states
  const [editingLocationIdx, setEditingLocationIdx] = useState(null);
  const [editingLocation, setEditingLocation] = useState({ name: '', chapter: '', description: '' });
  const [editingWeaponIdx, setEditingWeaponIdx] = useState(null);
  const [editingWeapon, setEditingWeapon] = useState({ name: '', chapter: '', description: '' });
  const [editingTechniqueIdx, setEditingTechniqueIdx] = useState(null);
  const [editingTechnique, setEditingTechnique] = useState({ name: '', chapter: '', description: '' });

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

  // API Call: Resolve Thread manually
  const handleResolveThread = async (index) => {
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/threads/${index}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chapter_resolved: resolvingThreadChapter ? parseInt(resolvingThreadChapter) : null,
          resolution_note: resolvingThreadNote.trim()
        })
      });
      if (res.ok) {
        setResolvingThreadIndex(null);
        setResolvingThreadNote('');
        setResolvingThreadChapter('');
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi giải quyết nút thắt.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  const handleStartEditChar = (char) => {
    setEditingCharName(char.name);
    setEditingChar({
      ...char,
      weapons_owned: char.weapons_owned ? char.weapons_owned.join(', ') : '',
      techniques_owned: char.techniques_owned ? char.techniques_owned.join(', ') : '',
      visited_locations: char.visited_locations ? char.visited_locations.join(', ') : ''
    });
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
          first_chapter: newChar.first_chapter ? parseInt(newChar.first_chapter) : null,
          current_cultivation: newChar.current_cultivation ? newChar.current_cultivation.trim() : '',
          active_weapon: newChar.active_weapon ? newChar.active_weapon.trim() : '',
          weapons_owned: newChar.weapons_owned ? newChar.weapons_owned.split(',').map(w => w.trim()).filter(Boolean) : [],
          active_technique: newChar.active_technique ? newChar.active_technique.trim() : '',
          techniques_owned: newChar.techniques_owned ? newChar.techniques_owned.split(',').map(t => t.trim()).filter(Boolean) : [],
          visited_locations: newChar.visited_locations ? newChar.visited_locations.split(',').map(l => l.trim()).filter(Boolean) : []
        })
      });
      if (res.ok) {
        setIsAddingCharacter(false);
        setNewChar({ 
          name: '', role: '', description: '', first_chapter: null, appearance_context: '',
          current_cultivation: '', active_weapon: '', weapons_owned: '', active_technique: '', techniques_owned: '', visited_locations: ''
        });
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
          first_chapter: editingChar.first_chapter ? parseInt(editingChar.first_chapter) : null,
          current_cultivation: editingChar.current_cultivation ? editingChar.current_cultivation.trim() : '',
          active_weapon: editingChar.active_weapon ? editingChar.active_weapon.trim() : '',
          weapons_owned: editingChar.weapons_owned ? editingChar.weapons_owned.split(',').map(w => w.trim()).filter(Boolean) : [],
          active_technique: editingChar.active_technique ? editingChar.active_technique.trim() : '',
          techniques_owned: editingChar.techniques_owned ? editingChar.techniques_owned.split(',').map(t => t.trim()).filter(Boolean) : [],
          visited_locations: editingChar.visited_locations ? editingChar.visited_locations.split(',').map(l => l.trim()).filter(Boolean) : []
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

  // World Ledger API calls: Locations
  const handleAddLocation = async () => {
    if (!newLocation.name.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLocation.name.trim(),
          chapter: newLocation.chapter ? parseInt(newLocation.chapter) : null,
          description: newLocation.description.trim()
        })
      });
      if (res.ok) {
        setIsAddingLocation(false);
        setNewLocation({ name: '', chapter: '', description: '' });
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi thêm địa điểm.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  const handleSaveLocation = async (index) => {
    if (!editingLocation.name.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/locations/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingLocation.name.trim(),
          chapter: editingLocation.chapter ? parseInt(editingLocation.chapter) : null,
          description: editingLocation.description.trim()
        })
      });
      if (res.ok) {
        setEditingLocationIdx(null);
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi sửa địa điểm.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  const handleDeleteLocation = async (index) => {
    if (!confirm('Bạn có chắc muốn xóa địa điểm này không?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/locations/${index}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi xóa địa điểm.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  // World Ledger API calls: Weapons
  const handleAddWeapon = async () => {
    if (!newWeapon.name.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/weapons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newWeapon.name.trim(),
          chapter: newWeapon.chapter ? parseInt(newWeapon.chapter) : null,
          description: newWeapon.description.trim()
        })
      });
      if (res.ok) {
        setIsAddingWeapon(false);
        setNewWeapon({ name: '', chapter: '', description: '' });
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi thêm binh khí.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  const handleSaveWeapon = async (index) => {
    if (!editingWeapon.name.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/weapons/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingWeapon.name.trim(),
          chapter: editingWeapon.chapter ? parseInt(editingWeapon.chapter) : null,
          description: editingWeapon.description.trim()
        })
      });
      if (res.ok) {
        setEditingWeaponIdx(null);
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi sửa binh khí.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  const handleDeleteWeapon = async (index) => {
    if (!confirm('Bạn có chắc muốn xóa binh khí này không?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/weapons/${index}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi xóa binh khí.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  // World Ledger API calls: Techniques
  const handleAddTechnique = async () => {
    if (!newTechnique.name.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/techniques`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTechnique.name.trim(),
          chapter: newTechnique.chapter ? parseInt(newTechnique.chapter) : null,
          description: newTechnique.description.trim()
        })
      });
      if (res.ok) {
        setIsAddingTechnique(false);
        setNewTechnique({ name: '', chapter: '', description: '' });
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi thêm công pháp.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  const handleSaveTechnique = async (index) => {
    if (!editingTechnique.name.trim()) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/techniques/${index}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingTechnique.name.trim(),
          chapter: editingTechnique.chapter ? parseInt(editingTechnique.chapter) : null,
          description: editingTechnique.description.trim()
        })
      });
      if (res.ok) {
        setEditingTechniqueIdx(null);
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi sửa công pháp.');
      }
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
    }
  };

  const handleDeleteTechnique = async (index) => {
    if (!confirm('Bạn có chắc muốn xóa công pháp này không?')) return;
    try {
      const res = await fetch(`${backendUrl}/api/stories/${storyMeta.uuid}/ledger/techniques/${index}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        if (onRefreshDetails) onRefreshDetails();
      } else {
        const data = await res.json();
        alert(data.error || 'Lỗi khi xóa công pháp.');
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
        {/* Left column: Characters & World Ledger */}
        <div className="overview-col glass">
          <div className="col-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserCheck className="icon-sm text-cyan" />
              <h3 style={{ margin: 0 }}>Quản Lý</h3>
            </div>
            <div className="tab-switcher" style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '2px' }}>
              <button
                className={`tab-btn ${leftTab === 'characters' ? 'active' : ''}`}
                onClick={() => setLeftTab('characters')}
                style={{
                  border: 'none',
                  background: leftTab === 'characters' ? 'var(--color-cyan)' : 'transparent',
                  color: leftTab === 'characters' ? '#10141f' : 'var(--text-secondary)',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Nhân vật ({storyMeta.characters?.length || 0})
              </button>
              <button
                className={`tab-btn ${leftTab === 'world' ? 'active' : ''}`}
                onClick={() => setLeftTab('world')}
                style={{
                  border: 'none',
                  background: leftTab === 'world' ? 'var(--color-cyan)' : 'transparent',
                  color: leftTab === 'world' ? '#10141f' : 'var(--text-secondary)',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Thế giới
              </button>
            </div>
          </div>

          {leftTab === 'characters' ? (
            <div className="characters-grid" style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '500px', paddingRight: '4px' }}>
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
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Vai trò</label>
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
                      
                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tu vi hiện tại</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <select
                            className="form-select-sm"
                            value={(storyMeta.cultivation_stages || []).includes(editingChar.current_cultivation) ? editingChar.current_cultivation : ''}
                            onChange={(e) => setEditingChar({ ...editingChar, current_cultivation: e.target.value === 'custom' ? '' : e.target.value })}
                            style={{ flex: 1, background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                          >
                            <option value="">-- Chọn bậc tu vi --</option>
                            {(storyMeta.cultivation_stages || []).map((stage, idx) => (
                              <option key={idx} value={stage}>{stage}</option>
                            ))}
                            <option value="custom">Nhập khác...</option>
                          </select>
                          <input
                            type="text"
                            placeholder="Nhập tu vi..."
                            value={editingChar.current_cultivation || ''}
                            onChange={(e) => setEditingChar({ ...editingChar, current_cultivation: e.target.value })}
                            style={{ flex: 1, background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Binh khí đang dùng</label>
                          <input
                            type="text"
                            value={editingChar.active_weapon || ''}
                            onChange={(e) => setEditingChar({ ...editingChar, active_weapon: e.target.value })}
                            style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Công pháp đang dùng</label>
                          <input
                            type="text"
                            value={editingChar.active_technique || ''}
                            onChange={(e) => setEditingChar({ ...editingChar, active_technique: e.target.value })}
                            style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Binh khí sở hữu (dấu phẩy cách)</label>
                        <input
                          type="text"
                          value={editingChar.weapons_owned || ''}
                          onChange={(e) => setEditingChar({ ...editingChar, weapons_owned: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Công pháp sở hữu (dấu phẩy cách)</label>
                        <input
                          type="text"
                          value={editingChar.techniques_owned || ''}
                          onChange={(e) => setEditingChar({ ...editingChar, techniques_owned: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Địa điểm đi qua (dấu phẩy cách)</label>
                        <input
                          type="text"
                          value={editingChar.visited_locations || ''}
                          onChange={(e) => setEditingChar({ ...editingChar, visited_locations: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
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
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button 
                          onClick={() => handleStartEditChar(char)} 
                          className="btn-icon" 
                          style={{ width: '28px', height: '28px' }}
                          title="Sửa"
                        >
                          <Edit className="icon-xs" />
                        </button>
                        {!isMain && (
                          <button 
                            onClick={() => handleDeleteCharacter(char.name)} 
                            className="btn-icon" 
                            style={{ width: '28px', height: '28px' }}
                            title="Xóa"
                          >
                            <Trash2 className="icon-xs text-red" />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="char-desc" style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>{char.description || 'Chưa có mô tả chi tiết.'}</p>
                    
                    <div className="char-extra-details" style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px', fontSize: '12px', color: 'var(--text-secondary)', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '8px' }}>
                      {char.current_cultivation && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sparkles className="icon-xs text-yellow" style={{ width: '12px', height: '12px' }} />
                          <span><strong>Tu vi:</strong> {char.current_cultivation}</span>
                        </div>
                      )}
                      {char.active_weapon && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Sword className="icon-xs text-red" style={{ width: '12px', height: '12px' }} />
                          <span><strong>Binh khí dùng:</strong> {char.active_weapon}</span>
                        </div>
                      )}
                      {char.weapons_owned && char.weapons_owned.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Shield className="icon-xs text-orange" style={{ width: '12px', height: '12px' }} />
                          <span><strong>Binh khí sở hữu:</strong> {char.weapons_owned.join(', ')}</span>
                        </div>
                      )}
                      {char.active_technique && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Book className="icon-xs text-blue" style={{ width: '12px', height: '12px' }} />
                          <span><strong>Công pháp dùng:</strong> {char.active_technique}</span>
                        </div>
                      )}
                      {char.techniques_owned && char.techniques_owned.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <BookOpen className="icon-xs text-purple" style={{ width: '12px', height: '12px' }} />
                          <span><strong>Công pháp sở hữu:</strong> {char.techniques_owned.join(', ')}</span>
                        </div>
                      )}
                      {char.visited_locations && char.visited_locations.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <MapPin className="icon-xs text-green" style={{ width: '12px', height: '12px' }} />
                          <span><strong>Địa điểm qua:</strong> {char.visited_locations.join(', ')}</span>
                        </div>
                      )}
                    </div>
                    
                    {char.first_chapter && (
                      <span className="char-first-chap" style={{ display: 'inline-block', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>Xuất hiện: Chương {char.first_chapter}</span>
                    )}
                  </div>
                );
              })}

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
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Vai trò</label>
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
                  
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tu vi ban đầu</label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        className="form-select-sm"
                        value={(storyMeta.cultivation_stages || []).includes(newChar.current_cultivation) ? newChar.current_cultivation : ''}
                        onChange={(e) => setNewChar({ ...newChar, current_cultivation: e.target.value })}
                        style={{ flex: 1, background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                      >
                        <option value="">-- Chọn bậc tu vi --</option>
                        {(storyMeta.cultivation_stages || []).map((stage, idx) => (
                          <option key={idx} value={stage}>{stage}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        placeholder="Nhập tu vi..."
                        value={newChar.current_cultivation || ''}
                        onChange={(e) => setNewChar({ ...newChar, current_cultivation: e.target.value })}
                        style={{ flex: 1, background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Binh khí ban đầu</label>
                      <input
                        type="text"
                        value={newChar.active_weapon || ''}
                        onChange={(e) => setNewChar({ ...newChar, active_weapon: e.target.value })}
                        style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Công pháp ban đầu</label>
                      <input
                        type="text"
                        value={newChar.active_technique || ''}
                        onChange={(e) => setNewChar({ ...newChar, active_technique: e.target.value })}
                        style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                    <button onClick={() => setIsAddingCharacter(false)} className="btn-secondary-sm">Hủy</button>
                    <button onClick={handleAddCharacter} className="btn-primary-sm">Thêm</button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => { setIsAddingCharacter(true); setNewChar({ name: '', role: '', description: '', first_chapter: null, appearance_context: '', current_cultivation: '', active_weapon: '', weapons_owned: '', active_technique: '', techniques_owned: '', visited_locations: '' }); }} 
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
          ) : (
            <div className="world-ledger-container" style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', maxHeight: '500px', paddingRight: '4px' }}>
              <div className="world-subtabs" style={{ display: 'flex', gap: '8px', marginBottom: '16px', background: 'rgba(255, 255, 255, 0.02)', padding: '6px', borderRadius: '8px' }}>
                <button
                  onClick={() => setWorldSection('locations')}
                  className={`btn-secondary-sm ${worldSection === 'locations' ? 'active' : ''}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 4px', fontSize: '11px', background: worldSection === 'locations' ? 'rgba(0, 242, 254, 0.15)' : 'transparent', border: '1px solid rgba(0, 242, 254, 0.2)', color: worldSection === 'locations' ? '#00f2fe' : 'var(--text-secondary)' }}
                >
                  <MapPin className="icon-xs" style={{ width: '12px', height: '12px' }} /> Địa điểm ({storyLedger?.locations?.length || 0})
                </button>
                <button
                  onClick={() => setWorldSection('weapons')}
                  className={`btn-secondary-sm ${worldSection === 'weapons' ? 'active' : ''}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 4px', fontSize: '11px', background: worldSection === 'weapons' ? 'rgba(239, 68, 68, 0.15)' : 'transparent', border: '1px solid rgba(239, 68, 68, 0.2)', color: worldSection === 'weapons' ? '#ef4444' : 'var(--text-secondary)' }}
                >
                  <Sword className="icon-xs" style={{ width: '12px', height: '12px' }} /> Binh khí ({storyLedger?.weapons?.length || 0})
                </button>
                <button
                  onClick={() => setWorldSection('techniques')}
                  className={`btn-secondary-sm ${worldSection === 'techniques' ? 'active' : ''}`}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '6px 4px', fontSize: '11px', background: worldSection === 'techniques' ? 'rgba(59, 130, 246, 0.15)' : 'transparent', border: '1px solid rgba(59, 130, 246, 0.2)', color: worldSection === 'techniques' ? '#3b82f6' : 'var(--text-secondary)' }}
                >
                  <Book className="icon-xs" style={{ width: '12px', height: '12px' }} /> Công pháp ({storyLedger?.techniques?.length || 0})
                </button>
              </div>

              {worldSection === 'locations' && (
                <div className="world-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(storyLedger?.locations || []).map((loc, idx) => {
                    const isEditing = editingLocationIdx === idx;
                    if (isEditing) {
                      return (
                        <div key={idx} className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên địa điểm</label>
                            <input
                              type="text"
                              value={editingLocation.name}
                              onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chương xuất hiện</label>
                            <input
                              type="number"
                              value={editingLocation.chapter || ''}
                              onChange={(e) => setEditingLocation({ ...editingLocation, chapter: e.target.value })}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mô tả địa điểm</label>
                            <textarea
                              value={editingLocation.description || ''}
                              onChange={(e) => setEditingLocation({ ...editingLocation, description: e.target.value })}
                              rows={2}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setEditingLocationIdx(null)} className="btn-secondary-sm">Hủy</button>
                            <button onClick={() => handleSaveLocation(idx)} className="btn-primary-sm">Lưu</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '3px solid #00f2fe' }}>
                        <div style={{ flex: 1, paddingRight: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>{loc.name}</h4>
                            {loc.chapter && (
                              <span className="meta-badge" style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(0, 242, 254, 0.1)', color: '#00f2fe', borderColor: 'rgba(0, 242, 254, 0.2)' }}>Chương {loc.chapter}</span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: '1.4' }}>{loc.description || 'Chưa có mô tả.'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => { setEditingLocationIdx(idx); setEditingLocation({ ...loc }); }} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Sửa"><Edit className="icon-xs" /></button>
                          <button onClick={() => handleDeleteLocation(idx)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Xóa"><Trash2 className="icon-xs text-red" /></button>
                        </div>
                      </div>
                    );
                  })}

                  {isAddingLocation ? (
                    <div className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', borderBottom: '1px solid var(--border-glass)', paddingBottom: '4px', margin: '0 0 4px 0' }}>Thêm địa điểm mới</h4>
                      <div>
                        <input
                          type="text"
                          placeholder="Tên địa điểm..."
                          value={newLocation.name}
                          onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Chương số xuất hiện..."
                          value={newLocation.chapter}
                          onChange={(e) => setNewLocation({ ...newLocation, chapter: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <textarea
                          placeholder="Mô tả địa điểm..."
                          value={newLocation.description}
                          onChange={(e) => setNewLocation({ ...newLocation, description: e.target.value })}
                          rows={2}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => setIsAddingLocation(false)} className="btn-secondary-sm">Hủy</button>
                        <button onClick={handleAddLocation} className="btn-primary-sm">Thêm</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIsAddingLocation(true)} className="btn-secondary-sm" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                      <Plus className="icon-xs" /> Thêm Địa Điểm Mới
                    </button>
                  )}
                  {(!storyLedger?.locations || storyLedger.locations.length === 0) && !isAddingLocation && (
                    <p className="text-muted text-center padding-sm" style={{ fontSize: '12px' }}>Chưa có địa điểm nào trong sổ cái.</p>
                  )}
                </div>
              )}

              {worldSection === 'weapons' && (
                <div className="world-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(storyLedger?.weapons || []).map((w, idx) => {
                    const isEditing = editingWeaponIdx === idx;
                    if (isEditing) {
                      return (
                        <div key={idx} className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên binh khí / pháp khí</label>
                            <input
                              type="text"
                              value={editingWeapon.name}
                              onChange={(e) => setEditingWeapon({ ...editingWeapon, name: e.target.value })}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chương xuất hiện</label>
                            <input
                              type="number"
                              value={editingWeapon.chapter || ''}
                              onChange={(e) => setEditingWeapon({ ...editingWeapon, chapter: e.target.value })}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mô tả binh khí</label>
                            <textarea
                              value={editingWeapon.description || ''}
                              onChange={(e) => setEditingWeapon({ ...editingWeapon, description: e.target.value })}
                              rows={2}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setEditingWeaponIdx(null)} className="btn-secondary-sm">Hủy</button>
                            <button onClick={() => handleSaveWeapon(idx)} className="btn-primary-sm">Lưu</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '3px solid #ef4444' }}>
                        <div style={{ flex: 1, paddingRight: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>{w.name}</h4>
                            {w.chapter && (
                              <span className="meta-badge" style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.2)' }}>Chương {w.chapter}</span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: '1.4' }}>{w.description || 'Chưa có mô tả.'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => { setEditingWeaponIdx(idx); setEditingWeapon({ ...w }); }} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Sửa"><Edit className="icon-xs" /></button>
                          <button onClick={() => handleDeleteWeapon(idx)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Xóa"><Trash2 className="icon-xs text-red" /></button>
                        </div>
                      </div>
                    );
                  })}

                  {isAddingWeapon ? (
                    <div className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', borderBottom: '1px solid var(--border-glass)', paddingBottom: '4px', margin: '0 0 4px 0' }}>Thêm binh khí mới</h4>
                      <div>
                        <input
                          type="text"
                          placeholder="Tên binh khí / pháp khí..."
                          value={newWeapon.name}
                          onChange={(e) => setNewWeapon({ ...newWeapon, name: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Chương số xuất hiện..."
                          value={newWeapon.chapter}
                          onChange={(e) => setNewWeapon({ ...newWeapon, chapter: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <textarea
                          placeholder="Mô tả binh khí..."
                          value={newWeapon.description}
                          onChange={(e) => setNewWeapon({ ...newWeapon, description: e.target.value })}
                          rows={2}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => setIsAddingWeapon(false)} className="btn-secondary-sm">Hủy</button>
                        <button onClick={handleAddWeapon} className="btn-primary-sm">Thêm</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIsAddingWeapon(true)} className="btn-secondary-sm" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                      <Plus className="icon-xs" /> Thêm Binh Khí Mới
                    </button>
                  )}
                  {(!storyLedger?.weapons || storyLedger.weapons.length === 0) && !isAddingWeapon && (
                    <p className="text-muted text-center padding-sm" style={{ fontSize: '12px' }}>Chưa có binh khí nào trong sổ cái.</p>
                  )}
                </div>
              )}

              {worldSection === 'techniques' && (
                <div className="world-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(storyLedger?.techniques || []).map((t, idx) => {
                    const isEditing = editingTechniqueIdx === idx;
                    if (isEditing) {
                      return (
                        <div key={idx} className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Tên công pháp</label>
                            <input
                              type="text"
                              value={editingTechnique.name}
                              onChange={(e) => setEditingTechnique({ ...editingTechnique, name: e.target.value })}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chương xuất hiện</label>
                            <input
                              type="number"
                              value={editingTechnique.chapter || ''}
                              onChange={(e) => setEditingTechnique({ ...editingTechnique, chapter: e.target.value })}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Mô tả công pháp</label>
                            <textarea
                              value={editingTechnique.description || ''}
                              onChange={(e) => setEditingTechnique({ ...editingTechnique, description: e.target.value })}
                              rows={2}
                              style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                            <button onClick={() => setEditingTechniqueIdx(null)} className="btn-secondary-sm">Hủy</button>
                            <button onClick={() => handleSaveTechnique(idx)} className="btn-primary-sm">Lưu</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={idx} className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '3px solid #3b82f6' }}>
                        <div style={{ flex: 1, paddingRight: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: '600', margin: 0 }}>{t.name}</h4>
                            {t.chapter && (
                              <span className="meta-badge" style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderColor: 'rgba(59, 130, 246, 0.2)' }}>Chương {t.chapter}</span>
                            )}
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '6px 0 0 0', lineHeight: '1.4' }}>{t.description || 'Chưa có mô tả.'}</p>
                        </div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => { setEditingTechniqueIdx(idx); setEditingTechnique({ ...t }); }} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Sửa"><Edit className="icon-xs" /></button>
                          <button onClick={() => handleDeleteTechnique(idx)} className="btn-icon" style={{ width: '28px', height: '28px' }} title="Xóa"><Trash2 className="icon-xs text-red" /></button>
                        </div>
                      </div>
                    );
                  })}

                  {isAddingTechnique ? (
                    <div className="glass-light" style={{ padding: '12px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <h4 style={{ fontSize: '13px', fontWeight: '600', borderBottom: '1px solid var(--border-glass)', paddingBottom: '4px', margin: '0 0 4px 0' }}>Thêm công pháp mới</h4>
                      <div>
                        <input
                          type="text"
                          placeholder="Tên công pháp..."
                          value={newTechnique.name}
                          onChange={(e) => setNewTechnique({ ...newTechnique, name: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          placeholder="Chương số xuất hiện..."
                          value={newTechnique.chapter}
                          onChange={(e) => setNewTechnique({ ...newTechnique, chapter: e.target.value })}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div>
                        <textarea
                          placeholder="Mô tả công pháp..."
                          value={newTechnique.description}
                          onChange={(e) => setNewTechnique({ ...newTechnique, description: e.target.value })}
                          rows={2}
                          style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px', fontSize: '13px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                        <button onClick={() => setIsAddingTechnique(false)} className="btn-secondary-sm">Hủy</button>
                        <button onClick={handleAddTechnique} className="btn-primary-sm">Thêm</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setIsAddingTechnique(true)} className="btn-secondary-sm" style={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                      <Plus className="icon-xs" /> Thêm Công Pháp Mới
                    </button>
                  )}
                  {(!storyLedger?.techniques || storyLedger.techniques.length === 0) && !isAddingTechnique && (
                    <p className="text-muted text-center padding-sm" style={{ fontSize: '12px' }}>Chưa có công pháp nào trong sổ cái.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column: Threads (Unresolved/Resolved tabs) */}
        <div className="overview-col glass">
          <div className="col-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <HelpCircle className="icon-sm text-yellow" />
              <h3 style={{ margin: 0 }}>Nút Thắt Cốt Truyện</h3>
            </div>
            <div className="tab-switcher" style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '6px', padding: '2px' }}>
              <button
                className={`tab-btn ${threadsTab === 'unresolved' ? 'active' : ''}`}
                onClick={() => setThreadsTab('unresolved')}
                style={{
                  border: 'none',
                  background: threadsTab === 'unresolved' ? 'var(--color-cyan)' : 'transparent',
                  color: threadsTab === 'unresolved' ? '#10141f' : 'var(--text-secondary)',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Chưa giải ({unresolved.length})
              </button>
              <button
                className={`tab-btn ${threadsTab === 'resolved' ? 'active' : ''}`}
                onClick={() => setThreadsTab('resolved')}
                style={{
                  border: 'none',
                  background: threadsTab === 'resolved' ? 'var(--color-cyan)' : 'transparent',
                  color: threadsTab === 'resolved' ? '#10141f' : 'var(--text-secondary)',
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                Đã giải ({storyLedger?.resolved_threads?.length || 0})
              </button>
            </div>
          </div>

          <div className="threads-list-container" style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '450px', paddingRight: '4px' }}>
            {threadsTab === 'unresolved' ? (
              <>
                {unresolved.map((thread, index) => {
                  const isEditing = editingThreadIndex === index;
                  const isResolving = resolvingThreadIndex === index;
                  
                  // Support both string (old data) and object (new data)
                  const threadText = typeof thread === 'object' && thread !== null ? thread.thread : thread;
                  const threadChapter = typeof thread === 'object' && thread !== null ? thread.chapter : null;

                  if (isResolving) {
                    return (
                      <div key={index} className="unresolved-item glass-light" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid var(--color-green)' }}>
                        <div>
                          <span style={{ color: 'var(--color-green)', fontWeight: '600', fontSize: '13px' }}>Giải quyết: </span>
                          <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>"{threadText}"</span>
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Cách giải quyết / Ghi chú</label>
                          <textarea
                            placeholder="Mô tả cách nút thắt này được giải quyết..."
                            value={resolvingThreadNote}
                            onChange={(e) => setResolvingThreadNote(e.target.value)}
                            className="form-control"
                            rows={2}
                            style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px', fontFamily: 'var(--font-sans)', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Chương giải quyết (Bỏ trống nếu không rõ)</label>
                          <input
                            type="number"
                            placeholder="Nhập số chương giải quyết..."
                            value={resolvingThreadChapter}
                            onChange={(e) => setResolvingThreadChapter(e.target.value)}
                            style={{ width: '100%', background: '#151a24', color: '#fff', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '8px', fontSize: '13px', outline: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', width: '100%' }}>
                          <button onClick={() => setResolvingThreadIndex(null)} className="btn-secondary-sm">Hủy</button>
                          <button onClick={() => handleResolveThread(index)} className="btn-primary-sm" style={{ background: 'var(--color-green)', borderColor: 'var(--color-green)', color: '#10141f' }}>Xác nhận</button>
                        </div>
                      </div>
                    );
                  }

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
                                  setResolvingThreadIndex(index);
                                  setResolvingThreadNote('');
                                  setResolvingThreadChapter('');
                                }}
                                className="btn-icon"
                                style={{ width: '28px', height: '28px' }}
                                title="Giải quyết nút thắt"
                              >
                                <Check className="icon-xs text-green" />
                              </button>
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
                  <div className="unresolved-empty" style={{ textAlign: 'center', padding: '20px 0' }}>
                    <p className="text-green">✓ Tất cả các nút thắt đã được giải quyết!</p>
                  </div>
                )}
              </>
            ) : (
              <>
                {(storyLedger?.resolved_threads || []).map((thread, index) => {
                  const threadText = typeof thread === 'object' && thread !== null ? thread.thread : thread;
                  const threadChapIntro = typeof thread === 'object' && thread !== null ? thread.chapter_introduced : null;
                  const threadChapResolved = typeof thread === 'object' && thread !== null ? thread.chapter_resolved : null;
                  const threadNote = typeof thread === 'object' && thread !== null ? thread.resolution_note : '';

                  return (
                    <div key={index} className="resolved-item glass-light" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 14px', borderRadius: '8px', borderLeft: '3px solid var(--color-green)' }}>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <span className="thread-number" style={{ color: 'var(--color-green)', fontWeight: '600', fontSize: '13px' }}>#{index + 1}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          <p className="thread-text" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'line-through', lineHeight: '1.5' }}>{threadText}</p>
                          
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                            {threadChapIntro !== null && threadChapIntro !== undefined && (
                              <span className="meta-badge chapter-badge" style={{ fontSize: '10px', padding: '1px 4px', background: 'rgba(234, 179, 8, 0.05)', borderColor: 'rgba(234, 179, 8, 0.1)', color: 'rgba(234, 179, 8, 0.8)' }}>
                                Xuất hiện: Chương {threadChapIntro}
                              </span>
                            )}
                            {threadChapResolved !== null && threadChapResolved !== undefined && (
                              <span className="meta-badge chapter-badge" style={{ fontSize: '10px', padding: '1px 4px', background: 'rgba(34, 197, 94, 0.1)', borderColor: 'rgba(34, 197, 94, 0.2)', color: 'var(--color-green)' }}>
                                Giải quyết: Chương {threadChapResolved}
                              </span>
                            )}
                          </div>
                          
                          {threadNote && (
                            <div style={{ marginTop: '6px', padding: '6px 10px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '4px', borderLeft: '2px solid rgba(34, 197, 94, 0.3)' }}>
                              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', fontWeight: '600', marginBottom: '2px' }}>Cách giải quyết:</span>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4', margin: 0 }}>{threadNote}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {(!storyLedger?.resolved_threads || storyLedger.resolved_threads.length === 0) && (
                  <div className="unresolved-empty" style={{ textAlign: 'center', padding: '20px 0' }}>
                    <p className="text-muted">Chưa có nút thắt nào được giải quyết.</p>
                  </div>
                )}
              </>
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
