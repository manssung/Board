import { useState } from 'react';

export function useAiStrategyGenerator() {
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 이제 이 함수는 'prompt' 문자열 하나만 받습니다.
  const generateStrategy = async (prompt) => {
    setIsAiLoading(true);
    
    const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${API_KEY}`;

    try {
      console.log("--- [Gemini로 전송될 프롬프트] ---", prompt); // 전송될 프롬프트 확인

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API 호출 실패: ${response.status}`);
      }
      const data = await response.json();
      const aiResponseJsonString = data.candidates[0].content.parts[0].text;
      console.log("Gemini로부터 받은 원본 응답:", aiResponseJsonString);
      return JSON.parse(aiResponseJsonString.trim());

    } catch (error) {
      console.error("Gemini 전략 생성 중 오류 발생:", error);
      alert("Gemini 전략 생성에 실패했습니다. API 키와 네트워크 연결을 확인해주세요.");
      return null;
    } finally {
      setIsAiLoading(false);
    }
  };

  return { isAiLoading, generateStrategy };
}