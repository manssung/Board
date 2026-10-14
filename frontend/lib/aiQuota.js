function getQuotaDetails(payload = {}) {
  const error = payload.error || {};
  const message = error.message || '';
  const details = Array.isArray(error.details) ? error.details : [];
  const violations = details.flatMap(item => item.violations || []);
  const isDailyLimit = /per_?day|daily|day_limit/i.test(message + ' ' + violations.map(item => item.quotaId || '').join(' '));
  const retryInfo = details.find(item => typeof item.retryDelay === 'string');
  const seconds = Number(retryInfo?.retryDelay?.replace(/s$/, '') || message.match(/retry in\s+([\d.]+)s/i)?.[1]);
  const limit = Number(violations.find(item => item.quotaValue != null)?.quotaValue ?? message.match(/limit:\s*(\d+)/i)?.[1]);
  return {
    limitSource: 'provider', isDailyLimit,
    retryInSeconds: Number.isFinite(seconds) ? seconds : undefined,
    quotaLimit: Number.isFinite(limit) ? limit : undefined,
  };
}
module.exports = { getQuotaDetails };
