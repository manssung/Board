import React, { useState } from 'react';
import { PREANALYSIS_LABELS } from '../util/inboxPreanalysis';

const PAGE_SIZE = 5;

export default function InboxInquiryBrowser({
  inquiries,
  loading,
  error,
  lastUpdatedAt,
  refresh,
  getAnalysisStatus,
  onSelect,
  onClose,
}) {
  const [brokerFilter, setBrokerFilter] = useState('전체');
  const [sortOrder, setSortOrder] = useState('oldest');
  const [page, setPage] = useState(1);
  const brokers = [...new Set(inquiries.map((inquiry) => inquiry.broker))];
  const visibleInquiries = inquiries
    .filter((inquiry) => brokerFilter === '전체' || inquiry.broker === brokerFilter)
    .sort((left, right) => (sortOrder === 'oldest'
      ? left.receivedAt.localeCompare(right.receivedAt)
      : right.receivedAt.localeCompare(left.receivedAt)));
  const pageCount = Math.max(1, Math.ceil(visibleInquiries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedInquiries = visibleInquiries.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pageNumbers = Array.from({ length: pageCount }, (_, index) => index + 1)
    .filter((pageNumber) => pageNumber === 1 || pageNumber === pageCount || Math.abs(pageNumber - currentPage) <= 1);
  const selectBroker = (broker) => {
    setBrokerFilter(broker);
    setPage(1);
  };

  return (
    <div className="board-inquiry-browser" aria-label="미응답 문의 선택">
      <div className="board-inquiry-browser-head">
        <div><span>BOARD INBOX</span><h3>증권사별 업무 큐</h3><p>처리할 문의를 고르면 원글을 자동 추천 입력창으로 가져옵니다.</p></div>
        <button type="button" onClick={onClose}>입력으로 돌아가기</button>
      </div>
      <div className="board-queue-summary" aria-label="문의 현황">
        <span><b>{inquiries.length}</b> 전체 문의</span>
        <span><b>{brokers.length}</b> 증권사</span>
        <span>원문을 선택하면 자동 추천 입력창으로 가져옵니다.</span>
      </div>
      <div className="board-queue-layout">
        <aside className="board-queue-brokers" aria-label="증권사 필터">
          <button type="button" className={brokerFilter === '전체' ? 'active' : ''} onClick={() => selectBroker('전체')}><span>전체 문의</span><b>{inquiries.length}</b></button>
          {brokers.map((broker) => {
            const count = inquiries.filter((inquiry) => inquiry.broker === broker).length;
            return <button type="button" key={broker} className={brokerFilter === broker ? 'active' : ''} onClick={() => selectBroker(broker)}><span>{broker}</span><b>{count}</b></button>;
          })}
        </aside>
        <section className="board-queue-list">
          <div className="board-queue-list-head">
            <strong>{brokerFilter === '전체' ? '전체 미응답 문의' : `${brokerFilter} 문의`} <small className="board-queue-count">{visibleInquiries.length}건</small></strong>
            <div className="board-queue-list-actions">
              <button type="button" disabled={loading} onClick={refresh}>{loading ? (lastUpdatedAt ? '갱신 중…' : '불러오는 중…') : '새로고침'}</button>
              <button type="button" onClick={() => { setSortOrder((order) => order === 'oldest' ? 'latest' : 'oldest'); setPage(1); }}>
                {sortOrder === 'oldest' ? '오래된순 ↑' : '최신순 ↓'}
              </button>
            </div>
          </div>
          <div className="board-inquiry-browser-list">
            {pagedInquiries.map((inquiry) => {
              const analysisStatus = getAnalysisStatus(inquiry);
              return (
                <button type="button" key={inquiry.id} onClick={() => onSelect(inquiry)}>
                  <span><em>{inquiry.broker}</em><small>게시글 #{inquiry.id} · {inquiry.author} · {inquiry.receivedAt}</small></span>
                  <strong>
                    {inquiry.isFollowUp && <mark>재문의</mark>}
                    <mark className={`attachment ${inquiry.hasImageAttachment ? 'present' : 'absent'}`}>
                      {inquiry.hasImageAttachment ? '파일 있음' : '파일 없음'}
                    </mark>
                    <mark className={`analysis-status ${analysisStatus}`}>{PREANALYSIS_LABELS[analysisStatus]}</mark>
                    {inquiry.title}
                  </strong>
                  <p>{inquiry.query}</p>
                </button>
              );
            })}
            {loading && !lastUpdatedAt && <div className="board-queue-empty" role="status">미답변 문의를 불러오는 중입니다…</div>}
            {error && <div className="board-queue-empty" role="alert">{error}</div>}
            {!loading && !error && visibleInquiries.length === 0 && <div className="board-queue-empty">조건에 맞는 문의가 없습니다.</div>}
          </div>
          {pageCount > 1 && (
            <nav className="board-queue-pagination" aria-label="문의 페이지">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>이전</button>
              {pageNumbers.map((pageNumber, index) => (
                <React.Fragment key={pageNumber}>
                  {index > 0 && pageNumbers[index - 1] !== pageNumber - 1 && <i>…</i>}
                  <button type="button" className={pageNumber === currentPage ? 'active' : ''} onClick={() => setPage(pageNumber)}>{pageNumber}</button>
                </React.Fragment>
              ))}
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>다음</button>
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}

