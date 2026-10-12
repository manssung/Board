import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { useInboxPreanalysis } from './useInboxPreanalysis';

jest.mock('../util/conditionCandidateFilter', () => ({ getRecommendationCandidates: () => [{ detail: '조건' }] }));

const result = { conditions: [{ detail: '조건' }], coverage: [] };
const inquiries = [1, 2].map((id) => ({ id: String(id), broker: '신한증권', query: `문의 ${id}`, receivedAt: String(id) }));
const conditions = [{ detail: '조건' }];
let root;
let container;
let latest;
let props;
let cacheHandler;
const flush = async () => { await act(async () => { for (let i = 0; i < 40; i += 1) await Promise.resolve(); }); };
const render = async () => {
  await act(async () => { root.render(<Harness {...props} />); });
  await flush();
};
function Harness(config) { latest = useInboxPreanalysis(config); return null; }

beforeEach(() => {
  jest.useFakeTimers();
  window.localStorage.clear();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  props = { enabled: true, hasLoaded: true, inquiries, getConditions: jest.fn().mockResolvedValue(conditions), generateStrategy: jest.fn().mockResolvedValue(result) };
  cacheHandler = (body) => {
    if (body.action === 'claim') return { status: 'claimed', claimToken: `token-${body.inquiryId}` };
    return { status: 'ready', results: {} };
  };
  global.fetch = jest.fn(async (_url, options) => {
    const data = await cacheHandler(JSON.parse(options.body));
    return { ok: !data.httpStatus, status: data.httpStatus || 200, json: async () => data };
  });
});
afterEach(async () => {
  await act(async () => root.unmount());
  await flush();
  container.remove();
  jest.useRealTimers();
  delete global.fetch;
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const requests = (action) => fetch.mock.calls.map(([, options]) => JSON.parse(options.body)).filter((body) => body.action === action);

test('한 건 실패해도 다음 문의를 저장하고 실패한 건은 자동 재시도한다', async () => {
  props.generateStrategy.mockRejectedValueOnce(new Error('일시 오류'));
  await render();
  expect(props.generateStrategy).toHaveBeenCalledTimes(2);
  expect(requests('store').map((body) => body.inquiryId)).toEqual(['2']);
  expect(requests('release').map((body) => body.inquiryId)).toEqual(['1']);
  await act(async () => jest.advanceTimersByTime(30000));
  await flush();
  expect(requests('store').map((body) => body.inquiryId)).toEqual(['2', '1']);
  expect(latest.getStatus(inquiries[0])).toBe('ready');
});

test('40건이 누적되어도 모든 문의를 순차 저장한다', async () => {
  props.inquiries = Array.from({ length: 40 }, (_, index) => ({ ...inquiries[0], id: String(index + 1), query: `문의 ${index + 1}` }));
  await render();
  expect(requests('store')).toHaveLength(40);
});

test('다른 작업의 잠금이 만료되면 새로고침 없이 다시 분석한다', async () => {
  let locked = true;
  cacheHandler = (body) => body.action === 'claim'
    ? (locked ? { status: 'analyzing' } : { status: 'claimed', claimToken: 'token' }) : {};
  await render();
  expect(props.generateStrategy).not.toHaveBeenCalled();
  locked = false;
  await act(async () => jest.advanceTimersByTime(120000));
  await flush();
  expect(requests('store')).toHaveLength(2);
});

test('저장 실패 후 AI를 다시 호출하지 않고 기존 결과를 저장한다', async () => {
  let failed = false;
  cacheHandler = (body) => {
    if (body.action === 'claim') return { status: 'claimed', claimToken: 'token' };
    if (body.action === 'store' && !failed) { failed = true; return { httpStatus: 502 }; }
    return {};
  };
  await render();
  expect(props.generateStrategy).toHaveBeenCalledTimes(2);
  await act(async () => jest.advanceTimersByTime(30000));
  await flush();
  expect(props.generateStrategy).toHaveBeenCalledTimes(2);
  expect(requests('store')).toHaveLength(3);
});

test('목록 변경 중인 분석이 끝난 뒤 다음 실행을 시작한다', async () => {
  let finish;
  props.generateStrategy.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await render();
  props = { ...props, inquiries: [...inquiries] };
  await render();
  expect(props.generateStrategy).toHaveBeenCalledTimes(1);
  await act(async () => finish(result));
  await flush();
  expect(props.generateStrategy).toHaveBeenCalledTimes(2);
  expect(requests('store').map((body) => body.inquiryId)).toEqual(['1', '2']);
});

test('단기 AI 요청 제한은 안내된 대기 시간 후 자동 재개한다', async () => {
  props.generateStrategy.mockRejectedValueOnce(Object.assign(new Error('요청 제한'), { status: 429, retryInSeconds: 60 }));
  await render();
  expect(props.generateStrategy).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(30000));
  await flush();
  expect(props.generateStrategy).toHaveBeenCalledTimes(1);
  await act(async () => jest.advanceTimersByTime(30000));
  await flush();
  expect(requests('store')).toHaveLength(2);
});

test('저장 실패는 완료가 아니라 저장 대기로 표시한다', async () => {
  cacheHandler = (body) => {
    if (body.action === 'claim') return { status: 'claimed', claimToken: 'token' };
    if (body.action === 'store') return { httpStatus: 502 };
    return {};
  };
  await render();
  expect(latest.getStatus(inquiries[0])).toBe('save_pending');
  expect(latest.progress.completed).toBe(0);
  expect(latest.progress.saving).toBe(2);
  expect(latest.getAnalysisDetail(inquiries[0]).reason).toContain('저장하지 못했습니다');
});

test('일시정지 중 다음 문의를 시작하지 않고 재개하면 이어서 저장한다', async () => {
  let finish;
  props.generateStrategy.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  await render();
  await act(async () => latest.togglePaused());
  await act(async () => finish(result));
  await flush();
  expect(props.generateStrategy).toHaveBeenCalledTimes(1);
  expect(latest.progress.phase).toBe('paused');
  await act(async () => latest.togglePaused());
  await flush();
  expect(props.generateStrategy).toHaveBeenCalledTimes(2);
  expect(latest.progress.completed).toBe(2);
  expect(latest.progress.phase).toBe('complete');
});

test('수동 재시도로 실패한 문의만 다시 처리한다', async () => {
  props.generateStrategy.mockRejectedValueOnce(new Error('일시 오류'));
  await render();
  await act(async () => latest.retryFailed());
  await flush();
  expect(requests('store').map((body) => body.inquiryId)).toEqual(['2', '1']);
  expect(latest.progress.completed).toBe(2);
});

test('증권사 선택 없이 여러 증권사의 문의를 각각 맞는 조건으로 분석한다', async () => {
  props.inquiries = [inquiries[0], { ...inquiries[1], broker: 'NH증권' }];
  await render();
  expect(props.getConditions.mock.calls.map(([broker]) => broker)).toEqual(['신한증권', 'NH증권']);
  expect(props.generateStrategy.mock.calls.map((args) => args[2])).toEqual(['신한증권', 'NH증권']);
  expect(latest.progress.total).toBe(2);
  expect(latest.progress.completed).toBe(2);
});

test('파일 첨부와 미지원 증권사는 전체 분석 대상에서 제외한다', async () => {
  props.inquiries = [inquiries[0], { ...inquiries[1], broker: '미지원증권' }, { ...inquiries[1], id: '3', hasImageAttachment: true }];
  await render();
  expect(props.generateStrategy).toHaveBeenCalledTimes(1);
  expect(latest.progress.total).toBe(3);
  expect(latest.progress.excluded).toBe(2);
  expect(latest.progress.blocked).toBe(2);
  expect(latest.progress.phase).toBe('complete');
  expect(latest.getStatus(props.inquiries[1])).toBe('unsupported');
});


test('서버에 남은 분석 결과는 웹에서 AI를 다시 호출하지 않고 저장한다', async () => {
  cacheHandler = (body) => body.action === 'claim'
    ? {status:'claimed', claimToken:'server-retry-token', pendingResult:result} : {};
  await render();
  expect(props.generateStrategy).not.toHaveBeenCalled();
  expect(props.getConditions).not.toHaveBeenCalled();
  expect(requests('store')).toHaveLength(2);
  expect(latest.progress.completed).toBe(2);
});

test('공용 캐시가 안내한 60초 대기 후 자동 분석을 재개한다', async () => {
  let limited = true;
  cacheHandler = (body) => {
    if (body.action === 'claim' && limited) return {httpStatus: 429, retryInSeconds: 60, isDailyLimit: false};
    if (body.action === 'claim') return {status: 'claimed', claimToken: 'token'};
    return {};
  };
  await render();
  expect(props.generateStrategy).not.toHaveBeenCalled();
  limited = false;
  await act(async () => jest.advanceTimersByTime(59999));
  await flush();
  expect(props.generateStrategy).not.toHaveBeenCalled();
  await act(async () => jest.advanceTimersByTime(1));
  await flush();
  expect(requests('store')).toHaveLength(2);
  expect(latest.getStatus(inquiries[0])).toBe('ready');
});
