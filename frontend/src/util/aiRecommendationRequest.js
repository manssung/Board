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
4. 추천 조건(matches)과 고객 요청 반영 현황(coverage)을 JSON 객체로 반환합니다.

# 논리 연산자 규칙 (중요)
- 선택한 조건은 사용자가 의도한 평가 순서대로 반환하세요.
- nextOperator에는 현재 조건과 다음 조건 사이의 연산자인 "and" 또는 "or"를 넣으세요. 마지막 조건에는 "and"를 넣으세요.
- "또는", "이거나", "or", "either", "one of"처럼 대안을 명시한 경우에만 "or"를 사용하고, 그 외에는 "and"를 사용하세요.
- 앱은 조건이 3개 이상일 때만 연속된 OR 조건을 자동으로 괄호로 묶습니다. 예: A and (B or C)는 A의 nextOperator를 "and", B의 nextOperator를 "or"로 반환합니다. 조건이 정확히 2개인 A or B에는 괄호를 사용하지 않습니다.

# 실무 조건 선택 기준: 전일 대비 등락률
- 전일 대비 등락률/등락율 또는 비교 기준이 따로 없는 가격 등락률 요청은, 목록에서 "1봉전 [가격] 대비 0봉전 [가격] 등락률 N%"를 구현하는 범위 조건을 우선 선택하세요. 증권사마다 조건명이 달라도 상세 설정 형태를 기준으로 고르세요.
- 봉 주기가 일봉일 때 1봉전은 전일, 0봉전은 당일입니다. 전일 대비 요청을 분봉의 직전 봉 대비로 바꾸지 마세요.
- 시가·종가·고가·저가 기준은 고객이 명시한 값을 따르세요. 명시하지 않았다면 목록의 기본 가격 기준을 유지하되 requiresConfirmation을 true로 하고 confirmationNote에 확인할 가격 기준을 적으세요.
- 고객이 지정한 N%, 이상/이하/초과/미만, 상승/하락과 부호를 보존하세요. 기간 신고가·저가 대비, 이동평균 대비, 등락폭(원), 등락률 순위 조건으로 대신하지 마세요.
- 고객이 5일 전, 시가 대비, 이동평균 대비 등 다른 기준이나 순위를 명시했다면 그 요구를 우선하세요. 전일 대비 형식을 무조건 적용하지 마세요.
- 해당 형태를 구현하는 조건이 목록에 없거나 설정으로 구현할 수 없다면 조건을 만들지 말고 coverage에 needs_confirmation으로 표시하세요.

# 사용자 요청 사항
"${customerQuery}"

# ${selectedBroker} 제공 조건 목록 (여기 있는 것 중에서만 골라야 함)
---
${conditions}
---

# 숫자 표기 규칙
- RSI[14,6], MACD[12,26,9]처럼 대괄호 안의 쉼표는 서로 다른 지표 인자를 구분합니다. 반드시 유지하고 RSI[146]처럼 숫자를 이어 붙이지 마세요. 고객이 변경한 인자도 각 위치를 구분하세요.
- 금액·수량의 정수 부분은 천 단위 쉼표로 표시하세요. 예: 1000 → 1,000, 1000000 → 1,000,000. 소수점 이하 자리와 음수 부호는 유지하세요.
- 지표 대괄호 안의 인자에 천 단위 쉼표를 넣거나, 종목코드·날짜·시간을 금액처럼 바꾸지 마세요.

# 지시사항
- 목록에 있는 조건 중 적합한 것을 모두 선택하되, 같은 조건을 중복해서 넣지 마세요. 목록에 없는 조건을 만들어내지 마세요.
- 각 선택 객체의 detail에서 수치와 요청에 명시된 봉 시점·가격 기준을 사용자의 요청에 맞게 수정하세요. 원래 상세조건의 형식(단위, 표현 방식)은 최대한 유지하세요.
- reason은 고객이 읽는 안내문처럼 자연스럽고 쉬운 한국어 한 문장으로 작성하세요. "고객님께서 [원하는 결과]를 찾으셔서, [이 조건이 도움이 되는 이유]를 반영했습니다."처럼 요청과 조건의 연결을 설명하세요. 단순히 조건명을 반복하거나 "AI가 선택했습니다"라고 쓰지 말고, 전문 용어는 풀어서 설명하세요. 60자 이내로 핵심 수치·기간만 담으세요.
- confidence에는 high, medium, low 중 하나만 작성하세요. 고객 요청과 조건명이 직접 일치하면 high, 일부 해석이 필요하면 medium, 가능성만 있으면 low입니다.
- 기준 기간·수치처럼 작업자의 확인이 필요한 경우에도 가장 적합한 조건을 matches에 넣으세요. 이때 requiresConfirmation을 true로 하고 confirmationNote에 확인할 내용을 짧게 작성하세요. 확정 가능한 조건은 false와 빈 문자열을 넣으세요.
- 모든 응답 객체에는 nextOperator를 반드시 포함하고 값은 "and" 또는 "or" 중 하나여야 합니다.
- coverage에는 고객 요청에서 실제 조건으로 판단할 수 있는 핵심 요구사항을 2~5개로 나눠 넣으세요. 선택 조건이 직접 반영했을 때만 status를 "covered"로, 기준이 모호하거나 제공 조건으로 확정할 수 없을 때는 "needs_confirmation"으로 설정하세요.
- 응답은 { "matches": [...], "coverage": [...] } JSON 객체여야 합니다. matches의 각 객체에는 originalIndex, detail, reason, confidence, nextOperator, requiresConfirmation, confirmationNote 키를 포함하세요.

# 예시
사용자 요청: "거래량 10만주 이상이고 시가총액 1000억 이상인 종목 찾아줘"
{
  "matches": [
    { "originalIndex": 42, "detail": "거래량이 100,000주 이상", "reason": "고객님께서 거래가 활발한 종목을 찾으셔서, 거래량이 많은 종목만 보도록 반영했습니다.", "confidence": "high", "nextOperator": "and", "requiresConfirmation": false, "confirmationNote": "" },
    { "originalIndex": 17, "detail": "시가총액이 1000억원 이상", "reason": "고객님께서 규모가 큰 기업을 원하셔서, 시가총액 기준을 반영했습니다.", "confidence": "high", "nextOperator": "and", "requiresConfirmation": false, "confirmationNote": "" }
  ],
  "coverage": [
    { "request": "거래량 10만주 이상", "status": "covered", "reason": "거래량 조건에 반영" },
    { "request": "시가총액 1000억 이상", "status": "covered", "reason": "시가총액 조건에 반영" }
  ]
}`;
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


module.exports = { buildPrompt, responseSchema };
