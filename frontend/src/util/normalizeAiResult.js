const { formatConditionDetail } = require('./formatConditionDetail');
function normalizeAiResult(data, conditionList) {
  const rawList = Array.isArray(data.matches) ? data.matches : [];
  const seenIndex = new Set();
  const matchedItems = [];

  rawList.forEach((result) => {
    const matchedIndex = Number(result?.originalIndex);
    if (
      Number.isInteger(matchedIndex) && result?.originalIndex != null &&
      matchedIndex !== -1 &&
      conditionList[matchedIndex] &&
      !seenIndex.has(matchedIndex)
    ) {
      seenIndex.add(matchedIndex);
      matchedItems.push({
        ...conditionList[matchedIndex],
        detail: formatConditionDetail(typeof result.detail === 'string' ? result.detail : conditionList[matchedIndex].detail),
        aiReason: typeof result.reason === 'string' ? result.reason.trim() : '',
        aiConfidence: ['high', 'medium', 'low'].includes(String(result.confidence).toLowerCase())
          ? String(result.confidence).toLowerCase()
          : 'medium',
        nextOperator: result.nextOperator === 'or' ? 'or' : 'and',
        requiresConfirmation: result.requiresConfirmation === true,
        confirmationNote: typeof result.confirmationNote === 'string' ? result.confirmationNote.trim() : '',
      });
    }
  });

  const coverage = Array.isArray(data.coverage)
    ? data.coverage.filter((item) => item && typeof item.request === 'string').map((item) => ({
      request: item.request.trim(),
      status: item.status === 'covered' ? 'covered' : 'needs_confirmation',
      reason: typeof item.reason === 'string' ? item.reason.trim() : '',
    })).filter((item) => item.request)
    : [];

  return { conditions: matchedItems, coverage };
}
module.exports = { normalizeAiResult };
