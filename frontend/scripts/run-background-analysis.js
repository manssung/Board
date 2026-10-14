// Runs in GitHub Actions. Only the endpoint URL and its authorization secret leave the runner.
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function run({ siteUrl, secret, fetchImpl = fetch, sleep = delay, max = 30 }) {
  if (!siteUrl || !secret) throw new Error('SITE_URL and CRON_SECRET are required');
  const origin = new URL(siteUrl);
  if (origin.protocol !== 'https:') throw new Error('SITE_URL must use HTTPS');
  const endpoint = new URL('/api/background-analysis', origin);
  let stored = 0, deferred = 0;
  for (let attempt = 0; attempt < max; attempt++) {
    const response = await fetchImpl(endpoint, {method:'POST', headers:{Authorization:'Bearer '+secret}, redirect:'error', signal:AbortSignal.timeout(65000)});
    if (!response.ok) throw new Error('Background endpoint failed ('+response.status+')');
    const data = await response.json();
    if (data.status === 'stored') stored++;
    else if (data.status === 'deferred') deferred++;
    else if (['no_work','waiting','quota_wait'].includes(data.status)) break;
    else throw new Error('Unexpected background status');
    if (attempt + 1 < max) await sleep(3500);
  }
  return {stored, deferred};
}
if (require.main === module) run({siteUrl:process.env.SITE_URL, secret:process.env.CRON_SECRET}).then(result => console.log('Saved: '+result.stored+'; deferred: '+result.deferred)).catch(() => {console.error('Background run failed. Check endpoint availability and repository secrets.');process.exitCode=1;});
module.exports = {run};
