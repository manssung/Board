import React, { useEffect, useState } from 'react';
import '../StrategyQnA.css';

export default function ConditionTreeView({ broker, selectedConditions, onConditionClick, onRemove }) {
  const [treeData, setTreeData] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const map = {
      "KB증권": "/kb_condition_paths_full_with_typename.json"
    };
    if (map[broker]) {
      fetch(map[broker])
        .then((res) => res.json())
        .then((data) => setTreeData(data))
        .catch((err) => console.error("조건 트리 로딩 오류:", err));
    } else {
      setTreeData([]);
    }
  }, [broker]);

  const filteredTree = treeData.filter(item =>
    item.path.toLowerCase().includes(search.toLowerCase()) ||
    item.detail.toLowerCase().includes(search.toLowerCase())
  );

  if (!treeData.length) return null;

  return (
    <div className="condition-tree-view">
      <div className="row">
        <div className="column small-column">
          <label>조건 검색</label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="조건명을 입력하세요"
          />
        </div>
      </div>

      <h4>조건 목록</h4>
      <ul className="tree-list compact-list">
        {filteredTree.map((item, index) => (
          <li key={index} className="tree-item" onClick={() => onConditionClick(item)}>
            <strong>{item.type} &gt; {item.path}</strong> : {item.detail}
          </li>
        ))}
      </ul>

      <h3>선택된 조건</h3>
      <ul className="selected-list">
        {selectedConditions.map((cond, idx) => (
          <li key={idx} className="selected-item">
            <span>{String.fromCharCode(65 + idx)} : {cond.path} : {cond.detail}</span>
            <button className="delete-button" onClick={() => onRemove(idx)}>
              삭제
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}