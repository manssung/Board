import React, { useRef } from 'react'; // useRef를 import 합니다.
import '../css/SelectedConditions.css';
import useAutoSizeTextArea from '../hooks/useAutoSizeTextArea'; // 1단계에서 만든 훅을 import 합니다.

const SelectedConditions = ({ selectedConditions, onRemove, onCommentChange, onToggleParen, onMove }) => {
  return (
    <>
      {selectedConditions.map((cond, index) => (
        // 각 아이템별로 독립적인 로직을 갖도록 컴포넌트로 분리합니다.
        <SelectedItem
          key={index}
          cond={cond}
          index={index}
          isFirst={index === 0}
          isLast={index === selectedConditions.length - 1}
          onRemove={onRemove}
          onCommentChange={onCommentChange}
          onToggleParen={onToggleParen}
          onMove={onMove}
        />
      ))}
    </>
  );
};

// --- ✨ 각 아이템을 렌더링하는 별도의 컴포넌트 ---
const SelectedItem = ({ cond, index, isFirst, isLast, onRemove, onCommentChange, onToggleParen, onMove, isChecked }) => {
  // textarea DOM 요소에 접근하기 위해 useRef를 사용합니다.
  const textAreaRef = useRef(null);

  // useAutoSizeTextArea 훅을 호출하여 ref와 추적할 값을 전달합니다.
  // cond.comment 또는 cond.detail 값이 바뀔 때마다 높이가 재계산됩니다.
  useAutoSizeTextArea(textAreaRef.current, cond.comment || cond.detail);

  return (
    <div className="selected-item selected-condition-card condition-review-row">
      <div className="condition-content review-row-main">
        <div className="review-row-top">
          <div className="condition-pill">
            <span
              className={`paren-toggle ${cond.openParen ? 'active' : ''}`}
              onClick={() => onToggleParen(index, 'open')}
            >
              (
            </span>
            {cond.type ? `${cond.type} > ` : ''}{cond.path}
            <span
              className={`paren-toggle ${cond.closeParen ? 'active' : ''}`}
              onClick={() => onToggleParen(index, 'close')}
            >
              )
            </span>
          </div>
        </div>
        <textarea
          ref={textAreaRef} // ref를 textarea에 연결합니다.
          className="comment-input"
          // value={cond.comment !== undefined && cond.comment !== '' ? cond.comment : cond.detail || ""}
          value={cond.comment !== undefined ? cond.comment : cond.detail || ""}
          onChange={(e) => onCommentChange(index, e.target.value)}
          placeholder={cond.detail === '' ? "(기본값 없음) 세부 수치를 입력해주세요" : ""}
          rows={1} // 기본 높이를 1줄로 시작합니다.
        />
        {cond.aiReason && (
          <div className="ai-match-info">
            <span className={`ai-confidence ai-confidence-${cond.aiConfidence || 'medium'}`}>
              AI {cond.aiConfidence || 'medium'}
            </span>
            <span className="ai-match-reason">AI 추천 근거: {cond.aiReason}</span>
          </div>
        )}
      </div>
      <div className="move-buttons">
        <button
          className="move-button"
          onClick={() => onMove(index, 'up')}
          disabled={isFirst}
          title="위로 이동"
        >
          ▲
        </button>
        <button
          className="move-button"
          onClick={() => onMove(index, 'down')}
          disabled={isLast}
          title="아래로 이동"
        >
          ▼
        </button>
      </div>
      <button
        className="delete-button"
        onClick={() => onRemove(index)}
        title="삭제"
      >
        &times;
      </button>
    </div>
  );
};

export default SelectedConditions;
