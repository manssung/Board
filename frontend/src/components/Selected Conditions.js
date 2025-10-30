// src/components/SelectedConditions.js
import React, { useRef } from 'react'; // useRef를 import 합니다.
import '../css/SelectedConditions.css';
import useAutoSizeTextArea from '../hooks/useAutoSizeTextArea'; // 1단계에서 만든 훅을 import 합니다.

const SelectedConditions = ({ selectedConditions, onRemove, onCommentChange }) => {
  return (
    <>
      {selectedConditions.map((cond, index) => (
        // 각 아이템별로 독립적인 로직을 갖도록 컴포넌트로 분리합니다.
        <SelectedItem 
          key={index}
          cond={cond}
          index={index}
          onRemove={onRemove}
          onCommentChange={onCommentChange}
        />
      ))}
    </>
  );
};

// --- ✨ 각 아이템을 렌더링하는 별도의 컴포넌트 ---
const SelectedItem = ({ cond, index, onRemove, onCommentChange }) => {
  // textarea DOM 요소에 접근하기 위해 useRef를 사용합니다.
  const textAreaRef = useRef(null);

  // useAutoSizeTextArea 훅을 호출하여 ref와 추적할 값을 전달합니다.
  // cond.comment 또는 cond.detail 값이 바뀔 때마다 높이가 재계산됩니다.
  useAutoSizeTextArea(textAreaRef.current, cond.comment || cond.detail);

  return (
    <div className="selected-item">
      <div className="condition-content">
        <div className="condition-pill">
          {cond.type ? `${cond.type} > ` : ''}{cond.path}
        </div>
        <textarea
          ref={textAreaRef} // ref를 textarea에 연결합니다.
          className="comment-input"
          // value={cond.comment !== undefined && cond.comment !== '' ? cond.comment : cond.detail || ""}
          value={cond.comment !== undefined ? cond.comment : cond.detail || ""}
          onChange={(e) => onCommentChange(index, e.target.value)}
          placeholder="코멘트 입력..."
          rows={1} // 기본 높이를 1줄로 시작합니다.
        />
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