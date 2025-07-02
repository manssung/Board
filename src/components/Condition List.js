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
            {/* 기존 cond.name 대신 type > path : detail로 변경 */}
            {cond.type || "기타"} > {cond.path || "(경로 없음)"} : {cond.detail || "(내용 없음)"}
          </div>
        ))}
      </div>
    </div>
  );
}
