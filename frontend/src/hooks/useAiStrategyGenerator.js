import { useState } from 'react';
import { showAppAlert, showToast } from '../components/AppToast';

// Vercel에서는 같은 도메인의 서버리스 API를 호출하므로 키가 브라우저로 전달되지 않습니다.
const API_ENDPOINT = process.env.REACT_APP_API_URL || '/api/ai-recommend';
const LOCAL_GEMINI_API_KEY = process.env.NODE_ENV === 'development'
  ? (process.env.REACT_APP_GEMINI_API_KEY || '').trim()
  : '';

const getQuotaDetails = (message = '', fallbackRetryInSeconds) => {
  const retryMatch = message.match(/retry in\s+([\d.]+)s/i);
  const limitMatch = message.match(/limit:\s*(\d+)/i);
  return {
    retryInSeconds: Number.isFinite(Number(fallbackRetryInSeconds))
      ? Number(fallbackRetryInSeconds)
      : Number(retryMatch?.[1]),
    quotaLimit: Number(limitMatch?.[1]),
    isDailyLimit: /per_day|daily|day_limit/i.test(message),
    isHighDemand: /high demand|temporarily unavailable|overloaded/i.test(message),
  };
};

const getAiErrorMessage = (error) => {
  const details = getQuotaDetails(error?.message || '', error?.retryInSeconds);

  if (error?.status === 429) {
    const limit = error?.quotaLimit || details.quotaLimit;
    const limitText = Number.isFinite(limit) ? `무료 등급 하루 ${limit}회` : '오늘의 AI 요청 한도';
    return `오늘 사용 가능한 ${limitText}를 모두 사용했습니다.\n할당량이 갱신된 후 다시 시도해 주세요.`;
  }

  if (error?.status === 503 || details.isHighDemand) return 'AI 서비스 요청이 일시적으로 많습니다. 잠시 후 다시 시도해 주세요.';
  return `조건 추천을 생성하지 못했습니다.\n${error?.message || '잠시 후 다시 시도해 주세요.'}`;
};

const getAiErrorAlert = (error) => {
  const details = getQuotaDetails(error?.message || '', error?.retryInSeconds);
  if (error?.status === 429) {
    const limit = error?.quotaLimit || details.quotaLimit;
    const limitText = Number.isFinite(limit) ? `무료 등급 하루 ${limit}회` : '오늘의 AI 요청 한도';
    return {
      title: '오늘의 AI 할당량을 모두 사용했습니다',
      message: `오늘 사용 가능한 ${limitText}를 모두 사용했습니다.\n할당량이 갱신된 후 다시 시도해 주세요.`,
    };
  }
  if (error?.status === 503 || details.isHighDemand) {
    return { title: 'AI 서비스가 일시적으로 혼잡합니다', message: '현재 요청이 많아 조건을 추천하지 못했습니다. 잠시 후 다시 시도해 주세요.' };
  }
  return null;
};

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
4. 추천 조건과 고객 요청 반영 현황을 JSON 객체로 반환합니다.

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
- coverage에는 고객 요청에서 실제 조건으로 판단할 수 있는 핵심 요구사항을 2~5개로 나눠 넣으세요.
- coverage의 status는 선택 조건이 직접 반영했을 때만 "covered", 기준이 모호하거나 제공 조건으로 확정할 수 없을 때는 "needs_confirmation"입니다.
- 기준 기간·수치처럼 작업자의 확인이 필요한 경우에도 가장 적합한 조건을 matches에 넣으세요. 이때 requiresConfirmation을 true로 하고 confirmationNote에 확인할 내용을 짧게 작성하세요.
- 적합한 조건이 없으면 matches는 빈 배열로 반환하세요.`;
}

const responseSchema = {
  type: 'OBJECT',
  properties: {
    matches: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          originalIndex: { type: 'INTEGER' },
          detail: { type: 'STRING' },
          reason: { type: 'STRING' },
          confidence: { type: 'STRING' },
          nextOperator: { type: 'STRING', enum: ['and', 'or'] },
          requiresConfirmation: { type: 'BOOLEAN' },
          confirmationNote: { type: 'STRING' },
        },
        required: ['originalIndex', 'detail', 'reason', 'confidence', 'nextOperator', 'requiresConfirmation', 'confirmationNote'],
      },
    },
    coverage: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          request: { type: 'STRING' },
          status: { type: 'STRING', enum: ['covered', 'needs_confirmation'] },
          reason: { type: 'STRING' },
        },
        required: ['request', 'status', 'reason'],
      },
    },
  },
  required: ['matches', 'coverage'],
};

export function useAiStrategyGenerator() {
  const [isAiLoading, setIsAiLoading] = useState(false);

  const generateStrategy = async (customerQuery, conditionList, selectedBroker, imageAttachment = null) => {
    setIsAiLoading(true);

    try {
      const imagePart = imageAttachment?.data && imageAttachment?.mimeType
        ? { inlineData: { mimeType: imageAttachment.mimeType, data: imageAttachment.data } }
        : null;
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerQuery, conditionList, selectedBroker, imageAttachment }),
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
              contents: [{ parts: [{ text: `${buildLocalPrompt(customerQuery, conditionList, selectedBroker)}${imagePart ? '\n\n# 첨부 이미지 안내\n첨부 이미지는 고객 문의를 파악하는 보조 자료입니다. 이미지에서 확인할 수 있는 내용만 참고하고, 목록에 없는 조건은 만들지 마세요.' : ''}` }, ...(imagePart ? [imagePart] : [])] }],
              generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema },
            }),
          },
        );
        const geminiData = await response.json().catch(() => ({}));
        const responseText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
        const parsed = JSON.parse(responseText || '{"matches":[],"coverage":[]}');
        data = response.ok
          ? (Array.isArray(parsed) ? { matches: parsed, coverage: [] } : parsed)
          : { error: geminiData?.error?.message || `Gemini 요청 실패: ${response.status}` };
        if (!response.ok) Object.assign(data, getQuotaDetails(data.error));
      } else {
        response = await fetch(API_ENDPOINT, requestOptions);
        data = await response.json().catch(() => ({}));
      }

      if (response.status === 429) {
        const quotaDetails = getQuotaDetails(data.error || '', data.retryInSeconds);
        const quotaError = new Error(data.error || 'AI 요청 한도에 도달했습니다.');
        quotaError.status = 429;
        quotaError.retryInSeconds = quotaDetails.retryInSeconds;
        quotaError.quotaLimit = data.quotaLimit || quotaDetails.quotaLimit;
        quotaError.isDailyLimit = data.isDailyLimit || quotaDetails.isDailyLimit;
        throw quotaError;
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
        const requestError = new Error(data.error || `서버 요청 실패: ${response.status}`);
        requestError.status = response.status;
        requestError.retryInSeconds = data.retryInSeconds;
        requestError.quotaLimit = data.quotaLimit;
        requestError.isDailyLimit = data.isDailyLimit;
        throw requestError;
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
            requiresConfirmation: result.requiresConfirmation === true,
            confirmationNote: typeof result.confirmationNote === 'string' ? result.confirmationNote.trim() : '',
          });
        }
      });

      const coverage = Array.isArray(data.coverage)
        ? data.coverage.filter((item) => item && typeof item.request === 'string').map((item) => ({
          request: item.request.trim(),
          status: item.status === 'covered' ? 'covered' : 'needs_confirmation',
          reason: typeof item.reason === 'string' ? item.reason.trim() : '',
        })).filter((item) => item.request)
        : [];

      return { conditions: matchedItems, coverage };
    } catch (error) {
      console.error('AI 전략 생성 중 오류 발생:', error);
      const alert = getAiErrorAlert(error);
      if (alert) showAppAlert(alert.title, alert.message);
      else showToast(getAiErrorMessage(error), 'error');
      return null;
    } finally {
      setIsAiLoading(false);
    }
  };

  return { isAiLoading, generateStrategy };
}
