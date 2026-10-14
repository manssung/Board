import { buildPrompt, responseSchema } from '../util/aiRecommendationRequest';
import { normalizeAiResult } from '../util/normalizeAiResult';
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
    if (!error?.isDailyLimit && !details.isDailyLimit) return 'AI 요청이 잠시 대기 중입니다. 잠시 후 다시 시도해 주세요.';
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
    if (!error?.isDailyLimit && !details.isDailyLimit) return null;
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


export function useAiStrategyGenerator() {
  const [isAiLoading, setIsAiLoading] = useState(false);

  const generateStrategy = async (customerQuery, conditionList, selectedBroker, imageAttachment = null, options = {}) => {
    if (!options.background) setIsAiLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);

    try {
      const imagePart = imageAttachment?.data && imageAttachment?.mimeType
        ? { inlineData: { mimeType: imageAttachment.mimeType, data: imageAttachment.data } }
        : null;
      const requestOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerQuery, conditionList, selectedBroker, imageAttachment }),
        signal: controller.signal,
      };

      let response;
      let data;

      if (LOCAL_GEMINI_API_KEY) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${LOCAL_GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${buildPrompt(customerQuery, conditionList, selectedBroker)}${imagePart ? '\n\n# 첨부 이미지 안내\n첨부 이미지는 고객 문의를 파악하는 보조 자료입니다. 이미지에서 확인할 수 있는 내용만 참고하고, 목록에 없는 조건은 만들지 마세요.' : ''}` }, ...(imagePart ? [imagePart] : [])] }],
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
        quotaError.limitSource = data.limitSource;
        throw quotaError;
      }

      if (!response.ok) {
        const requestError = new Error(data.error || `서버 요청 실패: ${response.status}`);
        requestError.status = response.status;
        requestError.retryInSeconds = data.retryInSeconds;
        requestError.quotaLimit = data.quotaLimit;
        requestError.isDailyLimit = data.isDailyLimit;
        throw requestError;
      }

      return normalizeAiResult(data, conditionList);
    } catch (error) {
      if (options.background) throw error;
      console.error('AI 전략 생성 중 오류 발생:', error);
      const alert = getAiErrorAlert(error);
      if (alert) showAppAlert(alert.title, alert.message);
      else showToast(getAiErrorMessage(error), 'error');
      return null;
    } finally {
      clearTimeout(timeout);
      if (!options.background) setIsAiLoading(false);
    }
  };

  return { isAiLoading, generateStrategy };
}
