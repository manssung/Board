const { reserveCacheRequest } = require('../lib/cacheBudget');
const crypto = require('crypto');
const { getRedis } = require('../lib/upstashRedis');
const { processNext } = require('../lib/backgroundAnalysis');
const aiHandler = require('./ai-recommend');
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  const expected = process.env.CRON_SECRET;
  const supplied = String(req.headers.authorization || '');
  const wanted = 'Bearer ' + expected;
  const actualBytes = Buffer.from(supplied), expectedBytes = Buffer.from(wanted);
  if (!expected || actualBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(actualBytes, expectedBytes)) return res.status(401).json({error:'Unauthorized'});
  const redis = getRedis();
  if (!redis) return res.status(503).json({error:'Shared store is not configured'});
  try {
    if (!await reserveCacheRequest(redis, res)) return res.status(429).json({error:'Monthly application cache request limit reached'});
    const url = new URL(process.env.QNA_API_URL);
    if (url.protocol !== 'https:') throw new Error('Invalid protocol');
    const upstream = await fetch(url, {signal:AbortSignal.timeout(10000), redirect:'error', headers:{Accept:'application/json'}});
    if (!upstream.ok) throw new Error('Upstream failure');
    const rows = await upstream.json();
    if (!Array.isArray(rows)) throw new Error('Invalid response');
    const catalog = require('../lib/generated/brokerConditions.json');
    const retryProbe = req.headers['x-scheduled-probe'] === '1';
    let apiAttempted = false;
    const recommend = async (customerQuery, conditionList, selectedBroker) => {
      let status = 200, data;
      await aiHandler({method:'POST', body:{customerQuery, conditionList, selectedBroker}, scheduledProbe:retryProbe, onProviderAttempt:()=>{apiAttempted=true;}}, {
        setHeader() {}, status(value) {status=value; return this;}, json(value) {data=value; return this;}
      });
      if (status !== 200) throw Object.assign(new Error('AI request failed'), {status, retryInSeconds:data?.retryInSeconds, isDailyLimit:data?.isDailyLimit});
      return data;
    };
    const result = await processNext({redis, rows, catalog, recommend, retryProbe});
    return res.status(200).json({...result, apiAttempted});
  } catch {
    return res.status(502).json({error:'Background analysis could not complete'});
  }
};
