import React, { useEffect, useMemo, useState } from 'react';
import { createRequestChecklist } from '../util/requestChecklist';

export default function RequestCoverageReview({ requestText, coverage = [], conditions = [], embedded = false }) {
  const seedKey = useMemo(() => JSON.stringify([requestText, coverage]), [requestText, coverage]);
  const [items, setItems] = useState(() => createRequestChecklist(requestText, coverage));
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => { setItems(createRequestChecklist(requestText, coverage)); }, [seedKey]);
  useEffect(() => {
    setItems((previous) => previous.map((item) => {
      const mapped = item.mapped.filter((index) => index < conditions.length);
      return { ...item, mapped, status: mapped.length ? 'covered' : item.status };
    }));
  }, [conditions.length]);

  if (!requestText?.trim() || items.length === 0) return null;
  const reviewedCount = items.filter((item) => item.verified).length;
  const toggleStatus = (itemId) => setItems((previous) => previous.map((item) => (
    item.id === itemId ? { ...item, status: item.verified ? 'pending' : 'covered', verified: !item.verified } : item
  )));

  return (
    <section className={`request-coverage-review ${embedded ? 'embedded' : ''}`} aria-label="고객 요청 대조">
      <button type="button" className="request-coverage-heading" aria-expanded={isOpen} onClick={() => setIsOpen((value) => !value)}>
        <span><b>요청 대조</b><small>고객 요구사항과 적용 조건을 연결합니다.</small></span>
        <span className={reviewedCount === items.length ? 'complete' : ''}>{reviewedCount}/{items.length} 확인 완료 <i>{isOpen ? '접기' : '펼치기'}</i></span>
      </button>
      {isOpen && <div className="request-coverage-list">
        {items.map((item) => <div className={`request-coverage-row ${item.verified ? 'covered' : item.status}`} key={item.id}>
          <button type="button" className="request-status-button" onClick={() => toggleStatus(item.id)}>{item.verified ? '확인 완료' : item.status === 'covered' ? '후보 있음' : '확인 필요'}</button>
          <div className="request-coverage-copy"><strong>{item.text}</strong>{item.reason && <small>{item.reason}</small>}</div>
          <span className="request-review-state">{item.verified ? '작업자 확인 완료' : item.status === 'covered' ? '추천 조건 있음' : conditions.length ? '작업자 확인' : '조건 추가 전'}</span>
        </div>)}
      </div>}
    </section>
  );
}
