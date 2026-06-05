import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, MessageSquare, Send, CheckCircle2, AlertTriangle, Eye, ArrowLeft, Terminal, XCircle } from 'lucide-react';
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
  const standardModels = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-2.5-pro'];
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
            <option value="gemini-1.5-flash">1. gemini-1.5-flash</option>
            <option value="gemini-1.5-pro">2. gemini-1.5-pro</option>
            <option value="gemini-2.0-flash">3. gemini-2.0-flash</option>
            <option value="gemini-2.5-flash">4. gemini-2.5-flash</option>
            <option value="gemini-2.5-pro">5. gemini-2.5-pro</option>
            <option value="other">6. Khác (Nhập thủ công)</option>
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

export default function ChapterGenerator({ 
  storyUuid, 
  defaultModel, 
  socket, 
  onGenerationComplete 
}) {
  const [userIdea, setUserIdea] = useState('');
  const [model, setModel] = useState(defaultModel || 'gemini-2.5-flash');
  const [generating, setGenerating] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, running, etc.
  const [messages, setMessages] = useState([]);

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
    socket.on('llm_error_select_model', onLlmErrorSelectModel);

    return () => {
      socket.off('agent_status', onAgentStatus);
      socket.off('agent_log', onAgentLog);
      socket.off('clarify_requirements', onClarifyRequirements);
      socket.off('draft_review_needed', onDraftReviewNeeded);
      socket.off('audit_warnings', onAuditWarnings);
      socket.off('llm_error_select_model', onLlmErrorSelectModel);
    };
  }, [socket, storyUuid, onGenerationComplete]);

  const handleStartGeneration = async (e) => {
    e.preventDefault();
    if (!userIdea.trim()) return;

    setGenerating(true);
    setStatus('starting');
    setMessages([
      {
        id: `user-idea-${Date.now()}`,
        sender: 'user',
        type: 'text',
        text: `Sáng tác chương mới với ý tưởng: "${userIdea.trim()}"`,
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
        body: JSON.stringify({ user_idea: userIdea.trim(), model: model })
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
                  <AlertTriangle className="icon-xs animate-bounce" />
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
                    {msg.warnings.map((warn, widx) => (
                      <li key={widx}>⚠️ {warn}</li>
                    ))}
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

  return (
    <div className="chapter-generator fade-in">
      {status === 'idle' ? (
        // Start Generation Setup Panel
        <div className="generator-setup-card glass">
          <div className="card-header-spark">
            <Sparkles className="icon-sm text-cyan animate-pulse" />
            <h3>Sáng tác Chương mới</h3>
          </div>
          <form onSubmit={handleStartGeneration} className="setup-form">
            <div className="form-group">
              <label className="form-label required">Ý tưởng sơ bộ cho chương mới</label>
              <textarea
                className="form-textarea"
                value={userIdea}
                onChange={e => setUserIdea(e.target.value)}
                placeholder="Nhập ý kiến diễn biến chính. Ví dụ: 'Chu Niệm Phàm đi vào Vong Linh rừng để hái thuốc theo yêu cầu của Mục Dã, trên đường gặp ma thú tấn công nhưng được sức mạnh kỳ lạ trợ giúp...'"
                rows={5}
                required
              />
            </div>
            <div className="form-row align-items-center">
              <div className="form-group flex-1">
                <label className="form-label">Model AI</label>
                <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Khuyên dùng)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (Chất lượng cao)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Nhanh)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Thông minh)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary btn-generate margin-top-md" disabled={generating}>
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
    </div>
  );
}
