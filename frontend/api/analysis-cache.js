const { INDEX_KEY, resultKey, lockKey, claimAnalysis, storeAnalysis, releaseAnalysis, stateKey } = require('../lib/analysisStore');
const { getRedis } = require('../lib/upstashRedis');

const { reserveCacheRequest } = require('../lib/cacheBudget');

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  const redis = getRedis();
  if (!redis) return response.status(503).json({ error: '공용 분석 저장소가 연결되지 않았습니다.' });
  const { action, inquiryId: rawId, fingerprint, result, claimToken, inquiries: lookupInquiries } = request.body || {};
  const inquiryId = rawId !== undefined ? String(rawId).trim() : '';

  try {
    if (!await reserveCacheRequest(redis, response)) return response.status(429).json({ error: '이번 달 공용 캐시 요청 안전 한도에 도달했습니다.', status: 'limit_reached' });

    if (action === 'sync') {
      const upstreamUrl = new URL(process.env.QNA_API_URL);
      if (upstreamUrl.protocol !== 'https:') throw new Error('Invalid upstream protocol');
      const upstream = await fetch(upstreamUrl, { headers: { Accept: 'application/json' }, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
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
        await redis.del(...staleIds.flatMap((id) => [resultKey(id), stateKey(id)]));
        await redis.srem(INDEX_KEY, ...staleIds);
      }
      await redis.persist(INDEX_KEY);
      return response.status(200).json({ status: 'synced', removed: staleIds.length });
    }

    if (action === 'get_many') {
      if (!Array.isArray(lookupInquiries) || lookupInquiries.length > 100) {
        return response.status(400).json({ error: '조회할 문의 목록이 올바르지 않습니다.' });
      }
      const lookups = lookupInquiries
        .map((item) => ({ id: String(item?.id || '').trim(), fingerprint: String(item?.fingerprint || '') }))
        .filter((item) => item.id && item.fingerprint);
      if (!lookups.length) return response.status(200).json({ status: 'ready', results: {} });
      const cachedItems = await redis.mget(...lookups.map((item) => resultKey(item.id)));
      const results = {};
      lookups.forEach((item, index) => {
        const cached = cachedItems[index];
        if (cached?.fingerprint === item.fingerprint && cached?.result) results[item.id] = cached.result;
      });
      return response.status(200).json({ status: 'ready', results });
    }

    if (!inquiryId || typeof fingerprint !== 'string' || !fingerprint) {
      return response.status(400).json({ error: '문의 식별 정보가 올바르지 않습니다.' });
    }
    if (action === 'retry') {
      await redis.eval("local saved = redis.call('GET', KEYS[1]); if saved and redis.call('EXISTS', KEYS[2]) == 0 then local item = cjson.decode(saved); if item.fingerprint == ARGV[1] then item.permanent = false; item.retryAt = 0; item.failures = 0; redis.call('SET', KEYS[1], cjson.encode(item), 'EX', 3024000) end end; return 1", [stateKey(inquiryId), lockKey(inquiryId)], [fingerprint]);
      return response.status(200).json({status:'retry_requested'});
    }
    if (action === 'claim') {
      return response.status(200).json(await claimAnalysis(redis, inquiryId, fingerprint));
    }
    if (action === 'store') {
      if (!result || !Array.isArray(result.conditions) || !Array.isArray(result.coverage)) return response.status(400).json({ error: '분석 결과 형식이 올바르지 않습니다.' });
      if (!claimToken || !await storeAnalysis(redis, inquiryId, fingerprint, claimToken, result)) return response.status(409).json({ error: '분석 저장 권한이 만료되었습니다.' });
      return response.status(200).json({ status: 'stored' });
    }
    if (action === 'release') {
      if (claimToken) await releaseAnalysis(redis, inquiryId, claimToken);
      return response.status(200).json({ status: 'released' });
    }
    return response.status(400).json({ error: '지원하지 않는 작업입니다.' });
  } catch (error) {
    console.error('Shared analysis cache failed:', error.message);
    return response.status(502).json({ error: '공용 분석 캐시를 처리하지 못했습니다.' });
  }
};
