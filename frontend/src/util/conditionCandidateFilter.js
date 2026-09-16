const MAX_CANDIDATES = 180;
const MIN_CANDIDATES = 90;

const STOP_WORDS = new Set([
  '종목', '찾아줘', '찾기', '조건', '이상', '이하', '최근', '있는', '하는', '그리고', '면서', '대해', '중에서',
]);

const CONCEPTS = [
  { query: ['거래량', '거래량급증', '거래활발'], terms: ['거래량', '거래량증가', '거래량급증', '거래회전율'] },
  { query: ['거래대금'], terms: ['거래대금', '대금증가'] },
  { query: ['시가총액', '대형주', '중형주', '소형주', '기업규모'], terms: ['시가총액', '자산총계', '자본총계'] },
  { query: ['저평가', 'per', 'pbr', '배당', '배당률'], terms: ['per', 'pbr', 'psr', '배당', '주가수익비율', '주가순자산비율'] },
  { query: ['상승추세', '상승', '골든크로스', '돌파', '신고가'], terms: ['상승', '상향돌파', '골든크로스', '이동평균', '신고가', '고가'] },
  { query: ['하락추세', '하락', '데드크로스', '이탈', '신저가'], terms: ['하락', '하향돌파', '데드크로스', '이동평균', '신저가', '저가'] },
  { query: ['매출', '영업이익', '순이익', '실적', '수익성'], terms: ['매출', '영업이익', '당기순이익', '순이익', '이익률', 'roe', 'roa'] },
  { query: ['외국인', '기관', '수급'], terms: ['외국인', '기관', '투자자', '순매수', '수급'] },
  { query: ['변동성', '급등', '급락'], terms: ['변동성', '등락률', '상승률', '하락률', '급등', '급락'] },
];

const normalize = (value) => String(value || '').toLowerCase().replace(/\s+/g, '');

const getQueryTokens = (query) => String(query || '')
  .toLowerCase()
  .match(/[가-힣a-z]+|\d+(?:[,.]\d+)?/g)
  ?.map((token) => token.replace(/[,.]/g, ''))
  .filter((token) => token.length > 1 && !STOP_WORDS.has(token)) || [];

// 전체 XML은 브라우저에 유지하고, 모델 호출 직전에만 넓은 후보군으로 압축합니다.
// 매칭 근거가 부족하면 원본을 그대로 반환해 조건 누락보다 정확도를 우선합니다.
export function getRecommendationCandidates(query, conditions = []) {
  if (!Array.isArray(conditions) || conditions.length <= MAX_CANDIDATES + 60) return conditions;

  const normalizedQuery = normalize(query);
  const tokens = getQueryTokens(query);
  const activeConcepts = CONCEPTS.filter(({ query: triggers }) => triggers.some((trigger) => normalizedQuery.includes(trigger)));

  if (tokens.length === 0 && activeConcepts.length === 0) return conditions;

  const ranked = conditions.map((condition, index) => {
    const text = normalize(`${condition?.type || ''} ${condition?.path || ''} ${condition?.detail || ''}`);
    let score = 0;

    tokens.forEach((token) => {
      if (text.includes(token)) score += /^\d+$/.test(token) ? 3 : 8;
    });
    activeConcepts.forEach(({ terms }) => {
      const hits = terms.filter((term) => text.includes(term)).length;
      score += hits * 14;
    });

    return { condition, index, score };
  });

  const matched = ranked.filter((item) => item.score > 0);
  if (matched.length === 0) return conditions;

  matched.sort((a, b) => b.score - a.score || a.index - b.index);
  const selected = matched.slice(0, MAX_CANDIDATES);
  const selectedIndexes = new Set(selected.map((item) => item.index));

  // 요청이 짧거나 표현이 모호할 때도 모델이 대안을 검토할 수 있도록 일부 후보를 보충합니다.
  for (const item of ranked) {
    if (selected.length >= MIN_CANDIDATES || selectedIndexes.has(item.index)) continue;
    selected.push(item);
    selectedIndexes.add(item.index);
  }

  return selected
    .sort((a, b) => a.index - b.index)
    .map((item) => item.condition);
}
