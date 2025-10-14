// components/SelectedConditions.js
import React from 'react';
import '../css/SelectedConditions.css';

export default function SelectedConditions({ selectedConditions, onRemove, onCommentChange  }) {
  return (
<>
      {selectedConditions.map((cond, index) => (
        <div key={index} className="selected-item">
          <div className="condition-content">
            {/* 조건 경로를 세련된 '태그' 형태로 표시합니다. */}
            <div className="condition-pill">
              {cond.type ? `${cond.type} > ` : ''}{cond.path}
            </div>

            {/* 말씀하신 기존의 value 로직을 그대로 유지합니다. */}
            <textarea
              className="comment-input"
              value={cond.comment !== undefined && cond.comment !== '' ? cond.comment : cond.detail || ""}
              onChange={(e) => onCommentChange(index, e.target.value)}
              placeholder="코멘트 입력..."
              rows={2}
            />
          </div>

          {/* 삭제 버튼을 'X' 아이콘 버튼으로 변경합니다. */}
          <button 
            className="delete-button" 
            onClick={() => onRemove(index)}
            title="삭제"
          >
            &times; {/* HTML 특수문자로 'X' 모양을 만듭니다 */}
          </button>
        </div>
      ))}
    </>
  );
}
