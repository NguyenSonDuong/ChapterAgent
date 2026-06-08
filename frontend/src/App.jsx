import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { BookOpen, Sparkles, HelpCircle, FileText, LayoutDashboard, RefreshCw } from 'lucide-react';
import Sidebar from './components/Sidebar';
import NewStoryModal from './components/NewStoryModal';
import StoryOverview from './components/StoryOverview';
import ChapterReader from './components/ChapterReader';
import ChapterGenerator from './components/ChapterGenerator';
import './App.css';

const BACKEND_URL = 'http://127.0.0.1:5000';

export default function App() {
  const [stories, setStories] = useState([]);
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [storyMeta, setStoryMeta] = useState(null);
  const [storyLedger, setStoryLedger] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [activeChapterNum, setActiveChapterNum] = useState(null);
  
  const [activeTab, setActiveTab] = useState('overview'); // overview, reader, generator
  const [showNewStoryModal, setShowNewStoryModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socket, setSocket] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // 1. Setup Socket.IO connection
  useEffect(() => {
    const newSocket = io(BACKEND_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Socket.IO connection established with backend');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // 2. Fetch all stories on mount
  useEffect(() => {
    fetchStories();
  }, []);

  // 3. Fetch detailed data for selected story
  useEffect(() => {
    if (!selectedStoryId) {
      setStoryMeta(null);
      setStoryLedger(null);
      setChapters([]);
      setActiveChapterNum(null);
      return;
    }

    fetchStoryDetails(selectedStoryId);
  }, [selectedStoryId]);

  const fetchStories = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/stories`);
      if (res.ok) {
        const data = await res.json();
        setStories(data);
        // Default select first story if none selected
        if (data.length > 0 && !selectedStoryId) {
          setSelectedStoryId(data[0].uuid);
        }
      }
    } catch (e) {
      console.error('Failed to fetch stories:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStoryDetails = async (uuid) => {
    try {
      // 1. Fetch Meta
      const metaRes = await fetch(`${BACKEND_URL}/api/stories/${uuid}`);
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        setStoryMeta(metaData);
      }

      // 2. Fetch Ledger
      const ledgerRes = await fetch(`${BACKEND_URL}/api/stories/${uuid}/ledger`);
      if (ledgerRes.ok) {
        const ledgerData = await ledgerRes.json();
        setStoryLedger(ledgerData);
      }

      // 3. Fetch Chapters
      const chaptersRes = await fetch(`${BACKEND_URL}/api/stories/${uuid}/chapters`);
      if (chaptersRes.ok) {
        const chaptersData = await chaptersRes.json();
        setChapters(chaptersData);
        if (chaptersData.length > 0) {
          setActiveChapterNum(prev => {
            if (prev && chaptersData.some(c => c.chapter === prev)) {
              return prev;
            }
            return chaptersData[0].chapter;
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch story details:', e);
    }
  };

  const handleCreateStory = async (storyData) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(storyData)
      });
      if (res.ok) {
        const result = await res.json();
        await fetchStories();
        setSelectedStoryId(result.uuid);
        setActiveTab('overview');
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      alert('Không thể kết nối đến backend server.');
      return false;
    }
  };

  const handleUpdateChapterContent = async (chapNum, content) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stories/${selectedStoryId}/chapters/${chapNum}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      if (res.ok) {
        // Refresh chapter list and details
        await fetchStoryDetails(selectedStoryId);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleDeleteChapter = async (chapNum) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/stories/${selectedStoryId}/chapters/${chapNum}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // Refresh everything
        await fetchStoryDetails(selectedStoryId);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const handleGenerationComplete = (newChapterNum) => {
    // Refresh story details after generation finishes
    setTimeout(() => {
      fetchStoryDetails(selectedStoryId);
      setActiveChapterNum(newChapterNum);
      setActiveTab('reader'); // Go directly to read tab to show the new chapter
    }, 1000);
  };

  return (
    <div className="app-container">
      {/* Sidebar listing all stories */}
      <Sidebar
        stories={stories}
        selectedStoryId={selectedStoryId}
        onSelectStory={(id) => { setSelectedStoryId(id); setActiveTab('overview'); }}
        onOpenNewStoryModal={() => setShowNewStoryModal(true)}
        onRefresh={fetchStories}
        loading={loading}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main workspace */}
      <div className="main-workspace">
        {storyMeta ? (
          <>
            {/* Top Navigation tabs bar */}
            <div className="top-nav-tabs glass">
              <button 
                className={`nav-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <LayoutDashboard className="icon-xs" />
                <span>Tổng Quan</span>
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'reader' ? 'active' : ''}`}
                onClick={() => setActiveTab('reader')}
              >
                <BookOpen className="icon-xs" />
                <span>Đọc Tác Phẩm</span>
              </button>
              <button 
                className={`nav-tab-btn ${activeTab === 'generator' ? 'active' : ''}`}
                onClick={() => setActiveTab('generator')}
              >
                <Sparkles className="icon-xs" />
                <span>Sáng Tác Chương Mới</span>
              </button>
            </div>

            <div className="tab-content-container" style={{ position: 'relative' }}>
              <div style={{ display: activeTab === 'overview' ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>
                <StoryOverview 
                  storyMeta={storyMeta} 
                  storyLedger={storyLedger} 
                  backendUrl={BACKEND_URL}
                  onRefreshDetails={() => fetchStoryDetails(selectedStoryId)}
                />
              </div>
              <div style={{ display: activeTab === 'reader' ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>
                <ChapterReader
                  storyUuid={selectedStoryId}
                  chapters={chapters}
                  activeChapterNum={activeChapterNum}
                  setActiveChapterNum={setActiveChapterNum}
                  onUpdateChapterContent={handleUpdateChapterContent}
                  onDeleteChapter={handleDeleteChapter}
                  backendUrl={BACKEND_URL}
                  storyMeta={storyMeta}
                  storyLedger={storyLedger}
                />

              </div>
              <div style={{ display: activeTab === 'generator' ? 'flex' : 'none', flexDirection: 'column', flex: 1 }}>
                <ChapterGenerator
                  storyUuid={selectedStoryId}
                  defaultModel={storyMeta?.model}
                  storyMeta={storyMeta}
                  storyLedger={storyLedger}
                  socket={socket}
                  onGenerationComplete={handleGenerationComplete}
                  backendUrl={BACKEND_URL}
                />
              </div>
            </div>
          </>
        ) : (
          <div className="center-content text-center">
            <BookOpen className="icon-lg text-muted margin-bottom-sm" />
            <h3>Chưa có câu chuyện nào</h3>
            <p className="text-muted padding-xs">Vui lòng chọn hoặc bấm nút thêm mới để tạo tác phẩm đầu tiên.</p>
            <button onClick={() => setShowNewStoryModal(true)} className="btn-primary margin-top-md">
              Khởi tạo truyện mới
            </button>
          </div>
        )}
      </div>

      {/* Modal overlays */}
      {showNewStoryModal && (
        <NewStoryModal
          onClose={() => setShowNewStoryModal(false)}
          onCreateStory={handleCreateStory}
        />
      )}
    </div>
  );
}
