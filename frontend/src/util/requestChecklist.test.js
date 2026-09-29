import { createRequestChecklist, extractRequestItems } from './requestChecklist';

test('extracts numbered requirements and removes greeting', () => {
  expect(extractRequestItems('안녕하세요. 1) 시가총액 2,000억원 이상 2) 거래량 10만주 이상\n감사합니다.')).toEqual([
    '시가총액 2,000억원 이상', '거래량 10만주 이상',
  ]);
});

test('uses AI coverage without inventing condition mappings', () => {
  expect(createRequestChecklist('문의', [{ request: '20일 평균 거래량', status: 'covered', reason: '반영됨' }])).toEqual([
    { id: 'ai-0', text: '20일 평균 거래량', status: 'covered', verified: false, mapped: [], reason: '반영됨' },
  ]);
});
