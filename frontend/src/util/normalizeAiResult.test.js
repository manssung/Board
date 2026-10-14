import { normalizeAiResult } from './normalizeAiResult';
import { buildPrompt, responseSchema } from './aiRecommendationRequest';

const source = [{ broker: '신한증권', path: '거래대금 범위', detail: '10백만원 ~ 50백만원' }];
const analyze = (match) => normalizeAiResult({ matches: [{ originalIndex: 0, confidence: 'high', ...match }], coverage: [{ request: '거래대금', status: 'covered' }] }, source);

test('원본 범위에 숫자 슬롯만 적용한다', () => {
  expect(analyze({ detail: '20백만원 ~ 60백만원', numericValues: ['20', '60'] }).conditions[0].detail).toBe('20백만원 ~ 60백만원');
});
test.each([
  { detail: '10백만원 이상' },
  { detail: '10억원 ~ 50억원' },
  { detail: '10백만원 ~ 50백만원', numericValues: ['10'] },
  { detail: '10백만원 ~ 50백만원', confidence: 'low' },
  { detail: '10백만원 ~ 50백만원', originalIndex: 999 },
  { detail: '60백만원 ~ 20백만원' },
])('구조 변경과 근거 부족을 확정 답변에서 제외한다: %j', (match) => {
  const result = analyze(match);
  expect(result.conditions).toEqual([]);
  expect(result.coverage[0].status).toBe('needs_confirmation');
});
test('AND/OR 일부를 삭제해 의미가 달라지는 것을 막는다', () => {
  const result = normalizeAiResult({ matches: [
    { originalIndex: 0, detail: '10백만원 ~ 50백만원', nextOperator: 'or' },
    { originalIndex: 1, detail: '20백만원 이상' },
  ] }, [...source, { detail: '20백만원 ~ 80백만원' }]);
  expect(result.conditions).toEqual([]);
  expect(result.coverage[0].status).toBe('needs_confirmation');
});
test('지표 인자와 문장 구분 쉼표를 보존한다', () => {
  const result = normalizeAiResult({ matches: [{ originalIndex: 0, detail: 'RSI[14,6], 거래대금 1,000,000원', numericValues: ['14', '6', '1000000'] }] }, [{ detail: 'RSI[14,6], 거래대금 5,000원' }]);
  expect(result.conditions[0].detail).toBe('RSI[14,6], 거래대금 1,000,000원');
});
test('빈 원본으로 조건을 만들어내지 않는다', () => {
  expect(normalizeAiResult({ matches: [{ originalIndex: 0, detail: '100원 이상' }] }, [{ detail: '' }]).conditions).toEqual([]);
});
test('프롬프트와 응답 스키마가 숫자 슬롯 및 보수적인 선택을 요구한다', () => {
  const prompt = buildPrompt('거래대금', source, '신한증권');
  expect(prompt).toContain('기본 숫자 슬롯:["10","50"]');
  expect(prompt).toContain('low 후보는 반환하지 마세요');
  expect(responseSchema.properties.matches.items.required).toContain('numericValues');
});
