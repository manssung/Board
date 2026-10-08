import { buildPreanalysisQueue, getResultStatus, MAX_PREANALYSIS_BATCH_SIZE } from './inboxPreanalysis';
import { inquiryFingerprint } from './inboxAnalysisCache';

const inquiry = (id, receivedAt, overrides = {}) => ({
  id: String(id),
  broker: '신한증권',
  receivedAt,
  query: `문의 ${id}`,
  hasImageAttachment: false,
  ...overrides,
});

test('오래된 문의부터 최대 10건만 자동 분석한다', () => {
  const inquiries = Array.from({ length: 12 }, (_, index) => inquiry(index + 1, `2026-01-${String(12 - index).padStart(2, '0')}`));
  const queue = buildPreanalysisQueue({ inquiries, selectedBroker: '신한증권', verifiedKeys: new Set() });

  expect(queue).toHaveLength(MAX_PREANALYSIS_BATCH_SIZE);
  expect(queue.map((item) => item.receivedAt)).toEqual([...queue.map((item) => item.receivedAt)].sort());
});

test('첨부파일, 다른 증권사, 이미 확인한 문의는 분석 대상에서 제외한다', () => {
  const verified = inquiry(3, '2026-01-03');
  const verifiedKey = `${verified.id}:${inquiryFingerprint(verified)}`;
  const queue = buildPreanalysisQueue({
    inquiries: [
      inquiry(1, '2026-01-01', { hasImageAttachment: true }),
      inquiry(2, '2026-01-02', { broker: 'NH증권' }),
      verified,
      inquiry(4, '2026-01-04'),
    ],
    selectedBroker: '신한증권',
    verifiedKeys: new Set([verifiedKey]),
  });

  expect(queue.map((item) => item.id)).toEqual(['4']);
});

test('추천 결과의 내부 상태를 일관되게 분류한다', () => {
  expect(getResultStatus({ conditions: [] })).toBe('no_result');
  expect(getResultStatus({ conditions: [{ requiresConfirmation: true }] })).toBe('needs_confirmation');
  expect(getResultStatus({ conditions: [{ requiresConfirmation: false }] })).toBe('ready');
});

