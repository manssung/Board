import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {Simulate} from 'react-dom/test-utils';
import TemplateConditionSettings from './TemplateConditionSettings';
let container,root;
beforeEach(()=>{global.IS_REACT_ACT_ENVIRONMENT=true;container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();delete global.IS_REACT_ACT_ENVIRONMENT;});
const condition={broker:'신한증권',detail:'기존 수동 작성 문장',inputSchema:{name:'금액 범위',kind:'inline',template:'(C1)원 ~ (C2)원',fields:[{packet:'C1',type:'number',defaultValue:'10',maxLength:5,allowNegative:false,allowDecimal:false},{packet:'C2',type:'number',defaultValue:'50',maxLength:5,allowNegative:false,allowDecimal:false}]}};
const render=async(props)=>act(async()=>root.render(<TemplateConditionSettings condition={condition} {...props}/>));
const button=()=>container.querySelector('.settings-apply');
const change=async(selector,value)=>act(async()=>{const input=container.querySelector(selector);input.value=value;Simulate.change(input);});
test('읽지 못한 기존 문장은 자동 변경하지 않고 유효한 표시값의 명시적 적용은 허용한다',async()=>{
 const apply=jest.fn();await render({onApply:apply});expect(container.textContent).toContain('원본 기본값을 표시');
 expect(button().disabled).toBe(false);expect(apply).not.toHaveBeenCalled();await act(async()=>Simulate.click(button()));expect(apply).toHaveBeenCalledWith('10원 ~ 50원');
});
test('범위 오류는 차단하고 수정하면 즉시 적용 가능하다',async()=>{
 await render({onApply:()=>{}});await change('[aria-label="금액 범위 C1"]','60');expect(button().disabled).toBe(true);expect(container.querySelector('[role="alert"]').textContent).toContain('범위의 시작값');
 await change('[aria-label="금액 범위 C1"]','20');expect(button().disabled).toBe(false);
});
test('기본 선택이 없는 비교 방식은 이유를 표시하고 사용자가 선택하면 활성화한다',async()=>{
 const choice={...condition,inputSchema:{name:'비교',kind:'settings',template:'(T1)',fields:[{packet:'T1',type:'select',defaultValue:'',options:[{value:'이상',label:'이상'},{value:'이하',label:'이하'}]}]}};
 await render({condition:choice,onApply:()=>{}});expect(button().disabled).toBe(true);expect(container.querySelector('[role="alert"]').textContent).toContain('선택 항목');
 await change('[aria-label="비교 T1"]','이하');expect(button().disabled).toBe(false);
});

test('입력 중 잘라내지 않고 확인된 자릿수는 적용 시 검사한다',async()=>{
 const rank={...condition,inputSchema:{name:'거래대금 변동폭 순위',kind:'inline',template:'상위 (RANK)% 이내',fields:[{packet:'RANK',type:'number',defaultValue:'10',maxLength:2,allowNegative:false,allowDecimal:false}]}};
 await render({condition:rank,onApply:()=>{}});
 expect(container.querySelector('input').hasAttribute('maxlength')).toBe(false);
 await change('input','9999');expect(container.querySelector('input').value).toBe('9999');expect(button().disabled).toBe(true);
 await change('input','99');
 expect(button().disabled).toBe(false);
});
