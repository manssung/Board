import React from 'react';

export default function AiDraftList({ drafts, isPartial = false, onApplyAll, onApply, onDiscard }) {
  return (
    <div className="ai-draft-list">
      <div className="ai-draft-actions" data-partial={isPartial}>
        <span>추천 초안 {drafts.length}개</span>
        <button type="button" onClick={onApplyAll}>적용하고 편집하기</button>
      </div>
      {drafts.map((condition, index) => (
        <article className="ai-draft-card condition-review-row" key={`${condition.path}-${index}`}>
          <div className="condition-content review-row-main">
            <div className="review-row-top">
              <span className="review-kind">AI 추천 초안</span>
              <div className="condition-pill">{condition.type ? `${condition.type} > ` : ''}{condition.path}</div>
            </div>
            <div className="ai-draft-detail">{condition.detail}</div>
            {condition.aiReason && (
              <div className="ai-match-info">
                <span className={`ai-confidence ai-confidence-${condition.aiConfidence || 'medium'}`}>AI {condition.aiConfidence || 'medium'}</span>
                <span className="ai-match-reason">AI 추천 근거: {condition.aiReason}</span>
              </div>
            )}
          </div>
          <div className="ai-draft-card-actions">
            <button type="button" className="draft-apply-button" onClick={() => onApply(index)}>적용</button>
            <button type="button" className="draft-discard-button" onClick={() => onDiscard(index)}>제외</button>
          </div>
        </article>
      ))}
    </div>
  );
}
