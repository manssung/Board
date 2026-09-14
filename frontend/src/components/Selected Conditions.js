import React, { useEffect, useMemo, useRef, useState } from 'react'; // useRef를 import 합니다.
import '../css/SelectedConditions.css';
import { getConditionLabel } from '../util/conditionEditor';

const SelectedConditions = ({
  selectedConditions,
  onRemove,
  onCommentChange,
  onToggleParen,
  onMove,
  onDuplicate,
  onToggleOperator,
  isGrouping,
  checkedLetters,
  onToggleGroupMode,
  onLetterCheck,
  onGroup,
  onClearAllGroups,
}) => {
  const [editingIndex, setEditingIndex] = useState(null);
  const previousLengthRef = useRef(selectedConditions.length);

  useEffect(() => {
    const previousLength = previousLengthRef.current;
    const nextLength = selectedConditions.length;

    if (nextLength === previousLength + 1) {
      // 직접 추가·복제는 곧바로 값 수정으로 이어지는 흐름입니다.
      setEditingIndex(nextLength - 1);
    } else if (nextLength > previousLength + 1) {
      // AI가 여러 조건을 한 번에 적용한 경우에는 목록을 압축 상태로 유지합니다.
      setEditingIndex(null);
    } else if (nextLength < previousLength) {
      setEditingIndex((current) => current !== null && current >= nextLength ? null : current);
    }

    previousLengthRef.current = nextLength;
  }, [selectedConditions.length]);
  const groups = useMemo(() => {
    const ranges = new Map();
    selectedConditions.forEach((condition, index) => {
      (condition.groupIds || []).forEach((id) => {
        const range = ranges.get(id) || { id, start: index, end: index };
        ranges.set(id, { ...range, start: Math.min(range.start, index), end: Math.max(range.end, index) });
      });
    });

    return Array.from(ranges.values()).reduce((map, range) => {
      const containsOr = selectedConditions.slice(range.start, range.end).some((condition) => condition.operator === 'or');
      map.set(range.id, { ...range, label: containsOr ? 'OR 그룹' : '괄호 그룹' });
      return map;
    }, new Map());
  }, [selectedConditions]);

  return (
    <div className="selected-conditions-workspace">
      <div className="selected-conditions-list">
        {selectedConditions.map((cond, index) => {
          const groupId = (cond.groupIds || [])[0];
          const group = groupId ? groups.get(groupId) : null;
          const groupPosition = group ? (index === group.start ? 'start' : index === group.end ? 'end' : 'middle') : '';
          return <div className={`condition-grouped-entry ${group ? `is-grouped ${groupPosition}` : ''}`} key={index}>
            {group && index === group.start && <span className="condition-group-label">{group.label}</span>}
            <SelectedItem
              cond={cond}
              index={index}
              isFirst={index === 0}
              isLast={index === selectedConditions.length - 1}
              onRemove={onRemove}
              onCommentChange={onCommentChange}
              onToggleParen={onToggleParen}
              onMove={onMove}
              onDuplicate={onDuplicate}
              isEditing={editingIndex === index}
              onStartEditing={() => setEditingIndex(index)}
            />
          </div>;
        })}
      </div>
      {selectedConditions.length > 0 && (
        <ConditionFormulaBar
          selectedConditions={selectedConditions}
          onToggleOperator={onToggleOperator}
          isGrouping={isGrouping}
          checkedLetters={checkedLetters}
          onToggleGroupMode={onToggleGroupMode}
          onLetterCheck={onLetterCheck}
          onGroup={onGroup}
          onClearAllGroups={onClearAllGroups}
        />
      )}
    </div>
  );
};

const ConditionFormulaBar = ({ selectedConditions, onToggleOperator, isGrouping, checkedLetters, onToggleGroupMode, onLetterCheck, onGroup, onClearAllGroups }) => (
  <section className="condition-formula-bar" aria-label="조건식 편집">
    <div className="condition-formula-heading">
      <strong>조건식 {isGrouping && <span className="condition-group-count">{checkedLetters?.size || 0}개 선택됨</span>}</strong>
      <button type="button" className={`condition-group-mode-button ${isGrouping ? 'active' : ''}`} onClick={onToggleGroupMode}>
        {isGrouping ? '선택 완료' : '괄호 묶기'}
      </button>
    </div>
      <div className="condition-formula-line" aria-label="현재 조건식">
      {selectedConditions.map((condition, index) => {
        const letter = getConditionLabel(index);
        const previous = selectedConditions[index - 1];
        const next = selectedConditions[index + 1];
        const ids = condition.groupIds || [];
        const opens = ids.filter((id) => !(previous?.groupIds || []).includes(id));
        const closes = ids.filter((id) => !(next?.groupIds || []).includes(id));
        return <React.Fragment key={`${condition.id || condition.path}-${index}`}>
          {opens.map((id) => <span className="condition-formula-paren" key={`open-${id}`}>(</span>)}
          <button type="button" className={`condition-formula-letter ${isGrouping ? 'grouping' : ''} ${checkedLetters?.has(letter) ? 'checked' : ''}`} onClick={() => isGrouping && onLetterCheck(letter)}>{letter}</button>
          {closes.map((id) => <span className="condition-formula-paren" key={`close-${id}`}>)</span>)}
          {index < selectedConditions.length - 1 && <button type="button" className="condition-formula-operator" onClick={() => onToggleOperator(index)}>{condition.operator || 'and'}</button>}
        </React.Fragment>;
      })}
    </div>
    {isGrouping && (
      <div className="condition-group-actions">
        <span>연속된 항목을 선택한 뒤 묶으세요.</span>
        <button type="button" onClick={onGroup} disabled={!checkedLetters || checkedLetters.size < 2}>선택 묶기</button>
        {selectedConditions.some((condition) => (condition.groupIds || []).length > 0) && <button type="button" className="condition-group-clear" onClick={onClearAllGroups}>모든 그룹 해제</button>}
      </div>
    )}
  </section>
);

// --- ✨ 각 아이템을 렌더링하는 별도의 컴포넌트 ---
const SelectedItem = ({ cond, index, isFirst, isLast, onRemove, onCommentChange, onMove, onDuplicate, isEditing, onStartEditing }) => {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isEditing) return;
    inputRef.current?.focus();
  }, [isEditing]);

  return (
    <div className={`selected-item selected-condition-card condition-review-row inline-condition-row ${isEditing ? 'is-editing' : ''}`}>
      <button type="button" className="inline-condition-summary" onClick={onStartEditing}>
        <span className="condition-summary-main">
          <span className="condition-row-letter">{getConditionLabel(index)}</span>
          <span className="compact-condition-name">{cond.type ? `${cond.type} > ` : ''}{cond.path}</span>
        </span>
        {!isEditing && <span className="compact-condition-value">{cond.comment !== undefined ? cond.comment : cond.detail || '세부값 없음'}</span>}
      </button>
      <div className="inline-condition-actions">
        <button
          className="move-button"
          onClick={() => onMove(index, 'up')}
          disabled={isFirst}
          title="위로 이동"
        >▲</button>
        <button
          className="move-button"
          onClick={() => onMove(index, 'down')}
          disabled={isLast}
          title="아래로 이동"
        >▼</button>
        <button className="delete-button" onClick={() => onRemove(index)} title="삭제">&times;</button>
        <button type="button" className="duplicate-button" onClick={() => onDuplicate(index)} title="이 조건을 맨 아래에 복사">복사</button>
      </div>
      {isEditing && <input
          ref={inputRef}
          className="inline-condition-value"
          value={cond.comment !== undefined ? cond.comment : cond.detail || ""}
          onChange={(e) => onCommentChange(index, e.target.value)}
          placeholder="세부 설정값 입력"
        />}
    </div>
  );
};

export default SelectedConditions;
