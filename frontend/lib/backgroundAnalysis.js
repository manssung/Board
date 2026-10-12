const { normalizeInquiry, inquiryFingerprint, retryPolicy } = require('../src/util/inquiryData');
const { getRecommendationCandidates } = require('../src/util/conditionCandidateFilter');
const { normalizeAiResult } = require('../src/util/normalizeAiResult');
const { resultKey, stateKey, lockKey, claimAnalysis, storeAnalysis, releaseAnalysis } = require('./analysisStore');
const SAVE_STATE = `if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[2], ARGV[2], 'EX', 3024000)
return 1`;
async function processNext({ redis, rows, catalog, recommend, now = Date.now() }) {
  const inquiries = rows.map(normalizeInquiry).filter(item => item.id && item.id !== 'undefined' && item.query.trim() && !item.hasImageAttachment && catalog[item.broker]?.length)
    .sort((a,b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id, undefined, {numeric:true}));
  if (!inquiries.length) return { status: 'no_work' };
  const values = await redis.mget(...inquiries.flatMap(item => [resultKey(item.id), stateKey(item.id)]));
  let waiting = false;
  for (let index = 0; index < inquiries.length; index++) {
    const inquiry = inquiries[index];
    const fingerprint = inquiryFingerprint(inquiry);
    const cached = values[index*2];
    const state = values[index*2+1]?.fingerprint === fingerprint ? values[index*2+1] : null;
    if (cached?.fingerprint === fingerprint && cached.result) continue;
    if (state?.permanent || state?.retryAt > now) { waiting = true; continue; }
    const claim = await claimAnalysis(redis, inquiry.id, fingerprint);
    if (claim.status === 'ready') continue;
    if (!claim.claimToken) { waiting = true; continue; }
    let result = claim.pendingResult || state?.pendingResult;
    try {
      if (!result) {
        const conditions = getRecommendationCandidates(inquiry.query, catalog[inquiry.broker]);
        const data = await recommend(inquiry.query, conditions, inquiry.broker);
        result = normalizeAiResult(data, conditions);
        // Persist the generated result before committing, so a later invocation can retry storage.
        await redis.eval(SAVE_STATE, [lockKey(inquiry.id), stateKey(inquiry.id)], [claim.claimToken, JSON.stringify({fingerprint, pendingResult:result})]);
      }
      if (!await storeAnalysis(redis, inquiry.id, fingerprint, claim.claimToken, result)) throw new Error('Analysis lease expired');
      return { status: 'stored' };
    } catch (error) {
      const failures = (state?.failures || 0) + 1;
      const policy = retryPolicy(error, failures);
      await redis.eval(SAVE_STATE, [lockKey(inquiry.id), stateKey(inquiry.id)], [claim.claimToken, JSON.stringify({fingerprint, failures, permanent:policy.permanent, retryAt: now + policy.delay, ...(result ? {pendingResult:result} : {})})]);
      return { status: error.status === 429 ? 'quota_wait' : 'deferred', retryInSeconds: Math.ceil(policy.delay/1000) };
    } finally {
      await releaseAnalysis(redis, inquiry.id, claim.claimToken).catch(() => {});
    }
  }
  return { status: waiting ? 'waiting' : 'no_work' };
}
module.exports = { processNext };
