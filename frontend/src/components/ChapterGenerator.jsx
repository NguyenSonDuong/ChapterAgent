import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Terminal, MessageSquare, Send, CheckCircle2, AlertTriangle, Eye, ArrowRight } from 'lucide-react';
import ProgressBar from './ProgressBar';

export default function ChapterGenerator({ 
  storyUuid, 
  defaultModel, 
  socket, 
  onGenerationComplete 
}) {
  const [userIdea, setUserIdea] = useState('');
  const [model, setModel] = useState(defaultModel || 'gemini-2.5-flash');
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, running, etc.
  const [logs, setLogs] = useState([]);
  
  // Real-time interactive states
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState('');
  
  const [draftContent, setDraftContent] = useState('');
  const [revisionFeedback, setRevisionFeedback] = useState('');
  
  const [warnings, setWarnings] = useState([]);
  const [auditFeedback, setAuditFeedback] = useState('');

  const logsEndRef = useRef(null);

  // Auto-scroll logs to bottom
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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
      
      setStatus(data.status);
      setLogs((prev) => [...prev, { 
        time: new Date().toLocaleTimeString(), 
        status: data.status, 
        message: data.message 
      }]);

      if (data.status === 'completed') {
        setGenerating(false);
        if (onGenerationComplete) onGenerationComplete(data.chapter_num);
      } else if (data.status === 'error') {
        setGenerating(false);
      }
    };

    const onClarifyRequirements = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setQuestions(data.questions);
      setAnswers('');
      setStatus('waiting_clarification');
    };

    const onDraftReviewNeeded = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setDraftContent(data.draft_content);
      setRevisionFeedback('');
      setStatus('waiting_review');
    };

    const onAuditWarnings = (data) => {
      if (data.story_uuid !== storyUuid) return;
      setWarnings(data.warnings || []);
      setAuditFeedback(data.feedback || '');
    };

    socket.on('agent_status', onAgentStatus);
    socket.on('clarify_requirements', onClarifyRequirements);
    socket.on('draft_review_needed', onDraftReviewNeeded);
    socket.on('audit_warnings', onAuditWarnings);

    return () => {
      socket.off('agent_status', onAgentStatus);
      socket.off('clarify_requirements', onClarifyRequirements);
      socket.off('draft_review_needed', onDraftReviewNeeded);
      socket.off('audit_warnings', onAuditWarnings);
    };
  }, [socket, storyUuid, onGenerationComplete]);

  const handleStartGeneration = async (e) => {
    e.preventDefault();
    if (!userIdea.trim()) return;

    setGenerating(true);
    setLogs([{ 
      time: new Date().toLocaleTimeString(), 
      status: 'starting', 
      message: 'Bắt đầu gửi yêu cầu sáng tác chương...' 
    }]);
    setQuestions([]);
    setDraftContent('');
    setWarnings([]);

    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyUuid}/chapters/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_idea: userIdea.trim(), model: model })
      });
      const data = await res.json();
      if (!res.ok) {
        setLogs((prev) => [...prev, { 
          time: new Date().toLocaleTimeString(), 
          status: 'error', 
          message: data.error || 'Lỗi không xác định khi bắt đầu sinh chương.' 
        }]);
        setGenerating(false);
      }
    } catch (err) {
      setLogs((prev) => [...prev, { 
        time: new Date().toLocaleTimeString(), 
        status: 'error', 
        message: f`Không thể kết nối đến backend API: ${err.message}` 
      }]);
      setGenerating(false);
    }
  };

  const handleSendClarification = () => {
    if (!socket) return;
    socket.emit('submit_clarification', {
      story_uuid: storyUuid,
      answers: answers.trim()
    });
    setLogs((prev) => [...prev, { 
      time: new Date().toLocaleTimeString(), 
      status: 'sending', 
      message: `Đã gửi câu trả lời làm rõ: "${answers}"` 
    }]);
    setQuestions([]);
    setAnswers('');
    setStatus('running');
  };

  const handleSendReview = (feedbackText) => {
    if (!socket) return;
    socket.emit('submit_review_feedback', {
      story_uuid: storyUuid,
      feedback: feedbackText
    });
    if (feedbackText.toLowerCase() === 'done') {
      setLogs((prev) => [...prev, { 
        time: new Date().toLocaleTimeString(), 
        status: 'sending', 
        message: 'Đã duyệt bản nháp thông qua (Done)!' 
      }]);
    } else {
      setLogs((prev) => [...prev, { 
        time: new Date().toLocaleTimeString(), 
        status: 'sending', 
        message: `Yêu cầu chỉnh sửa nháp truyện: "${feedbackText}"` 
      }]);
    }
    setDraftContent('');
    setRevisionFeedback('');
    setStatus('running');
  };

  return (
    <div className="chapter-generator fade-in">
      {status === 'idle' ? (
        // Start Generation Form
        <div className="generator-setup-card glass">
          <div className="card-header-spark">
            <Sparkles className="icon-sm text-cyan animate-pulse" />
            <h3>Sáng tác Chương kế tiếp</h3>
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
                <label className="form-label">Chỉ định Model AI cho phiên này</label>
                <select className="form-select" value={model} onChange={e => setModel(e.target.value)}>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Mặc định)</option>
                  <option value="gemini-1.5-flash">gemini-1.5-flash (Nhanh)</option>
                  <option value="gemini-1.5-pro">gemini-1.5-pro (Thông minh)</option>
                  <option value="gemini-2.0-flash">gemini-2.0-flash (Thế hệ mới)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (Chất lượng cao nhất)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary btn-generate margin-top-md" disabled={generating}>
                <Sparkles className="icon-xs" /> <span>Bắt đầu Sáng tác</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        // Live Generation Workspace
        <div className="generator-workspace">
          {/* Progress bar */}
          <ProgressBar status={status} />

          <div className="workspace-panels">
            {/* Left Column: Live chat / prompts / draft review */}
            <div className="interaction-panel glass">
              <div className="panel-title-bar">
                <MessageSquare className="icon-xs text-cyan" />
                <h4>Khung Tương Tác Thời Gian Thực</h4>
              </div>

              <div className="interaction-content">
                {/* 1. Normal Running / Loader */}
                {status === 'running' || status === 'analyzing_requirements' || status === 'drafting' || status === 'revising' || status === 'auditing' || status === 'updating' ? (
                  <div className="status-loading-card">
                    <div className="loader spin"></div>
                    <p className="margin-top-sm">Agent đang thực thi tiến trình chạy nền...</p>
                  </div>
                ) : null}

                {/* 2. Questions Prompt (waiting_clarification) */}
                {status === 'waiting_clarification' && questions.length > 0 && (
                  <div className="interactive-card clarification-card glass-light fade-in">
                    <div className="card-header text-yellow">
                      <AlertTriangle className="icon-xs" />
                      <h5>Làm rõ ý tưởng (Requirement Clarification)</h5>
                    </div>
                    <div className="questions-box">
                      <p className="instruction-text text-muted">AI phát hiện thiếu thông tin cốt lõi, hãy trả lời câu hỏi dưới đây:</p>
                      <ul className="questions-ul">
                        {questions.map((q, idx) => (
                          <li key={idx} className="question-li">{q}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="input-reply-area">
                      <textarea
                        className="form-textarea-sm"
                        value={answers}
                        onChange={e => setAnswers(e.target.value)}
                        placeholder="Nhập câu trả lời hoặc làm rõ thêm các chi tiết..."
                        rows={3}
                      />
                      <div className="actions-row">
                        <button onClick={() => { setAnswers(''); handleSendClarification(); }} className="btn-secondary-sm">Bỏ qua</button>
                        <button onClick={handleSendClarification} className="btn-primary-sm btn-cyan">
                          <Send className="icon-xs" /> Gửi câu trả lời
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Draft Review (waiting_review) */}
                {status === 'waiting_review' && draftContent && (
                  <div className="interactive-card review-card glass-light fade-in">
                    <div className="card-header text-cyan">
                      <MessageSquare className="icon-xs" />
                      <h5>Phê duyệt Bản nháp Chương truyện</h5>
                    </div>
                    <div className="draft-preview-box">
                      <p className="instruction-text text-muted">Đọc bản viết nháp bên dưới và cho ý kiến:</p>
                      <div className="draft-content-scroll">
                        {draftContent.split('\n').map((line, idx) => (
                          <p key={idx}>{line}</p>
                        ))}
                      </div>
                    </div>
                    <div className="input-reply-area">
                      <input
                        type="text"
                        className="form-input-sm"
                        value={revisionFeedback}
                        onChange={e => setRevisionFeedback(e.target.value)}
                        placeholder="Ví dụ: 'Thêm hội thoại kịch tính', 'Cho nhân vật A tỏ vẻ nghi ngờ'..."
                      />
                      <div className="actions-row">
                        <button 
                          onClick={() => handleSendReview(revisionFeedback || 'Chỉnh sửa lại đoạn cuối')} 
                          className="btn-secondary-sm btn-re-edit"
                          disabled={!revisionFeedback.trim()}
                        >
                          Yêu cầu sửa lại
                        </button>
                        <button 
                          onClick={() => handleSendReview('Done')} 
                          className="btn-primary-sm btn-green"
                        >
                          <CheckCircle2 className="icon-xs" /> Duyệt bản viết (Done)
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Complete Status */}
                {status === 'completed' && (
                  <div className="interactive-card success-card glass-light fade-in">
                    <CheckCircle2 className="icon-md text-green animate-bounce" />
                    <h3>Hoàn Thành Chương Mới!</h3>
                    <p className="text-muted text-center padding-sm">Chương truyện đã được kiểm duyệt logic và lưu vào ổ đĩa thành công.</p>
                    <div className="actions-row">
                      <button onClick={() => setStatus('idle')} className="btn-secondary-sm">Sáng tác tiếp</button>
                    </div>
                  </div>
                )}

                {/* 5. Error Status */}
                {status === 'error' && (
                  <div className="interactive-card error-card glass-light fade-in">
                    <AlertTriangle className="icon-md text-red animate-pulse" />
                    <h3 className="text-red">Gặp lỗi hệ thống!</h3>
                    <p className="text-muted text-center padding-sm">Gặp lỗi trong quá trình thực thi đồ thị Agent.</p>
                    <button onClick={() => setStatus('idle')} className="btn-primary-sm btn-red">Trở về</button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Terminal Logs & Audit Warnings */}
            <div className="terminal-panel glass">
              <div className="panel-title-bar">
                <Terminal className="icon-xs text-green" />
                <h4>Live Console Logs</h4>
              </div>
              <div className="terminal-logs-scroll">
                {logs.map((log, index) => (
                  <div key={index} className="log-line">
                    <span className="log-time">[{log.time}]</span>
                    <span className={`log-status status-${log.status}`}>[{log.status.toUpperCase()}]</span>
                    <span className="log-msg">{log.message}</span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>

              {/* Collapsible/Card Audit warnings inside terminal panel if present */}
              {warnings.length > 0 && (
                <div className="audit-warnings-box glass-light">
                  <div className="audit-header text-yellow">
                    <AlertTriangle className="icon-xs" />
                    <h5>Cảnh báo logic cốt truyện (Auditor Warnings)</h5>
                  </div>
                  <ul className="audit-ul">
                    {warnings.map((warn, idx) => (
                      <li key={idx} className="audit-li">⚠️ {warn}</li>
                    ))}
                  </ul>
                  {auditFeedback && (
                    <div className="audit-feedback-desc">
                      <strong>Nhận xét:</strong> {auditFeedback}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
