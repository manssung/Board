import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useAiStrategyGenerator } from './useAiStrategyGenerator';
import { showAppAlert, showToast } from '../components/AppToast';

jest.mock('../components/AppToast', () => ({ showAppAlert: jest.fn(), showToast: jest.fn() }));
let root;
let container;
let latest;
function Harness() { latest = useAiStrategyGenerator(); return null; }
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await act(async () => root.render(<Harness />));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  jest.restoreAllMocks();
  jest.clearAllMocks();
  delete global.fetch;
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
test('단기 요청 제한은 하루 한도 소진으로 안내하지 않고 로딩을 해제한다', async () => {
  global.fetch = jest.fn().mockResolvedValue({ok: false, status: 429, json: async () => ({retryInSeconds: 2, isDailyLimit: false})});
  await act(async () => {
    expect(await latest.generateStrategy('거래량', [{detail: '거래량'}], 'KB증권')).toBeNull();
  });
  expect(showAppAlert).not.toHaveBeenCalled();
  expect(showToast).toHaveBeenCalledWith(expect.stringContaining('잠시 대기'), 'error');
  expect(latest.isAiLoading).toBe(false);
});
test('하루 할당량 소진은 별도 안내를 표시한다', async () => {
  global.fetch = jest.fn().mockResolvedValue({ok: false, status: 429, json: async () => ({isDailyLimit: true, quotaLimit: 20})});
  await act(async () => latest.generateStrategy('거래량', [{detail: '거래량'}], 'KB증권'));
  expect(showAppAlert).toHaveBeenCalledWith('오늘의 AI 할당량을 모두 사용했습니다', expect.stringContaining('20회'));
  expect(latest.isAiLoading).toBe(false);
});
test('자동 분석 오류는 UI 알림 대신 재시도 정보를 호출자에 전달한다', async () => {
  global.fetch = jest.fn().mockResolvedValue({ok: false, status: 429, json: async () => ({retryInSeconds: 60, isDailyLimit: false})});
  await expect(latest.generateStrategy('거래량', [{detail: '거래량'}], 'KB증권', null, {background: true}))
    .rejects.toMatchObject({status: 429, retryInSeconds: 60, isDailyLimit: false});
  expect(showToast).not.toHaveBeenCalled();
  expect(showAppAlert).not.toHaveBeenCalled();
});
