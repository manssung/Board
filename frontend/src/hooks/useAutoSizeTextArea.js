// src/hooks/useAutoSizeTextArea.js
import { useEffect } from 'react';

// textarea의 높이를 내용물에 맞게 조절하는 커스텀 훅
const useAutoSizeTextArea = (textAreaRef, value) => {
  useEffect(() => {
    if (textAreaRef) {
      // 높이를 먼저 초기화해야 정확한 scrollHeight를 계산할 수 있습니다.
      textAreaRef.style.height = "0px";
      const scrollHeight = textAreaRef.scrollHeight;

      // 계산된 스크롤 높이를 실제 높이로 설정합니다.
      textAreaRef.style.height = scrollHeight + "px";
    }
  }, [textAreaRef, value]);
};

export default useAutoSizeTextArea;