// Counts application cache requests, not the provider's billed Redis commands.
const RESERVE = `local used = tonumber(redis.call('GET', KEYS[1]) or '0')
if used >= tonumber(ARGV[1]) then return 0 end
local next = redis.call('INCR', KEYS[1])
if next == 1 then redis.call('EXPIRE', KEYS[1], 3024000) end
return next`;
async function reserveCacheRequest(redis, response) {
  const limit = Math.max(1000, Number(process.env.APP_MONTHLY_CACHE_REQUEST_LIMIT || process.env.REDIS_MONTHLY_OPERATION_LIMIT) || 10000);
  const usage = Number(await redis.eval(RESERVE, ['qna-analysis:v1:usage:'+new Date().toISOString().slice(0,7)], [limit]));
  response.setHeader('X-Cache-Usage', String(usage || limit));
  response.setHeader('X-Cache-Usage-Limit', String(limit));
  return usage > 0;
}
module.exports = {reserveCacheRequest};
