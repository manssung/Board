// components/ConditionSearch.js
import React from 'react';
import '../css/ConditionSearch.css';

export default function ConditionSearch({ search, onSearch }) {
  return (
<div className="condition-search-container">
      <input
        type="text"
        placeholder="조건명을 입력하세요"
        value={search}
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  );
}
