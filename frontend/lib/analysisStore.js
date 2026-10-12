const crypto = require('crypto');
const INDEX_KEY = 'qna-analysis:v1:ids';
const resultKey = (id) => `qna-analysis:v1:${id}`;
const lockKey = (id) => `qna-analysis:v1:${id}:lock`;
const stateKey = (id) => `qna-analysis:v1:${id}:state`;
const CLAIM = `
local cached = redis.call('GET', KEYS[1])
if cached then
  local item = cjson.decode(cached)
  if item.fingerprint == ARGV[1] and item.result then return {'ready', cached} end
end
local pending = ''
local saved = redis.call('GET', KEYS[3])
if saved then
  local state = cjson.decode(saved)
  if state.fingerprint == ARGV[1] then
    if state.permanent or (state.retryAt or 0) > tonumber(ARGV[3]) then return {'deferred', saved} end
    if state.pendingResult then pending = cjson.encode(state.pendingResult) end
  end
end
if redis.call('SET', KEYS[2], ARGV[2], 'NX', 'EX', 120) then return {'claimed', ARGV[2], pending} end
return {'analyzing', ''}`;
const STORE = `
if redis.call('GET', KEYS[2]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SADD', KEYS[3], ARGV[3])
redis.call('PERSIST', KEYS[3])
redis.call('DEL', KEYS[2], KEYS[4])
return 1`;
const RELEASE = `
if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end
return 0`;
async function claimAnalysis(redis, id, fingerprint) {
  const [status, value, pending] = await redis.eval(CLAIM, [resultKey(id), lockKey(id), stateKey(id)], [fingerprint, crypto.randomUUID(), Date.now()]);
  return status === 'ready' ? { status, result: (typeof value === 'string' ? JSON.parse(value) : value).result }
    : status === 'deferred' ? { status, ...(typeof value === 'string' ? JSON.parse(value) : value) } : status === 'claimed' ? { status, claimToken: value, ...(pending ? {pendingResult: typeof pending === 'string' ? JSON.parse(pending) : pending} : {}) } : { status };
}
async function storeAnalysis(redis, id, fingerprint, token, result) {
  return Number(await redis.eval(STORE, [resultKey(id), lockKey(id), INDEX_KEY, stateKey(id)], [token, JSON.stringify({ fingerprint, result, savedAt: Date.now() }), String(id)])) === 1;
}
async function releaseAnalysis(redis, id, token) {
  return redis.eval(RELEASE, [lockKey(id)], [token]);
}
module.exports = { INDEX_KEY, resultKey, lockKey, stateKey, claimAnalysis, storeAnalysis, releaseAnalysis, RELEASE };
