const { formatConditionDetail } = require('./formatConditionDetail');
const { applyTemplate } = require('./conditionTemplate');
function normalizeAiResult(data, conditionList) {
  const rawList = Array.isArray(data.matches) ? data.matches : [];
  const seenIndex = new Set();
  const matchedItems = [];
  let rejected = false;

  rawList.forEach((result) => {
    const matchedIndex = Number(result?.originalIndex);
    if (
      Number.isInteger(matchedIndex) && result?.originalIndex != null &&
      matchedIndex !== -1 &&
      conditionList[matchedIndex] &&
      !seenIndex.has(matchedIndex)
    ) {
      const source = conditionList[matchedIndex];
      const detail = applyTemplate(source.detail, result);
      if (detail === null || result.confidence === 'low') {
        rejected = true;
        return;
      }
      seenIndex.add(matchedIndex);
      matchedItems.push({
        ...conditionList[matchedIndex],
        detail: formatConditionDetail(detail),
        aiReason: typeof result.reason === 'string' ? result.reason.trim() : '',
        aiConfidence: ['high', 'medium', 'low'].includes(String(result.confidence).toLowerCase())
          ? String(result.confidence).toLowerCase()
          : 'medium',
        nextOperator: result.nextOperator === 'or' ? 'or' : 'and',
        requiresConfirmation: result.requiresConfirmation === true,
        confirmationNote: typeof result.confirmationNote === 'string' ? result.confirmationNote.trim() : '',
      });
    } else { rejected = true; }
  });

  const coverage = Array.isArray(data.coverage)
    ? data.coverage.filter((item) => item && typeof item.request === 'string').map((item) => ({
      request: item.request.trim(),
      status: item.status === 'covered' ? 'covered' : 'needs_confirmation',
      reason: typeof item.reason === 'string' ? item.reason.trim() : '',
    })).filter((item) => item.request)
    : [];

  // Partial removal can change AND/OR semantics: require rechecking the whole strategy.
  if (rejected || matchedItems.length === 0) {
    coverage.forEach((item) => {
      item.status = 'needs_confirmation';
      item.reason = '원본 입력 형식 또는 조건 관련성을 확인해야 합니다. ' + item.reason;
    });
  }
  if (rejected && coverage.length === 0) coverage.push({ request: '추천 조건 검증', status: 'needs_confirmation', reason: '원본 입력 형식과 맞지 않거나 근거가 부족한 조건이 있어 재확인이 필요합니다.' });
  return { conditions: rejected ? [] : matchedItems, coverage };
}
module.exports = { normalizeAiResult };
