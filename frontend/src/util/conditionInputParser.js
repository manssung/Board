const { formatConditionDetail } = require('./formatConditionDetail');
// User verified in NH HTS: this field accepts 9999%, despite EDIT_LENGTH=2.
// Scope overrides to the broker, file, condition identity and packet.
const INPUT_OVERRIDES = [{broker:'NH증권',file:'E',tag:'E12_1_3',name:'거래대금 변동폭 순위',packet:'RANK',rules:{maxLength:4,allowNegative:false,allowDecimal:false}}];
const cleanTemplate = text => String(text || '').replace(/\(STERM\)봉전기준/g, '').replace(/\(ETERM\)봉이내/g, '').replace(/\(SCNT1\)~\(SCNT2\)회 발생/g, '').replace(/^(?:\s*,)+\s*|\s*,\s*$/g, '').replace(/\s+/g, ' ').trim();
const splitConditionTemplate = template => template.split(/\(([A-Z][A-Z0-9_]*)\)/g);
function buildInputSchema(node, source = {}) {
  const name = node.getAttribute('MAP_NAME') || '';
  const controls = [...node.querySelectorAll('CONTROL')];
  const templates = ['COMPLETE_INDEX_NAME', 'COMPLETE_INDEX_NAME2'].map(key => cleanTemplate(node.getAttribute(key))).filter(Boolean);
  const review = reason => ({kind:'review', name, reason});
  if (!templates[0]) return review('설정 문장 템플릿이 없습니다.');
  if (source.broker === 'KB증권' && name === '거래대금 범위' && ((source.file === 'A-B' && node.tagName === 'B2_1_13') || (source.file === 'B_FUTOPT' && node.tagName === 'B2_1_8'))) return {kind:'tradeAmount',name};
  if (new Set(templates).size > 1) return review('선택지별 문장과 입력칸 연결을 추가 확인해야 합니다.');
  const template = templates[0];
  const packets = [...new Set(splitConditionTemplate(template).filter((_,index)=>index%2))];
  if (controls.some(c=>/check/i.test(c.getAttribute('TYPE')||''))) return review('체크 항목의 독립 선택 규칙 확인이 필요합니다.');
  if (controls.some(c=>c.getAttribute('TYPE')==='Radio'&&!packets.includes(c.getAttribute('PACKET_ID')))) return review('문장에 드러나지 않는 라디오 선택지가 있어 확인이 필요합니다.');
  const fields = [];
  for (const packet of packets) {
    const matches = controls.filter(c=>c.getAttribute('PACKET_ID')===packet);
    if (!matches.length) return review('입력 항목 ' + packet + '의 원본 연결을 확인해야 합니다.');
    const radios = matches.filter(c=>c.getAttribute('TYPE')==='Radio');
    if (radios.length) {
      if (radios.length !== matches.length) return review('같은 입력 ID에 서로 다른 종류의 입력칸이 연결되어 있습니다.');
      if (radios.filter(c=>c.getAttribute('CHECKED')==='1').length > 1) return review('라디오 기본 선택이 중복되어 확인이 필요합니다.');
      if (radios.some(c=>!c.getAttribute('STATIC_CAPTION'))) return review('라디오 선택지의 표시 문구가 없습니다.');
      const groups = radios.map(c=>c.getAttribute('RADIOGROUP_ID')).filter(Boolean);
      if (controls.some(c=>['Edit','ComboBox'].includes(c.getAttribute('TYPE'))&&groups.includes(c.getAttribute('RADIOGROUP_ID')))) return review('라디오별 입력칸 활성화 규칙 확인이 필요합니다.');
      const options = radios.map(c=>({value:c.getAttribute('STATIC_CAPTION'),label:c.getAttribute('STATIC_CAPTION')}));
      fields.push({packet,type:'radio',options,defaultValue:radios.find(c=>c.getAttribute('CHECKED')==='1')?.getAttribute('STATIC_CAPTION') || ''});
      continue;
    }
    const definitions = matches.map(c=>{
      const type=c.getAttribute('TYPE');
      if(type==='Edit') return {packet,type:'number',defaultValue:c.getAttribute('DEFAULT_VALUE') || '',xmlEditLength:Number(c.getAttribute('EDIT_LENGTH'))||null,allowNegative:c.getAttribute('MINUS_NOT_USE')!=='1',allowDecimal:(c.getAttribute('DEFAULT_VALUE')||'').includes('.')};
      if(type==='ComboBox') {
        const labels=(c.getAttribute('COMBO_ITEM')||'').split('/');
        const indexes=(c.getAttribute('COMBO_INDEX')||'').split('/');
        if(labels.some(label=>!label)||labels.length!==indexes.length||new Set(indexes).size!==indexes.length||new Set(labels).size!==labels.length)return null;
        return {packet,type:'select',options:labels.map(label=>({value:label,label})),defaultValue:labels[indexes.indexOf(c.getAttribute('DEFAULT_VALUE'))]||''};
      }
      return null;
    });
    if(definitions.some(x=>!x)||new Set(definitions.map(x=>JSON.stringify(x))).size!==1) return review('입력 항목 ' + packet + '의 선택지 또는 중복 정의가 불명확합니다.');
    const override = INPUT_OVERRIDES.find(item=>item.broker===source.broker&&item.file===source.file&&item.tag===node.tagName&&item.name===name&&item.packet===packet);
    fields.push({...definitions[0],...(override?.rules||{})});
  }
  if(!fields.length) return review('수정할 입력 항목이 없는 고정 문장입니다.');
  return {kind:fields.some(f=>f.type!=='number')?'settings':'inline',name,template,fields};
}
function buildConditionDetail(schema,values) {
  for(const field of schema.fields||[]) {
    const value=String(values[field.packet]??'');
    if(field.type==='number') {
      if((!field.allowDecimal&&value.includes('.'))||!(field.allowNegative?/^-?\d+(?:\.\d+)?$/:/^\d+(?:\.\d+)?$/).test(value)||!Number.isFinite(Number(value))) return {error:'숫자 형식을 확인해 주세요.'};
      if(Number.isFinite(field.maxLength)&&value.replace(/[.-]/g,'').length>field.maxLength) return {error:`이 항목은 확인된 HTS 기준 숫자 ${field.maxLength}자리까지 적용할 수 있습니다.`};
    } else if(!field.options.some(option=>option.value===value)) return {error:'모든 선택 항목을 지정해 주세요.'};
  }
  for(const time of schema.template.matchAll(/\(([A-Z][A-Z0-9_]*)\)시\s*\(([A-Z][A-Z0-9_]*)\)분/g)) {
    const hour=Number(values[time[1]]),minute=Number(values[time[2]]);
    if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59)return {error:'시각은 0~23시, 0~59분으로 입력해 주세요.'};
  }
  for(const range of schema.template.matchAll(/\(([A-Z][A-Z0-9_]*)\)([^()]*)~\s*\(([A-Z][A-Z0-9_]*)\)/g)) {
    if(schema.fields.find(f=>f.packet===range[1])?.type==='number'&&schema.fields.find(f=>f.packet===range[3])?.type==='number'&&Number(values[range[1]])>Number(values[range[3]]))return {error:'범위의 시작값은 끝값 이하여야 합니다.'};
  }
  for(const range of schema.template.matchAll(/\(([A-Z][A-Z0-9_]*)\)([^()\s]*)\s*이상\s*\(([A-Z][A-Z0-9_]*)\)([^()\s]*)\s*이하/g)) {
    if(range[2]===range[4]&&schema.fields.find(f=>f.packet===range[1])?.type==='number'&&schema.fields.find(f=>f.packet===range[3])?.type==='number'&&Number(values[range[1]])>Number(values[range[3]]))return {error:'최소값은 최대값 이하여야 합니다.'};
  }
  return {detail:formatConditionDetail(splitConditionTemplate(schema.template).map((part,index)=>index%2?values[part]:part).join(''))};
}
function readConditionValues(schema, detail) {
  const parts=splitConditionTemplate(schema.template);
  const escape=text=>text.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s*');
  const pattern=parts.map((part,index)=>{
    if(!(index%2))return escape(part);
    const field=schema.fields.find(f=>f.packet===part);
    return field.type==='number'?'([+-]?\\d+(?:,\\d+)*(?:\\.\\d+)?)':'('+field.options.map(o=>escape(o.value)).join('|')+')';
  }).join('');
  const match=String(detail||'').trim().match(new RegExp('^'+pattern+'$'));
  if(!match)return null;
  const values={};const packets=parts.filter((_,index)=>index%2);
  for(let i=0;i<packets.length;i++){
    const packet=packets[i],field=schema.fields.find(f=>f.packet===packet);
    const value=field.type==='number'?match[i+1].replace(/,/g,''):match[i+1];
    if(values[packet]!==undefined&&values[packet]!==value)return null;
    values[packet]=value;
  }
  return values;
}
module.exports={buildInputSchema,buildConditionDetail,readConditionValues,splitConditionTemplate};