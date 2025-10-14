import React, { useState } from 'react';
import '../css/GeneratedMent.css';

const GeneratedMent = ({ ment, onChange }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    // navigator.clipboard API를 사용하여 텍스트를 복사합니다.
    navigator.clipboard.writeText(ment).then(() => {
      setIsCopied(true); // 복사 성공 시 상태 변경
      // 2초 후에 다시 원래 상태로 되돌립니다.
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    }).catch(err => {
      console.error('복사 실패:', err);
      alert('텍스트 복사에 실패했습니다.');
    });
  };

  return (
    <div className="ment-box-container">
      <textarea
        className="ment-textarea"
        value={ment}
        onChange={(e) => onChange(e.target.value)}
      />
      <button 
        className={`copy-button ${isCopied ? 'copied' : ''}`}
        onClick={handleCopy}
      >
        {isCopied ? (
          '✅ 복사 완료!'
        ) : (
          <>
            <svg className="copy-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375V9.375a2.25 2.25 0 00-2.25-2.25H9.375" />
            </svg>
            복사
          </>
        )}
      </button>
    </div>
  );
};

export default GeneratedMent;