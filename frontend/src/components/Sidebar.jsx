import React from 'react';
import { BookOpen, Plus, Settings, Sparkles, RefreshCw } from 'lucide-react';

export default function Sidebar({ 
  stories, 
  selectedStoryId, 
  onSelectStory, 
  onOpenNewStoryModal, 
  onRefresh, 
  loading 
}) {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <Sparkles className="logo-icon text-cyan" />
          <h2 className="logo-text">Chapter<span className="text-cyan">Agent</span></h2>
        </div>
        <button 
          onClick={onRefresh} 
          className="btn-icon" 
          title="Tải lại danh sách"
          disabled={loading}
        >
          <RefreshCw className={`icon-sm ${loading ? 'spin' : ''}`} />
        </button>
      </div>

      <div className="sidebar-content">
        <div className="section-title">
          <span>DANH SÁCH TRUYỆN</span>
          <button 
            onClick={onOpenNewStoryModal} 
            className="btn-add-story" 
            title="Khởi tạo truyện mới"
          >
            <Plus className="icon-xs" />
            <span>Thêm mới</span>
          </button>
        </div>

        {stories.length === 0 ? (
          <div className="empty-stories">
            <p>Chưa có tác phẩm nào</p>
            <button onClick={onOpenNewStoryModal} className="btn-primary-sm">
              <Plus className="icon-xs" /> Tạo truyện mới
            </button>
          </div>
        ) : (
          <div className="stories-list">
            {stories.map((story) => {
              const isSelected = story.uuid === selectedStoryId;
              return (
                <div
                  key={story.uuid}
                  className={`story-item ${isSelected ? 'active' : ''}`}
                  onClick={() => onSelectStory(story.uuid)}
                >
                  <BookOpen className="story-item-icon" />
                  <div className="story-item-details">
                    <span className="story-item-name">{story.name}</span>
                    <span className="story-item-meta">{story.model}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="sidebar-footer">
        <div className="footer-info">
          <Settings className="icon-xs text-muted" />
          <span>v2.0 (Flask & Socket.IO)</span>
        </div>
      </div>
    </div>
  );
}
