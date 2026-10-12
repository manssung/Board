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
