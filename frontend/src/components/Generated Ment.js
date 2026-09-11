import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../css/GeneratedMent.css';
import useAutoSizeTextArea from '../hooks/useAutoSizeTextArea';
import { getConditionLabel } from '../util/conditionEditor';

const HEADER = '안녕하십니까 전략Q&A담당자입니다.\n먼저 전략Q&A게시판을 이용해주시는 고객님께 감사인사드립니다.\n\n문의하신 내용에 대해 답변드립니다.\n\n';
const FOOTER = '감사합니다.';

const conditionLine = (item, index) => {
  const type = item.type?.trim() ? `${item.type}>` : '';
  const path = item.path ? item.path.replace(/^[\s>]+/, '').trim() : '';
  const detail = item.comment !== undefined ? item.comment : (item.detail || '');
  return `${getConditionLabel(index)} : ${type}${path} : ${detail}`;
};

const formulaText = (conditions) => {
  let formula = '조건식 ';
  conditions.forEach((item, index) => {
    const previous = conditions[index - 1];
    const next = conditions[index + 1];
    const ids = item.groupIds || [];
    formula += '('.repeat(ids.filter((id) => !(previous?.groupIds || []).includes(id)).length);
    formula += getConditionLabel(index);
    formula += ')'.repeat(ids.filter((id) => !(next?.groupIds || []).includes(id)).length);
    if (index < conditions.length - 1) formula += ` ${item.operator || 'and'} `;
  });
  return `${formula} 입니다.`;
};

const makeParts = ({ selectedConditions, strategies, fixedMentMap, selectedBroker }) => {
  const list = strategies?.length ? strategies : [{ id: 'single', name: '1번 조건식', conditions: selectedConditions || [] }];
  let conditionNumber = 0;
  const blocks = list.map((strategy, index) => {
    if (strategy.kind === 'template') {
      const text = (fixedMentMap?.[selectedBroker]?.[strategy.fixedType] || '').trimEnd();
      return { id: strategy.id, kind: 'template', text, title: `${index + 1}. ${strategy.fixedType || '답변 템플릿'}` };
    }
    conditionNumber += 1;
    return {
      id: strategy.id,
      kind: 'condition',
      title: `${index + 1}. ${conditionNumber}번 조건식`,
      lines: strategy.conditions.map(conditionLine).join('\n'),
      formula: formulaText(strategy.conditions),
      conditions: strategy.conditions,
    };
  }).filter((block) => block.kind === 'template' ? block.text : block.conditions?.length);
  const strategyText = blocks.map((block) => block.kind === 'template'
    ? `${blocks.length > 1 ? `${block.title}\n` : ''}${block.text}`
    : `${blocks.length > 1 ? `${block.title}\n` : ''}${block.lines}\n\n${block.formula}`).join('\n\n');
  const fullText = `${HEADER}${strategyText}${strategyText ? '\n\n' : ''}${FOOTER}`;
  return { header: HEADER, footer: FOOTER, blocks, fullText, isFixed: !blocks.length };
};

export default function GeneratedMent({
  selectedConditions,
  strategies,
  activeStrategyId,
  onToggleOperator,
  fixedMentMap,
  selectedBroker,
  isGrouping,
  checkedLetters,
  onToggleGroupMode,
  onLetterCheck,
  onGroup,
  onClearAllGroups,
  onSaveDraft,
  showLogicControls = true,
  isCollapsed = false,
  onToggleCollapsed,
}) {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const textAreaRef = useRef(null);
  const parts = useMemo(() => makeParts({ selectedConditions, strategies, fixedMentMap, selectedBroker }), [selectedConditions, strategies, fixedMentMap, selectedBroker]);
  useAutoSizeTextArea(textAreaRef.current, editText);

  useEffect(() => {
    setEditText(parts.fullText);
    if (!parts.isFixed) setIsEditing(false);
  }, [parts.fullText, parts.isFixed]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(isEditing ? editText : parts.fullText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('복사 실패:', error);
    }
  };

  const renderActiveFormula = () => (
    <p className="closing-line">
      {selectedConditions.map((item, index) => {
        const letter = getConditionLabel(index);
        const checked = checkedLetters.has(letter);
        const previous = selectedConditions[index - 1];
        const next = selectedConditions[index + 1];
        const ids = item.groupIds || [];
        const opens = ids.filter((id) => !(previous?.groupIds || []).includes(id));
        const closes = ids.filter((id) => !(next?.groupIds || []).includes(id));
        return <React.Fragment key={`${item.id || item.originalIndex || index}-${index}`}>
          {opens.map((id) => <span key={`open-${id}`}>( </span>)}
          <span className={`condition-letter ${isGrouping ? 'groupable' : ''} ${checked ? 'checked' : ''}`} onClick={() => isGrouping && onLetterCheck(letter)}>{letter}</span>
          {closes.map((id) => <span key={`close-${id}`}> )</span>)}
          {index < selectedConditions.length - 1 && <span className="operator" onClick={() => onToggleOperator(index)}>{` ${item.operator || 'and'} `}</span>}
        </React.Fragment>;
      })}
      {' 입니다.'}
    </p>
  );

  return <div className="ment-box-container">
    <div className="ment-header">
      <div className="ment-title-group"><span className="ment-section-icon">✎</span><div><h3>답변 멘트</h3><p>확정한 조건식이 안내 문구에 반영됩니다.</p></div></div>
      <div className="ment-buttons">
        {onToggleCollapsed && <button type="button" className="ment-collapse-button" onClick={onToggleCollapsed}>{isCollapsed ? '펼치기' : '접기'}</button>}
        {onSaveDraft && <button type="button" className="save-draft-button" onClick={onSaveDraft}>임시저장</button>}
        <button type="button" className={`copy-button ${isCopied ? 'copied' : ''}`} onClick={handleCopy}>{isCopied ? '✓ 복사 완료!' : '복사'}</button>
      </div>
    </div>
    {!isCollapsed && <div className="ment-display">
      <pre>{parts.header}</pre>
      {parts.blocks.map((block) => block.kind === 'template'
        ? <section key={block.id} className="ment-strategy-block ment-template-block">{parts.blocks.length > 1 && <strong className="ment-strategy-title">{block.title}</strong>}<pre>{block.text}</pre></section>
        : <section key={block.id} className="ment-strategy-block">
        {parts.blocks.length > 1 && <strong className="ment-strategy-title">{block.title}</strong>}
        <pre>{block.lines}</pre>
        {block.id === activeStrategyId && showLogicControls ? <div className="closing-line-container">
          <div className="closing-line-toolbar"><strong>조건식</strong><button type="button" className={`group-toggle-button ${isGrouping ? 'active' : ''}`} onClick={onToggleGroupMode}>{isGrouping ? '그룹 설정 완료' : '괄호 그룹 설정'}</button></div>
          {renderActiveFormula()}
          {isGrouping && <div className="group-action-buttons">
            <p className="group-guide">묶을 조건의 알파벳을 선택한 뒤 <b>그룹 생성</b>을 눌러 주세요.</p>
            {checkedLetters.size > 0 && <button type="button" className="group-button" onClick={onGroup}>그룹 생성</button>}
            {selectedConditions.some((item) => (item.groupIds || []).length > 0) && <button type="button" className="group-button clear-all" onClick={onClearAllGroups}>모든 그룹 해제</button>}
          </div>}
        </div> : <p className="closing-line closing-line-static">{block.formula}</p>}
      </section>)}
      <pre>{parts.footer}</pre>
    </div>}
  </div>;
}
