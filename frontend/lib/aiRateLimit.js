const crypto = require('crypto');
const { RELEASE } = require('./analysisStore');
const KEY = 'qna-analysis:v1:ai-lock';
const NEXT = 'qna-analysis:v1:ai-next';
const ACQUIRE = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 2000 end
local next = tonumber(redis.call('GET', KEYS[2]) or '0')
if next > tonumber(ARGV[2]) then return next - tonumber(ARGV[2]) end
redis.call('SET', KEYS[1], ARGV[1], 'EX', 90)
redis.call('SET', KEYS[2], tonumber(ARGV[2]) + tonumber(ARGV[3]), 'PX', 3600000)
return 0`;
async function withAiSlot(redis, run) {
  // API calls require the shared limiter; the local browser development path is separate.
  if (!redis) throw Object.assign(new Error('공용 분석 저장소가 연결되지 않았습니다.'), { status: 503 });
  const token = crypto.randomUUID();
  const delay = Number(await redis.eval(ACQUIRE, [KEY, NEXT], [token, Date.now(), Math.max(2000, Number(process.env.AI_REQUEST_INTERVAL_MS) || 3000)]));
  if (delay > 0) throw Object.assign(new Error('다른 분석이 진행 중입니다.'), { status: 429, retryInSeconds: Math.ceil(delay / 1000), isDailyLimit: false });
  try {
    const response = await run();
    if (response.status === 429) {
      const data = await response.clone().json().catch(() => ({}));
      const message = data?.error?.message || '';
      const seconds = Number(message.match(/retry in\s+([\d.]+)s/i)?.[1]);
      const delay = /per_day|daily|day_limit/i.test(message) || !Number.isFinite(seconds) ? 3600000 : Math.max(30000, seconds*1000);
      await redis.set(NEXT, Date.now()+delay, {px: delay+60000});
    }
    return response;
  }
  finally { await redis.eval(RELEASE, [KEY], [token]).catch(() => {}); }
}
module.exports = { withAiSlot };
