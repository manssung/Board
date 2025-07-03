// components/SelectedConditions.js
import React from 'react';

export default function SelectedConditions({ selectedConditions, onRemove, onCommentChange  }) {
  return (
    <div>
      <h3>선택된 조건</h3>
      <ul className="selected-list">
        {selectedConditions.map((cond, idx) => (
          <li key={idx} className="selected-item">
            <span style={{width:'320px'}}>
              {cond.type ? `${cond.type} > ` : ''}
              {cond.path} : {cond.detail}
            </span>
            <textarea
                className="comment-input"
                value={cond.comment || ""}
                onChange={(e) => onCommentChange(idx, e.target.value)}
                placeholder="조건에 대한 설명을 입력하세요"
                rows={2}
              />
            <button className="delete-button" onClick={() => onRemove(idx)}>
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
