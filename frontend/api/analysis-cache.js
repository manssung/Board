const crypto = require('crypto');
const { getRedis } = require('../lib/upstashRedis');

const MONTHLY_OPERATION_LIMIT = Math.max(1000, Number(process.env.REDIS_MONTHLY_OPERATION_LIMIT) || 10000);
const INDEX_KEY = 'qna-analysis:v1:ids';
const resultKey = (id) => `qna-analysis:v1:${id}`;
const lockKey = (id) => `qna-analysis:v1:${id}:lock`;

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  const redis = getRedis();
  if (!redis) return response.status(503).json({ error: '공용 분석 저장소가 연결되지 않았습니다.' });
  const { action, inquiryId: rawId, fingerprint, result, claimToken } = request.body || {};
  const inquiryId = rawId !== undefined ? String(rawId).trim() : '';

  try {
    const month = new Date().toISOString().slice(0, 7);
    const usageKey = `qna-analysis:v1:usage:${month}`;
    const usage = await redis.incr(usageKey);
    if (usage === 1) await redis.expire(usageKey, 35 * 24 * 60 * 60);
    response.setHeader('X-Cache-Usage', String(usage));
    response.setHeader('X-Cache-Usage-Limit', String(MONTHLY_OPERATION_LIMIT));
    if (usage > MONTHLY_OPERATION_LIMIT) {
      return response.status(429).json({ error: '이번 달 공용 캐시 안전 한도에 도달했습니다.', status: 'limit_reached' });
    }

    if (action === 'sync') {
      const upstreamUrl = new URL(process.env.QNA_API_URL);
      if (upstreamUrl.protocol !== 'https:') throw new Error('Invalid upstream protocol');
      const upstream = await fetch(upstreamUrl, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      if (!upstream.ok) throw new Error('Upstream failure');
      const rows = await upstream.json();
      if (!Array.isArray(rows)) throw new Error('Invalid upstream response');
      const activeRows = new Map(rows.map((row) => [String(row.uid), row]));
      const cachedIds = (await redis.smembers(INDEX_KEY)).map(String);
      const staleIds = cachedIds.filter((id) => {
        const row = activeRows.get(id);
        return !row || Number(row.file) > 0;
      });
      if (staleIds.length) {
        await redis.del(...staleIds.flatMap((id) => [resultKey(id), lockKey(id)]));
        await redis.srem(INDEX_KEY, ...staleIds);
      }
      await redis.persist(INDEX_KEY);
      return response.status(200).json({ status: 'synced', removed: staleIds.length });
    }

    if (!inquiryId || typeof fingerprint !== 'string' || !fingerprint) {
      return response.status(400).json({ error: '문의 식별 정보가 올바르지 않습니다.' });
    }
    if (action === 'claim') {
      const cached = await redis.get(resultKey(inquiryId));
      if (cached?.fingerprint === fingerprint && cached?.result) {
        await redis.persist(resultKey(inquiryId));
        return response.status(200).json({ status: 'ready', result: cached.result });
      }
      if (cached) await redis.del(resultKey(inquiryId));
      const token = crypto.randomUUID();
      const acquired = await redis.set(lockKey(inquiryId), token, { nx: true, ex: 120 });
      return response.status(200).json(acquired ? { status: 'claimed', claimToken: token } : { status: 'analyzing' });
    }
    if (action === 'store') {
      if (!result || !Array.isArray(result.conditions) || !Array.isArray(result.coverage)) return response.status(400).json({ error: '분석 결과 형식이 올바르지 않습니다.' });
      const currentToken = await redis.get(lockKey(inquiryId));
      if (!claimToken || currentToken !== claimToken) return response.status(409).json({ error: '분석 저장 권한이 만료되었습니다.' });
      await redis.set(resultKey(inquiryId), { fingerprint, result, savedAt: Date.now() });
      await redis.sadd(INDEX_KEY, inquiryId);
      await redis.persist(INDEX_KEY);
      await redis.del(lockKey(inquiryId));
      return response.status(200).json({ status: 'stored' });
    }
    if (action === 'release') {
      const currentToken = await redis.get(lockKey(inquiryId));
      if (claimToken && currentToken === claimToken) await redis.del(lockKey(inquiryId));
      return response.status(200).json({ status: 'released' });
    }
    return response.status(400).json({ error: '지원하지 않는 작업입니다.' });
  } catch (error) {
    console.error('Shared analysis cache failed:', error.message);
    return response.status(502).json({ error: '공용 분석 캐시를 처리하지 못했습니다.' });
  }
};
