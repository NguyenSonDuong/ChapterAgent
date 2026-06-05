import React from 'react';
import { User, Tag, HelpCircle, History, BookOpen, UserCheck } from 'lucide-react';

export default function StoryOverview({ storyMeta, storyLedger }) {
  if (!storyMeta) {
    return (
      <div className="center-content">
        <p className="text-muted">Chọn hoặc tạo một bộ truyện từ thanh Sidebar để xem chi tiết</p>
      </div>
    );
  }

  const unresolved = storyLedger?.unresolved_threads || [];
  const timeline = storyLedger?.timeline || [];

  return (
    <div className="story-overview fade-in">
      <div className="overview-header glass">
        <h1 className="story-title">{storyMeta.name}</h1>
        <div className="story-meta-tags">
          <span className="meta-badge model-badge">{storyMeta.model}</span>
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
          <div className="col-header">
            <UserCheck className="icon-sm text-cyan" />
            <h3>Nhân Vật Chính ({storyMeta.characters?.length || 0})</h3>
          </div>
          <div className="characters-grid">
            {(storyMeta.characters || []).map((char, index) => (
              <div key={index} className="character-card glass-light">
                <div className="char-avatar-container">
                  <div className="char-avatar">
                    <User className="icon-sm" />
                  </div>
                  <div className="char-name-role">
                    <h4 className="char-name">{char.name}</h4>
                    <span className="char-role">{char.role}</span>
                  </div>
                </div>
                <p className="char-desc">{char.description || 'Chưa có mô tả chi tiết.'}</p>
                {char.first_chapter && (
                  <span className="char-first-chap">Xuất hiện: Chương {char.first_chapter}</span>
                )}
              </div>
            ))}
            {(!storyMeta.characters || storyMeta.characters.length === 0) && (
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
          <div className="unresolved-list">
            {unresolved.map((thread, index) => (
              <div key={index} className="unresolved-item glass-light">
                <span className="thread-number">#{index + 1}</span>
                <p className="thread-text">{thread}</p>
              </div>
            ))}
            {unresolved.length === 0 && (
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
