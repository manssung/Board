import { normalizeInquiry } from './useUnansweredInquiries';

test('decodes API comparison entities without changing numbers or line breaks', () => {
  const result = normalizeInquiry({ subject: 'A &lt; B', comment: '현재가 &lt; 110일선\n110일선 &#60; 220일선\n거래량 &gt;= 100000 -&gt; 검색' });
  expect(result.title).toBe('A < B');
  expect(result.query).toBe('현재가 < 110일선\n110일선 < 220일선\n거래량 >= 100000 -> 검색');
});

test('keeps decoded markup inert as a string', () => {
  expect(normalizeInquiry({ comment: '&lt;img src=x onerror=alert(1)&gt;' }).query).toBe('<img src=x onerror=alert(1)>');
});

test.each([['신한', '신한증권'], ['카이로스', '미래에셋증권'], ['NH', 'NH증권'], ['LS증권', 'LS증권']])('maps broker %s', (company, expected) => {
  expect(normalizeInquiry({ uid: '1', company, comment: '문의 본문' }).broker).toBe(expected);
});
test.each([['0', false], ['1', true], [1, true], ['2', true]])('attachment flag %s', (file, expected) => {
  expect(normalizeInquiry({ uid: '1', file }).hasImageAttachment).toBe(expected);
});
test('preserves content and date without inventing follow-up status', () => {
  const inquiry = normalizeInquiry({ uid: '25', comment: '첫 줄\n둘째 줄', s_datetime: '2026-09-18 10:30:00' });
  expect(inquiry.query).toBe('첫 줄\n둘째 줄');
  expect(inquiry.receivedAt).toBe('2026-09-18 10:30:00');
  expect(inquiry.isFollowUp).toBe(false);
});
