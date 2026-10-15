const {createConditionSchemaRegistry}=require('./conditionInputSchema');
const xml=text=>new DOMParser().parseFromString(text,'application/xml');
const tree=(tag='X',name='테스트')=>xml(`<${tag} NAME="${name}"/>`).documentElement;
const map=(value='10',tag='X',name='테스트')=>xml(`<ROOT><${tag} MAP_NAME="${name}" COMPLETE_INDEX_NAME="(C1)원"><CONTROL TYPE="Edit" PACKET_ID="C1" DEFAULT_VALUE="${value}"/></${tag}></ROOT>`);
test('파일과 태그가 같은 원본을 우선하고 다른 증권사의 정의는 공유하지 않는다',()=>{
 const a=createConditionSchemaRegistry('신한증권'),b=createConditionSchemaRegistry('KB증권');
 a.add('/mapa.xml',map('10'));a.add('/mapb.xml',map('20'));b.add('/mapa.xml',map('30'));
 expect(a.resolve(tree(),'A').fields[0].defaultValue).toBe('10');
 expect(a.resolve(tree(),'B').fields[0].defaultValue).toBe('20');
 expect(b.resolve(tree(),'A').fields[0].defaultValue).toBe('30');
 expect(a.resolve(tree(),'missing').kind).toBe('review');
});
test('이름만 같은 다른 태그나 정확한 파일의 다른 이름을 빌려오지 않는다',()=>{
 const registry=createConditionSchemaRegistry('NH증권');registry.add('/mapa.xml',map());
 expect(registry.resolve(tree('OTHER'),'A').kind).toBe('review');
 expect(registry.resolve(tree('X','다른 조건'),'A').kind).toBe('review');
});
test('파일 별칭은 동일한 이름과 태그의 구조가 모두 같을 때만 허용한다',()=>{
 const registry=createConditionSchemaRegistry('LS증권');registry.add('/mapa.xml',map());registry.add('/mapb.xml',map());
 expect(registry.resolve(tree(),'alias').source.match).toBe('equivalent');
 registry.add('/mapc.xml',map('50'));
 expect(registry.resolve(tree(),'alias').kind).toBe('review');
});
test('KB 거래대금 예외는 검증된 증권사·파일·태그에만 적용한다',()=>{
 const amount=xml('<ROOT><B2_1_13 MAP_NAME="거래대금 범위" COMPLETE_INDEX_NAME="(C1)백만원"><CONTROL TYPE="Edit" PACKET_ID="C1" DEFAULT_VALUE="10"/></B2_1_13></ROOT>');
 const kb=createConditionSchemaRegistry('KB증권'),shin=createConditionSchemaRegistry('신한증권');kb.add('/mapa-b.xml',amount);shin.add('/mapa-b.xml',amount);
 expect(kb.resolve(tree('B2_1_13','거래대금 범위'),'A-B').kind).toBe('tradeAmount');
 expect(shin.resolve(tree('B2_1_13','거래대금 범위'),'A-B').kind).toBe('inline');
});

test('NH 실제 거래대금 변동폭 순위는 HTS 확인값 9999%까지 적용하고 예외를 격리한다',()=>{
 const fs=require('fs'),path=require('path'),{TextDecoder}=require('util');
 const {buildConditionDetail,readConditionValues}=require('./conditionInputSchema');
 const document=xml(new TextDecoder('euc-kr').decode(fs.readFileSync(path.join(process.cwd(),'public/nh_xml/mape.xml'))));
 const registry=createConditionSchemaRegistry('NH증권');registry.add('/nh_xml/mape.xml',document);
 const node=tree('E12_1_3','거래대금 변동폭 순위'),schema=registry.resolve(node,'E');
 expect(schema.fields.find(field=>field.packet==='RANK').maxLength).toBe(4);
 const values={C1:'증가',T2:'상위순',RANK:'9999'};
 const result=buildConditionDetail(schema,values);expect(result.error).toBeUndefined();expect(result.detail).toContain('9,999%');
 expect(readConditionValues(schema,result.detail)).toEqual(values);
 expect(buildConditionDetail(schema,{...values,RANK:'10000'}).error).toBeTruthy();
 const other=createConditionSchemaRegistry('KB증권');other.add('/mape.xml',document);
 expect(other.resolve(node,'E').fields.find(field=>field.packet==='RANK').maxLength).toBeUndefined();
 const otherFile=createConditionSchemaRegistry('NH증권');otherFile.add('/mapother.xml',document);
 expect(otherFile.resolve(node,'OTHER').fields.find(field=>field.packet==='RANK').maxLength).toBeUndefined();
});

test('XML EDIT_LENGTH만으로 자릿수를 제한하지 않는다',()=>{
 const {buildInputSchema,buildConditionDetail}=require('./conditionInputParser');
 const schema=buildInputSchema(xml('<X MAP_NAME="금액" COMPLETE_INDEX_NAME="(C1)원"><CONTROL TYPE="Edit" PACKET_ID="C1" DEFAULT_VALUE="10" EDIT_LENGTH="2"/></X>').documentElement);
 expect(schema.fields[0].xmlEditLength).toBe(2);expect(schema.fields[0].maxLength).toBeUndefined();
 expect(buildConditionDetail(schema,{C1:'123456789'}).detail).toBe('123,456,789원');
});

test('시각 입력은 자릿수와 별개로 시·분 경계를 검사한다',()=>{
 const {buildInputSchema,buildConditionDetail}=require('./conditionInputParser');
 const schema=buildInputSchema(xml('<X MAP_NAME="시각" COMPLETE_INDEX_NAME="(C1)시 (C2)분 이전"><CONTROL TYPE="Edit" PACKET_ID="C1" DEFAULT_VALUE="9"/><CONTROL TYPE="Edit" PACKET_ID="C2" DEFAULT_VALUE="0"/></X>').documentElement);
 expect(buildConditionDetail(schema,{C1:'23',C2:'59'}).detail).toBe('23시 59분 이전');
 for(const values of [{C1:'24',C2:'0'},{C1:'9',C2:'60'},{C1:'123456',C2:'123457'},{C1:'-1',C2:'0'}])expect(buildConditionDetail(schema,values).error).toContain('시각');
});
