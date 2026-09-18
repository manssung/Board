import { formatInquiry } from './formatInquiry';

test('cleans markup and whitespace', () => {
  expect(formatInquiry('<p>문의&nbsp; 내용</p><br><br><div>1. 거래량</div><div>2. 주가</div>')).toBe('문의 내용\n\n1. 거래량\n2. 주가');
});
test('preserves financial comparisons and numeric values', () => {
  const source = 'A < B AND C > D\n0.5% 이상 -2% 이하\n20일 OR 60일';
  expect(formatInquiry(source)).toBe(source);
});
test('renders list items on separate lines and removes scripts', () => {
  expect(formatInquiry('<ul><li>A</li><li>B</li></ul><script>alert(1)</script>')).toBe('• A\n\n• B');
});

test('separates pasted Korean questions without changing their words', () => {
  const source = '안녕하세요. 문의 남깁니다.1. MACD 방법? 차트에서는 설정할 수 없네요.어떻게 해야 하나요?감사합니다.';
  expect(formatInquiry(source)).toBe('안녕하세요.\n문의 남깁니다.\n1. MACD 방법?\n차트에서는 설정할 수 없네요.\n어떻게 해야 하나요?\n감사합니다.');
});

test('splits unpunctuated endings and labelled conditions', () => {
  expect(formatInquiry('이유가 뭘까요 이렇게 누락되더라고요 현재가 3.18%입니다 다음 조건 A: 종가 > 20 B: MACD(12,26,9) -2000 이하')).toBe('이유가 뭘까요\n이렇게 누락되더라고요\n현재가 3.18%입니다\n다음 조건\nA: 종가 > 20\nB: MACD(12,26,9) -2000 이하');
});

test('keeps decimals and indicator parameters intact', () => {
  const source = 'MACD(12, 26, 9), 1.5% 이상 / 2.0 이하, A AND (B OR C)';
  expect(formatInquiry(source)).toBe(source);
});
