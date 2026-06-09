import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare, Send, CheckCircle2, AlertTriangle, Eye, ArrowLeft, Terminal, XCircle, Plus, Edit, Trash2, Link, Check, X, FileText, Share2 } from 'lucide-react';
import ProgressBar from './ProgressBar';

// Sub-components for inline widget forms to keep main component clean
function ClarificationReplyForm({ onSubmit }) {
  const [text, setText] = useState('');
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && text.trim()) {
      e.preventDefault();
      onSubmit(text);
    }
  };

  return (
    <div className="widget-reply-area">
      <textarea
        className="form-textarea-sm"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="Nhập câu trả lời hoặc làm rõ thêm chi tiết..."
        rows={3}
      />
      <div className="actions-row">
        <button onClick={() => onSubmit('')} className="btn-secondary-sm">Bỏ qua</button>
        <button onClick={() => onSubmit(text)} className="btn-primary-sm btn-cyan" disabled={!text.trim()}>
          <Send className="icon-xs" /> Gửi câu trả lời
        </button>
      </div>
    </div>
  );
}

function ReviewReplyForm({ onSubmit }) {
  const [feedback, setFeedback] = useState('');
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && feedback.trim()) {
      e.preventDefault();
      onSubmit(feedback);
    }
  };

  return (
    <div className="widget-reply-area">
      <input
        type="text"
        className="form-input-sm"
        value={feedback}
        onChange={e => setFeedback(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="Ví dụ: 'Thêm hội thoại kịch tính', 'Cho nhân vật A tỏ vẻ nghi ngờ'..."
      />
      <div className="actions-row">
        <button 
          onClick={() => onSubmit(feedback)} 
          className="btn-secondary-sm btn-re-edit"
          disabled={!feedback.trim()}
        >
          Yêu cầu sửa lại
        </button>
        <button 
          onClick={() => onSubmit('Done')} 
          className="btn-primary-sm btn-green"
        >
          <CheckCircle2 className="icon-xs" /> Duyệt bản viết (Done)
        </button>
      </div>
    </div>
  );
}

function ModelChangeForm({ onSubmit, currentModel }) {
  const standardModels = [
    'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-flash-lite',
    'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.1-pro', 'gemini-2.5-flash-lite',
    'gemini-3.0-flash', 'gemma-4-26b-it', 'gemma-4-31b-it', 'gemini-1.5-flash', 'gemini-1.5-pro'
  ];
  const isStandard = standardModels.includes(currentModel);
  const [selectedOption, setSelectedOption] = useState(isStandard ? currentModel : (currentModel ? 'other' : 'gemini-2.5-flash'));
  const [customModel, setCustomModel] = useState(!isStandard && currentModel ? currentModel : '');

  const handleConfirm = () => {
    const finalModel = selectedOption === 'other' ? customModel.trim() : selectedOption;
    if (selectedOption === 'other' && !customModel.trim()) {
      alert('Vui lòng nhập tên model AI!');
      return;
    }
    onSubmit(finalModel);
  };

  return (
    <div className="widget-reply-area">
      <p className="instruction-text text-muted">Vui lòng lựa chọn model AI dự phòng để tiếp tục tiến trình:</p>
      <div className="form-row" style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
          <select 
            className="form-select flex-1" 
            value={selectedOption} 
            onChange={e => setSelectedOption(e.target.value)}
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
            <option value="gemma-4-26b-it">Gemma 4 26B IT</option>
            <option value="gemma-4-31b-it">Gemma 4 31B IT</option>
            <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
            <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
            <option value="other">Khác (Nhập thủ công)</option>
          </select>
          <button 
            onClick={handleConfirm} 
            className="btn-primary-sm btn-red"
          >
            <Sparkles className="icon-xs" /> Xác nhận & Thử lại
          </button>
        </div>
        {selectedOption === 'other' && (
          <div className="custom-model-input-row fade-in" style={{ display: 'flex', gap: '10px', alignItems: 'center', width: '100%' }}>
            <input 
              type="text" 
              className="form-input-sm" 
              style={{ flex: 1 }}
              value={customModel} 
              onChange={e => setCustomModel(e.target.value)} 
              placeholder="Nhập tên Model AI (Ví dụ: gemini-2.5-pro-experimental)..."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ConflictResolutionForm({ warnings, onSubmit }) {
  const [resolutions, setResolutions] = useState(
    warnings.map((w, idx) => ({
      warning_index: idx,
      resolve: true,
      instruction: ''
    }))
  );

  const handleResolveChange = (idx, val) => {
    setResolutions(prev => prev.map(r => r.warning_index === idx ? { ...r, resolve: val } : r));
  };

  const handleInstructionChange = (idx, val) => {
    setResolutions(prev => prev.map(r => r.warning_index === idx ? { ...r, instruction: val } : r));
  };

  const handleSubmit = () => {
    onSubmit(resolutions);
  };

  return (
    <div className="widget-reply-area conflict-resolution-widget" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '16px', background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.2)', borderRadius: '8px', marginTop: '10px' }}>
      <p className="instruction-text text-yellow" style={{ fontSize: '13px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px', margin: 0, color: '#facc15' }}>
        <AlertTriangle className="icon-xs" /> Hãy chọn các mâu thuẫn logic muốn AI sửa và nhập hướng dẫn (nếu có):
      </p>
      
      <div className="conflicts-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {warnings.map((w, idx) => {
          const res = resolutions.find(r => r.warning_index === idx) || { resolve: false, instruction: '' };
          const chapterSource = w.conflicting_chapter ? `Chương ${w.conflicting_chapter}` : "Bối cảnh thế giới/nhân vật";
          
          return (
            <div key={idx} className="conflict-item" style={{ background: 'rgba(10, 14, 23, 0.4)', border: '1px solid var(--border-glass)', borderRadius: '6px', padding: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <input 
                  type="checkbox" 
                  id={`conflict-${idx}`} 
                  checked={res.resolve} 
                  onChange={e => handleResolveChange(idx, e.target.checked)}
                  style={{ marginTop: '3px', cursor: 'pointer' }}
                />
                <div style={{ flex: 1 }}>
                  <label htmlFor={`conflict-${idx}`} style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', display: 'block' }}>
                    Mâu thuẫn {idx + 1} ({chapterSource}):
                  </label>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 8px 0', lineHeight: '1.4' }}>
                    {w.warning}
                  </p>
                  
                  {res.resolve && (
                    <input 
                      type="text"
                      className="form-input-sm"
                      placeholder="Nhập hướng dẫn cách sửa (để trống AI sẽ tự giải quyết)..."
                      value={res.instruction}
                      onChange={e => handleInstructionChange(idx, e.target.value)}
                      style={{ width: '100%', marginTop: '4px' }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="actions-row" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
        <button 
          onClick={() => onSubmit(resolutions.map(r => ({ ...r, resolve: false })))} 
          className="btn-secondary-sm"
        >
          Bỏ qua toàn bộ
        </button>
        <button 
          onClick={handleSubmit} 
          className="btn-primary-sm btn-yellow"
          style={{ background: 'rgba(234, 179, 8, 0.2)', border: '1px solid rgba(234, 179, 8, 0.4)', color: '#facc15' }}
        >
          <Check className="icon-xs" /> Xác nhận sửa lỗi bằng AI
        </button>
      </div>
    </div>
  );
}

export default function ChapterGenerator({ 
  storyUuid, 
  defaultModel, 
  storyMeta,
  storyLedger,
  socket, 
  onGenerationComplete 
}) {
  const [mode, setMode] = useState('nodes'); // nodes (event flowchart), text (raw text)
  const [userIdea, setUserIdea] = useState('');
  const [model, setModel] = useState(defaultModel || 'gemini-2.5-flash');
  const [generating, setGenerating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, running, etc.
  const [messages, setMessages] = useState([]);

  // --- Canvas Node Graph States ---
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [editingNodeId, setEditingNodeId] = useState(null);
  const [linkingSourceNodeId, setLinkingSourceNodeId] = useState(null);
  
  // Node Form State
  const [nodeForm, setNodeForm] = useState({
    title: '',
    description: '',
    characters: [],
    resolvedThreadText: '',
    resolutionNote: '',
    links: [], // [{ chapter: number, nodes: [nodeId, ...] }]
    locations: [],
    weapons: [],
    techniques: [],
    content: ''
  });

  const [chapterNodesCache, setChapterNodesCache] = useState({});

  // --- AI Suggest Nodes States ---
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [suggestForm, setSuggestForm] = useState({
    numNodes: 3,
    linkedChapters: [],
    characters: [],
    resolvedThreads: [],
    techniques: [],
    locations: [],
    weapons: [],
    notes: ''
  });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(null);
  const [suggestingNodeId, setSuggestingNodeId] = useState(null);

  const chatEndRef = useRef(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Sync model with story meta default
  useEffect(() => {
    if (defaultModel) {
      setModel(defaultModel);
    }
  }, [defaultModel]);

  // Reset node editor on node change or cancel
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

  // Handle Socket.IO events for active generation
  useEffect(() => {
    if (!socket || !storyUuid) return;

    const onAgentStatus = (data) => {
      if (data.story_uuid !== storyUuid) return;
      
      if (data.status !== 'completed' && data.status !== 'error' && data.status !== 'cancelled') {
        setStatus(data.status);
      }

      if (data.status === 'completed') {
        setStatus('completed');
        setGenerating(false);
        if (onGenerationComplete) onGenerationComplete(data.chapter_num);
      } else if (data.status === 'error') {
        setStatus('error');
        setGenerating(false);
      } else if (data.status === 'cancelled') {
        setStatus('idle');
        setGenerating(false);
        setMessages((prev) => [...prev, {
          id: `cancel-success-${Date.now()}`,
          sender: 'system',
          type: 'system_log',
          text: 'Tiến trình sáng tác đã bị hủy thành công bởi tác giả.',
          level: 'warning',
          time: new Date().toLocaleTimeString()
        }]);
      }
    };

    const onAgentLog = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setMessages((prev) => [...prev, {
        id: `log-${Date.now()}-${Math.random()}`,
        sender: 'system',
        type: 'system_log',
        text: data.message,
        level: data.level || 'info',
        time: data.time || new Date().toLocaleTimeString()
      }]);
    };

    const onClarifyRequirements = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setStatus('waiting_clarification');
      setMessages((prev) => [...prev, {
        id: `clarify-${Date.now()}-${Math.random()}`,
        sender: 'agent',
        type: 'agent_question',
        questions: data.questions,
        time: new Date().toLocaleTimeString()
      }]);
    };

    const onDraftReviewNeeded = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setStatus('waiting_review');
      setMessages((prev) => [...prev, {
        id: `review-${Date.now()}-${Math.random()}`,
        sender: 'agent',
        type: 'agent_review',
        draftContent: data.draft_content,
        time: new Date().toLocaleTimeString()
      }]);
    };

    const onAuditWarnings = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setMessages((prev) => [...prev, {
        id: `audit-${Date.now()}-${Math.random()}`,
        sender: 'agent',
        type: 'agent_warning',
        warnings: data.warnings || [],
        text: data.feedback || '',
        time: new Date().toLocaleTimeString()
      }]);
    };

    const onConflictReviewNeeded = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setStatus('waiting_conflict_review');
      setMessages((prev) => [...prev, {
        id: `conflict-review-${Date.now()}-${Math.random()}`,
        sender: 'agent',
        type: 'agent_conflict_review',
        warnings: data.warnings || [],
        text: data.feedback || '',
        time: new Date().toLocaleTimeString()
      }]);
    };

    const onLlmErrorSelectModel = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setStatus('waiting_model_change');
      setMessages((prev) => [...prev, {
        id: `model-error-${Date.now()}-${Math.random()}`,
        sender: 'system',
        type: 'model_error',
        error: data.error,
        currentModel: data.current_model,
        time: new Date().toLocaleTimeString()
      }]);
    };

    socket.on('agent_status', onAgentStatus);
    socket.on('agent_log', onAgentLog);
    socket.on('clarify_requirements', onClarifyRequirements);
    socket.on('draft_review_needed', onDraftReviewNeeded);
    socket.on('audit_warnings', onAuditWarnings);
    socket.on('conflict_review_needed', onConflictReviewNeeded);
    socket.on('llm_error_select_model', onLlmErrorSelectModel);

    return () => {
      socket.off('agent_status', onAgentStatus);
      socket.off('agent_log', onAgentLog);
      socket.off('clarify_requirements', onClarifyRequirements);
      socket.off('draft_review_needed', onDraftReviewNeeded);
      socket.off('audit_warnings', onAuditWarnings);
      socket.off('conflict_review_needed', onConflictReviewNeeded);
      socket.off('llm_error_select_model', onLlmErrorSelectModel);
    };
  }, [socket, storyUuid, onGenerationComplete]);

  // --- Node Graph Canvas Drag and Drop Handlers ---
  const handleNodeMouseDown = (e, nodeId) => {
    if (e.button !== 0) return; // Left click only
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
      // Boundaries check (Expanded Canvas dimension: 2400px width, 1600px height)
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
      // Add connection if it doesn't exist
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

  // --- AI Suggest Nodes Handlers ---
  const handleOpenSuggestModal = () => {
    setSuggestForm({
      numNodes: 3,
      linkedChapters: [],
      characters: [],
      resolvedThreads: [],
      techniques: [],
      locations: [],
      weapons: [],
      notes: ''
    });
    setSuggestError(null);
    setShowSuggestModal(true);
  };

  const handleSuggestToggle = (field, item) => {
    setSuggestForm(prev => {
      const exists = prev[field].includes(item);
      return {
        ...prev,
        [field]: exists ? prev[field].filter(x => x !== item) : [...prev[field], item]
      };
    });
  };

  const handleAISuggestSubmit = async (e) => {
    e.preventDefault();
    setSuggesting(true);
    setSuggestError(null);

    const nextChapterNum = storyLedger?.timeline && storyLedger.timeline.length > 0
      ? Math.max(...storyLedger.timeline.map(t => t.chapter)) + 1
      : 1;

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyUuid}/chapters/${nextChapterNum}/suggest-nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          num_nodes: suggestForm.numNodes,
          linked_chapters: suggestForm.linkedChapters,
          characters: suggestForm.characters,
          resolved_threads: suggestForm.resolvedThreads,
          techniques: suggestForm.techniques,
          locations: suggestForm.locations,
          weapons: suggestForm.weapons,
          notes: suggestForm.notes
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Lỗi không xác định khi gợi ý sự kiện.');
      }

      setNodes(data.nodes || []);
      setConnections(data.connections || []);

      for (const chap of suggestForm.linkedChapters) {
        await fetchChapterNodes(chap);
      }

      setShowSuggestModal(false);
    } catch (err) {
      setSuggestError(err.message);
    } finally {
      setSuggesting(false);
    }
  };

  const handleSuggestSingleNode = async (nodeId) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;

    setSuggestingNodeId(nodeId);

    const nextChapterNum = storyLedger?.timeline && storyLedger.timeline.length > 0
      ? Math.max(...storyLedger.timeline.map(t => t.chapter)) + 1
      : 1;

    // Use current form values if editing this node, otherwise use saved node values
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

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyUuid}/chapters/${nextChapterNum}/suggest-node-details`, {
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


  // --- Fetch Chapter Event Nodes Cache ---
  const fetchChapterNodes = async (chapNum) => {
    if (chapterNodesCache[chapNum]) return;
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyUuid}/chapters/${chapNum}/nodes`);
      if (res.ok) {
        const data = await res.json();
        setChapterNodesCache(prev => ({ ...prev, [chapNum]: data }));
      }
    } catch (e) {
      console.error(`Failed to fetch nodes for chapter ${chapNum}:`, e);
    }
  };

  // Node editing form handlers
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

  // --- Start Generation Trigger ---
  const handleStartGeneration = async (e) => {
    e.preventDefault();
    
    // Compile user idea
    let finalIdea = '';
    if (mode === 'nodes') {
      if (nodes.length === 0) {
        alert('Vui lòng thêm ít nhất một sự kiện (Node) vào sơ đồ để bắt đầu sáng tác.');
        return;
      }
      finalIdea = {
        nodes: nodes.map(({ id, title, description, characters, resolved_thread, links, locations, weapons, techniques, content, x, y }) => ({
          id, title, description, characters, resolved_thread, links, locations, weapons, techniques, content, x, y
        })),
        connections
      };
    } else {
      if (!userIdea.trim()) {
        alert('Vui lòng nhập ý tưởng viết chương.');
        return;
      }
      finalIdea = userIdea.trim();
    }

    setGenerating(true);
    setStatus('starting');
    
    const displayMsg = mode === 'nodes' 
      ? `Sáng tác chương mới qua Sơ đồ sự kiện (${nodes.length} sự kiện, ${connections.length} luồng liên kết)`
      : `Sáng tác chương mới với ý tưởng: "${userIdea.trim()}"`;

    setMessages([
      {
        id: `user-idea-${Date.now()}`,
        sender: 'user',
        type: 'text',
        text: displayMsg,
        time: new Date().toLocaleTimeString()
      },
      {
        id: `start-log-${Date.now()}`,
        sender: 'system',
        type: 'system_log',
        text: 'Bắt đầu gửi yêu cầu sáng tác chương...',
        level: 'info',
        time: new Date().toLocaleTimeString()
      }
    ]);

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyUuid}/chapters/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_idea: finalIdea, model: model })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, {
          id: `error-log-${Date.now()}`,
          sender: 'system',
          type: 'system_log',
          text: data.error || 'Lỗi không xác định khi bắt đầu sinh chương.',
          level: 'error',
          time: new Date().toLocaleTimeString()
        }]);
        setGenerating(false);
        setStatus('error');
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `error-log-${Date.now()}`,
        sender: 'system',
        type: 'system_log',
        text: `Không thể kết nối đến backend API: ${err.message}`,
        level: 'error',
        time: new Date().toLocaleTimeString()
      }]);
      setGenerating(false);
      setStatus('error');
    }
  };

  const handleSendClarification = (replyText) => {
    if (!socket) return;
    
    const displayMsg = replyText.trim() ? `Đã bổ sung ý tưởng: "${replyText.trim()}"` : 'Bỏ qua yêu cầu làm rõ ý tưởng.';
    
    setMessages((prev) => [...prev, {
      id: `user-clarify-${Date.now()}`,
      sender: 'user',
      type: 'text',
      text: displayMsg,
      time: new Date().toLocaleTimeString()
    }]);

    socket.emit('submit_clarification', {
      story_uuid: storyUuid,
      answers: replyText.trim()
    });

    setStatus('running');
  };

  const handleSendReview = (feedbackText) => {
    if (!socket) return;

    let displayMsg = feedbackText;
    if (feedbackText.toLowerCase() === 'done') {
      displayMsg = 'Duyệt bản viết thông qua (Done)!';
    } else {
      displayMsg = `Yêu cầu chỉnh sửa nháp: "${feedbackText}"`;
    }

    setMessages((prev) => [...prev, {
      id: `user-review-${Date.now()}`,
      sender: 'user',
      type: 'text',
      text: displayMsg,
      time: new Date().toLocaleTimeString()
    }]);

    socket.emit('submit_review_feedback', {
      story_uuid: storyUuid,
      feedback: feedbackText
    });

    setStatus('running');
  };

  const handleSendModelChange = (newModel) => {
    if (!socket || !newModel) return;

    setMessages((prev) => [...prev, {
      id: `user-model-${Date.now()}`,
      sender: 'user',
      type: 'text',
      text: `Đổi model AI thành: ${newModel} & Tiếp tục thử lại`,
      time: new Date().toLocaleTimeString()
    }]);

    socket.emit('submit_model_change', {
      story_uuid: storyUuid,
      model_name: newModel
    });

    setStatus('running');
  };

  const handleSendConflictResolutions = (resolutions) => {
    if (!socket || !storyUuid) return;
    
    const resolvedCount = resolutions.filter(r => r.resolve).length;
    const userMsg = `Yêu cầu AI giải quyết ${resolvedCount}/${resolutions.length} mâu thuẫn logic.`;
    
    setMessages((prev) => [...prev, {
      id: `user-resolutions-${Date.now()}`,
      sender: 'user',
      type: 'text',
      text: userMsg,
      time: new Date().toLocaleTimeString()
    }]);
    
    setMessages((prev) => [...prev, {
      id: `resolve-start-${Date.now()}`,
      sender: 'system',
      type: 'system_log',
      text: 'Đang gửi phương án sửa đổi logic lên server...',
      level: 'info',
      time: new Date().toLocaleTimeString()
    }]);
    
    socket.emit('submit_conflict_resolutions', {
      story_uuid: storyUuid,
      resolutions: resolutions
    });
    
    setStatus('running');
  };

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyUuid}/chapters/cancel`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, {
          id: `cancel-error-${Date.now()}`,
          sender: 'system',
          type: 'system_log',
          text: data.error || 'Lỗi không xác định khi hủy tiến trình.',
          level: 'error',
          time: new Date().toLocaleTimeString()
        }]);
      }
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: `cancel-error-${Date.now()}`,
        sender: 'system',
        type: 'system_log',
        text: `Không thể kết nối đến backend API: ${err.message}`,
        level: 'error',
        time: new Date().toLocaleTimeString()
      }]);
    } finally {
      setCancelling(false);
    }
  };

  const renderMessage = (msg, index) => {
    const isLastOfItsType = (() => {
      if (msg.type === 'agent_question') return status === 'waiting_clarification' && index === messages.length - 1;
      if (msg.type === 'agent_review') return status === 'waiting_review' && index === messages.length - 1;
      if (msg.type === 'agent_conflict_review') return status === 'waiting_conflict_review' && index === messages.length - 1;
      if (msg.type === 'model_error') return status === 'waiting_model_change' && index === messages.length - 1;
      return false;
    })();

    if (msg.type === 'system_log') {
      return (
        <div key={msg.id || index} className={`chat-system-log level-${msg.level}`}>
          <span className="log-time">[{msg.time}]</span>
          <span className="log-text">{msg.text}</span>
        </div>
      );
    }

    const isUser = msg.sender === 'user';
    
    return (
      <div key={msg.id || index} className={`chat-bubble-row ${isUser ? 'user-row' : 'agent-row'}`}>
        {!isUser && (
          <div className="chat-avatar agent-avatar">
            <Sparkles className="icon-xs" />
          </div>
        )}
        
        <div className={`chat-bubble ${isUser ? 'bubble-user' : 'bubble-agent'} ${msg.type}`}>
          <div className="bubble-meta">
            <span className="bubble-sender">{isUser ? 'Tác giả' : 'ChapterAgent'}</span>
            <span className="bubble-time">{msg.time}</span>
          </div>
          
          <div className="bubble-content">
            {msg.type === 'text' && <p className="message-text">{msg.text}</p>}
            
            {msg.type === 'agent_question' && (
              <div className="widget-clarification">
                <div className="widget-header text-yellow">
                  <AlertTriangle className="icon-xs" />
                  <span>Cần làm rõ thông tin cốt truyện</span>
                </div>
                <div className="questions-box">
                  <ul className="questions-list">
                    {msg.questions.map((q, qidx) => (
                      <li key={qidx}>{q}</li>
                    ))}
                  </ul>
                </div>
                {isLastOfItsType ? (
                  <ClarificationReplyForm onSubmit={handleSendClarification} />
                ) : (
                  <p className="widget-historical-note">✓ Đã phản hồi câu hỏi này.</p>
                )}
              </div>
            )}
            
            {msg.type === 'agent_review' && (
              <div className="widget-review">
                <div className="widget-header text-cyan">
                  <Eye className="icon-xs" />
                  <span>Duyệt bản nháp chương truyện</span>
                </div>
                <div className="draft-preview-container">
                  <div className="draft-content-scroll">
                    {msg.draftContent.split('\n').map((line, lidx) => (
                      <p key={lidx} className="draft-line">{line}</p>
                    ))}
                  </div>
                </div>
                {isLastOfItsType ? (
                  <ReviewReplyForm onSubmit={handleSendReview} />
                ) : (
                  <p className="widget-historical-note">✓ Đã phê duyệt bản nháp này.</p>
                )}
              </div>
            )}
            
            {msg.type === 'agent_warning' && (
              <div className="widget-warning">
                <div className="widget-header text-yellow">
                  <AlertTriangle className="icon-xs" />
                  <span>Cảnh báo tính nhất quán từ Auditor</span>
                </div>
                {msg.warnings && msg.warnings.length > 0 ? (
                  <ul className="warnings-list">
                    {msg.warnings.map((warn, widx) => {
                      const chapterSource = warn.conflicting_chapter ? `Chương ${warn.conflicting_chapter}` : "Bối cảnh thế giới/nhân vật";
                      return <li key={widx}>⚠️ [{chapterSource}] {warn.warning}</li>;
                    })}
                  </ul>
                ) : (
                  <p className="warnings-empty">✓ Không phát hiện lỗi nhất quán cốt truyện.</p>
                )}
                {msg.text && (
                  <div className="auditor-feedback-box">
                    <strong>Đánh giá chi tiết:</strong>
                    <p>{msg.text}</p>
                  </div>
                )}
              </div>
            )}
            
            {msg.type === 'agent_conflict_review' && (
              <div className="widget-warning conflict-review-widget-container" style={{ borderColor: '#facc15' }}>
                <div className="widget-header text-yellow" style={{ color: '#facc15' }}>
                  <AlertTriangle className="icon-xs text-yellow" />
                  <span>Duyệt và khắc phục mâu thuẫn logic</span>
                </div>
                {msg.text && (
                  <div className="auditor-feedback-box" style={{ marginBottom: '12px', background: 'rgba(234, 179, 8, 0.03)', borderLeft: '3px solid #facc15' }}>
                    <strong>Nhận xét từ Auditor:</strong>
                    <p>{msg.text}</p>
                  </div>
                )}
                {isLastOfItsType ? (
                  <ConflictResolutionForm warnings={msg.warnings} onSubmit={handleSendConflictResolutions} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p className="widget-historical-note" style={{ color: '#eab308' }}>✓ Đã gửi yêu cầu tự động xử lý mâu thuẫn logic.</p>
                    <ul className="warnings-list">
                      {msg.warnings.map((warn, widx) => {
                        const chapterSource = warn.conflicting_chapter ? `Chương ${warn.conflicting_chapter}` : "Bối cảnh thế giới/nhân vật";
                        return <li key={widx}>⚠️ [{chapterSource}] {warn.warning}</li>;
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
            
            {msg.type === 'model_error' && (
              <div className="widget-model-error">
                <div className="widget-header text-red">
                  <AlertTriangle className="icon-xs text-red animate-pulse" />
                  <span>Lỗi quá tải / Không tìm thấy Model AI</span>
                </div>
                <div className="error-description">
                  <p>{msg.error}</p>
                  <p className="text-muted" style={{ marginTop: '4px' }}>Model hiện tại: <code>{msg.currentModel}</code></p>
                </div>
                {isLastOfItsType ? (
                  <ModelChangeForm onSubmit={handleSendModelChange} currentModel={msg.currentModel} />
                ) : (
                  <p className="widget-historical-note">✓ Đã xử lý đổi model AI khác.</p>
                )}
              </div>
            )}
          </div>
        </div>
        
        {isUser && (
          <div className="chat-avatar user-avatar">
            <MessageSquare className="icon-xs" />
          </div>
        )}
      </div>
    );
  };

  const isThinking = ['starting', 'running', 'analyzing_requirements', 'drafting', 'revising', 'auditing', 'updating'].includes(status);

  // Render Connections Line Layer
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
        // Stop exactly at the border of target node (approx 110px from center)
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

  return (
    <div className={`chapter-generator ${status === 'idle' ? 'setup-mode' : ''} fade-in`}>
      {/* Insert Localized CSS for Event Nodes Canvas */}
      <style>{`
        .canvas-container {
          position: relative;
          width: 100%;
          height: 100%;
          background-color: #0d121f;
          border: 1px solid var(--border-glass);
          border-radius: 12px;
          overflow: auto;
          box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
        }
        .canvas-container::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .canvas-container::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
          border-radius: 4px;
        }
        .canvas-container::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }
        .canvas-container::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.3);
        }
        .canvas-wrapper {
          position: relative;
          width: 2400px;
          height: 1600px;
          background-image: 
            radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
          background-color: transparent;
        }
        .canvas-svg {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 1;
        }
        .canvas-node {
          position: absolute;
          width: 200px;
          min-height: 90px;
          padding: 12px;
          border-radius: 10px;
          border: 1px solid var(--border-glass);
          background: rgba(15, 21, 36, 0.85);
          backdrop-filter: blur(10px);
          z-index: 2;
          cursor: grab;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
          user-select: none;
        }
        .canvas-node:active {
          cursor: grabbing;
        }
        .canvas-node:hover {
          border-color: var(--color-cyan);
          box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);
        }
        .canvas-node.linking-source {
          border-color: var(--color-yellow);
          box-shadow: 0 0 15px var(--color-yellow-glow);
        }
        .canvas-node.editing-node {
          border-color: var(--color-cyan);
          box-shadow: 0 0 15px var(--color-cyan-glow);
        }
        .canvas-node-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 6px;
          white-space: nowrap;
          text-overflow: ellipsis;
          overflow: hidden;
        }
        .canvas-node-meta {
          font-size: 11px;
          color: var(--text-secondary);
          display: flex;
          flex-direction: column;
          gap: 3px;
          max-height: 40px;
          overflow: hidden;
        }
        .canvas-node-actions {
          display: flex;
          justify-content: space-between;
          margin-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 6px;
          gap: 2px;
        }
        .canvas-node-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          font-size: 10px;
          cursor: pointer;
          padding: 2px 4px;
          border-radius: 4px;
          display: inline-flex;
          align-items: center;
          gap: 2px;
          transition: var(--transition-fast);
        }
        .canvas-node-btn:hover {
          background: var(--bg-glass-hover);
          color: var(--text-primary);
        }
        .canvas-controls-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 14px;
          gap: 12px;
        }
        .canvas-editor-layout {
          display: grid;
          grid-template-columns: 1fr 350px;
          gap: 20px;
          margin-top: 12px;
          height: 650px;
        }
        .canvas-inspector {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
          border-radius: 12px;
          background: rgba(18, 22, 33, 0.55);
          border: 1px solid var(--border-glass);
          overflow-y: auto;
          height: 100%;
        }
        .mode-toggle-bar {
          display: flex;
          gap: 8px;
          padding: 4px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-glass);
          align-self: flex-start;
          margin-bottom: 16px;
        }
        .mode-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 12px;
          font-weight: 500;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: var(--transition-fast);
        }
        .mode-btn.active {
          background: var(--bg-glass-hover);
          color: var(--color-cyan);
        }
      `}</style>

      {status === 'idle' ? (
        // Start Generation Setup Panel
        <div className="generator-setup-card glass" style={{ padding: '24px', borderRadius: '12px' }}>
          <div className="card-header-spark" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Sparkles className="icon-sm text-cyan animate-pulse" />
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Sáng tác Chương mới</h3>
          </div>

          {/* Mode Selector Toggle */}
          <div className="mode-toggle-bar">
            <button 
              type="button" 
              className={`mode-btn ${mode === 'nodes' ? 'active' : ''}`}
              onClick={() => setMode('nodes')}
            >
              <Share2 className="icon-xs" />
              <span>Sơ đồ sự kiện (Canvas kéo thả)</span>
            </button>
            <button 
              type="button" 
              className={`mode-btn ${mode === 'text' ? 'active' : ''}`}
              onClick={() => setMode('text')}
            >
              <FileText className="icon-xs" />
              <span>Nhập văn bản thô</span>
            </button>
          </div>

          <form onSubmit={handleStartGeneration} className="setup-form">
            {/* AI Model selection at the very top */}
            <div className="form-row" style={{ display: 'flex', gap: '20px', marginBottom: '20px', borderBottom: '1px solid var(--border-glass)', paddingBottom: '16px' }}>
              <div className="form-group" style={{ width: '100%', maxWidth: '320px' }}>
                <label className="form-label" style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>Model AI</label>
                <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Khuyên dùng)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Chất lượng cao)</option>
                  <option value="gemini-2.0-flash">Gemini 2 Flash (2.0) (Mới)</option>
                  <option value="gemini-2.0-flash-lite">Gemini 2 Flash Lite</option>
                  <option value="gemini-3.5-flash">Gemini 3.5 Flash</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite</option>
                  <option value="gemini-3.1-pro">Gemini 3.1 Pro</option>
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite</option>
                  <option value="gemini-3.0-flash">Gemini 3 Flash</option>
                  <option value="gemma-4-26b-it">Gemma 4 26B IT</option>
                  <option value="gemma-4-31b-it">Gemma 4 31B IT</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>
            </div>
            {mode === 'text' ? (
              // Old Text Flow
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label required">Ý tưởng viết chương</label>
                <textarea
                  className="form-textarea"
                  value={userIdea}
                  onChange={e => setUserIdea(e.target.value)}
                  placeholder="Nhập ý tưởng diễn biến chi tiết cho chương này..."
                  rows={6}
                  required
                />
              </div>
            ) : (
              // New Canvas Event Flow
              <div style={{ marginBottom: '20px' }}>
                <div className="canvas-controls-bar">
                  <div className="text-muted" style={{ fontSize: '13px' }}>
                    {linkingSourceNodeId ? (
                      <span className="text-yellow animate-pulse">⚠️ Chọn node đích để thiết lập luồng câu chuyện</span>
                    ) : (
                      <span>💡 Nhấp giữ chuột để Kéo thả Node. Nhấp "Liên kết" để nối các sự kiện theo luồng kể chuyện.</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      type="button" 
                      onClick={handleOpenSuggestModal}
                      className="btn-primary-sm btn-purple"
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px',
                        background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                        color: '#fff',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      <Sparkles className="icon-xs" /> Gợi Ý Sự Kiện (AI)
                    </button>
                    <button 
                      type="button" 
                      onClick={handleAddNewNode}
                      className="btn-primary-sm btn-cyan"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus className="icon-xs" /> Thêm Sự Kiện (Node)
                    </button>
                  </div>

                </div>

                <div className="canvas-editor-layout">
                  {/* Visual Node Canvas Workspace */}
                  <div className="canvas-container">
                    <div className="canvas-wrapper">
                      {/* SVG Layer for Connections */}
                      <svg className="canvas-svg">
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
                            className={`canvas-node ${isSource ? 'linking-source' : ''} ${isEditing ? 'editing-node' : ''}`}
                            style={{ left: `${n.x}px`, top: `${n.y}px` }}
                            onMouseDown={(e) => handleNodeMouseDown(e, n.id)}
                          >
                            <div className="canvas-node-title" title={n.title}>{n.title}</div>
                            <div className="canvas-node-meta">
                              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>👤 {charText}</span>
                              {n.resolved_thread?.thread && (
                                <span className="text-yellow" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🔑 Giải quyết nút thắt</span>
                              )}
                              {n.links?.length > 0 && (
                                <span className="text-cyan" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🔗 Có liên kết chương cũ</span>
                              )}
                            </div>
                            
                            <div className="canvas-node-actions">
                              <button
                                type="button"
                                onClick={() => handleNodeLinkClick(n.id)}
                                className={`canvas-node-btn ${isSource ? 'text-yellow' : ''}`}
                                title="Tạo liên kết luồng đến node khác"
                              >
                                <Link className="icon-xs" style={{ width: '9px', height: '9px' }} /> 
                                {isSource ? 'Nối...' : 'Nối'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSuggestSingleNode(n.id)}
                                className="canvas-node-btn text-purple"
                                title="Gợi ý nội dung bằng AI"
                                disabled={suggestingNodeId === n.id}
                              >
                                <Sparkles className="icon-xs" style={{ width: '9px', height: '9px' }} />
                                {suggestingNodeId === n.id ? '...' : 'AI'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingNodeId(n.id)}
                                className="canvas-node-btn text-cyan"
                                title="Sửa chi tiết sự kiện"
                              >
                                <Edit className="icon-xs" style={{ width: '9px', height: '9px' }} /> Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteNode(n.id)}
                                className="canvas-node-btn text-red"
                                title="Xóa sự kiện"
                              >
                                <Trash2 className="icon-xs" style={{ width: '9px', height: '9px' }} /> Xóa
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {nodes.length === 0 && (
                      <div style={{ display: 'flex', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px', pointerEvents: 'none', zIndex: 10 }}>
                        Nhấp nút "Thêm Sự Kiện (Node)" ở trên để thiết lập kịch bản chương truyện.
                      </div>
                    )}
                  </div>

                  {/* Node Inspector Panel */}
                  <div className="canvas-inspector">
                    {editingNodeId ? (
                      // Editing Node Form
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: '600', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px' }}>Sửa Sự Kiện</h4>
                        
                        <div>
                          <label className="form-label required" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Tiêu đề / Tiến trình</label>
                          <input 
                            type="text"
                            className="form-input-sm"
                            style={{ width: '100%', background: '#10141f', border: '1px solid var(--border-glass)', color: '#fff', padding: '6px', borderRadius: '4px' }}
                            value={nodeForm.title}
                            onChange={e => setNodeForm({ ...nodeForm, title: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Mô tả kịch bản / Hướng giải quyết</label>
                          <textarea 
                            className="form-textarea-sm"
                            rows={3}
                            style={{ width: '100%', background: '#10141f', border: '1px solid var(--border-glass)', color: '#fff', padding: '6px', borderRadius: '4px' }}
                            value={nodeForm.description}
                            onChange={e => setNodeForm({ ...nodeForm, description: e.target.value })}
                          />
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Nội dung truyện thực tế (do AI sinh hoặc tự nhập)</label>
                          <textarea 
                            className="form-textarea-sm"
                            rows={6}
                            style={{ width: '100%', background: '#10141f', border: '1px solid var(--border-glass)', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '12px' }}
                            value={nodeForm.content || ''}
                            onChange={e => setNodeForm({ ...nodeForm, content: e.target.value })}
                            placeholder="Nội dung văn bản thực tế tương ứng với sự kiện này..."
                          />
                        </div>

                        {/* Characters Select */}
                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Nhân vật tham gia</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#10141f', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-glass)', maxHeight: '90px', overflowY: 'auto' }}>
                            {storyMeta?.characters?.map((char) => {
                              const isChecked = nodeForm.characters.includes(char.name);
                              return (
                                <label key={char.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', background: isChecked ? 'rgba(6,182,212,0.1)' : 'transparent', padding: '2px 6px', borderRadius: '4px' }}>
                                  <input 
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => handleCharacterToggle(char.name)}
                                  />
                                  <span>{char.name}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        {/* World Ledger Elements (Locations, Weapons, Techniques) */}
                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Địa điểm xuất hiện</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#10141f', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-glass)', maxHeight: '90px', overflowY: 'auto' }}>
                            {(!storyLedger?.locations || storyLedger.locations.length === 0) ? (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px' }}>Chưa có địa điểm nào trong Sổ cái</span>
                            ) : (
                              storyLedger.locations.map((loc) => {
                                const isChecked = Array.isArray(nodeForm.locations) && nodeForm.locations.includes(loc.name);
                                return (
                                  <label key={loc.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', background: isChecked ? 'rgba(0, 242, 254, 0.1)' : 'transparent', padding: '2px 6px', borderRadius: '4px' }}>
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleLocationToggle(loc.name)}
                                    />
                                    <span>{loc.name}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Binh khí / Pháp khí sử dụng</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#10141f', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-glass)', maxHeight: '90px', overflowY: 'auto' }}>
                            {(!storyLedger?.weapons || storyLedger.weapons.length === 0) ? (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px' }}>Chưa có binh khí nào trong Sổ cái</span>
                            ) : (
                              storyLedger.weapons.map((weap) => {
                                const isChecked = Array.isArray(nodeForm.weapons) && nodeForm.weapons.includes(weap.name);
                                return (
                                  <label key={weap.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', background: isChecked ? 'rgba(0, 242, 254, 0.1)' : 'transparent', padding: '2px 6px', borderRadius: '4px' }}>
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleWeaponToggle(weap.name)}
                                    />
                                    <span>{weap.name}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Công pháp thi triển</label>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', background: '#10141f', padding: '6px', borderRadius: '4px', border: '1px solid var(--border-glass)', maxHeight: '90px', overflowY: 'auto' }}>
                            {(!storyLedger?.techniques || storyLedger.techniques.length === 0) ? (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '2px' }}>Chưa có công pháp nào trong Sổ cái</span>
                            ) : (
                              storyLedger.techniques.map((tech) => {
                                const isChecked = Array.isArray(nodeForm.techniques) && nodeForm.techniques.includes(tech.name);
                                return (
                                  <label key={tech.name} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer', background: isChecked ? 'rgba(0, 242, 254, 0.1)' : 'transparent', padding: '2px 6px', borderRadius: '4px' }}>
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleTechniqueToggle(tech.name)}
                                    />
                                    <span>{tech.name}</span>
                                  </label>
                                );
                              })
                            )}
                          </div>
                        </div>

                        {/* Resolved Thread Select */}
                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Giải quyết nút thắt (nếu có)</label>
                          <select
                            style={{ width: '100%', background: '#10141f', border: '1px solid var(--border-glass)', color: '#fff', padding: '6px', borderRadius: '4px', fontSize: '12px' }}
                            value={nodeForm.resolvedThreadText}
                            onChange={e => setNodeForm({ ...nodeForm, resolvedThreadText: e.target.value })}
                          >
                            <option value="">-- Chọn nút thắt giải quyết --</option>
                            {storyLedger?.unresolved_threads?.map((t, tidx) => {
                              const threadVal = typeof t === 'object' && t !== null ? t.thread : t;
                              return <option key={tidx} value={threadVal}>{threadVal}</option>;
                            })}
                          </select>
                          {nodeForm.resolvedThreadText && (
                            <textarea
                              placeholder="Chi tiết cách giải quyết nút thắt..."
                              className="form-textarea-sm"
                              rows={2}
                              style={{ width: '100%', background: '#10141f', border: '1px solid var(--border-glass)', color: '#fff', padding: '6px', borderRadius: '4px', marginTop: '6px' }}
                              value={nodeForm.resolutionNote}
                              onChange={e => setNodeForm({ ...nodeForm, resolutionNote: e.target.value })}
                            />
                          )}
                        </div>

                        {/* Link to previous chapter nodes */}
                        <div>
                          <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '4px' }}>Liên kết với chương cũ</label>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: '#10141f', padding: '8px', borderRadius: '4px', border: '1px solid var(--border-glass)', maxHeight: '120px', overflowY: 'auto' }}>
                            {storyLedger?.timeline?.map((item) => {
                              const isChecked = nodeForm.links.some(l => l.chapter === item.chapter);
                              const linkObj = nodeForm.links.find(l => l.chapter === item.chapter);
                              const cachedData = chapterNodesCache[item.chapter];
                              
                              return (
                                <div key={item.chapter} style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', marginBottom: '4px' }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', fontWeight: '500' }}>
                                    <input 
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleChapterLinkToggle(item.chapter)}
                                    />
                                    <span>Chương {item.chapter}: {item.title}</span>
                                  </label>

                                  {isChecked && cachedData?.nodes && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: '18px', marginTop: '4px' }}>
                                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Chọn node liên kết (nhiều lựa chọn):</span>
                                      {cachedData.nodes.map(pn => {
                                        const isNodeChecked = linkObj?.nodes?.includes(pn.id);
                                        return (
                                          <label key={pn.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                            <input 
                                              type="checkbox"
                                              checked={isNodeChecked || false}
                                              onChange={() => handleLinkedNodeToggle(item.chapter, pn.id)}
                                            />
                                            <span>{pn.title}</span>
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
                            {(!storyLedger?.timeline || storyLedger.timeline.length === 0) && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Chưa có chương trước để liên kết.</span>
                            )}
                          </div>
                        </div>

                        {/* 1. Visual Preview & Quick Delete for Linked Chapters and Nodes */}
                        {nodeForm.links?.length > 0 && (
                          <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                            <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>Xem trực quan liên kết chương cũ:</label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                              {nodeForm.links.map((link) => {
                                const chapNum = link.chapter;
                                const chapTimeline = storyLedger?.timeline?.find(t => t.chapter === chapNum);
                                const cachedData = chapterNodesCache[chapNum];
                                
                                return (
                                  <div key={chapNum} style={{ padding: '8px', background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-glass)', borderRadius: '6px', fontSize: '11px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div style={{ fontWeight: '600', color: 'var(--color-cyan)' }}>
                                        Chương {chapNum}: {chapTimeline?.title || 'Không rõ tiêu đề'}
                                      </div>
                                      <button 
                                        type="button" 
                                        onClick={() => handleChapterLinkToggle(chapNum)}
                                        className="btn-icon" 
                                        style={{ width: '18px', height: '18px' }}
                                        title="Xóa liên kết chương"
                                      >
                                        <X className="icon-xs text-red" style={{ width: '12px', height: '12px' }} />
                                      </button>
                                    </div>
                                    <p className="text-muted" style={{ fontSize: '10px', marginTop: '2px', marginBottom: '6px', fontStyle: 'italic' }}>
                                      Tóm tắt: {chapTimeline?.summary || 'Chưa có tóm tắt.'}
                                    </p>
                                    
                                    {/* Linked nodes of this chapter */}
                                    {link.nodes?.length > 0 && (
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px' }}>
                                        {link.nodes.map(nodeId => {
                                          const pn = cachedData?.nodes?.find(n => n.id === nodeId);
                                          return (
                                            <div key={nodeId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '4px', borderRadius: '4px' }}>
                                              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                                                <span style={{ fontWeight: '500' }}>📍 {pn?.title || nodeId}</span>
                                                <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>{pn?.description || 'Không có mô tả.'}</span>
                                                {pn?.content && (
                                                  <span style={{ fontSize: '9px', color: 'var(--color-cyan)', marginTop: '2px', display: 'block', whiteSpace: 'pre-wrap', maxHeight: '60px', overflowY: 'auto', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '2px' }}>
                                                    <strong>Nội dung:</strong> {pn.content}
                                                  </span>
                                                )}
                                              </div>
                                              <button 
                                                type="button" 
                                                onClick={() => handleLinkedNodeToggle(chapNum, nodeId)}
                                                className="btn-icon" 
                                                style={{ width: '16px', height: '16px' }}
                                                title="Xóa liên kết sự kiện"
                                              >
                                                <X className="icon-xs text-red" style={{ width: '10px', height: '10px' }} />
                                              </button>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 2. Visual Preview & Quick Delete for Current Chapter Connections */}
                        {(() => {
                          const nodeConnectionsFrom = connections.filter(c => c.from === editingNodeId);
                          const nodeConnectionsTo = connections.filter(c => c.to === editingNodeId);
                          
                          if (nodeConnectionsFrom.length === 0 && nodeConnectionsTo.length === 0) return null;

                          return (
                            <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', paddingTop: '10px' }}>
                              <label className="form-label" style={{ fontSize: '11px', display: 'block', marginBottom: '6px' }}>Các luồng liên kết trong chương:</label>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '150px', overflowY: 'auto' }}>
                                {nodeConnectionsFrom.map((c, idx) => {
                                  const targetNode = nodes.find(n => n.id === c.to);
                                  return (
                                    <div key={`from-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(6,182,212,0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '270px' }}>
                                        Đầu ra &rarr; {targetNode?.title || c.to}
                                      </span>
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setConnections(prev => prev.filter(conn => !(conn.from === c.from && conn.to === c.to)));
                                        }} 
                                        className="btn-icon" 
                                        style={{ width: '20px', height: '20px' }}
                                        title="Xóa liên kết luồng đầu ra"
                                      >
                                        <X className="icon-xs text-red" style={{ width: '12px', height: '12px' }} />
                                      </button>
                                    </div>
                                  );
                                })}

                                {nodeConnectionsTo.map((c, idx) => {
                                  const sourceNode = nodes.find(n => n.id === c.from);
                                  return (
                                    <div key={`to-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(16,185,129,0.05)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}>
                                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '270px' }}>
                                        Đầu vào &larr; {sourceNode?.title || c.from}
                                      </span>
                                      <button 
                                        type="button" 
                                        onClick={() => {
                                          setConnections(prev => prev.filter(conn => !(conn.from === c.from && conn.to === c.to)));
                                        }} 
                                        className="btn-icon" 
                                        style={{ width: '20px', height: '20px' }}
                                        title="Xóa liên kết luồng đầu vào"
                                      >
                                        <X className="icon-xs text-red" style={{ width: '12px', height: '12px' }} />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                          <button type="button" onClick={() => setEditingNodeId(null)} className="btn-secondary-sm">Hủy</button>
                          <button type="button" onClick={handleSaveNodeForm} className="btn-primary-sm btn-cyan">Cập nhật</button>
                        </div>
                      </div>
                    ) : (
                      // General details panel
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', justifyContent: 'space-between', height: '100%' }}>
                        <div>
                          <h4 style={{ fontSize: '14px', fontWeight: '600', borderBottom: '1px solid var(--border-glass)', paddingBottom: '6px', marginBottom: '12px' }}>Bộ thanh tra Sơ đồ</h4>
                          <p className="text-muted" style={{ fontSize: '12px', lineHeight: '1.5' }}>
                            Chọn bất kỳ một sự kiện (Node) trên canvas để tùy chỉnh chi tiết: nhân vật tham gia, nút thắt cốt truyện giải quyết, liên kết sự kiện liên chương.
                          </p>
                          
                          {/* List of current connections */}
                          {connections.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                              <label className="form-label" style={{ fontSize: '12px', fontWeight: '500', display: 'block', marginBottom: '8px' }}>Các liên kết luồng kể truyện:</label>
                              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                {connections.map((c, idx) => {
                                  const fromNode = nodes.find(n => n.id === c.from);
                                  const toNode = nodes.find(n => n.id === c.to);
                                  return (
                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', marginBottom: '6px' }}>
                                      <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
                                        {fromNode?.title || c.from} &rarr; {toNode?.title || c.to}
                                      </span>
                                      <button type="button" onClick={() => handleDeleteConnection(idx)} className="btn-icon" style={{ width: '22px', height: '22px' }}>
                                        <X className="icon-xs text-red" />
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>

                        <button 
                          type="button"
                          onClick={handleAddNewNode}
                          className="btn-secondary-sm"
                          style={{ width: '100%', display: 'flex', justifyContent: 'center', gap: '4px' }}
                        >
                          <Plus className="icon-xs" /> Thêm sự kiện mới
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="form-row" style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-glass)', paddingTop: '16px', marginTop: '16px' }}>
              <button type="submit" className="btn-primary btn-generate" disabled={generating} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 24px', fontSize: '14px' }}>
                <Sparkles className="icon-xs" /> <span>Bắt đầu Sáng tác</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        // Chat room workspace
        <div className="generator-workspace">
          {/* Header step tracker */}
          <ProgressBar status={status === 'waiting_model_change' ? 'running' : status} />

          <div className="chat-container">
            <div className="chat-header">
              <MessageSquare className="icon-xs text-cyan" />
              <h4>Không Gian Tương Tác Sáng Tác</h4>
            </div>

            <div className="chat-messages-container">
              {messages.map((msg, idx) => renderMessage(msg, idx))}
              <div ref={chatEndRef} />
            </div>

            <div className="chat-footer">
              {isThinking && (
                <div className="chat-thinking-indicator">
                  <span>ChapterAgent đang xử lý tiến trình</span>
                  <div className="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}

              {/* Reset/Back Options for Completed or Error States */}
              {(status === 'completed' || status === 'error') && (
                <div className="actions-row" style={{ alignSelf: 'center', margin: '10px 0' }}>
                  <button onClick={() => setStatus('idle')} className="btn-secondary-sm">
                    <ArrowLeft className="icon-xs" /> Quay lại Trang thiết lập
                  </button>
                  {status === 'completed' && (
                    <button onClick={() => setStatus('idle')} className="btn-primary-sm btn-green">
                      Sáng tác chương tiếp theo <Sparkles className="icon-xs" />
                    </button>
                  )}
                </div>
              )}

              <div className="chat-input-wrapper" style={{ display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  className="chat-input-bar"
                  disabled={true}
                  placeholder={
                    status === 'waiting_clarification' 
                      ? "Hãy điền câu trả lời inline phía trên..." 
                      : status === 'waiting_review'
                      ? "Hãy duyệt hoặc điền feedback inline phía trên..."
                      : status === 'waiting_model_change'
                      ? "Hãy đổi model AI inline phía trên..."
                      : "Tiến trình chạy nền đang được thực thi ngầm..."
                  }
                  style={{ flex: 1 }}
                />
                {generating && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="btn-cancel"
                    title="Hủy tiến trình sáng tác"
                  >
                    <XCircle className="icon-xs" /> Hủy sáng tác
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}



      {showSuggestModal && (
        <div className="modal-overlay">
          <div className="modal-card glass" style={{ maxWidth: '650px', width: '90%' }}>
            <div className="modal-header">
              <div className="modal-title-container">
                <Sparkles className="icon-sm text-cyan" style={{ animation: 'pulse 1.5s infinite' }} />
                <h3>Gợi Ý Sơ Đồ Sự Kiện Bằng AI</h3>
              </div>
              <button 
                onClick={() => !suggesting && setShowSuggestModal(false)} 
                className="btn-close" 
                type="button"
                disabled={suggesting}
              >
                <X className="icon-sm" />
              </button>
            </div>

            {suggesting ? (
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '20px' }}>
                <div className="ai-glowing-spinner" style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  border: '3px solid rgba(6, 182, 212, 0.1)',
                  borderTopColor: 'var(--color-cyan)',
                  borderRightColor: '#a855f7',
                  animation: 'spin 1s linear infinite, glow 2s ease-in-out infinite alternate'
                }} />
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>AI Đang Xây Dựng Kịch Bản...</h4>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Quá trình này có thể mất từ 10 - 25 giây để dệt nên kịch bản mượt mà nhất.</p>
                </div>
                <style>{`
                  @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                  }
                  @keyframes glow {
                    0% { box-shadow: 0 0 10px rgba(6, 182, 212, 0.2); }
                    100% { box-shadow: 0 0 25px rgba(168, 85, 247, 0.4); }
                  }
                `}</style>
              </div>
            ) : (
              <form onSubmit={handleAISuggestSubmit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', paddingRight: '4px' }}>
                {suggestError && (
                  <div className="chat-system-log level-error" style={{ padding: '8px 12px', borderRadius: '6px', margin: 0 }}>
                    <span className="log-text">⚠️ {suggestError}</span>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label className="form-label required">Số lượng sự kiện (Nodes) cần tạo</label>
                    <select 
                      className="form-select"
                      value={suggestForm.numNodes}
                      onChange={e => setSuggestForm(prev => ({ ...prev, numNodes: parseInt(e.target.value) }))}
                      required
                    >
                      <option value="2">2 Nodes (Ngắn)</option>
                      <option value="3">3 Nodes (Mặc định)</option>
                      <option value="4">4 Nodes</option>
                      <option value="5">5 Nodes (Trung bình)</option>
                      <option value="6">6 Nodes</option>
                      <option value="7">7 Nodes</option>
                      <option value="8">8 Nodes (Chi tiết)</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Chương sẽ liên kết</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px' }}>
                    {storyLedger?.timeline && storyLedger.timeline.length > 0 ? (
                      storyLedger.timeline.map((item) => {
                        const isChecked = suggestForm.linkedChapters.includes(item.chapter);
                        return (
                          <label key={item.chapter} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer', background: isChecked ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isChecked ? 'var(--color-cyan)' : 'var(--border-glass)'}`, borderRadius: '6px', padding: '6px 10px', transition: 'all 0.2s' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSuggestToggle('linkedChapters', item.chapter)}
                              style={{ display: 'none' }}
                            />
                            <span>Chương {item.chapter}: {item.title}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có chương cũ để liên kết.</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Nhân vật sẽ xuất hiện</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px' }}>
                    {storyMeta?.characters && storyMeta.characters.length > 0 ? (
                      storyMeta.characters.map((char) => {
                        const isChecked = suggestForm.characters.includes(char.name);
                        return (
                          <label key={char.name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer', background: isChecked ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isChecked ? 'var(--color-cyan)' : 'var(--border-glass)'}`, borderRadius: '6px', padding: '6px 10px', transition: 'all 0.2s' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSuggestToggle('characters', char.name)}
                              style={{ display: 'none' }}
                            />
                            <span>{char.name} ({char.role})</span>
                          </label>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có nhân vật nào trong tác phẩm.</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Giải quyết nút thắt (nếu có)</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px' }}>
                    {storyLedger?.unresolved_threads && storyLedger.unresolved_threads.length > 0 ? (
                      storyLedger.unresolved_threads.map((ut, utidx) => {
                        const threadText = typeof ut === 'string' ? ut : ut.thread;
                        const isChecked = suggestForm.resolvedThreads.includes(threadText);
                        return (
                          <label key={utidx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer', background: isChecked ? 'rgba(6, 182, 212, 0.05)' : 'transparent', border: `1px solid ${isChecked ? 'rgba(6, 182, 212, 0.3)' : 'transparent'}`, borderRadius: '6px', padding: '6px 8px', transition: 'all 0.2s' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSuggestToggle('resolvedThreads', threadText)}
                              style={{ accentColor: 'var(--color-cyan)' }}
                            />
                            <span>{threadText}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có nút thắt nào cần giải quyết.</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Địa điểm sẽ tới hoặc sẽ ở</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px' }}>
                    {storyLedger?.locations && storyLedger.locations.length > 0 ? (
                      storyLedger.locations.map((loc, lidx) => {
                        const isChecked = suggestForm.locations.includes(loc.name);
                        return (
                          <label key={lidx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer', background: isChecked ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isChecked ? 'var(--color-cyan)' : 'var(--border-glass)'}`, borderRadius: '6px', padding: '6px 10px', transition: 'all 0.2s' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSuggestToggle('locations', loc.name)}
                              style={{ display: 'none' }}
                            />
                            <span>{loc.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có địa điểm nào trong Sổ cái.</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Công pháp sẽ dùng</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px' }}>
                    {storyLedger?.techniques && storyLedger.techniques.length > 0 ? (
                      storyLedger.techniques.map((tech, tidx) => {
                        const isChecked = suggestForm.techniques.includes(tech.name);
                        return (
                          <label key={tidx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer', background: isChecked ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isChecked ? 'var(--color-cyan)' : 'var(--border-glass)'}`, borderRadius: '6px', padding: '6px 10px', transition: 'all 0.2s' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSuggestToggle('techniques', tech.name)}
                              style={{ display: 'none' }}
                            />
                            <span>{tech.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có công pháp nào trong Sổ cái.</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Binh khí sẽ dùng</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '10px' }}>
                    {storyLedger?.weapons && storyLedger.weapons.length > 0 ? (
                      storyLedger.weapons.map((weap, widx) => {
                        const isChecked = suggestForm.weapons.includes(weap.name);
                        return (
                          <label key={widx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: isChecked ? 'var(--color-cyan)' : 'var(--text-secondary)', cursor: 'pointer', background: isChecked ? 'rgba(6, 182, 212, 0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${isChecked ? 'var(--color-cyan)' : 'var(--border-glass)'}`, borderRadius: '6px', padding: '6px 10px', transition: 'all 0.2s' }}>
                            <input 
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleSuggestToggle('weapons', weap.name)}
                              style={{ display: 'none' }}
                            />
                            <span>{weap.name}</span>
                          </label>
                        );
                      })
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Chưa có binh khí nào trong Sổ cái.</span>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Chú thích / Lưu ý khi tạo sự kiện (Directives)</label>
                  <textarea 
                    className="form-textarea"
                    value={suggestForm.notes}
                    onChange={e => setSuggestForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Ví dụ: Kịch bản kịch tính, Sở Mặc đột phá ở cuối chương, hoặc các lưu ý về bối cảnh..."
                    rows={4}
                  />
                </div>

                <div className="modal-actions" style={{ marginTop: '8px' }}>
                  <button type="button" onClick={() => setShowSuggestModal(false)} className="btn-secondary">Hủy</button>
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{
                      background: 'linear-gradient(135deg, #a855f7 0%, #06b6d4 100%)',
                      color: '#fff',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles className="icon-xs" /> Gợi Ý Sự Kiện (AI)
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

