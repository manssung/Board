import React, { useMemo, useState } from 'react';
import '../css/ConditionList.css';

const getPathParts = (path = '') => path.split('>').map(part => part.trim()).filter(Boolean);

const getTopCategory = (condition) => condition.type?.trim() || getPathParts(condition.path)[0] || '기타';

const getDisplayParts = (condition) => {
  const parts = getPathParts(condition.path);
  if (condition.type?.trim()) return parts;
  return parts.slice(1);
};

export default function ConditionList({ conditions, onConditionClick, searchComponent, warning, isSearching = false }) {
  const [expandedCategories, setExpandedCategories] = useState(new Set());

  const groupedConditions = useMemo(() => {
    const groups = new Map();
    (conditions || []).forEach((condition) => {
      const category = getTopCategory(condition);
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(condition);
    });
    return Array.from(groups.entries());
  }, [conditions]);

  const toggleCategory = (category) => {
    setExpandedCategories((previous) => {
      const next = new Set(previous);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  if (!conditions || conditions.length === 0) {
    return (
      <div className="condition-list">
        <div className="empty-list-message"><p>표시할 조건이 없습니다.</p></div>
      </div>
    );
  }

  return (
    <div className="condition-list-wrapper">
      {(warning || searchComponent) && (
        <div className="list-header">
          {warning && <div style={{ color: 'red', marginBottom: '10px' }}>{warning}</div>}
          {searchComponent}
        </div>
      )}
      <div className="condition-list condition-folder-list">
        {groupedConditions.map(([category, categoryConditions]) => {
          const isOpen = isSearching || expandedCategories.has(category);
          return (
            <section className={`condition-folder ${isOpen ? 'open' : ''}`} key={category}>
              <button
                type="button"
                className="condition-folder-button"
                onClick={() => toggleCategory(category)}
                aria-expanded={isOpen}
              >
                <span className="condition-folder-arrow" aria-hidden="true">{isOpen ? '⌄' : '›'}</span>
                <strong>{category}</strong>
                <span>{categoryConditions.length}</span>
              </button>
              {isOpen && (
                <div className="condition-folder-items">
                  {categoryConditions.map((condition, index) => {
                    const parts = getDisplayParts(condition);
                    const conditionName = parts.at(-1) || condition.path || '이름 없는 조건';
                    const parentPath = parts.slice(0, -1).join(' > ');
                    return (
                      <button
                        type="button"
                        key={`${condition.path}-${index}`}
                        className="condition-item"
                        onClick={() => onConditionClick(condition)}
                      >
                        <span className="condition-list-copy">
                          {parentPath && <span className="condition-category">{parentPath}</span>}
                          <strong className="condition-name">{conditionName}</strong>
                        </span>
                        <span className="add-icon" aria-hidden="true">+</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
