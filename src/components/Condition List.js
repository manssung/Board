// components/ConditionList.js
import React from 'react';

export default function ConditionList({ conditions, onConditionClick, warning }) {
  return (
    <div>
      <h3>조건 선택</h3>
      {warning && <div style={{ color: 'red', marginBottom: '10px' }}>{warning}</div>}
      <div className="condition-list">
        {conditions.map((cond, idx) => (
          <div
            key={idx}
            className="condition-item"
            onClick={() => onConditionClick(cond)}
          >
            {cond.type || "기타"}{">"}{cond.path || "(경로 없음)"} : {cond.detail || ""}
          </div>
        ))}
      </div>
    </div>
  );
}
