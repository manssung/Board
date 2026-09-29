import { buildStrategyIssues, getAiChangeSummary, getCatalogHealth } from './strategyQuality';

describe('strategy quality', () => {
  test('빈 설정값과 중복 조건을 찾는다', () => {
    const issues = buildStrategyIssues([
      { type: '가격', path: '종가', comment: '' },
      { type: '가격', path: '종가', comment: '' },
    ]);
    expect(issues.some((issue) => issue.type === 'error')).toBe(true);
    expect(issues.some((issue) => issue.title.includes('중복'))).toBe(true);
  });

  test('실제 카탈로그 상태를 요약한다', () => {
    expect(getCatalogHealth([{ path: '가격 > 종가' }]).tone).toBe('success');
    expect(getCatalogHealth([], { error: '실패' }).tone).toBe('error');
  });

  test('AI 적용·수정·직접 추가를 구분한다', () => {
    const result = getAiChangeSummary([
      { detail: '10 이상', comment: '20 이상', aiReason: '추천' },
      { detail: '거래량 증가', comment: '거래량 증가' },
    ], 3, 1);
    expect(result).toEqual({ applied: 1, modified: 1, manual: 1, excluded: 1 });
  });
});
