const fs=require('fs'),path=require('path'),vm=require('vm');
const {JSDOM}=require('jsdom');
const {buildKBInputSchema}=require('../src/util/kbConditionSettings');
const root=path.resolve(__dirname,'..');
const ctx={module:{exports:{}}};vm.runInNewContext(fs.readFileSync(path.join(root,'src/data/brokerMap.js'),'utf8').replace('export default brokerMap;','module.exports = brokerMap;'),ctx);
const window=new JSDOM('').window;global.DOMParser=window.DOMParser;
const parser=new window.DOMParser();const catalog=require('../lib/generated/brokerConditions.json');
const report={createdAt:new Date().toISOString(),method:'Map templates are assessed with the current conservative KB interpreter. Name-based catalog projections are estimates, not verified HTS compatibility.',brokers:[]};
const normalize=s=>String(s||'').toLowerCase().replace(/stochastics/g,'stochastic').replace(/bands/g,'band').replace(/[\s\-_/()\[\]%&,]/g,'').replace(/[율률]/g,'');
for(const [broker,info]of Object.entries(ctx.module.exports)){
 const maps=Array.isArray(info)?info:info.maps;
 const r={broker,files:maps.length,catalogConditions:catalog[broker].length,templates:0,types:{},rawClasses:{},reasons:{},examples:{},radio:{conditions:0,withNamedGroups:0,withoutCaptions:0,withGroupedFields:0},multipleTemplates:0,dynamicCombos:0,otherNodeTypes:{},nameProjection:{},unmatchedNames:0,ambiguousNames:0};
 const names=new Map();
 for(const file of maps){
  const xml=new TextDecoder('euc-kr').decode(fs.readFileSync(path.join(root,'public',file)));
  for(const m of xml.matchAll(/<([A-Za-z][\w]*)\b(?=[^>]*(?:MAP_NAME|COMPLETE_INDEX_NAME)=)[^>]*>[\s\S]*?<\/\1>/g)){
   const doc=parser.parseFromString(m[0],'application/xml');if(doc.querySelector('parsererror'))throw Error('Invalid XML fragment '+file+' '+m[1]);
   const n=doc.documentElement;const cs=[...n.querySelectorAll('CONTROL')];r.templates++;
   const source={file,tag:n.tagName,name:n.getAttribute('MAP_NAME')||''};
   for(const c of cs){const type=c.getAttribute('TYPE')||'(empty)';r.types[type]=(r.types[type]||0)+1;}
   for(const tag of ['PARAM','ITEM','SUB_ITEM'])r.otherNodeTypes[tag]=(r.otherNodeTypes[tag]||0)+n.querySelectorAll(tag).length;
   const radios=cs.filter(c=>c.getAttribute('TYPE')==='Radio');
   if(radios.length){r.radio.conditions++;if(radios.every(c=>c.getAttribute('RADIOGROUP_ID')))r.radio.withNamedGroups++;if(radios.some(c=>!c.getAttribute('STATIC_CAPTION')))r.radio.withoutCaptions++;const groups=radios.map(c=>c.getAttribute('RADIOGROUP_ID')).filter(Boolean);if(cs.some(c=>['Edit','ComboBox'].includes(c.getAttribute('TYPE'))&&groups.includes(c.getAttribute('RADIOGROUP_ID'))))r.radio.withGroupedFields++;}
   if(n.getAttribute('COMPLETE_INDEX_NAME2')&&n.getAttribute('COMPLETE_INDEX_NAME2')!==n.getAttribute('COMPLETE_INDEX_NAME'))r.multipleTemplates++;
   if(cs.some(c=>c.getAttribute('TYPE')==='ComboBox'&&(!c.getAttribute('COMBO_ITEM')||!c.getAttribute('COMBO_INDEX'))))r.dynamicCombos++;
   let schema=buildKBInputSchema(n);if(broker!=='KB증권'&&schema.kind==='tradeAmount')schema={kind:'review',name:source.name,reason:'KB 전용 거래대금 예외를 다른 증권사에 적용할 수 없습니다.'};
   r.rawClasses[schema.kind]=(r.rawClasses[schema.kind]||0)+1;
   if(schema.kind==='review'){
    const reason=schema.reason.replace(/입력 항목 [A-Z0-9_]+의/g,'입력 항목의');r.reasons[reason]=(r.reasons[reason]||0)+1;
    if(!r.examples[reason])r.examples[reason]=source;
   }
   const name=normalize(source.name);if(name){const entries=names.get(name)||[];entries.push({signature:JSON.stringify(schema),schema,source});names.set(name,entries);}
  }
 }
 for(const condition of catalog[broker]){
  const name=normalize(condition.path.split('>').pop());const matches=names.get(name)||[];
  if(!matches.length){r.unmatchedNames++;r.nameProjection.review=(r.nameProjection.review||0)+1;continue;}
  if(new Set(matches.map(m=>m.signature)).size>1){r.ambiguousNames++;r.nameProjection.review=(r.nameProjection.review||0)+1;continue;}
  const kind=matches[0].schema.kind;r.nameProjection[kind]=(r.nameProjection[kind]||0)+1;
 }
 report.brokers.push(r);
 console.log(JSON.stringify({broker,files:r.files,templates:r.templates,catalog:r.catalogConditions,raw:r.rawClasses,nameProjection:r.nameProjection,radio:r.radio,multipleTemplates:r.multipleTemplates,dynamicCombos:r.dynamicCombos,reasons:r.reasons}));
}
fs.mkdirSync(path.join(root,'docs'),{recursive:true});fs.writeFileSync(path.join(root,'docs/xml-input-audit.json'),JSON.stringify(report,null,2));window.close();