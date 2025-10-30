// src/hooks/useAutoSizeTextArea.js
import { useEffect } from 'react';

// textarea의 높이를 내용물에 맞게 조절하는 커스텀 훅
const useAutoSizeTextArea = (textAreaRef, value) => {
  useEffect(() => {
    if (textAreaRef) {
      // 높이를 먼저 초기화해야 정확한 scrollHeight를 계산할 수 있습니다.
      textAreaRef.style.height = "0px";
      const scrollHeight = textAreaRef.scrollHeight;
      textAreaRef.style.height = scrollHeight + "px";
    }
  }, [textAreaRef, value]);
};

export default useAutoSizeTextArea;
// src/hooks/useAutoSizeTextArea.js
// import { useEffect } from 'react';

// // ✨ ref 객체를 통째로 받도록 (textAreaRef) 수정
// const useAutoSizeTextArea = (textAreaRef, value) => {
//   useEffect(() => {
//     // ✨ effect 내부에서 .current에 접근합니다.
//     if (textAreaRef.current) {
//       textAreaRef.current.style.height = "0px";
//       const scrollHeight = textAreaRef.current.scrollHeight;
//       textAreaRef.current.style.height = scrollHeight + "px";
//     }
//   }, [textAreaRef, value]); // ref 객체와 value가 바뀔 때마다 실행
// };

// export default useAutoSizeTextArea;