const { buildPrompt, responseSchema } = require('../src/util/aiRecommendationRequest');
const { getRedis } = require('../lib/upstashRedis');
const { withAiSlot } = require('../lib/aiRateLimit');
const { getQuotaDetails } = require('../lib/aiQuota');
const { getAiQuotaWindow } = require('../src/util/aiDailyBudget');
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_IMAGE_BASE64_LENGTH = Math.ceil((2 * 1024 * 1024 * 4) / 3) + 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);



module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_APIKEY || process.env.geminiapikey;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not configured in Vercel.');
    return response.status(500).json({ error: 'AI 서비스 설정이 완료되지 않았습니다.' });
  }

  const { customerQuery, conditionList, selectedBroker, imageAttachment } = request.body || {};
  if (typeof customerQuery !== 'string' || !customerQuery.trim()) {
    return response.status(400).json({ error: '고객 문의 내용을 입력해 주세요.' });
  }
  if (!Array.isArray(conditionList) || conditionList.length === 0 || conditionList.length > 1500) {
    return response.status(400).json({ error: '조건 목록이 올바르지 않습니다.' });
  }
  if (typeof selectedBroker !== 'string' || !selectedBroker.trim()) {
    return response.status(400).json({ error: '증권사를 선택해 주세요.' });
  }

  let imagePart = null;
  if (imageAttachment) {
    const { mimeType, data } = imageAttachment;
    if (!ALLOWED_IMAGE_TYPES.has(mimeType) || typeof data !== 'string' || !data || data.length > MAX_IMAGE_BASE64_LENGTH) {
      return response.status(400).json({ error: '첨부 이미지는 JPG, PNG, WEBP 형식의 2MB 이하 파일만 사용할 수 있습니다.' });
    }
    imagePart = { inlineData: { mimeType, data } };
  }

  try {
    const prompt = `${buildPrompt(customerQuery.trim(), conditionList, selectedBroker.trim())}${imagePart ? '\n\n# 첨부 이미지 안내\n첨부 이미지는 고객 문의를 파악하는 보조 자료입니다. 이미지에서 확인할 수 있는 내용만 참고하고, 목록에 없는 조건은 만들지 마세요.' : ''}`;
    const geminiResponse = await withAiSlot(getRedis(), () => { request.onProviderAttempt?.(); return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: 'POST',
        signal: AbortSignal.timeout(35000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, ...(imagePart ? [imagePart] : [])] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema },
        }),
      },
    ); }, {scheduledProbe: request.scheduledProbe === true});

    const payload = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      const retryInSeconds = Number(payload?.error?.message?.match(/retry in\s+([\d.]+)s/i)?.[1]);
      const quotaDetails = getQuotaDetails(payload);
      if (quotaDetails.isDailyLimit) quotaDetails.retryInSeconds = Math.ceil((getAiQuotaWindow().resetAt - Date.now()) / 1000);
      return response.status(geminiResponse.status).json({
        error: geminiResponse.status === 429 ? quotaDetails.isDailyLimit ? 'AI 제공업체의 하루 할당량에 도달했습니다.' : 'AI 제공업체의 요청 제한으로 잠시 대기합니다.' : '조건 추천을 생성하지 못했습니다.',
        retryInSeconds: Number.isFinite(retryInSeconds) ? retryInSeconds : undefined,
        ...quotaDetails,
      });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no recommendation text.');
    const parsed = JSON.parse(text.trim());
    const result = Array.isArray(parsed) ? { matches: parsed, coverage: [] } : parsed;
    return response.status(200).json({
      matches: Array.isArray(result.matches) ? result.matches : [],
      coverage: Array.isArray(result.coverage) ? result.coverage : [],
    });
  } catch (error) {
    console.error('AI recommendation failed:', error.message);
    return response.status(error.status || 502).json({ error: error.status === 429 ? error.message : '조건 추천을 처리하는 중 오류가 발생했습니다.', retryInSeconds: error.retryInSeconds, isDailyLimit: error.isDailyLimit === true, limitSource: error.limitSource, quotaLimit: error.quotaLimit });
  }
};
