import { useState } from 'react';

export function useAiStrategyGenerator() {
  const [isAiLoading, setIsAiLoading] = useState(false);

  // ✨ 수정됨: 인자에 'selectedBroker' 추가 (총 3개 받음)
  const generateStrategy = async (customerQuery, conditionList, selectedBroker) => {
    setIsAiLoading(true);
    
    // ⚠️ 본인의 API 키를 넣어주세요.
    const API_KEY = "AIzaSyDcQeGQFp5tRZHldjBNPzWNFXaO6WrKAmw"; 
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    try {
      // 1. 데이터 경량화
      const simplifiedList = conditionList.map((item, index) => 
        `ID:${index} | ${item.type} > ${item.path}`
      ).join('\n');

      console.log(`📦 [4] 조건 리스트 요약 완료 (총 ${conditionList.length}개)`);

      // 2. 프롬프트 구성 (증권사 이름 반영)
      const finalPrompt = `
        # 역할
        당신은 **${selectedBroker}** 조건검색 전략 생성 전문가입니다.

        # 임무
        1. 사용자의 [요청 사항]을 분석합니다.
        2. 아래 제공된 [${selectedBroker} 제공 조건 목록]을 꼼꼼히 읽어봅니다.
        3. 목록 중에서 사용자의 요청을 구현하기에 가장 적합한 조건 **단 하나**를 찾습니다.
        4. 찾은 조건의 ID(originalIndex)와, 사용자 요청에 맞춰 수정한 상세 설정값(detail)을 JSON으로 반환합니다.

        # 사용자 요청 사항
        "${customerQuery}"

        # ${selectedBroker} 제공 조건 목록 (여기 있는 것 중에서만 골라야 함)
        ---
        ${simplifiedList}
        ---

      # 전체 조건 목록 (JSON):
          ${JSON.stringify(simplifiedList, null, 2)}
          # 지시사항:
          - '전체 조건 목록'에서 가장 적합한 조건 객체를 단 하나만 찾아야 합니다.
          - 찾은 객체의 'detail'에 있는 수치만 사용자의 요청에 맞게 수정하고, 나머지 문구는 그대로 유지해야 합니다.
          - 다른 설명이나 대화 없이, 오직 수정된 **JSON 객체 하나만** 반환해야 합니다.
          - 응답 앞뒤에 \`\`\`json ... \`\`\` 같은 마크다운을 절대 포함하지 마세요.
          # 예시:
          - 사용자의 요청: "거래량 10만주 이상인 종목 찾아줘"
          - '전체 조건 목록'에서 찾은 객체: 
            { "type": "시세분석", "path": "거래량>거래량 범위", "detail": "거래량이 20,000주 이상" }
          - 올바른 반환값 (JSON 형식):
            { "type": "시세분석", "path": "거래량>거래량 범위", "detail": "거래량이 100,000주 이상" }
          `;


      console.log("📡 [5] fetch 요청 전송 시작...");

      // 3. API 요청
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      });

      console.log(`📩 [6] 응답 도착! 상태코드: ${response.status} (${response.statusText})`);

      if (!response.ok) {
        throw new Error(`Gemini API 호출 실패: ${response.status}`);
      }
      
      const data = await response.json();
      const aiResponseJsonString = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      // 4. 파싱 및 결과 병합
      const result = JSON.parse(aiResponseJsonString.trim());

      if (result.originalIndex !== undefined && result.originalIndex !== -1 && conditionList[result.originalIndex]) {
        const originalItem = conditionList[result.originalIndex];
        return {
          ...originalItem,
          detail: result.detail 
        };
      } else {
        return null;
      }

    } catch (error) {
      console.error("Gemini 전략 생성 중 오류 발생:", error);
      alert("AI 생성 중 오류가 발생했습니다. (콘솔 확인 필요)");
      return null;
    } finally {
      setIsAiLoading(false);
    }
  };

  return { isAiLoading, generateStrategy };
}