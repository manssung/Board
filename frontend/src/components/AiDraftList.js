import React from 'react';

const AppliedRow = ({ condition }) => (
  <article className={`ai-draft-review-row is-applied ${condition.requiresConfirmation ? 'needs-confirmation' : ''}`}>
    <span className="ai-draft-review-status">{condition.requiresConfirmation ? '확인 필요' : '적용됨'}</span>
    <div className="ai-draft-review-copy">
      <strong>{condition.type ? `${condition.type} › ` : ''}{condition.path}</strong>
      <p>{condition.comment ?? condition.detail}</p>
      {condition.requiresConfirmation && condition.confirmationNote && <em>{condition.confirmationNote}</em>}
    </div>
  </article>
);

export default function AiDraftList({ drafts, appliedConditions = [], brokerName, isPartial = false, onApplyAll, onApply, onDiscard }) {
  return (
    <div className="ai-draft-list">
      <div className="ai-draft-actions" data-partial={isPartial}>
        <span><b>추천 조건 검토</b><small>문의와 비교한 뒤 적용하거나 제외해 주세요.</small></span>
        <button type="button" onClick={onApplyAll}>적용하고 편집하기</button>
      </div>
      {appliedConditions.map((condition, index) => <AppliedRow condition={condition} key={`applied-${condition.id || condition.path}-${index}`} />)}
      {drafts.map((condition, index) => (
        <article className={`ai-draft-review-row ${condition.requiresConfirmation ? 'needs-confirmation' : ''}`} key={`${condition.path}-${index}`}>
          <span className="ai-draft-review-status">{condition.requiresConfirmation ? '확인 필요' : '추천'}</span>
          <div className="ai-draft-review-copy">
            <strong>{condition.type ? `${condition.type} › ` : ''}{condition.path}</strong>
            <p>{condition.detail}</p>
            <small>{condition.aiReason || `${brokerName || '선택 증권사'} 조건 목록에서 매칭했습니다.`}</small>
            {condition.requiresConfirmation && condition.confirmationNote && <em>{condition.confirmationNote}</em>}
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
