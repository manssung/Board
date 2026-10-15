import fs from 'fs';
import path from 'path';
import { TextDecoder } from 'util';
import { parseAmountSettings, readAmountValues, buildAmountDetail, supportsAmountSettings } from './tradeAmountSettings';
const xml = file => new TextDecoder('euc-kr').decode(fs.readFileSync(path.join(process.cwd(), 'public', file)));
const shin = () => parseAmountSettings(xml('shin_xml/mape.xml'), '신한증권');
const kb = () => parseAmountSettings(xml('kb_xml/mapa-b.xml'), 'KB증권');
test('실제 신한 XML의 고정 범위와 입력 길이를 읽는다', () => {
 const schema=shin(); expect(schema.hasRadio).toBe(false);expect(schema.modes.map(x=>x.id)).toEqual(['range']);
 expect(schema.modes[0].fields.map(x=>x.value)).toEqual(['0','10','50']);
 expect(buildAmountDetail(schema,'range',{C1:'0',C2:'20',C3:'60'}).detail).toBe('0봉전 거래대금 20백만원 ~ 60백만원');
});
test('KB는 실제 radio 그룹과 이상/이하 드롭다운을 읽는다', () => {
 const schema=kb();expect(schema.hasRadio).toBe(true);expect(schema.comparisons).toEqual(['이상','이하']);
 expect(schema.modes.map(x=>x.fields.length)).toEqual([1,2]);
 expect(buildAmountDetail(schema,'single',{C2:'10000',T2:'이하'}).detail).toBe('거래대금이 10,000백만원 이하');
 expect(buildAmountDetail(schema,'range',{C2:'10000',C3:'50000'}).detail).toBe('거래대금이 10,000백만원 이상 50,000백만원 이하');
});
test.each(['신한증권','KB증권'])('현재 문장을 읽어 기존 수정값을 보존한다: %s', broker => {
 const schema=broker==='신한증권'?shin():kb(); const mode=schema.modes.find(x=>x.id==='range');
 const values={C1:'3',C2:'1234',C3:'5678'}; const detail=buildAmountDetail(schema,mode.id,values).detail;
 const state=readAmountValues(schema,detail);expect(state.recognized).toBe(true);expect(state.values.C2).toBe('1234');expect(state.values.C3).toBe('5678');
});
test('잘못된 범위와 단위, 누락된 비교값을 확정하지 않는다', () => {
 const schema=kb();expect(buildAmountDetail(schema,'range',{C2:'60',C3:'10'}).error).toBeTruthy();
 expect(buildAmountDetail(schema,'single',{C2:'-10',T2:'이상'}).error).toBeTruthy();
 expect(buildAmountDetail(schema,'single',{C2:'10000'}).error).toBeTruthy();
 expect(buildAmountDetail(schema,'single',{C2:'1234567890123',T2:'이상'}).error).toBeUndefined();
 expect(readAmountValues(schema,'거래대금이 10억원 이상').recognized).toBe(false);
});
test('이름이 같아도 다른 증권사와 경로에 잘못 연결하지 않는다', () => {
 expect(supportsAmountSettings({broker:'신한증권',path:'거래량분석>거래대금>거래대금 범위'})).toBe(true);
 expect(supportsAmountSettings({broker:'NH증권',path:'거래량분석>거래대금>거래대금 범위'})).toBe(false);
 expect(supportsAmountSettings({broker:'KB증권',path:'다른 경로>거래대금 범위'})).toBe(false);
});