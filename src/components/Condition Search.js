// components/ConditionSearch.js
import React from 'react';

export default function ConditionSearch({ search, onSearch }) {
  return (
    <div className="column">
      <label>조건 검색</label>
      <input
        type="text"
        placeholder="조건명을 입력하세요"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  );
}
