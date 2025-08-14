// components/ConditionSearch.js
import React from 'react';

export default function ConditionSearch({ search, onSearch }) {
  return (
    <div className="column" style={{ marginLeft: '10px' }}>
      <input
        type="text"
        placeholder="조건명을 입력하세요"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  );
}
