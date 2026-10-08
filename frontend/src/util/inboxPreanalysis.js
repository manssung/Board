import { inquiryFingerprint } from './inboxAnalysisCache';

export const MAX_PREANALYSIS_BATCH_SIZE = 10;

export const PREANALYSIS_LABELS = {
  idle: '미분석',
  queued: '미분석',
  analyzing: '분석 중',
  ready: '분석 완료',
  needs_confirmation: '분석 완료',
  no_result: '분석 불가',
  limit_reached: '분석 불가',
  failed: '분석 불가',
  attachment: '분석 불가',
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
      if (inquiry.broker !== selectedBroker || inquiry.hasImageAttachment) return false;
      return !verifiedKeys.has(`${inquiry.id}:${inquiryFingerprint(inquiry)}`);
    })
    .sort((left, right) => {
      const dateOrder = String(left.receivedAt || '').localeCompare(String(right.receivedAt || ''));
      return dateOrder || String(left.id).localeCompare(String(right.id), undefined, { numeric: true });
    })
    .slice(0, limit);
}

