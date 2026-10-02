import React, { useEffect, useMemo, useRef, useState } from 'react';
import '../css/GeneratedMent.css';
import useAutoSizeTextArea from '../hooks/useAutoSizeTextArea';
import { getConditionLabel } from '../util/conditionEditor';

const HEADER = '안녕하십니까 전략Q&A담당자입니다.\n먼저 전략Q&A게시판을 이용해주시는 고객님께 감사인사드립니다.\n\n문의하신 내용에 대해 답변드립니다.\n\n';
const FOOTER = '감사합니다.';

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const blobToDataUrl = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = reject;
  reader.readAsDataURL(blob);
});

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
      const template = fixedMentMap?.[selectedBroker]?.[strategy.fixedType] || '';
      const text = (typeof template === 'string' ? template : template.text || '').trimEnd();
      return {
        id: strategy.id,
        kind: 'template',
        text,
        image: typeof template === 'object' ? template.image : '',
        imageAlt: typeof template === 'object' ? template.imageAlt : '',
        title: `${index + 1}. ${strategy.fixedType || '답변 템플릿'}`,
      };
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
}) {
  const [isCopied, setIsCopied] = useState(false);
  const [copiedImageId, setCopiedImageId] = useState(null);
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
    const text = isEditing ? editText : parts.fullText;
    const imageBlock = parts.blocks.find((block) => block.image);
    try {
      if (imageBlock && window.ClipboardItem && navigator.clipboard?.write) {
        const htmlBlob = (async () => {
          const response = await fetch(imageBlock.image);
          if (!response.ok) throw new Error('안내 이미지를 불러오지 못했습니다.');
          const dataUrl = await blobToDataUrl(await response.blob());
          const imageMarker = 'MTS 고객센터 접수 경로를 안내드립니다.';
          const markerEnd = text.indexOf(imageMarker) + imageMarker.length;
          const beforeImage = markerEnd >= imageMarker.length ? text.slice(0, markerEnd) : text;
          const afterImage = markerEnd >= imageMarker.length ? text.slice(markerEnd) : '';
          const imageHtml = `<p><img src="${dataUrl}" alt="${escapeHtml(imageBlock.imageAlt || '안내 이미지')}" width="560" style="max-width:100%;height:auto"></p>`;
          const html = `<div style="white-space:pre-wrap">${escapeHtml(beforeImage)}</div>${imageHtml}${afterImage ? `<div style="white-space:pre-wrap">${escapeHtml(afterImage)}</div>` : ''}`;
          return new Blob([html], { type: 'text/html' });
        })();
        await navigator.clipboard.write([new window.ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': htmlBlob,
        })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      console.error('복사 실패:', error);
      try {
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (fallbackError) {
        console.error('텍스트 복사 실패:', fallbackError);
      }
    }
  };

  const handleCopyImage = async (block) => {
    try {
      if (!window.ClipboardItem || !navigator.clipboard?.write) throw new Error('이미지 클립보드를 지원하지 않는 브라우저입니다.');
      const imagePromise = fetch(block.image).then((response) => {
        if (!response.ok) throw new Error('안내 이미지를 불러오지 못했습니다.');
        return response.blob();
      });
      await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': imagePromise })]);
      setCopiedImageId(block.id);
      setTimeout(() => setCopiedImageId(null), 2000);
    } catch (error) {
      console.error('이미지 복사 실패:', error);
      window.open(block.image, '_blank', 'noopener,noreferrer');
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
        {onSaveDraft && <button type="button" className="save-draft-button" onClick={onSaveDraft}>임시저장</button>}
        <button type="button" className={`copy-button ${isCopied ? 'copied' : ''}`} onClick={handleCopy}>{isCopied ? '✓ 복사 완료!' : '복사'}</button>
      </div>
    </div>
    <div className="ment-display">
      <pre>{parts.header}</pre>
      {parts.blocks.map((block) => block.kind === 'template'
        ? <section key={block.id} className="ment-strategy-block ment-template-block">{parts.blocks.length > 1 && <strong className="ment-strategy-title">{block.title}</strong>}<pre>{block.text}</pre>{block.image && <div className="ment-template-image" style={{ maxWidth: 560, marginTop: 14, padding: 10, border: '1px solid #dce5f0', borderRadius: 8, background: '#f8fafc' }}><img src={block.image} alt={block.imageAlt || '안내 이미지'} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 5 }} /><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 9 }}><span style={{ color: '#7b879b', fontSize: 10 }}>일반 복사 시 문구와 이미지가 함께 복사됩니다.</span><button type="button" onClick={() => handleCopyImage(block)} style={{ flex: '0 0 auto', padding: '6px 9px', border: '1px solid #bfd2f1', borderRadius: 6, color: '#2d63bd', background: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{copiedImageId === block.id ? '✓ 이미지 복사 완료' : '이미지만 복사'}</button></div></div>}</section>
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
    </div>
  </div>;
}
