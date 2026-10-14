import React from 'react';

const PHASE_LABELS = {
  loading: '문의 불러오는 중', preparing: '분석 준비 중',
  paused: '자동 분석 일시정지', quota_wait: '요청 한도로 대기 중', empty: '분석할 문의가 없습니다',
  complete: '자동 분석 완료', running: '자동 분석 중', saving: '분석 결과 저장 대기',
  retry_wait: '실패한 문의 재시도 대기', queued: '자동 분석 대기',
};
export const formatAnalysisTime = (time) => new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(time));

export default function InboxAnalysisProgress({ progress, onTogglePaused, onRetryFailed }) {
  if (!progress) return null;
  const { phase, paused, total, completed, analyzing, queued, blocked, retrying, saving, processed, percent, currentInquiry, quotaWait, lastCompletedAt } = progress;
  const hasWork = total > processed;
  const quotaBlocked = phase === 'quota_wait';
  const canControl = Boolean(hasWork && !['loading', 'preparing'].includes(phase));
  return (
    <section className={`inbox-analysis-progress ${phase}`} aria-label="자동 분석 현황">
      <div className="inbox-analysis-progress-head">
        <div>
          <strong role="status"><i aria-hidden="true" />{PHASE_LABELS[phase]}</strong>
          <span>전체 증권사 · 미답변 문의 {total}건</span>
        </div>
        <div className="inbox-analysis-controls">
          {canControl && <button type="button" onClick={onTogglePaused}>{paused ? '분석 재개' : '일시정지'}</button>}
          {(retrying > 0 || saving > 0) && <button type="button" onClick={onRetryFailed} disabled={paused || quotaBlocked} title={quotaBlocked ? '요청 한도 대기 후 자동 재개됩니다.' : undefined}>실패 건 재시도</button>}
        </div>
      </div>
      <>
          <div className="inbox-analysis-metrics">
            {[[completed, '완료', 'done'], [analyzing, '분석 중', 'working'], [queued, '대기', 'waiting'], [blocked, '작업불가', 'blocked']].map(([count, label, tone]) => (
              <div key={tone} className={tone}><b>{count}<small>건</small></b><span>{label}</span></div>
            ))}
          </div>
          <div className="inbox-analysis-meter-row">
            <progress max={total || 1} value={processed} aria-label="완료 또는 작업불가로 확인된 문의" />
            <span>확인 {processed}/{total}건 · {percent}%</span>
          </div>
      </>
      <p className="inbox-analysis-note">무료 AI: 하루 최대 20회 요청(자동 분석·직접 질문·재시도 합산). 한도에 도달하면 남은 문의는 갱신 후 처리합니다.</p>
      <div className="inbox-analysis-note" aria-live="polite">
        {paused ? <span>이 화면의 진행 중인 요청은 마무리한 뒤 멈춥니다. 서버 예약 분석은 별도로 실행됩니다.</span>
          : quotaBlocked ? <span>{formatAnalysisTime(quotaWait.retryAt)} 이후 자동으로 다시 시도합니다.</span>
            : currentInquiry ? <span className="inbox-analysis-current">{currentInquiry.broker} · 처리 중 #{currentInquiry.id} · {currentInquiry.title || currentInquiry.query}</span>
              : phase === 'complete' ? <span>전체 문의 확인을 마쳤습니다. 작업불가 건은 별도로 표시됩니다.</span>
                : phase === 'retry_wait' || phase === 'saving' ? <span>대기 중인 결과는 자동으로 재시도합니다. 저장 대기는 재분석하지 않습니다.</span>
                  : total > 0 ? <span>오래된 문의부터 한 건씩 처리합니다.</span> : null}
        {lastCompletedAt && <span className="inbox-analysis-last-completed">최근 저장 완료 {formatAnalysisTime(lastCompletedAt)}</span>}
      </div>
      <p className="inbox-analysis-scope">완료는 공용 저장까지 끝난 건수입니다. 작업불가는 추천 조건 없음과 자동 분석 제외를 포함합니다. 재시도·저장 대기는 대기에 포함합니다. 화면에서는 한 건씩 분석합니다. 서버 예약 실행을 설정하면 웹을 닫아도 매일 오전 6시에 미분석 문의를 처리합니다.</p>
    </section>
  );
}
