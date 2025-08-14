// components/ConditionList.js
import React from 'react';

export default function ConditionList({ conditions, onConditionClick, searchComponent, warning }) {
  return (
    <div>
      <div className="list-header">
      <h3>조건 선택</h3>
      {warning && <div style={{ color: 'red', marginBottom: '10px' }}>{warning}</div>}
      {searchComponent}
      </div>
      <div className="condition-list">
        {conditions.map((cond, idx) => (
          <div
            key={idx}
            className="condition-item"
            onClick={() => onConditionClick(cond)}
          >
            {cond.type || "기타"}{">"}{cond.path || "(경로 없음)"} : 
          </div>
        ))}
      </div>
    </div>
  );
}
