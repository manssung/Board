import { useState } from 'react';

// Vercel에서는 같은 도메인의 서버리스 API를 호출하므로 키가 브라우저로 전달되지 않습니다.
const API_ENDPOINT = process.env.REACT_APP_API_URL || '/api/ai-recommend';
const LOCAL_GEMINI_API_KEY = process.env.NODE_ENV === 'development'
  ? (process.env.REACT_APP_GEMINI_API_KEY || '').trim()
  : '';

const wait = (milliseconds) => new Promise(resolve => setTimeout(resolve, milliseconds));

function buildLocalPrompt(customerQuery, conditionList, selectedBroker) {
  const conditions = conditionList
    .map((item, index) => `ID:${index} | ${item.type || ''} > ${item.path || ''} : ${item.detail || ''}`)
    .join('\n');

  return `

# 역할
        당신은 **${selectedBroker}** 조건검색 전략 생성 전문가입니다.

# 임무
1. 사용자의 요청 사항을 분석합니다.
2. 아래 제공된 ${selectedBroker} 조건 목록을 꼼꼼히 읽고, 각 항목의 상세조건까지 반드시 비교해서 판단하세요.
3. 목록 중 사용자의 요청을 구현하기에 적합한 조건을 모두 찾으세요. 확실하지 않은 후보는 넣지 마세요.
4. originalIndex, detail, reason, confidence, nextOperator를 JSON 배열로 반환합니다.

# 논리 연산자 규칙
- 선택한 조건은 사용자가 의도한 평가 순서대로 반환하세요.
- nextOperator는 "and" 또는 "or"입니다. 마지막 조건에는 "and"를 넣으세요.
- "또는", "이거나", "or", "either", "one of"처럼 대안을 명시한 경우에만 "or"를 사용하고, 그 외에는 "and"를 사용하세요.
- 조건이 3개 이상일 때만 연속된 OR 조건을 괄호로 묶습니다. 예: A and (B or C)는 A의 nextOperator를 "and", B의 nextOperator를 "or"로 반환합니다.

# 사용자 요청 사항
"${customerQuery}"

# ${selectedBroker} 제공 조건 목록 (여기 있는 것 중에서만 골라야 함)
---
${conditions}
---

# 지시사항
- 목록에 있는 조건 중 적합한 것을 모두 선택하고 중복하지 마세요. 목록에 없는 조건을 만들지 마세요.
- detail 수치만 고객 요청에 맞게 수정하고 원래 상세조건의 단위와 표현 방식은 유지하세요.
- reason은 고객이 읽는 쉬운 한국어 한 문장입니다. 고객 요청과 이 조건이 도움이 되는 이유를 연결해 설명하고, 전문 용어는 풀어서 60자 이내로 작성하세요.
- confidence는 high, medium, low 중 하나입니다.
- 모든 객체에 nextOperator를 포함하세요. 적합한 조건이 없으면 []을 반환하세요.`;
}

const responseSchema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      originalIndex: { type: 'INTEGER' },
      detail: { type: 'STRING' },
      reason: { type: 'STRING' },
      confidence: { type: 'STRING' },
      nextOperator: { type: 'STRING', enum: ['and', 'or'] },
    },
    required: ['originalIndex', 'detail', 'reason', 'confidence', 'nextOperator'],
  },
};

export function useAiStrategyGenerator() {
  const [isAiLoading, setIsAiLoading] = useState(false);

  const generateStrategy = async (customerQuery, conditionList, selectedBroker) => {
    setIsAiLoading(true);

    try {
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerQuery, conditionList, selectedBroker }),
      };

      let response;
      let data;

      if (LOCAL_GEMINI_API_KEY) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${LOCAL_GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: buildLocalPrompt(customerQuery, conditionList, selectedBroker) }] }],
              generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema },
            }),
          },
        );
        const geminiData = await response.json().catch(() => ({}));
        const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        data = response.ok
          ? { matches: JSON.parse(responseText || '[]') }
          : { error: geminiData?.error?.message || `Gemini 요청 실패: ${response.status}` };
      } else {
        response = await fetch(API_ENDPOINT, requestOptions);
        data = await response.json().catch(() => ({}));
      }

      if (response.status === 429 && data.retryInSeconds) {
        await wait(Math.min(Math.max(data.retryInSeconds * 1000, 1000), 10000));
        if (LOCAL_GEMINI_API_KEY) {
          throw new Error('Gemini 요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.');
        }
        response = await fetch(API_ENDPOINT, requestOptions);
        data = await response.json().catch(() => ({}));
      }

      if (!response.ok) {
        throw new Error(data.error || `서버 요청 실패: ${response.status}`);
      }

      const rawList = Array.isArray(data.matches) ? data.matches : [];
      const seenIndex = new Set();
      const matchedItems = [];

      rawList.forEach((result) => {
        const matchedIndex = Number(result?.originalIndex);
        if (
          !Number.isNaN(matchedIndex) &&
          matchedIndex !== -1 &&
          conditionList[matchedIndex] &&
          !seenIndex.has(matchedIndex)
        ) {
          seenIndex.add(matchedIndex);
          matchedItems.push({
            ...conditionList[matchedIndex],
            detail: result.detail,
            aiReason: typeof result.reason === 'string' ? result.reason.trim() : '',
            aiConfidence: ['high', 'medium', 'low'].includes(String(result.confidence).toLowerCase())
              ? String(result.confidence).toLowerCase()
              : 'medium',
            nextOperator: result.nextOperator === 'or' ? 'or' : 'and',
          });
        }
      });

      return matchedItems;
    } catch (error) {
      console.error('AI 전략 생성 중 오류 발생:', error);
      alert(`AI 생성 중 오류가 발생했습니다.\n${error.message}`);
      return null;
    } finally {
      setIsAiLoading(false);
    }
  };

  return { isAiLoading, generateStrategy };
}
