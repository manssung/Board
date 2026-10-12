import { summarizePreanalysis } from './preanalysisProgress';

test('저장 대기와 실패는 완료에 포함하지 않고 다른 증권사는 집계하지 않는다', () => {
  const statuses = ['ready', 'needs_confirmation', 'no_result', 'analyzing', 'queued', 'failed', 'save_pending', 'storing', 'limit_reached', 'waiting_remote'];
  const inquiries = statuses.map((status, id) => ({ id, broker: '신한증권', status }));
  inquiries.push({ id: 11, broker: '신한증권', hasImageAttachment: true });
  inquiries.push({ id: 12, broker: 'NH증권', status: 'ready' });
  expect(summarizePreanalysis(inquiries, '신한증권', (inquiry) => inquiry.status)).toEqual({
    total: 11, completed: 2, analyzing: 2, queued: 5, blocked: 2, retrying: 2, saving: 2, excluded: 1, processed: 4, percent: 36,
  });
});

test('선택한 증권사가 없으면 진행률은 0이다', () => {
  expect(summarizePreanalysis([{ broker: '신한증권' }], '', () => 'ready').percent).toBe(0);
});

test('전체 현황은 증권사 선택 없이 모든 증권사를 집계한다', () => {
  const result = summarizePreanalysis([
    { broker: '신한증권', status: 'ready' },
    { broker: 'NH증권', status: 'queued' },
    { broker: 'KB증권', status: 'storing' },
  ], null, (inquiry) => inquiry.status);
  expect(result.total).toBe(3);
  expect(result.completed).toBe(1);
  expect(result.queued).toBe(2);
  expect(result.saving).toBe(1);
});

test('네 항목의 합계가 전체 문의와 같고 작업불가만 남아도 확인은 완료된다', () => {
  const inquiries = [
    { status: 'no_result' }, { status: 'unsupported' }, { status: 'attachment', hasImageAttachment: true },
  ];
  const result = summarizePreanalysis(inquiries, null, (inquiry) => inquiry.status);
  expect(result.completed).toBe(0);
  expect(result.blocked).toBe(3);
  expect(result.completed + result.analyzing + result.queued + result.blocked).toBe(result.total);
  expect(result.percent).toBe(100);
});
