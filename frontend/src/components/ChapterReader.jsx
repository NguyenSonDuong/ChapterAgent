import React, { useState, useEffect } from 'react';
import { BookOpen, Edit2, Save, Trash2, Eye, FileText, Settings } from 'lucide-react';

export default function ChapterReader({ 
  storyUuid, 
  chapters, 
  onUpdateChapterContent, 
  onDeleteChapter, 
  activeChapterNum,
  setActiveChapterNum,
  backendUrl
}) {
  const [selectedNum, setSelectedNum] = useState('');
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Selection states for AI editing
  const [selectionInfo, setSelectionInfo] = useState(null); // { text: '', rect: { top, left, width, height } }
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');
  const [aiEditing, setAiEditing] = useState(false);

  // Sync selectedNum with activeChapterNum if passed
  useEffect(() => {
    if (activeChapterNum) {
      setSelectedNum(activeChapterNum.toString());
    } else if (chapters.length > 0) {
      setSelectedNum(chapters[0].chapter.toString());
    } else {
      setSelectedNum('');
      setChapterData(null);
    }
  }, [activeChapterNum, chapters]);

  // Fetch chapter files from backend when selectedNum changes
  useEffect(() => {
    if (!selectedNum || !storyUuid) {
      setChapterData(null);
      return;
    }

    const fetchChapter = async () => {
      setLoading(true);
      setEditMode(false);
      try {
        const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyUuid}/chapters/${selectedNum}`);
        if (res.ok) {
          const data = await res.json();
          setChapterData(data);
          setEditContent(data.content);
        } else {
          setChapterData(null);
        }
      } catch (e) {
        console.error(e);
        setChapterData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchChapter();
  }, [selectedNum, storyUuid]);

  // Handle text selection events inside the textarea in Edit Mode
  const handleTextareaSelect = (e) => {
    if (!editMode) return;
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    
    if (start !== end) {
      const selectedText = textarea.value.substring(start, end).trim();
      if (selectedText.length > 0) {
        setSelectionInfo({
          text: selectedText,
          start,
          end,
          isTextarea: true
        });
        return;
      }
    }
    
    if (!showEditPopup) {
      setSelectionInfo(null);
    }
  };

  // Apply AI editing and replace text inside the textarea content (no automatic save)
  const handleApplyAiEdit = async () => {
    if (!selectionInfo || !editInstruction.trim() || !storyUuid || !selectedNum) return;
    
    setAiEditing(true);
    try {
      const targetUrl = backendUrl ? backendUrl.replace(/\/$/, '') : 'http://127.0.0.1:5000';
      const res = await fetch(`${targetUrl}/api/stories/${storyUuid}/chapters/${selectedNum}/edit-paragraph`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paragraph: selectionInfo.text,
          instruction: editInstruction.trim()
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        const revisedText = data.revised_paragraph;
        
        // Replace selection inside editContent state without writing to disk yet
        const start = selectionInfo.start;
        const end = selectionInfo.end;
        const newContent = editContent.substring(0, start) + revisedText + editContent.substring(end);
        
        setEditContent(newContent);
        
        const textarea = document.querySelector('.content-editor');
        if (textarea) {
          textarea.selectionStart = textarea.selectionEnd;
        }
        
        // Reset states
        setSelectionInfo(null);
        setShowEditPopup(false);
        setEditInstruction('');
      } else {
        const errData = await res.json();
        alert(errData.error || "Không thể chỉnh sửa văn bản bằng AI.");
      }
    } catch (e) {
      console.error(e);
      alert("Lỗi kết nối đến Backend.");
    } finally {
      setAiEditing(false);
    }
  };

  const handleSave = async () => {
    if (!selectedNum || !storyUuid) return;
    setSaving(true);
    const success = await onUpdateChapterContent(selectedNum, editContent);
    setSaving(false);
    if (success) {
      setEditMode(false);
      // Refresh chapter content
      setChapterData({
        ...chapterData,
        content: editContent
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedNum) return;
    if (window.confirm(`Bạn có chắc chắn muốn xóa Chương ${selectedNum}? Thao tác này sẽ xóa vĩnh viễn nội dung và trạng thái file trên ổ đĩa.`)) {
      const success = await onDeleteChapter(selectedNum);
      if (success) {
        setChapterData(null);
        setSelectedNum('');
        if (setActiveChapterNum) setActiveChapterNum(null);
      }
    }
  };

  if (chapters.length === 0) {
    return (
      <div className="center-content">
        <BookOpen className="icon-lg text-muted margin-bottom-sm" />
        <p className="text-muted">Bộ truyện này chưa có chương nào được viết.</p>
      </div>
    );
  }

  return (
    <div className="chapter-reader fade-in">
      <div className="reader-toolbar glass">
        <div className="toolbar-left">
          <label className="toolbar-label">Chọn Chương:</label>
          <select 
            value={selectedNum} 
            onChange={e => {
              setSelectedNum(e.target.value);
              if (setActiveChapterNum) setActiveChapterNum(parseInt(e.target.value));
            }}
            className="form-select-sm"
          >
            {chapters.map(chap => (
              <option key={chap.chapter} value={chap.chapter}>
                Chương {chap.chapter}: {chap.title}
              </option>
            ))}
          </select>
        </div>

        {chapterData && (
          <div className="toolbar-right">
            {!editMode ? (
              <button 
                onClick={() => setEditMode(true)} 
                className="btn-toolbar btn-edit"
              >
                <Edit2 className="icon-xs" /> <span>Chỉnh sửa</span>
              </button>
            ) : (
              <>
                {selectionInfo && selectionInfo.isTextarea && (
                  <button
                    onClick={() => setShowEditPopup(true)}
                    className="btn-toolbar"
                    style={{
                      background: 'rgba(6, 182, 212, 0.15)',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                      color: 'var(--color-cyan)',
                      marginRight: '8px',
                      boxShadow: '0 0 10px rgba(6, 182, 212, 0.1)'
                    }}
                    title="Chỉnh sửa phần bôi đen bằng AI"
                  >
                    <Edit2 className="icon-xs text-cyan" /> <span>Sửa bôi đen bằng AI</span>
                  </button>
                )}
                <button 
                  onClick={() => setEditMode(false)} 
                  className="btn-toolbar btn-cancel"
                  disabled={saving}
                >
                  <Eye className="icon-xs" /> <span>Đọc</span>
                </button>
                <button 
                  onClick={handleSave} 
                  className="btn-toolbar btn-save"
                  disabled={saving}
                >
                  <Save className="icon-xs" /> <span>{saving ? 'Đang lưu...' : 'Lưu lại'}</span>
                </button>
              </>
            )}
            <button 
              onClick={handleDelete} 
              className="btn-toolbar btn-delete"
            >
              <Trash2 className="icon-xs" /> <span>Xóa</span>
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="center-content">
          <div className="loader spin"></div>
          <p className="margin-top-sm">Đang nạp nội dung chương...</p>
        </div>
      ) : !chapterData ? (
        <div className="center-content">
          <p className="text-muted">Không tải được nội dung chương. Vui lòng chọn chương khác.</p>
        </div>
      ) : (
        <div className="reader-layout">
          {/* Left panel: Content */}
          <div className="reader-content-panel glass">
            {editMode ? (
              <textarea
                className="content-editor"
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                onSelect={handleTextareaSelect}
                onKeyUp={handleTextareaSelect}
                onMouseUp={handleTextareaSelect}
                placeholder="Nhập nội dung truyện bằng định dạng Markdown..."
              />
            ) : (
              <div className="markdown-body">
                {chapterData.content.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h2 key={idx} className="md-title">{line.substring(2)}</h2>;
                  } else if (line.startsWith('## ')) {
                    return <h3 key={idx} className="md-subtitle">{line.substring(3)}</h3>;
                  } else if (line.trim() === '') {
                    return <br key={idx} />;
                  } else {
                    return <p key={idx} className="md-paragraph">{line}</p>;
                  }
                })}
              </div>
            )}
          </div>


          {/* Right panel: Logic state */}
          <div className="reader-state-panel glass">
            <div className="state-panel-header">
              <FileText className="icon-xs text-cyan" />
              <h4>Trạng thái logic chương</h4>
            </div>
            
            <div className="state-panel-body">
              {chapterData.state ? (
                <div className="state-markdown">
                  {chapterData.state.split('\n').map((line, idx) => {
                    if (line.startsWith('# ')) return null; // Skip title
                    if (line.startsWith('## ')) {
                      return <h5 key={idx} className="state-section-title">{line.substring(3)}</h5>;
                    }
                    if (line.startsWith('- ')) {
                      return <div key={idx} className="state-bullet">{line.substring(2)}</div>;
                    }
                    return <p key={idx} className="state-text">{line}</p>;
                  })}
                </div>
              ) : (
                <p className="text-muted">Chưa có thông tin trạng thái trích xuất cho chương này.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* AI Paragraph Edit Modal */}
      {showEditPopup && selectionInfo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(10, 14, 23, 0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          animation: 'fadeIn 0.2s ease'
        }}>
          <div className="glass" style={{
            width: '90%',
            maxWidth: '550px',
            borderRadius: '12px',
            padding: '24px',
            border: '1px solid var(--border-glass)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            background: 'rgba(18, 22, 33, 0.9)'
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-glass)', paddingBottom: '10px' }}>
              Chỉnh Sửa Đoạn Văn Bằng AI
            </h3>
            
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Văn bản gốc:</label>
              <div style={{
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '10px 12px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '6px',
                border: '1px solid var(--border-glass)',
                fontSize: '14px',
                color: 'var(--text-muted)',
                lineHeight: '1.5',
                fontStyle: 'italic'
              }}>
                "{selectionInfo.text}"
              </div>
            </div>
            
            <div>
              <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px', fontWeight: '600' }}>Yêu cầu chỉnh sửa:</label>
              <textarea
                placeholder="Ví dụ: Viết lại đoạn văn giàu cảm xúc hơn, thêm miêu tả hành động, hoặc đổi ngôi kể..."
                value={editInstruction}
                onChange={e => setEditInstruction(e.target.value)}
                disabled={aiEditing}
                rows={3}
                style={{
                  width: '100%',
                  background: '#10141f',
                  color: '#fff',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '6px',
                  padding: '10px',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'var(--font-sans)'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => {
                  setShowEditPopup(false);
                  setEditInstruction('');
                  window.getSelection()?.removeAllRanges();
                  const textarea = document.querySelector('.content-editor');
                  if (textarea) {
                    textarea.selectionStart = textarea.selectionEnd;
                  }
                  setSelectionInfo(null);
                }}
                disabled={aiEditing}
                className="btn-secondary-sm"
                style={{ padding: '8px 16px' }}
              >
                Hủy
              </button>
              <button
                onClick={handleApplyAiEdit}
                disabled={aiEditing || !editInstruction.trim()}
                className="btn-primary-sm"
                style={{
                  padding: '8px 16px',
                  background: 'var(--color-cyan)',
                  borderColor: 'var(--color-cyan)',
                  color: '#10141f',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {aiEditing ? (
                  <>
                    <div className="loader spin" style={{ width: '12px', height: '12px', borderTopColor: '#10141f' }}></div>
                    <span>Đang sửa...</span>
                  </>
                ) : (
                  <span>Áp dụng AI</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
