const { decode } = require('html-entities');
const BROKER_NAMES = { 신한: '신한증권', 카이로스: '미래에셋증권', '카이로스(W)': '미래에셋증권(해외)', NH: 'NH증권', 교보: '교보증권', KB: 'KB증권' };
function decodeInquiryText(value) {
  return String(value ?? '').replace(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/gi, (entity) => decode(entity, { level: 'html5' })).replace(/\u00ad/g, '');
}
function normalizeInquiry(row) {
  const company = String(row.company || '').trim();
  return {
    id: String(row.uid), broker: BROKER_NAMES[company] || company,
    title: decodeInquiryText(row.subject), author: String(row.name || ''), receivedAt: String(row.s_datetime || ''),
    query: decodeInquiryText(row.comment), hasImageAttachment: Number(row.file) > 0,
    isFollowUp: row.isFollowUp === true || String(row.isFollowUp) === '1',
  };
}
function inquiryFingerprint(inquiry = {}) {
  const source = `${inquiry.id || ''}|${inquiry.broker || ''}|${inquiry.query || ''}`;
  let hash = 5381;
  for (let index = 0; index < source.length; index += 1) hash = ((hash << 5) + hash) ^ source.charCodeAt(index);
  return (hash >>> 0).toString(36);
}
function retryPolicy(error, failures = 1) {
  const permanent = [400, 401, 403, 404, 422].includes(error.status);
  const delay = error.status === 429
    ? error.isDailyLimit || !Number.isFinite(error.retryInSeconds) ? 3600000 : Math.max(30000, error.retryInSeconds * 1000)
    : Math.min(900000, 30000 * 2 ** Math.min(5, Math.max(0, failures - 1)));
  return { permanent, delay };
}
module.exports = { decodeInquiryText, normalizeInquiry, inquiryFingerprint, retryPolicy };
