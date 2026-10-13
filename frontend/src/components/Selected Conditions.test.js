import React, {act, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import SelectedConditions from './Selected Conditions';

let root, container;
function Harness() {
  const [conditions, setConditions] = useState([{path: '거래대금', detail: 'RSI[14,6] 거래대금 1000000원'}]);
  return <SelectedConditions selectedConditions={conditions} onCommentChange={(index, comment) => setConditions(list => list.map((condition, i) => i === index ? {...condition, comment} : condition))} />;
}
beforeEach(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<Harness />));
  await act(async () => Simulate.click(container.querySelector('.inline-condition-summary')));
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  delete global.IS_REACT_ACT_ENVIRONMENT;
});
const edit = async (raw, position = raw.length) => {
  const input = container.querySelector('.inline-condition-value');
  await act(async () => {
    input.value = raw;
    input.setSelectionRange(position, position);
    Simulate.change(input);
  });
  return input;
};
test('수정창을 열 때 기존 숫자에도 쉼표를 표시한다', () => {
  expect(container.querySelector('.inline-condition-value').value).toBe('RSI[14,6] 거래대금 1,000,000원');
});
test('입력 중 천 단위 표기를 적용하고 숫자 중간의 커서를 유지한다', async () => {
  const input = await edit('거래대금 1234500원 이상', '거래대금 1234'.length);
  expect(input.value).toBe('거래대금 1,234,500원 이상');
  expect(input.selectionStart).toBe('거래대금 1,234'.length);
});
test('금액과 함께 편집해도 RSI 인자 구분과 소수를 유지한다', async () => {
  const input = await edit('RSI[14,6] 거래대금 -1000000.50원');
  expect(input.value).toBe('RSI[14,6] 거래대금 -1,000,000.50원');
  expect(input.selectionStart).toBe(input.value.length);
});
test('지표 인자 사이의 쉼표를 입력한 위치를 유지한다', async () => {
  const input = await edit('RSI[14,] 거래대금 1000원', 'RSI[14,'.length);
  expect(input.value).toBe('RSI[14,] 거래대금 1,000원');
  expect(input.selectionStart).toBe('RSI[14,'.length);
});

test('Delete로 천 단위 쉼표를 지운 뒤 다음 숫자를 편집할 수 있다', async () => {
  await edit('거래대금 1000원');
  const input = container.querySelector('.inline-condition-value');
  await act(async () => {
    input.value = '거래대금 1000원';
    input.setSelectionRange('거래대금 1'.length, '거래대금 1'.length);
    Simulate.change(input, {nativeEvent: {inputType: 'deleteContentForward'}});
  });
  expect(input.value).toBe('거래대금 1,000원');
  expect(input.selectionStart).toBe('거래대금 1,'.length);
});
