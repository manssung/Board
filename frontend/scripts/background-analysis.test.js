const test = require('node:test');
const assert = require('node:assert/strict');
const {processNext} = require('../lib/backgroundAnalysis');
const {claimAnalysis,storeAnalysis,releaseAnalysis,resultKey,stateKey,lockKey} = require('../lib/analysisStore');
const {normalizeInquiry,inquiryFingerprint,retryPolicy} = require('../src/util/inquiryData');
const {run} = require('./run-background-analysis');
const row = id => ({uid:id, company:'KB', comment:'거래량 10만주 이상', s_datetime:'2026-10-12', file:0});
const catalog = {'KB증권':[{type:'거래량',path:'거래량',detail:'100000주'}]};
const recommendation = {matches:[{originalIndex:0,detail:'100000주',confidence:'high'}],coverage:[]};
// The fake models atomic eval boundaries; assertions below also verify no separate writes are issued.
class MemoryRedis {
 constructor(){this.data=new Map();this.calls=[];this.failStore=false;}
 async mget(...keys){return keys.map(key=>this.data.get(key));}
 async eval(script,keys,args){
  this.calls.push({script,keys,args});
  if(script.includes('cjson.decode(cached)')){
   const cached=this.data.get(keys[0]);if(cached?.fingerprint===args[0])return ['ready',JSON.stringify(cached)];
   const state=this.data.get(keys[2]);if(state?.fingerprint===args[0]&&(state.permanent||(state.retryAt>args[2]&&args[3]!=='1')))return ['deferred',JSON.stringify(state)];
   if(this.data.has(keys[1]))return ['analyzing',''];this.data.set(keys[1],args[1]);return ['claimed',args[1],state?.fingerprint===args[0] && state.pendingResult ? JSON.stringify(state.pendingResult) : ''];
  }
  if(script.includes("'SADD'")){
   if(this.failStore){this.failStore=false;throw new Error('Temporary storage failure');}
   if(this.data.get(keys[1])!==args[0])return 0;
   this.data.set(keys[0],JSON.parse(args[1]));this.data.delete(keys[1]);this.data.delete(keys[3]);return 1;
  }
  if(script.includes('local next') && keys.length===5)return 0;
  if(script.includes("'INCR'"))return 1;
  if(script.includes("'PX'"))return 0;
  if(script.includes('3024000')){
   if(this.data.get(keys[0])!==args[0])return 0;this.data.set(keys[1],JSON.parse(args[1]));return 1;
  }
  if(this.data.get(keys[0])===args[0])this.data.delete(keys[0]);return 1;
 }
}
test('40 inquiries are processed one at a time and cached results are skipped',async()=>{
 const redis=new MemoryRedis();const rows=Array.from({length:40},(_,i)=>row(i+1));let calls=0;
 const recommend=async()=>{calls++;return recommendation;};
 for(let i=0;i<40;i++)assert.equal((await processNext({redis,rows,catalog,recommend})).status,'stored');
 assert.equal(calls,40);assert.equal((await processNext({redis,rows,catalog,recommend})).status,'no_work');assert.equal(calls,40);
});
test('two workers share a claim and generate a single result',async()=>{
 const redis=new MemoryRedis();let calls=0;
 const recommend=async()=>{calls++;await new Promise(resolve=>setTimeout(resolve,5));return recommendation;};
 const results=await Promise.all([1,2].map(()=>processNext({redis,rows:[row(1)],catalog,recommend})));
 assert.equal(calls,1);assert.equal(results.filter(item=>item.status==='stored').length,1);
});
test('final storage failure retries the persisted result without another AI call',async()=>{
 const redis=new MemoryRedis();redis.failStore=true;let calls=0;
 const recommend=async()=>{calls++;return recommendation;};
 assert.equal((await processNext({redis,rows:[row(1)],catalog,recommend})).status,'deferred');
 const state=redis.data.get(stateKey('1'));assert.ok(state.pendingResult);state.retryAt=0;
 assert.equal((await processNext({redis,rows:[row(1)],catalog,recommend})).status,'stored');assert.equal(calls,1);
});
test('a failed inquiry does not prevent the next inquiry from being analyzed',async()=>{
 const redis=new MemoryRedis();let calls=0;
 const recommend=async()=>{if(++calls===1)throw new Error('Temporary failure');return recommendation;};
 const options={redis,rows:[row(1),row(2)],catalog,recommend};
 assert.equal((await processNext(options)).status,'deferred');assert.equal((await processNext(options)).status,'stored');assert.equal(calls,2);
});
test('attachments and unsupported brokers are excluded',async()=>{
 let calls=0;const result=await processNext({redis:new MemoryRedis(),rows:[{...row(1),file:1},{...row(2),company:'unknown'}],catalog,recommend:async()=>{calls++;}});
 assert.equal(result.status,'no_work');assert.equal(calls,0);
});
test('permanent failures stay deferred and increasing failures back off',async()=>{
 const redis=new MemoryRedis();const recommend=async()=>{throw Object.assign(new Error('Wrong key'),{status:403});};
 await processNext({redis,rows:[row(1)],catalog,recommend});assert.equal(redis.data.get(stateKey('1')).permanent,true);
 assert.equal((await processNext({redis,rows:[row(1)],catalog,recommend})).status,'waiting');
 assert.equal(retryPolicy({},1).delay,30000);assert.equal(retryPolicy({},2).delay,60000);assert.equal(retryPolicy({},20).delay,900000);
});
test('expired owners cannot store or release a replacement lease; storage is one eval',async()=>{
 const redis=new MemoryRedis();const claim=await claimAnalysis(redis,'1','fingerprint');redis.data.set(lockKey('1'),'replacement');
 const before=redis.calls.length;assert.equal(await storeAnalysis(redis,'1','fingerprint',claim.claimToken,{conditions:[],coverage:[]}),false);
 assert.equal(redis.calls.length,before+1);assert.ok(redis.calls.at(-1).script.includes("'SADD'"));
 await releaseAnalysis(redis,'1',claim.claimToken);assert.equal(redis.data.get(lockKey('1')),'replacement');assert.equal(redis.data.has(resultKey('1')),false);
});
test('server and browser normalization produces the same HTML decoded fingerprint',()=>{
 const inquiry=normalizeInquiry({...row(1),comment:'거래량 &gt; 10000 &shy;'});assert.equal(inquiry.query,'거래량 > 10000 ');assert.equal(inquiryFingerprint(inquiry),inquiryFingerprint({...inquiry}));
});
test('scheduler caps at 30 calls and terminates on quota wait',async()=>{
 let calls=0;const response=status=>({ok:true,json:async()=>({status})});
 await run({siteUrl:'https://example.com',secret:'test',fetchImpl:async(url,options)=>{assert.equal(options.redirect,'error');calls++;return response('stored');},sleep:async()=>{}});assert.equal(calls,30);
 calls=0;await run({siteUrl:'https://example.com',secret:'test',fetchImpl:async()=>{calls++;return response('quota_wait');},sleep:async()=>{}});assert.equal(calls,1);
});
test('server endpoint rejects missing and Unicode invalid authorization before fetch',async()=>{
 const handler=require('../api/background-analysis');const oldSecret=process.env.CRON_SECRET;process.env.CRON_SECRET='a';
 try {for(const authorization of ['', 'Bearer é']){let status;await handler({method:'POST',headers:{authorization}},{setHeader(){},status(value){status=value;return this;},json(){}});assert.equal(status,401);}}
 finally{if(oldSecret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=oldSecret;}
});

test('global AI limiter rejects concurrent callers and releases its slot after failure',async()=>{
 const {withAiSlot}=require('../lib/aiRateLimit');let owner=null,releaseCount=0;
 const redis={eval:async(script,keys,args)=>{
  if(script.includes("'EXISTS'")){if(owner)return 2000;owner=args[0];return 0;}
  if(owner===args[0]){owner=null;releaseCount++;}return 1;
 }};
 let finish;const first=withAiSlot(redis,()=>new Promise(resolve=>{finish=resolve;}));
 await new Promise(resolve=>setImmediate(resolve));
 await assert.rejects(withAiSlot(redis,async()=>({status:200})),error=>error.status===429&&error.retryInSeconds===2);
 finish({status:200});await first;assert.equal(releaseCount,1);
 await assert.rejects(withAiSlot(redis,async()=>{throw new Error('Network error');}),/Network error/);assert.equal(owner,null);assert.equal(releaseCount,2);
});
test('provider quota responses create a shared cooldown',async()=>{
 const {withAiSlot}=require('../lib/aiRateLimit');let cooldown;
 const redis={eval:async()=>0,set:async(key,value,options)=>{if(key.endsWith('ai-next'))cooldown={value,options};}};
 const response={status:429,clone:()=>({json:async()=>({error:{message:'retry in 60s'}})})};
 const now=Date.now();assert.equal(await withAiSlot(redis,async()=>response),response);
 assert.ok(cooldown.value>=now+60000);assert.equal(cooldown.options.px,120000);
});

test('a claim passes persisted analysis to a different worker without accepting an older fingerprint',async()=>{
 const redis=new MemoryRedis();const pendingResult={conditions:[{detail:'saved analysis'}],coverage:[]};
 redis.data.set(stateKey('1'),{fingerprint:'current',pendingResult,retryAt:0});
 const claim=await claimAnalysis(redis,'1','current');assert.deepEqual(claim.pendingResult,pendingResult);
 await releaseAnalysis(redis,'1',claim.claimToken);
 const changed=await claimAnalysis(redis,'1','changed');assert.equal(changed.pendingResult,undefined);
});

test('authenticated background endpoint stores a result readable by the screen cache endpoint',async()=>{
 const store=require('../lib/upstashRedis');const originalGetter=store.getRedis;const originalFetch=global.fetch;
 const names=['CRON_SECRET','QNA_API_URL','GEMINI_API_KEY'];const originalEnv=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 const modules=['../api/background-analysis','../api/ai-recommend','../api/analysis-cache'];
 const redis=new MemoryRedis();let aiCalls=0;store.getRedis=()=>redis;
 const call=async(handler,request)=>{let code,body;await handler(request,{setHeader(){},status(value){code=value;return this;},json(value){body=value;return this;}});return {code,body};};
 try {
  process.env.CRON_SECRET='test-only-secret';process.env.QNA_API_URL='https://board.example.test/unanswered';process.env.GEMINI_API_KEY='test-only-key';
  modules.forEach(name=>delete require.cache[require.resolve(name)]);
  global.fetch=async(url)=>{
   if(new URL(url).hostname==='board.example.test')return new Response(JSON.stringify([row(1)]),{status:200});
   // This endpoint uses the real catalog; the fake model must preserve its template.
   const candidates = require('../src/util/conditionCandidateFilter').getRecommendationCandidates(row(1).comment, require('../lib/generated/brokerConditions.json')['KB증권']);
   const originalIndex = candidates.findIndex(item => item.path.includes('거래량') && item.detail);
   const original = candidates[originalIndex];
   const actualRecommendation = { ...recommendation, matches: [{ ...recommendation.matches[0], originalIndex, detail: original.detail }] };
   aiCalls++;return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(actualRecommendation)}]}}]}),{status:200});
  };
  const background=require('../api/background-analysis');const cache=require('../api/analysis-cache');
  const request={method:'POST',headers:{authorization:'Bearer test-only-secret'}};
  const first=await call(background,request);assert.equal(first.code,200);assert.equal(first.body.status,'stored');
  const inquiry=normalizeInquiry(row(1));
  const shared=await call(cache,{method:'POST',body:{action:'get_many',inquiries:[{id:inquiry.id,fingerprint:inquiryFingerprint(inquiry)}]}});
  assert.equal(shared.code,200);assert.equal(shared.body.results['1'].conditions.length,1);
  const again=await call(background,request);assert.equal(again.body.status,'no_work');assert.equal(aiCalls,1);
 } finally {
  store.getRedis=originalGetter;global.fetch=originalFetch;
  names.forEach(name=>{if(originalEnv[name]===undefined)delete process.env[name];else process.env[name]=originalEnv[name];});
  modules.forEach(name=>delete require.cache[require.resolve(name)]);
 }
});

test('quota parser reads structured daily quota and RetryInfo', () => {
 const {getQuotaDetails}=require('../lib/aiQuota');
 const quota=getQuotaDetails({error:{message:'Quota exceeded',details:[{violations:[{quotaId:'GenerateRequestsPerDayPerProject',quotaValue:'20'}]},{retryDelay:'42s'}]}});
 assert.equal(quota.isDailyLimit,true);assert.equal(quota.retryInSeconds,42);assert.equal(quota.quotaLimit,20);
});
test('unclassified provider 429 waits one minute rather than one hour', async () => {
 const {withAiSlot}=require('../lib/aiRateLimit');const writes=[];
 const redis={eval:async()=>0,set:async(...args)=>writes.push(args)};
 await withAiSlot(redis,async()=>({status:429,clone:()=>({json:async()=>({error:{message:'Resource exhausted'}})})}));
 assert.equal(writes[0][2].px,120000);assert.equal(writes[1][1].isDailyLimit,false);
});
test('shared cooldown preserves the provider daily classification', async () => {
 const {withAiSlot}=require('../lib/aiRateLimit');let calls=0;
 const redis={eval:async()=>60000,get:async()=>({limitSource:'provider',isDailyLimit:true,retryAt:Date.now()+60000})};
 await assert.rejects(withAiSlot(redis,async()=>{calls++;}),error=>error.status===429&&error.isDailyLimit&&error.limitSource==='provider');
 assert.equal(calls,0);
});

test('application contention retries promptly and provider timing is respected', () => {
 assert.equal(retryPolicy({status:429,limitSource:'application',retryInSeconds:2}).delay,5000);
 assert.equal(retryPolicy({status:429,limitSource:'application',retryInSeconds:2367}).delay,30000);
 assert.equal(retryPolicy({status:429,limitSource:'provider',retryInSeconds:120}).delay,120000);
 assert.equal(retryPolicy({status:429,isDailyLimit:true,retryInSeconds:5}).delay,5000);
 assert.equal(retryPolicy({status:429}).delay,60000);
});
test('legacy cooldown migration uses the same atomic acquire and metadata key', async () => {
 const {withAiSlot}=require('../lib/aiRateLimit');let inspected=false;
 const redis={eval:async(script,keys)=>{
  if(script.includes('local next')){assert.equal(keys.length,5);assert.ok(script.includes("redis.call('EXISTS', KEYS[3]) == 0"));assert.ok(script.includes('next = tonumber(ARGV[2]) + 30000'));inspected=true;}
  return 0;
 }};
 await withAiSlot(redis,async()=>({status:200}));assert.equal(inspected,true);
});

test('shared daily request budget blocks request 31 across workers and resets in Pacific time', async () => {
 const {withAiSlot}=require('../lib/aiRateLimit');const {getAiQuotaWindow}=require('../src/util/aiDailyBudget');
 const counts=new Map();let calls=0;const originalNow=Date.now;let now=Date.parse('2026-10-14T00:00:00Z');Date.now=()=>now;
 const redis={eval:async(script,keys,args)=>{
  if(script.includes('local next')){
   assert.ok(script.includes("redis.call('INCR', KEYS[4])"));
   const count=counts.get(keys[3])||0;
   if(count>=args[3])return -(args[4]-args[1]);counts.set(keys[3],count+1);return 0;
  }return 1;
 }};
 try {
  for(let i=0;i<30;i++)await withAiSlot(redis,async()=>{calls++;return {status:200};});
  await assert.rejects(withAiSlot(redis,async()=>{calls++;return {status:200};}),e=>e.status===429&&e.isDailyLimit&&e.quotaLimit===30&&e.retryInSeconds===25200);
  assert.equal(calls,30);now=getAiQuotaWindow(now).resetAt;
  await withAiSlot(redis,async()=>{calls++;return {status:200};});assert.equal(calls,31);
 } finally {Date.now=originalNow;}
});
test('Pacific quota reset handles winter and DST transition dates',()=>{
 const {getAiQuotaWindow}=require('../src/util/aiDailyBudget');
 for(const [input,day,reset] of [
 ['2026-10-14T00:00:00Z','2026-10-13','2026-10-14T07:00:00Z'],
 ['2026-12-14T00:00:00Z','2026-12-13','2026-12-14T08:00:00Z'],
 ['2026-03-08T07:59:59Z','2026-03-07','2026-03-08T08:00:00Z'],
 ['2026-03-08T10:00:00Z','2026-03-08','2026-03-09T07:00:00Z'],
 ['2026-11-01T08:59:59Z','2026-11-01','2026-11-02T08:00:00Z']]){
 const result=getAiQuotaWindow(Date.parse(input));assert.equal(result.day,day);assert.equal(result.resetAt,Date.parse(reset));
 }
});
test('failed provider requests consume budget and contention never invokes provider',async()=>{
 const {withAiSlot}=require('../lib/aiRateLimit');let reserved=0,calls=0;
 const redis={eval:async(script)=>{if(script.includes('local next')){reserved++;return reserved<=30?0:-60000;}return 1;}};
 for(let i=0;i<30;i++)await assert.rejects(withAiSlot(redis,async()=>{calls++;throw new Error('Network failure');}),/Network failure/);
 await assert.rejects(withAiSlot(redis,async()=>{calls++;}),e=>e.isDailyLimit);assert.equal(calls,30);
});

test('scheduled probe retries deferred inquiry once and stops on provider quota',async()=>{
 const redis=new MemoryRedis();const inquiry=normalizeInquiry(row(1));let calls=0;
 redis.data.set(stateKey('1'),{fingerprint:inquiryFingerprint(inquiry),retryAt:Date.now()+3600000});
 const options={redis,rows:[row(1)],catalog,recommend:async()=>{calls++;throw Object.assign(new Error('quota'),{status:429,retryInSeconds:60});}};
 assert.equal((await processNext(options)).status,'waiting');assert.equal(calls,0);
 assert.equal((await processNext({...options,retryProbe:true})).status,'quota_wait');assert.equal(calls,1);
});
test('scheduled probe never retries permanent failures or cached successes',async()=>{
 const redis=new MemoryRedis();const inquiry=normalizeInquiry(row(1));let calls=0;
 redis.data.set(stateKey('1'),{fingerprint:inquiryFingerprint(inquiry),permanent:true});
 assert.equal((await processNext({redis,rows:[row(1)],catalog,retryProbe:true,recommend:async()=>{calls++;}})).status,'waiting');assert.equal(calls,0);
});
test('scheduler sends probe on first request only and logs quota stop',async()=>{
 const logs=[];let calls=0;
 await run({siteUrl:'https://example.com',secret:'test',sleep:async()=>{},log:value=>logs.push(value),fetchImpl:async(url,options)=>{
  calls++;assert.equal(options.headers['x-scheduled-probe'],calls===1?'1':undefined);
  return {ok:true,json:async()=>({status:calls===1?'stored':'quota_wait',apiAttempted:true})};
 }});assert.equal(calls,2);assert.ok(logs.some(value=>value.includes('Scheduled analysis started')));assert.ok(logs.some(value=>value.includes('quota_wait')));
});
test('only one scheduled quota probe per Korean day can exceed local budget',async()=>{
 const {withAiSlot}=require('../lib/aiRateLimit');const probes=new Set();let calls=0;
 const redis={eval:async(script,keys,args)=>{
  if(!script.includes('local next'))return 1;
  const probe=args[5]==='1'&&!probes.has(keys[4]);
  if(probe){assert.ok(script.includes("redis.call('SET', KEYS[5], '1'"));probes.add(keys[4]);return 0;}
  return -60000;
 }};
 await withAiSlot(redis,async()=>{calls++;return {status:200};},{scheduledProbe:true});
 await assert.rejects(withAiSlot(redis,async()=>{calls++;},{scheduledProbe:true}),e=>e.status===429);
 await assert.rejects(withAiSlot(redis,async()=>{calls++;}),e=>e.status===429);assert.equal(calls,1);
});
