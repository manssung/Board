import React, { useState } from 'react';

export default function AiDraftList({ drafts, coverage = [], brokerName, isPartial = false, onApplyAll, onApply, onDiscard }) {
  const [isCoverageExpanded, setIsCoverageExpanded] = useState(false);
  const coveredCount = coverage.filter((item) => item.status === 'covered').length;
  const needsConfirmation = coverage.filter((item) => item.status === 'needs_confirmation');
  const visibleConfirmations = isCoverageExpanded ? needsConfirmation : needsConfirmation.slice(0, 2);

  return (
    <div className="ai-draft-list">
      {coverage.length > 0 && (
        <section className="ai-coverage" aria-label="고객 요청 반영 현황">
          <div className="ai-coverage-heading"><strong>고객 요청 검토</strong><span>추천 조건과 비교한 결과입니다.</span></div>
          <div className="ai-coverage-summary">
            <span className="covered">반영 {coveredCount}개</span>
            <span className={needsConfirmation.length ? 'needs-confirmation' : 'clear'}>확인 필요 {needsConfirmation.length}개</span>
          </div>
          {needsConfirmation.length > 0 && <div className="ai-coverage-list">
            {visibleConfirmations.map((item, index) => (
              <div className="ai-coverage-item needs_confirmation" key={`${item.request}-${index}`}>
                <span>확인 필요</span>
                <div><strong>{item.request}</strong>{item.reason && <small>{item.reason}</small>}</div>
              </div>
            ))}
            {needsConfirmation.length > 2 && <button type="button" className="ai-coverage-toggle" onClick={() => setIsCoverageExpanded((expanded) => !expanded)}>{isCoverageExpanded ? '간단히 보기' : `확인 필요 ${needsConfirmation.length - 2}개 더 보기`}</button>}
          </div>}
        </section>
      )}
      <div className="ai-draft-actions" data-partial={isPartial}>
        <span>추천 초안 {drafts.length}개</span>
        <button type="button" onClick={onApplyAll}>적용하고 편집하기</button>
      </div>
      {drafts.map((condition, index) => (
        <article className={`ai-draft-card condition-review-row ${condition.requiresConfirmation ? 'needs-confirmation' : ''}`} key={`${condition.path}-${index}`}>
          <div className="condition-content review-row-main">
            <div className="review-row-top">
              <span className="review-kind">{condition.requiresConfirmation ? '확인 필요 초안' : '추천 초안'}</span>
              <div className="condition-pill">{condition.type ? `${condition.type} > ` : ''}{condition.path}</div>
            </div>
            <div className="ai-draft-detail">{condition.detail}</div>
            <div className="ai-draft-mapping"><span>{brokerName || '선택 증권사'} 조건 매핑</span><span className={`ai-confidence ai-confidence-${condition.aiConfidence || 'medium'}`}>신뢰도 {condition.aiConfidence || 'medium'}</span></div>
            {condition.aiReason && (
              <div className="ai-match-info">
                <span className="ai-match-reason">해석: {condition.aiReason}</span>
              </div>
            )}
            {condition.requiresConfirmation && condition.confirmationNote && (
              <div className="ai-draft-confirmation">확인 필요: {condition.confirmationNote}</div>
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
