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

 test('단위 없는 숫자는 지표 인자일 수 있으므로 콤마를 추가하지 않는다', async () => {
  let input = await edit('');
  for (const digit of '999999999') {
    const cursor = input.selectionStart;
    input = await edit(input.value.slice(0, cursor) + digit + input.value.slice(cursor), cursor + 1);
  }
  expect(input.value).toBe('999999999');
  expect(input.selectionStart).toBe(input.value.length);
});

test('기존 금액 중간에 숫자를 추가해도 쉼표와 커서를 정리한다', async () => {
  const input = await edit('거래대금 1,2345,567원', '거래대금 1,2345'.length);
  expect(input.value).toBe('거래대금 12,345,567원');
  expect(input.selectionStart).toBe('거래대금 12,345'.length);
});

test('이동평균 인자를 직접 수정해도 금액처럼 합치지 않는다', async () => {
  const input=await edit('종가 기준 5,20,60 단순 이평이 정배열');
  expect(input.value).toBe('종가 기준 5,20,60 단순 이평이 정배열');
});

test('개발 환경이 아니어도 지원 조건의 상세설정 버튼을 제공한다',async()=>{
 await act(async()=>root.render(<SelectedConditions selectedConditions={[{broker:'NH증권',path:'이동평균 배열',detail:'종가 기준 5,20,60 단순 이평이 정배열',inputSchema:{kind:'settings'}}]} onCommentChange={()=>{}}/>));
 expect([...container.querySelectorAll('button')].some(button=>button.textContent==='상세 설정')).toBe(true);
});
