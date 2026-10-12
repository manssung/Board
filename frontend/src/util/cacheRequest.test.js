import { cacheRequest } from './cacheRequest';
import { retryPolicy } from './inquiryData';

afterEach(() => {
  jest.useRealTimers();
  delete global.fetch;
});

test('캐시 429 응답의 재시도 시간을 유지한다', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false, status: 429, json: async () => ({ retryInSeconds: 60, isDailyLimit: false }),
  });
  const error = await cacheRequest({ action: 'claim' }).catch((value) => value);
  expect(error.status).toBe(429);
  expect(retryPolicy(error).delay).toBe(60000);
});

test('JSON이 아닌 오류 응답도 HTTP 상태를 유지한다', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false, status: 503, json: async () => { throw new Error('HTML response'); },
  });
  await expect(cacheRequest({ action: 'sync' })).rejects.toMatchObject({ status: 503 });
});

test('응답 본문 대기가 길어져도 요청을 중단하고 타이머를 정리한다', async () => {
  jest.useFakeTimers();
  global.fetch = jest.fn(async (_url, options) => ({
    ok: true,
    json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(Object.assign(new Error('Timeout'), { name: 'AbortError' })));
    }),
  }));
  const pending = cacheRequest({ action: 'get_many' });
  const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  await Promise.resolve();
  jest.advanceTimersByTime(20000);
  await assertion;
  expect(jest.getTimerCount()).toBe(0);
});
