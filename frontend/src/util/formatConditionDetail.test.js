import { formatConditionDetail } from './formatConditionDetail';
import { normalizeAiResult } from './normalizeAiResult';
import { generateMent } from './generateMent';

test.each([
  ['거래대금이 9999백만 이하', '거래대금이 9,999백만 이하'],
  ['거래대금이 9999백만이하', '거래대금이 9,999백만이하'],
  ['거래대금 1000 ~ 5000백만', '거래대금 1,000 ~ 5,000백만'],
  ['거래대금 -10000.50백만 이하', '거래대금 -10,000.50백만 이하'],
  ['종가 기준 5,20,60 단순 이평이 정배열', '종가 기준 5,20,60 단순 이평이 정배열'],
  ['이동평균 1000,2000,5000', '이동평균 1000,2000,5000'],
  ['이동평균 5,20', '이동평균 5,20'],
  ['RSI 기간 10000봉, 비율 10000%', 'RSI 기간 10000봉, 비율 10,000%'],
  ['1000주 이동평균', '1000주 이동평균'],
  ['종가 기준 10000 단순 이평', '종가 기준 10000 단순 이평'],
  ['거래대금 1000 ~ 5000백만원', '거래대금 1,000 ~ 5,000백만원'],
  ['거래대금 1000백만원 ~ 5000백만원', '거래대금 1,000백만원 ~ 5,000백만원'],
  ['거래대금 1000만원 비율 1000.25% RSI[1000,6]', '거래대금 1,000만원 비율 1,000.25% RSI[1000,6]'],
  ['이미 손상된 52,060 단순 이평', '이미 손상된 52,060 단순 이평'],

  ['종가기준 5,20,60 단순 이동평균이 정배열', '종가기준 5,20,60 단순 이동평균이 정배열'],
  ['RSI[14,6]', 'RSI[14,6]'],
  ['MACD[12,26,9] RSI[14,6] 30 이하', 'MACD[12,26,9] RSI[14,6] 30 이하'],
  ['RSI[1000,6] 거래대금 1000000원 이상', 'RSI[1000,6] 거래대금 1,000,000원 이상'],
  ['거래대금 1000만원 ~ 1000000만원', '거래대금 1,000만원 ~ 1,000,000만원'],
  ['거래량 1000000주, 현재가 12345.50원', '거래량 1,000,000주, 현재가 12,345.50원'],
  ['등락률 -3.00% 금액 -1000000원', '등락률 -3.00% 금액 -1,000,000원'],
  ['거래대금 1,000,000원', '거래대금 1,000,000원'],
  ['종목코드 [005940], 종목코드 123456, 2026-10-13 09:30', '종목코드 [005940], 종목코드 123456, 2026-10-13 09:30'],
  ['RSI[146]', 'RSI[146]'],
  ['거래량 9,99999999주', '거래량 999,999,999주'],
  ['금액 -1,0000.50원', '금액 -10,000.50원'],
  ['1,2', '1,2'],
])('%s의 의미와 지표 인자를 유지한다', (input, expected) => {
  expect(formatConditionDetail(input)).toBe(expected);
  expect(formatConditionDetail(expected)).toBe(expected);
});

test('AI 상세값과 답변에 같은 금액 표기를 적용한다', () => {
  const result = normalizeAiResult({matches: [{originalIndex: 0, detail: 'RSI[14,6] 거래대금 1000000원'}]}, [{type: '조건', path: '거래대금', detail: 'RSI[14,6] 거래대금 5000원'}]);
  expect(result.conditions[0].detail).toBe('RSI[14,6] 거래대금 1,000,000원');
  const text = generateMent({selectedConditions: result.conditions});
  expect(text).toContain('RSI[14,6] 거래대금 1,000,000원');
});

test('수동 수정 답변도 정리하되 빈 문자열은 유지한다', () => {
  const condition = {type: '조건', path: '거래대금', detail: '5000원', comment: '1000000원'};
  expect(generateMent({selectedConditions: [condition]})).toContain('1,000,000원');
  condition.comment = '';
  expect(generateMent({selectedConditions: [condition]})).not.toContain('5,000원');
});

test('원 생략 금액도 AI 숫자 슬롯 및 표시를 일관되게 유지한다',()=>{
 const {splitTemplate}=require('./conditionTemplate');
 expect(splitTemplate('거래대금이 9,999백만 이하').values).toEqual(['9999']);
 const result=normalizeAiResult({matches:[{originalIndex:0,detail:'거래대금이 9,999백만 이하',numericValues:['9999']}]},[{detail:'거래대금이 100백만 이하'}]);
 expect(result.conditions[0].detail).toBe('거래대금이 9,999백만 이하');
});
