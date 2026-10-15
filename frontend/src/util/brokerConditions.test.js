import fs from 'fs';
import path from 'path';
import { TextDecoder } from 'util';
import brokerMap from '../data/brokerMap';
import { loadBrokerConditions, fetchBrokerXmls } from './brokerConditions';

beforeAll(() => { global.TextDecoder = TextDecoder; process.env.PUBLIC_URL = ''; });
afterEach(() => { delete global.fetch; });

test.each(Object.keys(brokerMap))('%s의 실제 XML에서 해당 증권사 조건과 상세값을 불러온다', async (broker) => {
  global.fetch = jest.fn(async (url) => {
    const buffer = fs.readFileSync(path.join(process.cwd(), 'public', url));
    return { ok: true, arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) };
  });
  const conditions = await loadBrokerConditions(broker);
  expect(conditions.length).toBeGreaterThan(0);
  expect(conditions.every((item) => item.broker === broker)).toBe(true);
  expect(conditions.some((item) => item.detail.length > 0)).toBe(true);
  const requests = fetch.mock.calls.length;
  expect(await loadBrokerConditions(broker)).toBe(conditions);
  expect(fetch).toHaveBeenCalledTimes(requests);
});

test('조건 파일 다운로드는 한 번에 최대 네 개이고 파일 순서를 유지한다', async () => {
  let concurrent = 0;
  let peak = 0;
  global.fetch = jest.fn(async (url) => {
    concurrent += 1;
    peak = Math.max(peak, concurrent);
    await Promise.resolve();
    return { ok: true, arrayBuffer: async () => { concurrent -= 1; return Buffer.from(url); } };
  });
  const urls = Array.from({ length: 12 }, (_, index) => `file-${index}`);
  expect(await fetchBrokerXmls(urls)).toEqual(urls);
  expect(peak).toBe(4);
});

test.each([
  ['신한증권', '증거금률', '증거금 20%'],
  ['KB증권', '액면가', '현재가가 액면가 미만 대상'],
  ['KB증권', '증거금율', '증거금 20%'],
  ['미래에셋증권', '대상지정>증거금율', '증거금 100%'],
  ['NH증권', '증거금률', '증거금 30%'],
])('%s의 %s는 XML에서 선택된 라디오 문구를 사용한다', async (broker, conditionPath, expected) => {
  const conditions = await loadBrokerConditions(broker);
  expect(conditions.find(item => item.path === conditionPath)?.detail).toBe(expected);
});

test.each(Object.keys(brokerMap))('%s에서 상세 템플릿 누락을 복구하고 원본이 없는 항목만 남긴다', async (broker) => {
  const conditions = await loadBrokerConditions(broker);
  const missing = conditions.filter(item => !item.detail.trim());
  expect(missing).toHaveLength(0);

});

test('KB Price Oscillator 순위에 다른 지표의 상세 설명을 연결하지 않는다', async () => {
  const conditions = await loadBrokerConditions('KB증권');
  const detail = conditions.find(item => item.path === '추세지표>Price Oscillator>Price Oscillator 순위')?.detail;
  expect(detail).toContain('Price Osc');
  expect(detail).not.toContain('Band');
});

test.each(Object.keys(brokerMap))('%s의 전일 대비 등락률 요청에 기준봉 범위 조건을 전달한다', async (broker) => {
  const {getRecommendationCandidates} = require('./conditionCandidateFilter');
  const all = await loadBrokerConditions(broker);
  const query = '전일 대비 등락률이 5% 이상인 종목';
  const candidates = getRecommendationCandidates(query, all);
  expect(candidates.some(item => /1봉전.*대비\s*0봉전/.test(item.detail) && /등락[률율]/.test(item.path + item.detail) && item.detail.includes('%') && !item.path.includes('순위'))).toBe(true);
});

test('실제 KB XML의 RSI 기간과 Signal 기간을 쉼표로 구분한다', async () => {
  const conditions = await loadBrokerConditions('KB증권');
  const rsi = conditions.filter(item => item.detail.includes('RSI['));
  expect(rsi.length).toBeGreaterThan(0);
  expect(rsi.some(item => /RSI\[14,9\]/.test(item.detail))).toBe(true);
});

test.each(Object.keys(brokerMap))('%s 전체 항목에 입력 구조와 출처를 분류한다', async (broker) => {
 const {buildKBDetail,readKBValues}=require('./kbConditionSettings');
 const conditions=await loadBrokerConditions(broker);
 expect(conditions.every(c=>['inline','settings','tradeAmount','review'].includes(c.inputSchema?.kind))).toBe(true);
 for(const condition of conditions.filter(c=>['inline','settings'].includes(c.inputSchema.kind))) {
  const schema=condition.inputSchema;
  const values=Object.fromEntries(schema.fields.map(f=>[f.packet,f.defaultValue|| (f.type==='number'?'0':f.options[0].value)]));
  const result=buildKBDetail(schema,values);
  if(result.error)continue;
  expect(result.detail).not.toMatch(/\([A-Z][A-Z0-9_]*\)/);
  expect(readKBValues(schema,result.detail)).not.toBeNull();
 }
 expect(conditions.every(c=>c.inputSchema.source.broker===broker)).toBe(true);
});
