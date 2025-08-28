// src/hooks/useAiStrategy-Generator.js
import { useState } from 'react';

export function useAiStrategyGenerator() {
  const [isAiLoading, setIsAiLoading] = useState(false);

  // 이 함수는 이제 필요한 모든 정보를 '재료'로 전달받습니다.
  const generateStrategy = async ({ customerQuery, selectedBroker, allConditions }) => {
    console.log("[AI 로그] 분석을 시작합니다... (isLoading: true)");
    setIsAiLoading(true);

    // AI에게 보낼 프롬프트(명령문)는 그대로 유지됩니다.
    const prompt = `
        # 역할:
        당신은 증권사 조건검색 전략 생성 전문가입니다.

        # 임무:
        1. 사용자의 자연어 요청을 분석합니다.
        2. 주어진 '${selectedBroker}'의 '전체 조건 목록'에서 사용자의 요청과 가장 관련이 높은 조건 객체 "하나"를 선택합니다.
        3. 선택한 조건 객체의 'detail' 필드에 있는 숫자 값을 사용자의 요청에 맞게 수정합니다.
        4. 최종적으로, 'detail' 필드가 수정된 "완전한 조건 객체"를 JSON 형식으로 반환합니다.

        # 사용자의 요청:
        "${customerQuery}"

        # 전체 조건 목록 (JSON):
        ${JSON.stringify(allConditions, null, 2)}

        # 지시사항:
        - '전체 조건 목록'에서 가장 적합한 조건 객체를 단 하나만 찾아야 합니다.
        - 찾은 객체의 'detail'에 있는 수치만 사용자의 요청에 맞게 수정하고, 나머지 문구는 그대로 유지해야 합니다.
        - 다른 설명이나 대화 없이, 오직 수정된 **JSON 객체 하나만** 반환해야 합니다.

        # 예시:
        - 사용자의 요청: "거래량 10만주 이상인 종목 찾아줘"
        - '전체 조건 목록'에서 찾은 객체: 
          { "type": "시세분석", "path": "거래량>거래량 범위", "detail": "거래량이 20,000주 이상" }
        - 올바른 반환값 (JSON 형식):
          { "type": "시세분언급석", "path": "거래량>거래량 범위", "detail": "거래량이 100,000주 이상" }
      `;
    
    // ✨ --- Ollama 연동을 위한 수정 --- ✨
    const API_URL = 'http://localhost:11434/api/generate'; // Ollama 기본 주소

     try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "llama3",
          prompt: prompt,
          stream: false,
          format: "json", // AI가 JSON 객체를 반환하도록 지시
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama API 호출 실패: ${response.status}`);
      }

      const data = await response.json();
      
      // Ollama는 응답이 data.response에 문자열로 들어있습니다.
      const aiModifiedDetail = data.response;
      console.log("Ollama로부터 받은 원본 응답 (JSON 문자열):", aiModifiedDetail);
      
       const newConditionObject = JSON.parse(aiModifiedDetail);
      // AI가 수정한 detail 문자열을 반환합니다.
      return newConditionObject 

    } catch (error) {
      console.error("Ollama 상세 설명 수정 중 오류 발생:", error);
      alert("Ollama 상세 설명 수정에 실패했습니다. Ollama가 실행 중인지 확인해주세요.");
      return null;
    } finally {
      setIsAiLoading(false);
    }
  };

  return { isAiLoading, generateStrategy };
}