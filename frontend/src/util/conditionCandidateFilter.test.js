import { getRecommendationCandidates } from './conditionCandidateFilter';

const standard = {path: '기준봉 대비 등락율 범위', detail: '1봉전 종가 대비 0봉전 종가 등락율 0% ~ 30%'};
// Higher lexical scores must not crowd the requested daily range out of the model input.
const decoys = Array.from({length: 250}, (_, index) => ({
  path: `등락률 등락율 전일 대비 가격 조건 ${index}`,
  detail: '전일 대비 등락률 등락율 상위 10% 종목',
}));
const conditions = [...decoys, standard];

test.each(['전일 대비 5% 이상 상승', '등락률 5% 이상', '등락율이 -3% 이하인 종목'])('%s에는 기준봉 대비 범위 조건을 후보에 보존한다', (query) => {
  const result = getRecommendationCandidates(query, conditions);
  expect(result).toContain(standard);
  expect(result.length).toBeLessThanOrEqual(180);
});

test.each(['5일 전 대비 등락률 5% 이상', '이동평균 대비 등락률 5% 이상', '전일 대비 거래량 200% 이상', '전일 대비 등락률 상위 10 종목'])('%s에는 전일 대비 범위 규칙을 강제하지 않는다', (query) => {
  expect(getRecommendationCandidates(query, conditions)).not.toContain(standard);
});

test('작은 목록은 순서와 원본 객체를 유지한다', () => {
  const list = [standard, decoys[0]];
  expect(getRecommendationCandidates('전일 대비 5%', list)).toBe(list);
});

test('KB처럼 상세 문구에 등락율이라는 단어가 없어도 이름과 가격 기준으로 보존한다', () => {
  const kb = {path: '주가분석>등락>등락율 범위', detail: '1봉전 종가 대비 0봉전 종가 5% 이상'};
  expect(getRecommendationCandidates('전일 대비 등락률 5% 이상', [...decoys, kb])).toContain(kb);
});
