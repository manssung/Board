import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import StrategyGenerator from './StrategyGenerator';

jest.mock('./hooks/useUnansweredInquiries', () => ({ useUnansweredInquiries: () => ({
  inquiries: [], loading: false, error: '', refresh: jest.fn(), lastUpdatedAt: null,
}) }));
jest.mock('./hooks/useBrokerData', () => ({ useBrokerData: () => ({ allConditions: [], isLoading: false, error: null }) }));

test('처음에는 전체 미답변 현황을 보여주고 입력으로 돌아가기를 누르면 입력창과 증권사 선택을 보여준다', async () => {
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
    const back = [...container.querySelectorAll('button')].find((button) => button.textContent === '입력으로 돌아가기');
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
