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
        `ID:${index} | ${item.type} > ${item.path} : ${item.detail ?? ''} `
      ).join('\n');

      console.log(`📦 [4] 조건 리스트 요약 완료 (총 ${conditionList.length}개)`);

      // 2. 프롬프트 구성 (증권사 이름 반영)
      const finalPrompt = `
        # 역할
        당신은 **${selectedBroker}** 조건검색 전략 생성 전문가입니다.

        # 임무
        1. 사용자의 [요청 사항]을 분석합니다.
        2. 아래 제공된 [${selectedBroker} 제공 조건 목록]을 꼼꼼히 읽어봅니다. 각 항목의 '상세조건'까지 반드시 비교해서 판단하세요.
        3. 목록 중에서 사용자의 요청을 구현하기에 적합한 조건을 **모두** 찾습니다. (하나일 수도, 여러 개일 수도 있습니다. 확실하지 않은 후보는 넣지 마세요)
        4. 찾은 각 조건의 ID(originalIndex)와, 사용자 요청에 맞춰 수정한 상세 설정값(detail)을 JSON 배열로 반환합니다

        # 사용자 요청 사항
        "${customerQuery}"

        # ${selectedBroker} 제공 조건 목록 (여기 있는 것 중에서만 골라야 함)
        ---
        ${simplifiedList}
        ---

# 지시사항
      - 목록에 있는 조건 중 적합한 것을 모두 선택하되, 같은 조건을 중복해서 넣지 마세요. (목록에 없는 조건을 만들어내지 마세요)
      - 각 선택 객체의 'detail' 수치만 사용자의 요청에 맞게 수정하세요. 원래 상세조건의 형식(단위, 표현 방식)은 최대한 유지하세요.
      - 응답은 반드시 아래 예시와 같이 'originalIndex'와 'detail' 두 개의 키만 가진 객체들의 **JSON 배열**이어야 합니다. 적합한 조건이 하나면 배열 원소도 1개, 없으면 빈 배열 []을 반환하세요.

      # 예시:
      - 사용자의 요청: "거래량 10만주 이상이고 시가총액 1000억 이상인 종목 찾아줘"
      - 올바른 반환값 (JSON 형식):
      [
        { "originalIndex": 42, "detail": "거래량이 100,000주 이상" },
        { "originalIndex": 17, "detail": "시가총액이 1000억원 이상" }
      ]
`;

      // 3. API 요청
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: finalPrompt }] }],
          generationConfig: {
            temperature: 0, // 조건 매칭은 창의성보다 일관성이 중요
            responseMimeType: "application/json",
            responseSchema: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  originalIndex: { type: "INTEGER" },
                  detail: { type: "STRING" },
                },
                required: ["originalIndex", "detail"],
              },
            },
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API 호출 실패: ${response.status}`);
      }
      
      const data = await response.json();
      const aiResponseJsonString = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      // 4. 파싱 및 결과 병합 (배열)
      const resultArray = JSON.parse(aiResponseJsonString.trim());
      const rawList = Array.isArray(resultArray) ? resultArray : [resultArray]; // 혹시 모델이 객체 하나만 줘도 방어

      const seenIndex = new Set();
      const matchedItems = [];

      rawList.forEach((result) => {
        const matchedIndex = Number(result?.originalIndex);
        if (
          !Number.isNaN(matchedIndex) &&
          matchedIndex !== -1 &&
          conditionList[matchedIndex] &&
          !seenIndex.has(matchedIndex) // 중복 방지
        ) {
          seenIndex.add(matchedIndex);
          matchedItems.push({
            ...conditionList[matchedIndex],
            detail: result.detail,
          });
        }
      });

      return matchedItems; // 매칭 없으면 빈 배열

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