import React from 'react';
import { Check, AlertCircle } from 'lucide-react';

export default function ProgressBar({ status }) {
  // Map raw status into steps index (0 to 4)
  // Step 1: Phân tích (analyzing_requirements, waiting_clarification)
  // Step 2: Soạn thảo (drafting)
  // Step 3: Tác giả duyệt (waiting_review, revising)
  // Step 4: Kiểm duyệt (auditing)
  // Step 5: Hoàn tất (updating, completed)
  
  const steps = [
    { label: 'Phân tích Yêu cầu', key: 'analysis', statuses: ['analyzing_requirements', 'waiting_clarification'] },
    { label: 'Soạn thảo Bản nháp', key: 'drafting', statuses: ['drafting'] },
    { label: 'Tác giả phê duyệt', key: 'review', statuses: ['waiting_review', 'revising'] },
    { label: 'Kiểm duyệt Logic', key: 'auditing', statuses: ['auditing'] },
    { label: 'Cập nhật & Hoàn thành', key: 'completion', statuses: ['updating', 'completed'] }
  ];

  const getStepState = (stepIdx) => {
    const step = steps[stepIdx];
    
    // If error occurs, all incomplete steps turn error or dim
    if (status === 'error') {
      // Find where we errored? Actually we can just mark current step as error
      return 'dim'; 
    }

    const currentIdx = steps.findIndex(s => s.statuses.includes(status));
    
    if (status === 'completed') {
      return 'completed';
    }

    if (currentIdx === -1) {
      return 'dim'; // Idle/not started
    }

    if (stepIdx < currentIdx) {
      return 'completed';
    } else if (stepIdx === currentIdx) {
      if (status === 'waiting_clarification' || status === 'waiting_review') {
        return 'waiting';
      }
      return 'active';
    } else {
      return 'dim';
    }
  };

  return (
    <div className="progress-bar-container glass">
      <div className="progress-steps-row">
        {steps.map((step, idx) => {
          const state = getStepState(idx);
          return (
            <React.Fragment key={idx}>
              <div className={`step-node ${state}`}>
                <div className="step-badge">
                  {state === 'completed' ? (
                    <Check className="icon-xs" />
                  ) : status === 'error' && getStepState(idx) === 'active' ? (
                    <AlertCircle className="icon-xs" />
                  ) : (
                    idx + 1
                  )}
                </div>
                <span className="step-label">{step.label}</span>
              </div>
              {idx < steps.length - 1 && (
                <div className={`step-line ${state === 'completed' ? 'completed' : ''}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
