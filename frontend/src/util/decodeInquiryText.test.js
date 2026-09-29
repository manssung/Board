import { decodeInquiryText } from './decodeInquiryText';

test('removes literal and encoded soft hyphens from future inquiries', () => {
  expect(decodeInquiryText('지표\u00ad 내용&shy; 값&#173; 삭제&#xAD;')).toBe('지표 내용 값 삭제');
});

test('preserves customer headings, controls, spacing and line breaks', () => {
  const original = '√ 지표 내용    값 삭제 ▲ ▼ ↑ ↓\r\n? B [일]0봉전 Envelope(20,20) 하한선 2%이내 근접 □ X\r\n? C 코스피/코스닥 구분 : KOSPI200 □ X';
  expect(decodeInquiryText(original.replace(/ /g, ' \u00ad'))).toBe(original);
});

test('preserves negative numbers, ranges, comparisons and arrows', () => {
  expect(decodeInquiryText('-2000 &lt; MACD &lt;= -1000, 1-2봉 -&gt; 검색')).toBe('-2000 < MACD <= -1000, 1-2봉 -> 검색');
});
