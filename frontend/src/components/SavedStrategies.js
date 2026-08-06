import React from 'react';
import '../css/SavedStrategies.css';
import { SAVED_STRATEGIES_LIMIT, formatSavedStrategyTime } from '../hooks/useSavedStrategies';

export default function SavedStrategies({ items, onLoad, onDelete }) {
  return (
    <section className="saved-strategies" aria-label="최근 임시저장">
      <div className="saved-strategies-header">
        <div><h3>최근 임시저장</h3><p>최근 20개까지 보관되며, 24시간 후 자동 삭제됩니다.</p></div>
        <span>{items.length} / {SAVED_STRATEGIES_LIMIT}</span>
      </div>
      {items.length === 0 ? (
        <p className="saved-strategies-empty">저장된 전략이 없습니다. 답변 멘트 영역의 임시저장 버튼으로 현재 작업을 보관하세요.</p>
      ) : (
        <div className="saved-strategies-list">
          {items.map((item) => (
            <article className="saved-strategy-item" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <span>{formatSavedStrategyTime(item.savedAt)} · 조건 {item.selectedConditions?.length || 0}개</span>
              </div>
              <div className="saved-strategy-actions">
                <button type="button" onClick={() => onLoad(item)}>불러오기</button>
                <button type="button" onClick={() => onDelete(item.id)}>삭제</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
