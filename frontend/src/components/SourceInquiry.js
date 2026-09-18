import React, { useMemo, useRef, useState } from 'react';
import { formatInquiry } from '../util/formatInquiry';

export default function SourceInquiry({ sourceInquiry }) {
  const [isSourceExpanded, setIsSourceExpanded] = useState(true);
  const sourceDialogRef = useRef(null);
  const [showSourceRaw, setShowSourceRaw] = useState(false);
  const readableSource = useMemo(() => formatInquiry(sourceInquiry?.query), [sourceInquiry?.query]);
  const sourceMeta = sourceInquiry
    ? [sourceInquiry.broker, sourceInquiry.author, sourceInquiry.receivedAt, sourceInquiry.isFollowUp ? '재문의' : ''].filter(Boolean).join(' · ')
    : '';
  return <>{sourceInquiry && (
        <section className={`source-inquiry-context ${isSourceExpanded ? 'expanded' : ''}`} aria-label="기준 문의">
          <div className="source-inquiry-context-head">
            <span className="source-inquiry-label">기준 문의</span>
            <span className="source-inquiry-meta">{sourceMeta}</span>
            <button type="button" onClick={() => { setShowSourceRaw(false); sourceDialogRef.current?.showModal(); }}>크게 보기</button>
            <button type="button" aria-expanded={isSourceExpanded} aria-controls="source-inquiry-body" onClick={() => setIsSourceExpanded((expanded) => !expanded)}>{isSourceExpanded ? '접기' : '원문 보기'}</button>
          </div>
          <strong>{sourceInquiry.title}</strong>
          {isSourceExpanded && <p id="source-inquiry-body">{readableSource}</p>}
          <dialog className="source-inquiry-dialog" ref={sourceDialogRef} aria-labelledby="source-dialog-title" onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
            <div className="source-inquiry-dialog-header">
              <div><span>기준 문의 · {showSourceRaw ? '원문' : '읽기 편한 보기'}</span><h3 id="source-dialog-title">{sourceInquiry.title || '고객 문의'}</h3></div>
              <button type="button" autoFocus onClick={() => sourceDialogRef.current?.close()} aria-label="문의 크게 보기 닫기">닫기 ×</button>
            </div>
            <div className="source-inquiry-dialog-meta">{sourceMeta}</div>
            <button className="source-view-toggle" type="button" aria-pressed={showSourceRaw} onClick={() => setShowSourceRaw((value) => !value)}>{showSourceRaw ? '정돈된 내용 보기' : '원문 그대로 보기'}</button>
            <div className="source-inquiry-dialog-body" tabIndex={0}>{(showSourceRaw ? sourceInquiry.query : readableSource) || '문의 내용이 없습니다.'}</div>
          </dialog>
        </section>
      )}</>;
}

