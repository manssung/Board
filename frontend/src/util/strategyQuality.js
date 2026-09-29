const valueOf = (condition = {}) => String(condition.comment ?? condition.detail ?? '').trim();
const identityOf = (condition = {}) => [condition.type, condition.path, valueOf(condition)]
  .map((value) => String(value || '').trim().toLowerCase())
  .join('|');

export function buildStrategyIssues(conditions = []) {
  const issues = [];
  const seen = new Map();

  conditions.forEach((condition, index) => {
    if (!valueOf(condition)) {
      issues.push({ type: 'error', index, title: `${index + 1}번째 조건의 설정값이 비어 있습니다.`, action: '설정값 입력' });
    }
    if (condition.requiresConfirmation) {
      issues.push({ type: 'warning', index, title: condition.confirmationNote || `${index + 1}번째 추천 조건은 작업자 확인이 필요합니다.`, action: '조건 확인' });
    }
    const identity = identityOf(condition);
    if (seen.has(identity)) {
      issues.push({ type: 'warning', index, title: `${seen.get(identity) + 1}번째 조건과 중복됩니다.`, action: '중복 확인' });
    } else {
      seen.set(identity, index);
    }
  });

  return issues;
}

export function getCatalogHealth(conditions = [], { loading = false, error = '' } = {}) {
  if (loading) return { tone: 'loading', label: '불러오는 중', detail: '조건 데이터를 확인하고 있습니다.' };
  if (error) return { tone: 'error', label: '조회 오류', detail: String(error) };
  if (!conditions.length) return { tone: 'warning', label: '데이터 없음', detail: '선택한 증권사의 조건 목록이 비어 있습니다.' };
  const missing = conditions.filter((condition) => !String(condition.path || condition.type || '').trim()).length;
  return {
    tone: missing ? 'warning' : 'success',
    label: missing ? '확인 필요' : '정상',
    detail: missing ? `이름 또는 경로가 없는 조건 ${missing}개` : `${conditions.length.toLocaleString()}개 조건을 사용할 수 있습니다.`,
  };
}

export function getAiChangeSummary(conditions = [], recommendationCount = 0, remainingDraftCount = 0) {
  const aiConditions = conditions.filter((condition) => condition.aiReason !== undefined || condition.aiConfidence !== undefined);
  const modified = aiConditions.filter((condition) => valueOf(condition) !== String(condition.detail ?? '').trim()).length;
  const manual = conditions.length - aiConditions.length;
  const excluded = Math.max(0, recommendationCount - aiConditions.length - remainingDraftCount);
  return { applied: aiConditions.length, modified, manual, excluded };
}
