// src/hooks/useAiStrategyGenerator.js
import { useState } from 'react';

export function useAiStrategyGenerator() {
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 이 함수는 이제 필요한 모든 정보를 '재료'로 전달받습니다.
  const generateStrategy = async ({ customerQuery, selectedBroker, allConditions }) => {
    setIsAiLoading(true);

    const prompt = `
      당신은 증권사 조건검색 전략 생성 전문가입니다.
      고객의 자연어 요청을 분석해서, 아래에 제공되는 JSON 조건 목록 중에서 가장 적합한 조건들을 찾아 조합해야 합니다.
      # 고객 요청 사항:
      "${customerQuery}"
      # 사용 가능한 전체 조건 목록 (${selectedBroker}):
      ${JSON.stringify(allConditions, null, 2)}
      # 지시사항:
      - 반드시 위에 제공된 '${selectedBroker}'의 JSON 조건 목록 안에서만 조건들을 선택해야 합니다.
      - 고객 요청을 만족하는 조건이 없다면, 빈 배열([])을 반환하세요.
      - 결과는 다른 설명 없이, 선택된 조건 객체들의 배열을 JSON 문자열 형태로 반환해야 합니다.
      - 예시 반환 형태: [{"type": "시세분석", "path": "...", "detail": "..."}, {"type": "기술적분석", "path": "...", "detail": "..."}]
    `;
    
    const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      });

      if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
      }

      const data = await response.json();
      
      // AI 응답 텍스트를 정리하고 파싱하는 부분
      let aiResponseText = data.candidates[0].content.parts[0].text;

      if (aiResponseText.startsWith("```json")) {
        aiResponseText = aiResponseText.substring(7, aiResponseText.length - 3).trim();
      } else if (aiResponseText.startsWith("```")) {
        aiResponseText = aiResponseText.substring(3, aiResponseText.length - 3).trim();
      }
      
      const jsonStartIndex = aiResponseText.indexOf('[');
      if (jsonStartIndex > -1) {
        aiResponseText = aiResponseText.substring(jsonStartIndex);
      }

      const jsonEndIndex = aiResponseText.lastIndexOf(']');
      if (jsonEndIndex > -1) {
        aiResponseText = aiResponseText.substring(0, jsonEndIndex + 1);
      }

      return JSON.parse(aiResponseText); // 성공 시, 파싱된 조건 배열을 반환

    } catch (error) {
      console.error("AI 전략 생성 중 오류 발생:", error);
      alert("AI 전략 생성에 실패했습니다. 콘솔 로그를 확인해주세요.");
      return null; // 실패 시, null 반환
    } finally {
      setIsAiLoading(false);
    }
  };

  // 이 훅은 '로딩 상태'와 '전략 생성 함수'를 외부에 제공합니다.
  return { isAiLoading, generateStrategy };
}