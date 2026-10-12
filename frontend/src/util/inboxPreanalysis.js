import { inquiryFingerprint } from './inboxAnalysisCache';

export const MAX_PREANALYSIS_BATCH_SIZE = Infinity;

export const PREANALYSIS_LABELS = {
  idle: '미분석',
  queued: '분석 대기',
  analyzing: '분석 중',
  loading_conditions: '조건 준비 중',
  unsupported: '미지원 증권사',
  storing: '저장 중',
  save_pending: '저장 대기',
  waiting_remote: '다른 작업에서 분석 중',
  ready: '분석 완료',
  needs_confirmation: '분석 완료',
  no_result: '추천 조건 없음',
  limit_reached: '한도 대기',
  failed: '재시도 대기',
  attachment: '자동 분석 제외',
};

export function getResultStatus(result) {
  if (!result?.conditions?.length) return 'no_result';
  return result.conditions.some((condition) => condition.requiresConfirmation)
    ? 'needs_confirmation'
    : 'ready';
}

export function buildPreanalysisQueue({ inquiries, selectedBroker, verifiedKeys, limit = MAX_PREANALYSIS_BATCH_SIZE }) {
  return inquiries
    .filter((inquiry) => {
      if ((selectedBroker && inquiry.broker !== selectedBroker) || inquiry.hasImageAttachment) return false;
      return !verifiedKeys.has(`${inquiry.id}:${inquiryFingerprint(inquiry)}`);
    })
    .sort((left, right) => {
      const dateOrder = String(left.receivedAt || '').localeCompare(String(right.receivedAt || ''));
      return dateOrder || String(left.id).localeCompare(String(right.id), undefined, { numeric: true });
    })
    .slice(0, limit);
}

