import React, { useState, useEffect, useRef } from 'react';
import '../css/GeneratedMent.css';
import useAutoSizeTextArea from '../hooks/useAutoSizeTextArea';

// 멘트 생성 로직 (헬퍼 함수)
const getMentParts = ({ selectedConditions, fixedMentMap, selectedBroker, fixedType }) => {
  const header = `안녕하십니까 전략Q&A담당자입니다.\n먼저 전략Q&A게시판을 이용해주시는 고객님께 감사인사드립니다.\n\n문의하신 내용에 대해 답변드립니다.\n\n`;
  const footer = `\n감사합니다.`;

  // 1. 고정 멘트 우선 처리 (작성불가, 고객센터 등)
  const fixedMent = fixedMentMap?.[selectedBroker]?.[fixedType];
  if (fixedMent) {
    const fullTextForCopy = header + fixedMent + footer;
    // ✨ isFixed: true (고정 멘트), isEditable: true (수정 가능)
    return { header, conditionLines: fixedMent, footer, fullTextForCopy, isFixed: true, isEditable: true };
  }

  // 2. 선택된 조건 처리
  if (selectedConditions && selectedConditions.length > 0) {
    const conditionLines = selectedConditions.map((item, index) => {
      const letter = String.fromCharCode('A'.charCodeAt(0) + index);
      const path = `${item.type || ''}>${item.path || ''}`;
      const description = item.comment !== undefined ? item.comment : item.detail || '';
      return `${letter} : ${path} : ${description}`;
    }).join('\n');

    let closingLineText = '조건식 ';
    selectedConditions.forEach((item, index) => {
      closingLineText += (item.openParen || '') + String.fromCharCode('A'.charCodeAt(0) + index) + (item.closeParen || '');
      if (index < selectedConditions.length - 1) {
        closingLineText += ` ${item.operator || 'and'} `;
      }
    });
    closingLineText += ' 입니다.\n';

    const fullTextForCopy = `${header}${conditionLines}\n\n${closingLineText}${footer}`;
    // ✨ isFixed: false (조건 멘트), isEditable: false (수정 불가)
    return { header, conditionLines, footer, fullTextForCopy, isFixed: false, isEditable: false };
  }

  // 3. 아무것도 없을 때 (빈 멘트)
  const emptyText = header + '\n' + footer;
  // ✨ isFixed: true (고정 멘트), isEditable: true (수정 가능)
  return { header, conditionLines: '', footer, fullTextForCopy: emptyText, isFixed: true, isEditable: true };
};


const GeneratedMent = ({ selectedConditions, onToggleOperator, fixedMentMap, selectedBroker, fixedType }) => {
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

  return (
    <div className="ment-box-container">
      <div className="ment-header">
        <div className="ment-title-group">
          <h3>답변 멘트</h3>
          {/* {isEditable && (
            // <button className="edit-button" onClick={() => isEditing ? handleDoneEditing() : handleStartEditing()}>
             <button className="edit-button" onClick={() => alert('현재 개발중입니다.')}>
              {isEditing ? '✔ 완료' : '✏️ 수정'}
            </button>
          )} */}
        </div>
        <div className="ment-buttons">
          {/* ✨ isEditable이 true일 때만 '수정' 버튼이 보입니다. */}
          <button className={`copy-button ${isCopied ? 'copied' : ''}`} onClick={handleCopy}>
            {isCopied ? '✅ 복사 완료!' : '복사'}
          </button>
        </div>
      </div>

      {isEditing ? (
        <textarea
          ref={textAreaRef.current}
          className="ment-textarea-edit"
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
        />
      ) : (
        <div className="ment-display">
          <pre>{header}</pre>
          <pre>{conditionLines}</pre>
          {/* ✨ isFixed가 false일 때만 (조건 멘트일 때만) 'and/or' 토글 라인이 보입니다. */}
          {!isFixed && selectedConditions.length > 0 && (
            <p className="closing-line">
              {'조건식 '}
              {selectedConditions.map((item, index) => (
                <React.Fragment key={index}>
                  <span>{item.openParen}</span>
                  <span>{String.fromCharCode('A'.charCodeAt(0) + index)}</span>
                  <span>{item.closeParen}</span>
                  {index < selectedConditions.length - 1 && (
                    <span className="operator" onDoubleClick={() => onToggleOperator(index)}>
                      {/* <span className="operator"> */}
                      {` ${item.operator || 'and'} `}
                    </span>
                  )}
                </React.Fragment>
              ))}
              {' 입니다.'}
            </p>
          )}
          <pre>{footer}</pre>
        </div>
      )}
    </div>
  );
};

export default GeneratedMent;