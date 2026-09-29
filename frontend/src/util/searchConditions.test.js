import { searchConditions } from './searchConditions';

test('direct matches rank before aliases, without duplicates', () => {
  const rows = [{ path: '이동평균 비교' }, { path: '이평선 비교' }];
  expect(searchConditions(rows, '이평선')).toEqual([rows[1], rows[0]]);
});
test('ignores spacing and case and supports compound searches', () => {
  expect(searchConditions([{ path: '볼린저 밴드 하단' }], '볼밴 하단')).toHaveLength(1);
  expect(searchConditions([{ path: 'MACD 비교' }], '맥디')).toHaveLength(1);
});
test('does not broaden volume to transaction value or invent conditions', () => {
  expect(searchConditions([{ path: '거래대금' }], '거래량')).toEqual([]);
  expect(searchConditions([], '이평')).toEqual([]);
});
test('empty search preserves input and null fields are safe', () => {
  const rows = [{}, { path: 'RSI' }];
  expect(searchConditions(rows, ' ')).toBe(rows);
  expect(searchConditions(rows, '알에스아이')).toEqual([rows[1]]);
});
