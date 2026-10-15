import { buildKBInputSchema, buildKBDetail, readKBValues } from './kbConditionSettings';
const schema = (controls, template='(C1)원 ~ (C2)원') => buildKBInputSchema(new DOMParser().parseFromString(`<X MAP_NAME="테스트" COMPLETE_INDEX_NAME="${template}">${controls}</X>`,'application/xml').documentElement);
const edits='<CONTROL TYPE="Edit" PACKET_ID="C1" DEFAULT_VALUE="10" EDIT_LENGTH="4" MINUS_NOT_USE="1"/><CONTROL TYPE="Edit" PACKET_ID="C2" DEFAULT_VALUE="50" EDIT_LENGTH="4" MINUS_NOT_USE="1"/>';
test('숫자만 있는 조건은 별도 패널 없이 분류하고 역변환한다',()=>{
 const s=schema(edits);expect(s.kind).toBe('inline');const result=buildKBDetail(s,{C1:'1234',C2:'5000'});expect(result.detail).toBe('1,234원 ~ 5,000원');expect(readKBValues(s,result.detail)).toEqual({C1:'1234',C2:'5000'});
});
test('없는 선택지와 잘못된 범위를 적용하지 않는다',()=>{
 const s=schema(edits);expect(buildKBDetail(s,{C1:'60',C2:'10'}).error).toBeTruthy();expect(buildKBDetail(s,{C1:'-1',C2:'50'}).error).toBeTruthy();expect(buildKBDetail(s,{C1:'0.5',C2:'50'}).error).toBeTruthy();
});
test('드롭다운은 원본 항목만 허용한다',()=>{
 const s=schema('<CONTROL TYPE="ComboBox" PACKET_ID="C1" DEFAULT_VALUE="1" COMBO_ITEM="종가/시가" COMBO_INDEX="0/1"/>','(C1) 기준');expect(s.kind).toBe('settings');expect(buildKBDetail(s,{C1:'고가'}).error).toBeTruthy();expect(readKBValues(s,'시가 기준')).toEqual({C1:'시가'});
});
test('명시된 라디오 캡션을 제공한다',()=>{
 const s=schema('<CONTROL TYPE="Radio" PACKET_ID="C1" CHECKED="1" STATIC_CAPTION="상승"/><CONTROL TYPE="Radio" PACKET_ID="C1" STATIC_CAPTION="하락"/>','(C1) 추세');expect(s.kind).toBe('settings');expect(buildKBDetail(s,{C1:'하락'}).detail).toBe('하락 추세');
});
test('라디오 연결이 모호하거나 이름 없는 선택지는 확인 필요다',()=>{
 expect(schema('<CONTROL TYPE="Radio" PACKET_ID="C1"/>','(C1)').kind).toBe('review');
 expect(schema('<CONTROL TYPE="Radio" PACKET_ID="C1" STATIC_CAPTION="상위" RADIOGROUP_ID="G1"/><CONTROL TYPE="Edit" PACKET_ID="C2" RADIOGROUP_ID="G1"/>','(C1)').kind).toBe('review');
});
test('이름이 없는 체크박스와 숨은 라디오를 임의로 생략하지 않는다',()=>{
 expect(schema(edits+'<CONTROL TYPE="Checkbox"/>').kind).toBe('review');expect(schema(edits+'<CONTROL TYPE="Radio" PACKET_ID="T1"/>').kind).toBe('review');
});
test('반복된 인자가 서로 다른 기존 문장은 자동으로 덮어쓰지 않는다',()=>{
 const s=schema('<CONTROL TYPE="Edit" PACKET_ID="C1" DEFAULT_VALUE="5"/>','(C1)봉과 (C1)봉');expect(readKBValues(s,'5봉과 7봉')).toBeNull();
});
test('이상·이하 경계도 역전되면 차단한다',()=>{ const s=schema(edits,'(C1)% 이상 (C2)% 이하');expect(buildKBDetail(s,{C1:'60',C2:'10'}).error).toBeTruthy(); });
