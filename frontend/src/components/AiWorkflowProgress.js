import React from 'react';

const stages = [
  { key: 'request', title: '요청 분석', description: '핵심 조건 추출' },
  { key: 'search', title: '조건 탐색', description: '증권사 조건 비교' },
  { key: 'review', title: '추천 검토', description: '조건 적용 전 확인' },
];

const getCurrentStage = (phase) => {
  if (phase === 'loading') return 1;
  if (['review', 'partial_review', 'editing'].includes(phase)) return 2;
  return 0;
};

export default function AiWorkflowProgress({ phase, brokerName, coverage = [] }) {
  const currentStage = getCurrentStage(phase);
  const requestSignals = coverage.slice(0, 4).map((item) => item.request).filter(Boolean);

  return (
    <section className="ai-workflow-progress" aria-label="추천 작업 흐름">
      <div className="ai-progress-heading">
        <div><strong>추천 작업 흐름</strong><span>{brokerName ? `${brokerName} 조건 목록을 기준으로 분석합니다.` : '증권사를 선택하면 조건 목록을 분석합니다.'}</span></div>
        {phase === 'loading' && <b>분석 중</b>}
        {['review', 'partial_review'].includes(phase) && <b className="complete">검토 준비</b>}
      </div>
      <ol className="ai-progress-steps">
        {stages.map((stage, index) => (
          <li className={index < currentStage ? 'complete' : index === currentStage ? 'active' : ''} key={stage.key}>
            <span>{index < currentStage ? '✓' : index + 1}</span>
            <div><strong>{stage.title}</strong><small>{stage.description}</small></div>
          </li>
        ))}
      </ol>
      {requestSignals.length > 0 && <div className="ai-request-signals"><span>요청 내용</span>{requestSignals.map((signal) => <b key={signal}>{signal}</b>)}</div>}
    </section>
  );
}
