const crypto = require('crypto');
const { RELEASE } = require('./analysisStore');
const { getQuotaDetails } = require('./aiQuota');
const { DAILY_AI_REQUEST_LIMIT, getAiQuotaWindow } = require('../src/util/aiDailyBudget');
const REASON = 'qna-analysis:v1:ai-cooldown-reason';
const KEY = 'qna-analysis:v1:ai-lock';
const NEXT = 'qna-analysis:v1:ai-next';
const ACQUIRE = `
-- A shared daily budget covers browser, cron and direct questions atomically.
if tonumber(redis.call('GET', KEYS[4]) or '0') >= tonumber(ARGV[4]) then
  return -math.max(1, tonumber(ARGV[5]) - tonumber(ARGV[2]))
end
if redis.call('EXISTS', KEYS[1]) == 1 then return 2000 end
local next = tonumber(redis.call('GET', KEYS[2]) or '0')
-- Migrate legacy cooldowns without provider metadata once, without extending them.
if next > tonumber(ARGV[2]) + 60000 and redis.call('EXISTS', KEYS[3]) == 0 then
  next = tonumber(ARGV[2]) + 30000
  redis.call('SET', KEYS[2], next, 'PX', 90000)
end
if next > tonumber(ARGV[2]) then return next - tonumber(ARGV[2]) end
redis.call('INCR', KEYS[4])
redis.call('PEXPIRE', KEYS[4], math.max(1, tonumber(ARGV[5]) - tonumber(ARGV[2])))
redis.call('SET', KEYS[1], ARGV[1], 'EX', 90)
redis.call('SET', KEYS[2], tonumber(ARGV[2]) + tonumber(ARGV[3]), 'PX', 3600000)
return 0`;
async function withAiSlot(redis, run) {
  // API calls require the shared limiter; the local browser development path is separate.
  if (!redis) throw Object.assign(new Error('공용 분석 저장소가 연결되지 않았습니다.'), { status: 503 });
  const token = crypto.randomUUID();
  const now = Date.now();
  const window = getAiQuotaWindow(now);
  const budgetKey = 'qna-analysis:v1:ai-daily:' + (process.env.GEMINI_MODEL || 'gemini-2.5-flash') + ':' + window.day;
  const delay = Number(await redis.eval(ACQUIRE, [KEY, NEXT, REASON, budgetKey], [token, now, Math.max(2000, Number(process.env.AI_REQUEST_INTERVAL_MS) || 3000), DAILY_AI_REQUEST_LIMIT, window.resetAt]));
  if (delay < 0) throw Object.assign(new Error('앱의 하루 AI 분석 시도 상한(30회)에 도달했습니다. 남은 문의는 한도 갱신 후 분석합니다.'), {status:429, isDailyLimit:true, limitSource:'application', quotaLimit:DAILY_AI_REQUEST_LIMIT, retryInSeconds:Math.ceil(-delay/1000)});
  if (delay > 0) {
    const saved = typeof redis.get === 'function' ? await redis.get(REASON) : null;
    const quota = saved?.retryAt > Date.now() ? saved : {};
    throw Object.assign(new Error(quota.limitSource === 'provider'
      ? quota.isDailyLimit ? 'AI 제공업체의 하루 할당량에 도달했습니다.' : 'AI 제공업체의 요청 제한으로 대기 중입니다.'
      : '다른 분석이 진행 중입니다. 잠시 후 자동으로 재시도합니다.'),
    { status: 429, isDailyLimit: false, limitSource: 'application', ...quota, retryInSeconds: Math.ceil(delay / 1000) });
  }
  try {
    const response = await run();
    if (response.status === 429) {
      const data = await response.clone().json().catch(() => ({}));
      const quota = getQuotaDetails(data);
      const delay = quota.isDailyLimit ? getAiQuotaWindow().resetAt - Date.now() : Math.max(30000, (quota.retryInSeconds || 60)*1000);
      await redis.set(NEXT, Date.now()+delay, {px: delay+60000});
      await redis.set(REASON, { ...quota, retryAt: Date.now()+delay }, {px: delay+60000});
    }
    return response;
  }
  finally { await redis.eval(RELEASE, [KEY], [token]).catch(() => {}); }
}
module.exports = { withAiSlot };
