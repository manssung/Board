import { normalizeInquiry } from './useUnansweredInquiries';

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
