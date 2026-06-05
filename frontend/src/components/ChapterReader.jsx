import React, { useState, useEffect } from 'react';
import { BookOpen, Edit2, Save, Trash2, Eye, FileText, Settings } from 'lucide-react';

export default function ChapterReader({ 
  storyUuid, 
  chapters, 
  onUpdateChapterContent, 
  onDeleteChapter, 
  activeChapterNum,
  setActiveChapterNum
}) {
  const [selectedNum, setSelectedNum] = useState('');
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

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
    </div>
  );
}
