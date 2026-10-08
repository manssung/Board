import { cleanupInboxAnalyses, inquiryFingerprint, readInboxAnalysis, writeInboxAnalysis } from './inboxAnalysisCache';

const memoryStorage = () => {
  const values = new Map();
  return {
    get length() { return values.size; },
    key: (index) => [...values.keys()][index] || null,
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
};

test('문의 내용이 같을 때만 저장된 분석을 반환한다', () => {
  const storage = memoryStorage();
  const inquiry = { id: '1', broker: 'NH증권', query: '거래량 증가' };
  writeInboxAnalysis(inquiry, { conditions: [] }, storage);
  expect(readInboxAnalysis(inquiry, storage).result.conditions).toEqual([]);
  expect(readInboxAnalysis({ ...inquiry, query: '내용 변경' }, storage)).toBeNull();
});

test('미답변에서 사라진 문의의 캐시를 삭제한다', () => {
  const storage = memoryStorage();
  writeInboxAnalysis({ id: '1', broker: 'NH증권', query: 'A' }, {}, storage);
  writeInboxAnalysis({ id: '2', broker: 'NH증권', query: 'B' }, {}, storage);
  cleanupInboxAnalyses([{ id: '2' }], storage);
  expect(storage.length).toBe(1);
});

test('본문이 달라지면 지문도 달라진다', () => {
  expect(inquiryFingerprint({ id: '1', query: 'A' })).not.toBe(inquiryFingerprint({ id: '1', query: 'B' }));
});
