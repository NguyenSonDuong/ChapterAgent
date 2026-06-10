import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Edit2, Save, Trash2, Eye, FileText, Settings, Plus, XCircle, X, Link, Check, Sparkles, AlertTriangle, Volume2, Download } from 'lucide-react';

export default function ChapterReader({ 
  storyUuid, 
  chapters, 
  onUpdateChapterContent, 
  onDeleteChapter, 
  activeChapterNum,
  setActiveChapterNum,
  backendUrl,
  storyMeta,
  storyLedger
}) {
  const targetUrl = backendUrl ? backendUrl.replace(/\/$/, '') : 'http://127.0.0.1:5000';
  const [selectedNum, setSelectedNum] = useState('');
  const [chapterData, setChapterData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);

  // Audio TTS States
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef(null);

  // Selection states for AI editing
  const [selectionInfo, setSelectionInfo] = useState(null); // { text: '', rect: { top, left, width, height } }
  const [showEditPopup, setShowEditPopup] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');
  const [aiEditing, setAiEditing] = useState(false);

  // --- Canvas Node Editor States ---
  const [showCanvasModal, setShowCanvasModal] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [linkingSourceNodeId, setLinkingSourceNodeId] = useState(null);
  const [savingNodes, setSavingNodes] = useState(false);
  const [syncingNodes, setSyncingNodes] = useState(false);
  const [suggestingNodeId, setSuggestingNodeId] = useState(null);
  const [chapterNodesCache, setChapterNodesCache] = useState({});
  const [nodeForm, setNodeForm] = useState({
    title: '',
    description: '',
    characters: [],
    resolvedThreadText: '',
    resolutionNote: '',
    links: [],
    locations: [],
    weapons: [],
    techniques: [],
    content: ''
  });


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
    // Stop any playing audio when selected chapter changes
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (!selectedNum || !storyUuid) {
      setChapterData(null);
      return;
    }

    const fetchChapter = async () => {
      setLoading(true);
      setEditMode(false);
      try {
        const res = await fetch(`${targetUrl}/api/stories/${storyUuid}/chapters/${selectedNum}`);
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

    return () => {
      // Clean up audio when component unmounts or selectedNum changes
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
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

  const cleanTextForTts = (text) => {
    if (!text) return '';
    const lines = text.split('\n');
    const filteredLines = lines.filter(line => !line.trim().startsWith('#'));
    const cleanedText = filteredLines.join('\n');
    return cleanedText
      .replace(/[#*`~_\[\]()]/g, '') // remove markdown symbols
      .replace(/- /g, '') // remove list hyphens
      .trim();
  };

  const handlePlayAudio = async () => {
    if (!chapterData || !chapterData.content) return;
    
    // Toggle pause/play if already playing
    if (audioRef.current && audioPlaying) {
      audioRef.current.pause();
      setAudioPlaying(false);
      return;
    }

    setAudioLoading(true);
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      
      const cleanText = cleanTextForTts(chapterData.content);
      const response = await fetch(`${targetUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: cleanText,
          ref_audio: '',
          sample_rate: 24000
        })
      });
      
      if (!response.ok) {
        throw new Error('TTS server returned error ' + response.status);
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setAudioPlaying(false);
        audioRef.current = null;
      };
      
      audio.onerror = (e) => {
        console.error("Audio playback error:", e);
        setAudioPlaying(false);
        audioRef.current = null;
      };

      setAudioLoading(false);
      setAudioPlaying(true);
      await audio.play();
    } catch (error) {
      console.error(error);
      alert('Không thể phát Audio: ' + error.message);
      setAudioLoading(false);
      setAudioPlaying(false);
    }
  };

  const handleDownloadAudio = async () => {
    if (!chapterData || !chapterData.content) return;
    setAudioLoading(true);
    try {
      const cleanText = cleanTextForTts(chapterData.content);
      const response = await fetch(`${targetUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: cleanText,
          ref_audio: '',
          sample_rate: 24000
        })
      });
      
      if (!response.ok) {
        throw new Error('TTS server returned error ' + response.status);
      }
      
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = audioUrl;
      link.download = `chap_${selectedNum}_audio.wav`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error(error);
      alert('Không thể tải Audio: ' + error.message);
    } finally {
      setAudioLoading(false);
    }
  };

  // Sync node editor form fields when editingNodeId changes
  useEffect(() => {
    if (editingNodeId) {
      const node = nodes.find(n => n.id === editingNodeId);
      if (node) {
        setNodeForm({
          title: node.title || '',
          description: node.description || '',
          characters: node.characters || [],
          resolvedThreadText: node.resolved_thread?.thread || '',
          resolutionNote: node.resolved_thread?.resolution_note || '',
          links: node.links || [],
          locations: Array.isArray(node.locations) ? node.locations : [],
          weapons: Array.isArray(node.weapons) ? node.weapons : [],
          techniques: Array.isArray(node.techniques) ? node.techniques : [],
          content: node.content || ''
        });
      }
    } else {
      setNodeForm({
        title: '',
        description: '',
        characters: [],
        resolvedThreadText: '',
        resolutionNote: '',
        links: [],
        locations: [],
        weapons: [],
        techniques: [],
        content: ''
      });
    }
  }, [editingNodeId, nodes]);

  const fetchChapterNodes = async (chapNum) => {
    if (chapterNodesCache[chapNum]) return;
    try {
      const res = await fetch(`${targetUrl}/api/stories/${storyUuid}/chapters/${chapNum}/nodes`);
      if (res.ok) {
        const data = await res.json();
        setChapterNodesCache(prev => ({ ...prev, [chapNum]: data }));
      }
    } catch (e) {
      console.error(`Failed to fetch nodes for chapter ${chapNum}:`, e);
    }
  };

  const handleOpenCanvasModal = async () => {
    if (!selectedNum || !storyUuid) return;
    setEditingNodeId(null);
    setLinkingSourceNodeId(null);
    setNodes([]);
    setConnections([]);
    
    try {
      const res = await fetch(`${targetUrl}/api/stories/${storyUuid}/chapters/${selectedNum}/nodes`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        setConnections(data.connections || []);
      }
    } catch (e) {
      console.error(e);
      alert('Không thể tải sơ đồ sự kiện của chương.');
    }
    
    setShowCanvasModal(true);
  };

  const handleSaveCanvasNodes = async () => {
    if (!selectedNum || !storyUuid) return;
    setSavingNodes(true);
    try {
      const res = await fetch(`${targetUrl}/api/stories/${storyUuid}/chapters/${selectedNum}/nodes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodes: nodes.map(({ id, title, description, characters, resolved_thread, links, locations, weapons, techniques, content, x, y }) => ({
            id, title, description, characters, resolved_thread, links, locations, weapons, techniques, content, x, y
          })),
          connections
        })
      });
      if (res.ok) {
        setShowCanvasModal(false);
      } else {
        const errData = await res.json();
        alert(errData.error || 'Lỗi khi lưu sơ đồ sự kiện.');
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối khi lưu sơ đồ sự kiện.');
    } finally {
      setSavingNodes(false);
    }
  };

  const handleSyncNodeContents = async () => {
    if (!selectedNum || !storyUuid) return;
    setSyncingNodes(true);
    try {
      const res = await fetch(`${targetUrl}/api/stories/${storyUuid}/chapters/${selectedNum}/align-nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Đồng bộ nội dung vào các node sự kiện thành công.');
        if (showCanvasModal) {
          setNodes(data.nodes || []);
          setConnections(data.connections || []);
        }
      } else {
        alert(data.error || 'Lỗi khi đồng bộ nội dung vào các node.');
      }
    } catch (e) {
      console.error(e);
      alert('Lỗi kết nối khi đồng bộ nội dung vào các node.');
    } finally {
      setSyncingNodes(false);
    }
  };

  // Canvas interaction actions
  const handleNodeMouseDown = (e, nodeId) => {
    if (e.button !== 0) return;
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
      return;
    }
    e.preventDefault();
    const nodeIndex = nodes.findIndex(n => n.id === nodeId);
    if (nodeIndex === -1) return;

    const node = nodes[nodeIndex];
    const startX = e.clientX - node.x;
    const startY = e.clientY - node.y;

    const handleMouseMove = (moveEvent) => {
      const newX = Math.max(10, Math.min(2200, moveEvent.clientX - startX));
      const newY = Math.max(10, Math.min(1450, moveEvent.clientY - startY));
      setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, x: newX, y: newY } : n));
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleAddNewNode = () => {
    const newId = `node-${Date.now()}`;
    const newNode = {
      id: newId,
      title: `Sự kiện ${nodes.length + 1}`,
      description: 'Mô tả diễn biến...',
      characters: [],
      resolved_thread: { thread: '', resolution_note: '' },
      links: [],
      locations: [],
      weapons: [],
      techniques: [],
      x: 150 + Math.random() * 200,
      y: 100 + Math.random() * 150
    };
    setNodes(prev => [...prev, newNode]);
    setEditingNodeId(newId);
  };

  const handleNodeLinkClick = (nodeId) => {
    if (!linkingSourceNodeId) {
      setLinkingSourceNodeId(nodeId);
    } else {
      if (linkingSourceNodeId === nodeId) {
        setLinkingSourceNodeId(null);
        return;
      }
      const exists = connections.some(c => c.from === linkingSourceNodeId && c.to === nodeId);
      if (!exists) {
        setConnections(prev => [...prev, { from: linkingSourceNodeId, to: nodeId }]);
      }
      setLinkingSourceNodeId(null);
    }
  };

  const handleDeleteNode = (nodeId) => {
    if (confirm('Bạn có chắc chắn muốn xóa sự kiện này?')) {
      setNodes(prev => prev.filter(n => n.id !== nodeId));
      setConnections(prev => prev.filter(c => c.from !== nodeId && c.to !== nodeId));
      if (editingNodeId === nodeId) {
        setEditingNodeId(null);
      }
    }
  };

  const handleDeleteConnection = (index) => {
    setConnections(prev => prev.filter((_, idx) => idx !== index));
  };

  // Node editing form toggle handlers
  const handleCharacterToggle = (name) => {
    setNodeForm(prev => {
      const exists = prev.characters.includes(name);
      return {
        ...prev,
        characters: exists ? prev.characters.filter(c => c !== name) : [...prev.characters, name]
      };
    });
  };

  const handleLocationToggle = (name) => {
    setNodeForm(prev => {
      const exists = prev.locations.includes(name);
      return {
        ...prev,
        locations: exists ? prev.locations.filter(l => l !== name) : [...prev.locations, name]
      };
    });
  };

  const handleWeaponToggle = (name) => {
    setNodeForm(prev => {
      const exists = prev.weapons.includes(name);
      return {
        ...prev,
        weapons: exists ? prev.weapons.filter(w => w !== name) : [...prev.weapons, name]
      };
    });
  };

  const handleTechniqueToggle = (name) => {
    setNodeForm(prev => {
      const exists = prev.techniques.includes(name);
      return {
        ...prev,
        techniques: exists ? prev.techniques.filter(t => t !== name) : [...prev.techniques, name]
      };
    });
  };

  const handleChapterLinkToggle = async (chapNum) => {
    const existingIndex = nodeForm.links.findIndex(l => l.chapter === chapNum);
    if (existingIndex !== -1) {
      setNodeForm(prev => ({
        ...prev,
        links: prev.links.filter(l => l.chapter !== chapNum)
      }));
    } else {
      await fetchChapterNodes(chapNum);
      setNodeForm(prev => ({
        ...prev,
        links: [...prev.links, { chapter: chapNum, nodes: [] }]
      }));
    }
  };

  const handleLinkedNodeToggle = (chapNum, nodeId) => {
    setNodeForm(prev => {
      const newLinks = prev.links.map(l => {
        if (l.chapter === chapNum) {
          const exists = l.nodes.includes(nodeId);
          return {
            ...l,
            nodes: exists ? l.nodes.filter(id => id !== nodeId) : [...l.nodes, nodeId]
          };
        }
        return l;
      });
      return { ...prev, links: newLinks };
    });
  };

  const handleSaveNodeForm = () => {
    if (!nodeForm.title.trim()) {
      alert('Vui lòng nhập tiêu đề sự kiện.');
      return;
    }
    setNodes(prev => prev.map(n => {
      if (n.id === editingNodeId) {
        return {
          ...n,
          title: nodeForm.title.trim(),
          description: nodeForm.description.trim(),
          characters: nodeForm.characters,
          resolved_thread: {
            thread: nodeForm.resolvedThreadText,
            resolution_note: nodeForm.resolutionNote.trim()
          },
          links: nodeForm.links,
          locations: nodeForm.locations || [],
          weapons: nodeForm.weapons || [],
          techniques: nodeForm.techniques || [],
          content: nodeForm.content || null
        };
      }
      return n;
    }));
    setEditingNodeId(null);
  };

  const handleSuggestSingleNode = async (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setSuggestingNodeId(nodeId);

    // Identify linked nodes in the same chapter
    const linkedNodes = [];
    connections.forEach(conn => {
      if (conn.from === nodeId) {
        const otherNode = nodes.find(n => n.id === conn.to);
        if (otherNode) {
          linkedNodes.push({
            id: otherNode.id,
            title: otherNode.title,
            description: otherNode.description,
            relationship: 'after'
          });
        }
      } else if (conn.to === nodeId) {
        const otherNode = nodes.find(n => n.id === conn.from);
        if (otherNode) {
          linkedNodes.push({
            id: otherNode.id,
            title: otherNode.title,
            description: otherNode.description,
            relationship: 'before'
          });
        }
      }
    });

    const isNodeEditing = editingNodeId === nodeId;
    const charList = isNodeEditing ? nodeForm.characters : (node.characters || []);
    const locList = isNodeEditing ? nodeForm.locations : (node.locations || []);
    const weapList = isNodeEditing ? nodeForm.weapons : (node.weapons || []);
    const techList = isNodeEditing ? nodeForm.techniques : (node.techniques || []);
    const resThread = isNodeEditing ? {
      thread: nodeForm.resolvedThreadText,
      resolution_note: nodeForm.resolutionNote
    } : (node.resolved_thread || {});
    const lnkList = isNodeEditing ? nodeForm.links : (node.links || []);

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyUuid}/chapters/${selectedNum}/suggest-node-details`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          characters: charList,
          locations: locList,
          weapons: weapList,
          techniques: techList,
          resolved_thread: resThread,
          links: lnkList,
          notes: '',
          linked_nodes: linkedNodes
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi không xác định khi gợi ý nội dung sự kiện.');
      }

      setNodes(prev => prev.map(n => {
        if (n.id === nodeId) {
          return {
            ...n,
            title: data.title,
            description: data.description
          };
        }
        return n;
      }));

      if (isNodeEditing) {
        setNodeForm(prev => ({
          ...prev,
          title: data.title,
          description: data.description
        }));
      }
    } catch (err) {
      alert(`Không thể gợi ý nội dung node: ${err.message}`);
    } finally {
      setSuggestingNodeId(null);
    }
  };

  const renderConnections = () => {
    return connections.map((conn, idx) => {
      const fromNode = nodes.find(n => n.id === conn.from);
      const toNode = nodes.find(n => n.id === conn.to);
      if (!fromNode || !toNode) return null;

      // Node size: width = 200, height = 90
      const x1 = fromNode.x + 100;
      const y1 = fromNode.y + 45;
      const x2 = toNode.x + 100;
      const y2 = toNode.y + 45;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const dist = Math.sqrt(dx * dx + dy * dy);

      let targetX = x2;
      let targetY = y2;

      if (dist > 0) {
        const ratio = Math.max(0, (dist - 110) / dist);
        targetX = x1 + dx * ratio;
        targetY = y1 + dy * ratio;
      }

      return (
        <g key={idx}>
          <line
            x1={x1}
            y1={y1}
            x2={targetX}
            y2={targetY}
            stroke="var(--color-cyan)"
            strokeWidth="2.5"
            fill="none"
            markerEnd="url(#arrow)"
            strokeDasharray="4 2"
          />
        </g>
      );
    });
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
              <>
                <button 
                  onClick={handleSyncNodeContents} 
                  className="btn-toolbar btn-edit"
                  disabled={syncingNodes}
                  style={{ 
                    background: 'rgba(14, 165, 233, 0.15)', 
                    border: '1px solid rgba(14, 165, 233, 0.3)', 
                    color: '#38bdf8',
                    marginRight: '8px'
                  }}
                >
                  <Sparkles className={`icon-xs ${syncingNodes ? 'spin' : ''}`} style={{ color: '#38bdf8' }} /> 
                  <span>{syncingNodes ? 'Đang cập nhật...' : 'Cập nhật nội dung vào Node'}</span>
                </button>
                <button 
                  onClick={handleOpenCanvasModal} 
                  className="btn-toolbar btn-edit"
                  style={{ 
                    background: 'rgba(168, 85, 247, 0.15)', 
                    border: '1px solid rgba(168, 85, 247, 0.3)', 
                    color: '#c084fc',
                    marginRight: '8px'
                  }}
                >
                  <Settings className="icon-xs" style={{ color: '#c084fc' }} /> <span>Sửa Sơ Đồ (Canvas)</span>
                </button>
                <button 
                  onClick={handlePlayAudio} 
                  className="btn-toolbar"
                  disabled={audioLoading}
                  style={{ 
                    background: audioPlaying ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)', 
                    border: `1px solid ${audioPlaying ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`, 
                    color: audioPlaying ? '#ef4444' : '#10b981',
                    marginRight: '8px'
                  }}
                >
                  <Volume2 className={`icon-xs ${audioLoading ? 'spin' : ''}`} style={{ color: audioPlaying ? '#ef4444' : '#10b981' }} /> 
                  <span>{audioLoading ? 'Đang xử lý...' : (audioPlaying ? 'Dừng Audio' : 'Nghe Audio')}</span>
                </button>
                <button 
                  onClick={handleDownloadAudio} 
                  className="btn-toolbar"
                  disabled={audioLoading}
                  style={{ 
                    background: 'rgba(245, 158, 11, 0.15)', 
                    border: '1px solid rgba(245, 158, 11, 0.3)', 
                    color: '#f59e0b',
                    marginRight: '8px'
                  }}
                >
                  <Download className="icon-xs" style={{ color: '#f59e0b' }} /> 
                  <span>Tải Audio</span>
                </button>
                <button 
                  onClick={() => setEditMode(true)} 
                  className="btn-toolbar btn-edit"
                >
                  <Edit2 className="icon-xs" /> <span>Chỉnh sửa</span>
                </button>
              </>
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

      {showCanvasModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-card glass" style={{ maxWidth: '1200px', width: '95%', height: '90vh', display: 'flex', flexDirection: 'column', padding: '24px' }}>
            <div className="modal-header">
              <div className="modal-title-container">
                <Settings className="icon-sm text-cyan" />
                <h3>Sửa Sơ Đồ Sự Kiện - Chương {selectedNum}</h3>
              </div>
              <button onClick={() => !savingNodes && setShowCanvasModal(false)} className="btn-close" type="button" disabled={savingNodes}>
                <X className="icon-sm" />
              </button>
            </div>

            <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden', padding: 0 }}>
              
              {/* Canvas control toolbar */}
              <div className="canvas-controls-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0' }}>
                <div className="text-muted" style={{ fontSize: '13px' }}>
                  {linkingSourceNodeId ? (
                    <span className="text-yellow animate-pulse">⚠️ Chọn node đích để thiết lập luồng câu chuyện</span>
                  ) : (
                    <span>💡 Nhấp giữ chuột để Kéo thả Node. Nhấp "Liên kết" để nối các sự kiện theo luồng kể chuyện.</span>
                  )}
                </div>
                <button 
                  type="button" 
                  onClick={handleAddNewNode}
                  className="btn-primary-sm btn-cyan"
                  style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus className="icon-xs" /> Thêm Sự Kiện (Node)
                </button>
              </div>

              {/* Canvas Layout */}
              <div className="canvas-editor-layout" style={{ flex: 1, display: 'flex', gap: '16px', overflow: 'hidden', height: 'calc(100% - 40px)' }}>
                
                {/* Visual Node Canvas Workspace */}
                <div className="canvas-container" style={{ flex: 1, position: 'relative', overflow: 'auto', backgroundColor: '#0d121f', border: '1px solid var(--border-glass)', borderRadius: '12px' }}>
                  <div className="canvas-wrapper" style={{ position: 'relative', width: '2400px', height: '1600px', backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
                    
                    {/* SVG Layer for Connections */}
                    <svg className="canvas-svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 1 }}>
                      <defs>
                        <marker
                          id="arrow"
                          viewBox="0 0 10 10"
                          refX="6"
                          refY="5"
                          markerWidth="6"
                          markerHeight="6"
                          orient="auto-start-reverse"
                        >
                          <path d="M 0 1 L 10 5 L 0 9 z" fill="var(--color-cyan)" />
                        </marker>
                      </defs>
                      {renderConnections()}
                    </svg>

                    {/* Nodes Loop */}
                    {nodes.map((n) => {
                      const isSource = linkingSourceNodeId === n.id;
                      const isEditing = editingNodeId === n.id;
                      const charText = n.characters?.length > 0 ? n.characters.join(', ') : 'Chưa có nhân vật';
                      
                      return (
                        <div
                          key={n.id}
                          className={`canvas-node ${isSource ? 'linking-source' : ''} ${isEditing ? 'active-editing' : ''}`}
                          style={{
                            left: `${n.x}px`,
                            top: `${n.y}px`,
                            position: 'absolute',
                            width: '200px',
                            minHeight: '90px',
                            padding: '12px',
                            borderRadius: '10px',
                            border: `1px solid ${isEditing ? 'var(--color-cyan)' : 'var(--border-glass)'}`,
                            background: isEditing ? 'rgba(6, 182, 212, 0.15)' : 'rgba(15, 21, 36, 0.85)',
                            backdropFilter: 'blur(10px)',
                            zIndex: 2,
                            cursor: 'grab',
                            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
                            userSelect: 'none'
                          }}
                          onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', height: '100%' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '4px' }}>
                              <span style={{ fontWeight: '600', fontSize: '13px', color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                {n.title}
                              </span>
                              <button 
                                type="button" 
                                onClick={(e) => { e.stopPropagation(); handleDeleteNode(n.id); }}
                                className="node-icon-btn text-red"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: '#ef4444' }}
                                title="Xóa sự kiện"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                            
                            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {n.description || 'Chưa có mô tả kịch bản...'}
                            </p>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '4px', fontSize: '10px', color: 'var(--text-muted)' }}>
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '105px' }}>👤 {charText}</span>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleNodeLinkClick(n.id); }}
                                  className={`node-action-btn ${isSource ? 'active' : ''}`}
                                  style={{ border: 'none', background: isSource ? 'var(--color-cyan)' : 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 4px', fontSize: '9px', color: isSource ? '#000' : '#fff', cursor: 'pointer' }}
                                  title={isSource ? "Nhấp node khác để liên kết" : "Liên kết sự kiện"}
                                >
                                  <Link size={9} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleSuggestSingleNode(n.id); }}
                                  className="node-action-btn"
                                  style={{ border: 'none', background: suggestingNodeId === n.id ? 'var(--color-purple)' : 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 4px', fontSize: '9px', color: '#c084fc', cursor: 'pointer' }}
                                  title="Gợi ý nội dung bằng AI"
                                  disabled={suggestingNodeId === n.id}
                                >
                                  <Sparkles size={9} />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setEditingNodeId(n.id); }}
                                  className="node-action-btn"
                                  style={{ border: 'none', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', padding: '2px 4px', fontSize: '9px', color: '#fff', cursor: 'pointer' }}
                                  title="Chỉnh sửa chi tiết"
                                >
                                  <Edit2 size={9} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {nodes.length === 0 && (
                      <div className="center-content" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                        <BookOpen className="icon-md text-muted" />
                        <p className="text-muted" style={{ fontSize: '13px', marginTop: '8px' }}>
                          Sơ đồ sự kiện của chương đang trống.
                        </p>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          Nhấp nút "Thêm Sự Kiện (Node)" ở trên để thiết lập kịch bản chương truyện.
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Sidebar node editing panel */}
                {editingNodeId && (
                  <div className="node-editor-panel glass-light" style={{ width: '320px', border: '1px solid var(--border-glass)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-glass)', paddingBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: 'var(--color-cyan)' }}>Sửa Sự Kiện</h4>
                      <button onClick={() => setEditingNodeId(null)} className="btn-close" type="button">
                        <X size={14} />
                      </button>
                    </div>

                    <div className="form-group">
                      <label className="form-label required" style={{ fontSize: '11px' }}>Tiêu đề / Tiến trình *</label>
                      <input 
                        type="text"
                        className="form-input-sm"
                        value={nodeForm.title}
                        onChange={e => setNodeForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Tiêu đề sự kiện..."
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Mô tả kịch bản / Hướng giải quyết</label>
                      <textarea 
                        className="form-textarea-sm"
                        value={nodeForm.description}
                        onChange={e => setNodeForm(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Mô tả diễn biến..."
                        rows={3}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Nội dung truyện thực tế (do AI sinh hoặc tự nhập)</label>
                      <textarea 
                        className="form-textarea-sm"
                        value={nodeForm.content || ''}
                        onChange={e => setNodeForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="Nội dung văn bản thực tế tương ứng với sự kiện này..."
                        rows={6}
                      />
                    </div>

                    {/* Characters toggle list */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Nhân vật tham gia</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px' }}>
                        {storyMeta?.characters?.map(c => {
                          const isChecked = nodeForm.characters.includes(c.name);
                          return (
                            <label key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleCharacterToggle(c.name)}
                              />
                              <span>{c.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Locations toggle list */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Địa điểm xuất hiện</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px' }}>
                        {storyLedger?.locations?.map(l => {
                          const isChecked = nodeForm.locations.includes(l.name);
                          return (
                            <label key={l.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleLocationToggle(l.name)}
                              />
                              <span>{l.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Weapons toggle list */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Binh khí / Pháp khí sử dụng</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px' }}>
                        {storyLedger?.weapons?.map(w => {
                          const isChecked = nodeForm.weapons.includes(w.name);
                          return (
                            <label key={w.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleWeaponToggle(w.name)}
                              />
                              <span>{w.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Techniques toggle list */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Công pháp thi triển</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '100px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px' }}>
                        {storyLedger?.techniques?.map(t => {
                          const isChecked = nodeForm.techniques.includes(t.name);
                          return (
                            <label key={t.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer' }}>
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTechniqueToggle(t.name)}
                              />
                              <span>{t.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Unresolved threads dropdown selector */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Giải quyết nút thắt (nếu có)</label>
                      <select 
                        className="form-select-sm"
                        value={nodeForm.resolvedThreadText}
                        onChange={e => setNodeForm(prev => ({ ...prev, resolvedThreadText: e.target.value }))}
                      >
                        <option value="">-- Chọn nút thắt giải quyết --</option>
                        {storyLedger?.unresolved_threads?.map((t, idx) => {
                          const val = typeof t === 'string' ? t : t.thread;
                          return <option key={idx} value={val}>{val}</option>;
                        })}
                      </select>
                    </div>

                    {nodeForm.resolvedThreadText && (
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '11px' }}>Hướng/Cách giải quyết nút thắt</label>
                        <textarea 
                          className="form-textarea-sm"
                          value={nodeForm.resolutionNote}
                          onChange={e => setNodeForm(prev => ({ ...prev, resolutionNote: e.target.value }))}
                          placeholder="Mô tả cách xử lý nút thắt này..."
                          rows={2}
                        />
                      </div>
                    )}

                    {/* Links to old chapter nodes */}
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '11px' }}>Liên kết với chương cũ</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '120px', overflowY: 'auto', background: 'rgba(0,0,0,0.15)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '6px' }}>
                        {storyLedger?.timeline?.filter(item => item.chapter < selectedNum).map((item) => {
                          const isChecked = nodeForm.links.some(l => l.chapter === item.chapter);
                          const linkObj = nodeForm.links.find(l => l.chapter === item.chapter);
                          const cachedData = chapterNodesCache[item.chapter];
                          
                          return (
                            <div key={item.chapter} style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px', marginBottom: '4px' }}>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: '600' }}>
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => handleChapterLinkToggle(item.chapter)}
                                />
                                <span>Chương {item.chapter}: {item.title}</span>
                              </label>
                              
                              {isChecked && cachedData?.nodes && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '14px', borderLeft: '1px dashed rgba(255,255,255,0.1)', marginTop: '2px' }}>
                                  {cachedData.nodes.map(pn => {
                                    const isNodeChecked = linkObj?.nodes?.includes(pn.id);
                                    return (
                                      <label key={pn.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '10px', color: isNodeChecked ? 'var(--color-cyan)' : 'var(--text-muted)', cursor: 'pointer', marginBottom: '4px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          <input 
                                            type="checkbox"
                                            checked={isNodeChecked || false}
                                            onChange={() => handleLinkedNodeToggle(item.chapter, pn.id)}
                                          />
                                          <span>{pn.title}</span>
                                        </div>
                                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', paddingLeft: '18px' }}>
                                          {pn.description || 'Không có mô tả.'}
                                        </span>
                                        {pn.content && (
                                          <span style={{ fontSize: '9px', color: 'rgba(6,182,212,0.6)', paddingLeft: '18px', maxHeight: '40px', overflowY: 'auto', whiteSpace: 'pre-wrap', display: 'block' }}>
                                            <strong>Nội dung:</strong> {pn.content}
                                          </span>
                                        )}
                                      </label>
                                    );
                                  })}
                                  {cachedData.nodes.length === 0 && (
                                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chương này không có sơ đồ node.</span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {(!storyLedger?.timeline || storyLedger.timeline.filter(item => item.chapter < selectedNum).length === 0) && (
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có chương trước để liên kết.</span>
                        )}
                      </div>
                    </div>

                    <button 
                      type="button" 
                      onClick={handleSaveNodeForm}
                      className="btn-primary-sm btn-cyan"
                      style={{ width: '100%', marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                    >
                      <Check size={12} /> Cập nhật sự kiện
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-actions" style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '16px', marginTop: '16px' }}>
              <button 
                type="button" 
                onClick={() => setShowCanvasModal(false)} 
                className="btn-secondary"
                disabled={savingNodes}
              >
                Hủy
              </button>
              <button 
                type="button" 
                onClick={handleSaveCanvasNodes}
                className="btn-primary" 
                disabled={savingNodes}
                style={{
                  background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                  color: '#fff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {savingNodes ? (
                  <>
                    <div className="loader spin" style={{ width: '12px', height: '12px', borderTopColor: '#fff' }}></div>
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Lưu Sơ Đồ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

