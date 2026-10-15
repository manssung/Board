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

test('괄호 밖 이동평균 기간도 각각의 AI 숫자 슬롯으로 유지한다', () => {
 const original=[{path:'이동평균 배열',detail:'종가 기준 5,20,60 단순 이평이 정배열'}];
 const result=normalizeAiResult({matches:[{originalIndex:0,detail:'종가 기준 10,30,120 단순 이평이 정배열',numericValues:['10','30','120']}]},original);
 expect(result.conditions[0].detail).toBe('종가 기준 10,30,120 단순 이평이 정배열');
 expect(buildPrompt('이평 배열',original,'신한증권')).toContain('기본 숫자 슬롯:["5","20","60"]');
});
test('이동평균 기간과 금액 슬롯을 함께 바꿔도 구분자를 보존한다', () => {
 const result=normalizeAiResult({matches:[{originalIndex:0,detail:'이평 5,20,60 거래대금 1,000,000원',numericValues:['5','20','60','1000000']}]},[{detail:'이평 5,20,60 거래대금 5,000원'}]);
 expect(result.conditions[0].detail).toBe('이평 5,20,60 거래대금 1,000,000원');
});

test('조건 선택을 우선해 KB의 설정 미확정 조건도 확인 필요로 유지한다',()=>{
 const conditions=[{path:'등락율 범위',detail:'1봉전 종가 대비 0봉전 종가 5% 이상'},{path:'거래대금 범위',detail:'거래대금이 10,000백만원'},{path:'시가총액',detail:'50억원 이상'}];
 const result=normalizeAiResult({matches:[
 {originalIndex:0,detail:'1봉전 종가 대비 0봉전 종가 10% 이상',numericValues:['1','0','10'],confidence:'high'},
 {originalIndex:1,detail:'거래대금이 100,000백만원 이상',confidence:'medium',requiresConfirmation:true,confirmationNote:'요청은 거래대금 1천억원 이상. 이상 선택 확인 필요'},
 {originalIndex:2,detail:'50,000억원 이하',confidence:'medium',requiresConfirmation:true,confirmationNote:'요청은 시가총액 5조원 이하. 비교 방향 확인 필요'}
 ],coverage:[{request:'거래대금 1천억 이상',status:'covered'}]},conditions);
 expect(result.conditions).toHaveLength(3);expect(result.conditions[0].detail).toContain('10% 이상');
 expect(result.conditions[1].detail).toBe('거래대금이 10,000백만원');expect(result.conditions[2].detail).toBe('50억원 이상');
 expect(result.conditions[1].requiresConfirmation).toBe(true);expect(result.conditions[2].confirmationNote).toContain('5조원 이하');expect(result.coverage[0].status).toBe('needs_confirmation');
});
test('프롬프트는 수치 미확정을 조건 누락으로 처리하지 않는다',()=>{
 const prompt=buildPrompt('거래대금 1천억 이상, 시가총액 5조 이하',source,'KB증권');
 expect(prompt).toContain('추천할 조건 종류를 찾는 것을 수치 설정 확정보다 우선');
 expect(prompt).not.toContain('그 조건은 matches에 넣지 마세요');
 expect(prompt).not.toContain('필수 수치나 범위 경계가 빠져 구현을 확정할 수 없으면 matches에서 제외');
});
