// components/SelectedConditions.js
import React from 'react';

export default function SelectedConditions({ selectedConditions, onRemove }) {
  return (
    <div>
      <h3>선택된 조건</h3>
      <ul className="selected-list">
        {selectedConditions.map((cond, idx) => (
          <li key={idx} className="selected-item">
            <span>
              {cond.type ? `${cond.type} > ` : ''}
              {cond.path} : {cond.detail}
            </span>
            <button className="delete-button" onClick={() => onRemove(idx)}>
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
