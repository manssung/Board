import React from 'react';
import '../css/GenerateMent.css';

export default function GeneratedMent({ ment, onChange }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(ment)
      .then(() => alert('멘트가 복사되었습니다!'))
      .catch(err => console.error('복사 실패:', err));
  };

  return (
    <div className="generated-ment">
      <h3>자동 생성 멘트</h3>
      <textarea
        className="ment-box"
        value={ment}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        placeholder
      />
      <button className="copy-button" onClick={handleCopy}>복사</button>
    </div>
  );
}
