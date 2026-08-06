const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_IMAGE_BASE64_LENGTH = Math.ceil((2 * 1024 * 1024 * 4) / 3) + 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function buildPrompt(customerQuery, conditionList, selectedBroker) {
  const conditions = conditionList
    .map((item, index) => `ID:${index} | ${item.type || ''} > ${item.path || ''} : ${item.detail || ''}`)
    .join('\n');

  return `

   # 역할
        당신은 **${selectedBroker}** 조건검색 전략 생성 전문가입니다.
# 임무
1. 사용자의 요청 사항을 분석합니다.
2. 아래 제공된 ${selectedBroker} 조건 목록을 꼼꼼히 읽고, 각 항목의 상세조건까지 반드시 비교해서 판단하세요.
3. 목록 중 사용자의 요청을 구현하기에 적합한 조건을 모두 찾으세요. 하나일 수도, 여러 개일 수도 있습니다. 확실하지 않은 후보는 넣지 마세요.
4. 찾은 각 조건의 ID(originalIndex), 상세 설정값(detail), 선택 근거(reason), 신뢰도(confidence), 다음 조건과의 연결 연산자(nextOperator)를 JSON 배열로 반환합니다.

# 논리 연산자 규칙 (중요)
- 선택한 조건은 사용자가 의도한 평가 순서대로 반환하세요.
- nextOperator에는 현재 조건과 다음 조건 사이의 연산자인 "and" 또는 "or"를 넣으세요. 마지막 조건에는 "and"를 넣으세요.
- "또는", "이거나", "or", "either", "one of"처럼 대안을 명시한 경우에만 "or"를 사용하고, 그 외에는 "and"를 사용하세요.
- 앱은 조건이 3개 이상일 때만 연속된 OR 조건을 자동으로 괄호로 묶습니다. 예: A and (B or C)는 A의 nextOperator를 "and", B의 nextOperator를 "or"로 반환합니다. 조건이 정확히 2개인 A or B에는 괄호를 사용하지 않습니다.

# 사용자 요청 사항
"${customerQuery}"

# ${selectedBroker} 제공 조건 목록 (여기 있는 것 중에서만 골라야 함)
---
${conditions}
---

# 지시사항
- 목록에 있는 조건 중 적합한 것을 모두 선택하되, 같은 조건을 중복해서 넣지 마세요. 목록에 없는 조건을 만들어내지 마세요.
- 각 선택 객체의 detail 수치만 사용자의 요청에 맞게 수정하세요. 원래 상세조건의 형식(단위, 표현 방식)은 최대한 유지하세요.
- reason은 고객이 읽는 안내문처럼 자연스럽고 쉬운 한국어 한 문장으로 작성하세요. "고객님께서 [원하는 결과]를 찾으셔서, [이 조건이 도움이 되는 이유]를 반영했습니다."처럼 요청과 조건의 연결을 설명하세요. 단순히 조건명을 반복하거나 "AI가 선택했습니다"라고 쓰지 말고, 전문 용어는 풀어서 설명하세요. 60자 이내로 핵심 수치·기간만 담으세요.
- confidence에는 high, medium, low 중 하나만 작성하세요. 고객 요청과 조건명이 직접 일치하면 high, 일부 해석이 필요하면 medium, 가능성만 있으면 low입니다.
- 모든 응답 객체에는 nextOperator를 반드시 포함하고 값은 "and" 또는 "or" 중 하나여야 합니다.
- 응답은 originalIndex, detail, reason, confidence, nextOperator 키를 가진 객체들의 JSON 배열이어야 합니다. 적합한 조건이 하나면 배열 원소도 1개, 없으면 빈 배열 []을 반환하세요.

# 예시
사용자 요청: "거래량 10만주 이상이고 시가총액 1000억 이상인 종목 찾아줘"
[
  { "originalIndex": 42, "detail": "거래량이 100,000주 이상", "reason": "고객님께서 거래가 활발한 종목을 찾으셔서, 거래량이 많은 종목만 보도록 반영했습니다.", "confidence": "high", "nextOperator": "and" },
  { "originalIndex": 17, "detail": "시가총액이 1000억원 이상", "reason": "고객님께서 규모가 큰 기업을 원하셔서, 시가총액 기준을 반영했습니다.", "confidence": "high", "nextOperator": "and" }
]`;
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
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, ...(imagePart ? [imagePart] : [])] }],
          generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema },
        }),
      },
    );

    const payload = await geminiResponse.json().catch(() => ({}));
    if (!geminiResponse.ok) {
      const retryInSeconds = Number(payload?.error?.message?.match(/retry in\s+([\d.]+)s/i)?.[1]);
      return response.status(geminiResponse.status).json({
        error: geminiResponse.status === 429 ? 'AI 요청이 잠시 많습니다. 잠시 후 다시 시도해 주세요.' : 'AI 추천을 생성하지 못했습니다.',
        retryInSeconds: Number.isFinite(retryInSeconds) ? retryInSeconds : undefined,
      });
    }

    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned no recommendation text.');
    const matches = JSON.parse(text.trim());
    return response.status(200).json({ matches: Array.isArray(matches) ? matches : [matches] });
  } catch (error) {
    console.error('AI recommendation failed:', error.message);
    return response.status(502).json({ error: 'AI 추천을 처리하는 중 오류가 발생했습니다.' });
  }
};
