import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import StrategyGenerator from './StrategyGenerator';

jest.mock('./hooks/useUnansweredInquiries', () => ({ useUnansweredInquiries: () => ({
  inquiries: [], loading: false, error: '', refresh: jest.fn(), lastUpdatedAt: null,
}) }));
jest.mock('./hooks/useBrokerData', () => ({ useBrokerData: () => ({ allConditions: [], isLoading: false, error: null }) }));

test('처음에는 전체 미답변 현황을 보여주고 AI에게 직접 물어보기를 누르면 입력창과 증권사 선택을 보여준다', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<StrategyGenerator />));
    expect(container.querySelector('.board-inquiry-browser')).not.toBeNull();
    expect(container.querySelector('.inbox-analysis-progress').textContent).toContain('전체 증권사');
    expect(container.querySelector('#broker-select')).toBeNull();
    const back = [...container.querySelectorAll('button')].find((button) => button.textContent === 'AI에게 직접 물어보기');
    await act(async () => back.click());
    expect(container.querySelector('.board-inquiry-browser')).toBeNull();
    expect(container.querySelector('#broker-select')).not.toBeNull();
    expect(container.querySelector('textarea')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});

test.each([true, false])('답변 복사 후 AI 추천 이동 시 완료 여부에 따라 목록 또는 작업을 유지한다: %s', async (completed) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.localStorage.clear();
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue() } });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const click = async (label) => {
    const button = [...container.querySelectorAll('button')].find(item => item.textContent === label);
    expect(button).toBeDefined();
    await act(async () => button.click());
  };
  try {
    await act(async () => root.render(<StrategyGenerator />));
    await click('AI에게 직접 물어보기');
    const query = container.querySelector('textarea');
    const { Simulate } = require('react-dom/test-utils');
    await act(async () => Simulate.change(query, { target: { value: '거래대금 1천억 이상' } }));
    await click('조건식 편집');
    await click('AI 추천');
    expect(container.querySelector('.app-confirm-dialog')).toBeNull();
    await click('조건식 편집');
    await click('복사');
    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    await click('AI 추천');
    expect(container.querySelector('.app-confirm-dialog').textContent).toContain('현재 문의의 답변 작업을 완료하셨나요?');
    await click(completed ? '예, 미답변 목록으로' : '아니요, 작업 유지');
    expect(container.querySelector('.app-confirm-dialog')).toBeNull();
    if (completed) {
      expect(container.querySelector('.board-inquiry-browser')).not.toBeNull();
      await click('조건식 편집');
      await click('AI 추천');
      expect(container.querySelector('.app-confirm-dialog')).toBeNull();
    } else {
      expect(container.querySelector('.board-inquiry-browser')).toBeNull();
      expect(container.querySelector('textarea').value).toBe('거래대금 1천억 이상');
    }
    // Answering either way consumes this copy; only another successful copy should prompt again.
    await click('조건식 편집');
    await click('AI 추천');
    expect(container.querySelector('.app-confirm-dialog')).toBeNull();
    await click('조건식 편집');
    await click('복사');
    await click('AI 추천');
    expect(container.querySelector('.app-confirm-dialog').textContent).toContain('현재 문의의 답변 작업을 완료하셨나요?');
  } finally {
    await act(async () => root.unmount());
    container.remove();
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete navigator.clipboard;
    delete global.IS_REACT_ACT_ENVIRONMENT;
  }
});
