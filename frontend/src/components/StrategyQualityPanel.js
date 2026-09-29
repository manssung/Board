import React, { useMemo, useState } from 'react';
import { buildStrategyIssues, getAiChangeSummary } from '../util/strategyQuality';

const tabs = [
  ['validation', '전략 검증'],
  ['changes', 'AI 변경 내역'],
];

export default function StrategyQualityPanel({
  conditions,
  aiRecommendationCount,
  remainingAiDraftCount,
  onFocusCondition,
}) {
  const [activeTab, setActiveTab] = useState('validation');
  const issues = useMemo(() => buildStrategyIssues(conditions), [conditions]);
  const changes = useMemo(() => getAiChangeSummary(conditions, aiRecommendationCount, remainingAiDraftCount), [conditions, aiRecommendationCount, remainingAiDraftCount]);
  const aiAppliedConditions = useMemo(() => conditions
    .map((condition, index) => ({ condition, index }))
    .filter(({ condition }) => condition.aiReason !== undefined || condition.aiConfidence !== undefined), [conditions]);

  return (
    <section className="strategy-quality-panel" aria-label="전략 작업 점검">
      <div className="strategy-quality-tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={activeTab === id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>
            {label}{id === 'validation' && issues.length > 0 && <b>{issues.length}</b>}
          </button>
        ))}
      </div>

      {activeTab === 'validation' && (
        <div className="strategy-quality-content">
          <div className={`quality-summary ${issues.length ? 'warning' : 'success'}`}>
            <strong>{issues.length ? `${issues.length}개 항목을 확인해 주세요.` : '기본 검증을 통과했습니다.'}</strong>
            <span>{conditions.length}개 조건의 설정값·중복·확인 필요 여부를 점검했습니다.</span>
          </div>
          {issues.map((issue, index) => (
            <button type="button" className={`quality-issue ${issue.type}`} key={`${issue.index}-${index}`} onClick={() => onFocusCondition(issue.index)}>
              <span>{issue.type === 'error' ? '오류' : '확인'}</span><strong>{issue.title}</strong><em>{issue.action} →</em>
            </button>
          ))}
          {aiAppliedConditions.length > 0 && <div className="quality-applied-list" aria-label="요청 대조">
            <div className="quality-applied-heading"><strong>요청 대조</strong><span>현재 조건식에 남아 있는 조건입니다.</span></div>
            {aiAppliedConditions.map(({ condition, index }) => (
              <button type="button" className={`quality-applied-row ${condition.requiresConfirmation ? 'needs-confirmation' : ''}`} key={`${condition.id || condition.path}-${index}`} onClick={() => onFocusCondition(index)}>
                <span>{condition.requiresConfirmation ? '확인 필요' : '적용됨'}</span>
                <div><strong>{condition.type ? `${condition.type} › ` : ''}{condition.path}</strong><small>{condition.comment ?? condition.detail}</small></div>
                <em>조건 보기 →</em>
              </button>
            ))}
          </div>}
        </div>
      )}

      {activeTab === 'changes' && (
        <div className="strategy-quality-content quality-change-grid">
          <div><span>AI 추천 적용</span><strong>{changes.applied}</strong></div>
          <div><span>적용 후 수정</span><strong>{changes.modified}</strong></div>
          <div><span>직접 추가</span><strong>{changes.manual}</strong></div>
          <div><span>미적용·제외</span><strong>{changes.excluded}</strong></div>
          {!aiRecommendationCount && <p>현재 작업에는 AI 추천 이력이 없습니다.</p>}
        </div>
      )}
    </section>
  );
}
