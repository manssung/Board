// components/ConditionList.js
import React from 'react';
import '../css/ConditionList.css';

export default function ConditionList({ conditions, onConditionClick, searchComponent, warning }) {
 if (!conditions || conditions.length === 0) {
    return (
      <div className="condition-list">
        <div className="empty-list-message">
          <p>표시할 조건이 없습니다.</p>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="list-header">
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
           <span>{cond.type ? `${cond.type} >` : ""}{cond.path || "(경로 없음)"} : </span> 
            <span className="add-icon">+</span> 
          </div>
        ))}
      </div>
    </div>
  );
}
