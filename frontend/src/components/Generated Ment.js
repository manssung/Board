import React, { useState, useEffect, useRef } from 'react';
import '../css/GeneratedMent.css';
import useAutoSizeTextArea from '../hooks/useAutoSizeTextArea';
import { getConditionLabel } from '../util/conditionEditor';

// 멘트 생성 로직 (헬퍼 함수)
const getMentParts = ({ selectedConditions, fixedMentMap, selectedBroker, fixedType }) => {
  const header = `안녕하십니까 전략Q&A담당자입니다.\n먼저 전략Q&A게시판을 이용해주시는 고객님께 감사인사드립니다.\n\n문의하신 내용에 대해 답변드립니다.\n\n`;
  const footer = `감사합니다.`;

  // 1. 고정 멘트 우선 처리 (작성불가, 고객센터 등)
  const fixedMent = fixedMentMap?.[selectedBroker]?.[fixedType];
  if (fixedMent) {
    const fullTextForCopy = header + fixedMent + footer;
    return { header, conditionLines: fixedMent, footer, fullTextForCopy, isFixed: true, isEditable: true };
  }

  // 2. 선택된 조건 처리
  if (selectedConditions && selectedConditions.length > 0) {
    const conditionLines = selectedConditions.map((item, index) => {
      const letter = getConditionLabel(index);
      
      const typeStr = item.type && item.type.trim() !== '' ? `${item.type}>` : '';
      // 💡 2. path 맨 앞의 찌꺼기 화살표(>)와 공백을 완전히 청소합니다.
      const cleanPath = item.path ? item.path.replace(/^[\s>]+/, '').trim() : '';
      
      // 💡 3. 안전하게 조립된 경로를 사용합니다.
      const path = `${typeStr}${cleanPath}`;
      // const path = `${item.type || ''}>${item.path || ''}`;
      const description = item.comment !== undefined ? item.comment : item.detail || '';
      return `${letter} : ${path} : ${description}`;
    }).join('\n');
    
    let closingLineText = '조건식 ';
    // const processedGroups = new Set();
    selectedConditions.forEach((item, index) => {
      const letter = getConditionLabel(index);
      const prevItem = selectedConditions[index - 1];
      const nextItem = selectedConditions[index + 1];

      const currentGroupIds = item.groupIds || [];
      const prevGroupIds = prevItem ? (prevItem.groupIds || []) : [];
      const nextGroupIds = nextItem ? (nextItem.groupIds || []) : [];

// 1. 열어야 할 괄호 수 계산
      const groupIdsToOpen = currentGroupIds.filter(id => !prevGroupIds.includes(id));
      closingLineText += '('.repeat(groupIdsToOpen.length);

      closingLineText += letter;

      // 2. 닫아야 할 괄호 수 계산
      const groupIdsToClose = currentGroupIds.filter(id => !nextGroupIds.includes(id));
      closingLineText += ')'.repeat(groupIdsToClose.length);
      
      // 3. 연산자 처리
      if (index < selectedConditions.length - 1) {
        closingLineText += ` ${item.operator || 'and'} `;
      }
    });
    closingLineText += ' 입니다.';

    const fullTextForCopy = `${header}${conditionLines}\n\n${closingLineText}\n\n${footer}`;
    // ✨ isFixed: false (조건 멘트), isEditable: false (수정 불가)
    return { header, conditionLines, footer, fullTextForCopy, isFixed: false, isEditable: false };
  }

  // 3. 아무것도 없을 때 (빈 멘트)
  const emptyText = header + '\n' + footer;
  // ✨ isFixed: true (고정 멘트), isEditable: true (수정 가능)
  return { header, conditionLines: '', footer, fullTextForCopy: emptyText, isFixed: true, isEditable: true };
};


const GeneratedMent = ({ 
  selectedConditions, 
  onToggleOperator, 
  fixedMentMap, 
  selectedBroker, 
  fixedType,
  isGrouping, 
  setIsGrouping, 
  checkedLetters, 
  onLetterCheck, 
  onClearAllGroups,
  onSaveDraft,
  handleToggleGroupMode,
  onToggleGroupMode,
  onGroup, 
  onUngroup }) => {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');

  // ✨ isEditable 플래그를 받아옵니다.
  const { header, conditionLines, footer, fullTextForCopy, isFixed, isEditable } = getMentParts({ selectedConditions, fixedMentMap, selectedBroker, fixedType });

  const textAreaRef = useRef(null);
  // useAutoSizeTextArea(textAreaRef.current, editText);
  useAutoSizeTextArea(textAreaRef.current, editText);

  // 멘트가 바뀔 때마다 editText를 동기화하고, '조건 멘트'일 경우 '보기 모드'로 강제 전환
  useEffect(() => {
    setEditText(fullTextForCopy);
    if (!isFixed) {
      setIsEditing(false);
    }
  }, [fullTextForCopy, isFixed]);

  const handleCopy = () => {
    // ✨ 편집 중이면 수정한 텍스트를, 아니면 원본 텍스트를 복사
    const textToCopy = isEditing ? editText : fullTextForCopy;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }).catch(err => console.error('복사 실패:', err));
  };

  const handleStartEditing = () => {
    setEditText(fullTextForCopy); // 현재 멘트 내용으로 편집 시작
    setIsEditing(true);
  };
  
  const handleDoneEditing = () => {
    setIsEditing(false);
    // ✨ 수정한 내용은 부모(StrategyGenerator)로 보내지 않고,
    // 이 컴포넌트의 editText 상태에만 임시로 저장됩니다.
  };

  const hasAnyGroup = selectedConditions && selectedConditions.some(item => item.groupIds && item.groupIds.length > 0);

  return (
    <div className="ment-box-container">
      <div className="ment-header">
        <div className="ment-title-group">
          <span className="ment-section-icon">✎</span>
          <div>
            <h3>답변 멘트</h3>
            <p>확정한 조건식이 안내 문구에 반영됩니다.</p>
          </div>
        </div>
        <div className="ment-buttons">
          {onSaveDraft && (
            <button type="button" className="save-draft-button" onClick={onSaveDraft}>임시저장</button>
          )}
          {/* ✨ isEditable이 true일 때만 '수정' 버튼이 보입니다. */}
          <button className={`copy-button ${isCopied ? 'copied' : ''}`} onClick={handleCopy}>
            {isCopied ? '✅ 복사 완료!' : '복사'}
          </button>
        </div>
      </div>

<div className="ment-display">
        <pre>{header}</pre>
        <pre>{conditionLines}</pre>
        {!isFixed && selectedConditions.length > 0 && <br />}
        {!isFixed && selectedConditions.length > 0 && (
          <div className="closing-line-container">
            <div className="closing-line-toolbar">
              <strong>조건식</strong>
              <button
                type="button"
                className={`group-toggle-button ${isGrouping ? 'active' : ''}`}
                onClick={onToggleGroupMode}
              >
                {isGrouping ? '그룹 설정 완료' : '괄호 그룹 설정'}
              </button>
            </div>
            <p className="closing-line">
              {selectedConditions.map((item, index) => {
                const letter = getConditionLabel(index);
                const isChecked = checkedLetters.has(letter);
                const prevItem = selectedConditions[index - 1];
                const nextItem = selectedConditions[index + 1];

                const currentGroupIds = item.groupIds || [];
                const prevGroupIds = prevItem ? (prevItem.groupIds || []) : [];
                const nextGroupIds = nextItem ? (nextItem.groupIds || []) : [];

                // 중첩 괄호 계산
                const groupIdsToOpen = currentGroupIds.filter(id => !prevGroupIds.includes(id));
                const groupIdsToClose = currentGroupIds.filter(id => !nextGroupIds.includes(id));

                return (
                  <React.Fragment key={index}>
                    {groupIdsToOpen.map(id => <span key={`open-${id}`}>( </span>)}
                    
                    <span 
                      className={`condition-letter ${isGrouping ? 'groupable' : ''} ${isChecked ? 'checked' : ''}`}
                      onClick={() => isGrouping && onLetterCheck(letter)} // 그룹 모드일 때만 클릭 가능
                      title={isGrouping ? "그룹에 포함할 조건 선택" : ""}
                    >
                      {letter}
                    </span>
                    
                    {/* 닫는 괄호 */}
                    {groupIdsToClose.map(id => <span key={`close-${id}`}> )</span>)}

                    {/* 연산자 (더블클릭 시 토글) */}
                    {index < selectedConditions.length - 1 && (
                      <span 
                        className="operator" 
                       onClick={() => onToggleOperator(index)}
                       title="클릭하여 AND / OR 전환"
                      >
                        {` ${item.operator || 'and'} `}
                      </span>
                    )}
                  </React.Fragment>
                );
              })}
              {' 입니다.'}
            </p>
          {isGrouping && (
              <div className="group-action-buttons">
                <p className="group-guide">묶을 조건의 알파벳을 선택한 뒤 <b>그룹 생성</b>을 눌러 주세요.</p>
                {/* 1. 항목을 선택했을 때만 나오는 버튼들 */}
                {checkedLetters.size > 0 && (
                  <>
                    <button className="group-button" onClick={onGroup}>그룹 생성</button>
                    {/* <button className="group-button ungroup" onClick={onUngroup}>선택 해제</button> */}
                    {/* <button className="group-button clear" onClick={onClearAllGroups}>괄호 전체 삭제</button> */}
                  </>
                )}
              {(selectedConditions.some(item => item.groupIds && item.groupIds.length > 0)) && (
                  <>
                    {checkedLetters.size > 0 && <div className="divider"></div>}
                    <button className="group-button clear-all" onClick={onClearAllGroups}>모든 그룹 해제</button>
                  </>
                )}
              </div>
            )}
     
          </div>
        )}
        <pre>{footer}</pre>
      </div>
    </div>
  );
};

export default GeneratedMent;
