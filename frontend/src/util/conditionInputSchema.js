const {buildInputSchema,buildConditionDetail,readConditionValues,splitConditionTemplate}=require('./conditionInputParser');
// Keep broker, source file and XML identity together. Tags are reused across files.
const fileKey=value=>String(value||'').split(/[\\/]/).pop().replace(/\.xml$/i,'').replace(/^map/i,'').toUpperCase();
function createConditionSchemaRegistry(broker) {
 const entries=[];
 return {
  add(url,xml) {
   if(!xml)return;
   const file=fileKey(url);
   xml.querySelectorAll('[MAP_NAME]').forEach(node=>{
    const source={broker,file,tag:node.tagName};
    entries.push({name:node.getAttribute('MAP_NAME'),...source,schema:buildInputSchema(node,source)});
   });
  },
  resolve(node,fileName) {
   const name=node.getAttribute('NAME')||'',file=fileKey(fileName),tag=node.tagName;
   const review=reason=>({kind:'review',name,reason,source:{broker,file,tag}});
   const exact=entries.filter(entry=>entry.file===file&&entry.tag===tag);
   // An exact identity with a different name must never borrow another condition's inputs.
   if(exact.some(entry=>entry.name!==name))return review('원본 파일과 조건 이름이 일치하지 않아 기존 편집을 유지합니다.');
   const candidates=exact.length?exact:entries.filter(entry=>entry.name===name&&entry.tag===tag);
   if(!candidates.length)return review('원본 파일과 조건 ID를 고유하게 연결하지 못했습니다.');
   if(new Set(candidates.map(entry=>JSON.stringify(entry.schema))).size!==1)return review('같은 조건 ID의 입력 구조가 파일마다 달라 확인이 필요합니다.');
   const chosen=candidates[0];
   return {...chosen.schema,source:{broker,file:chosen.file,tag:chosen.tag,match:exact.length?'exact':'equivalent'}};
  }
 };
}
module.exports={createConditionSchemaRegistry,buildConditionDetail,readConditionValues,splitConditionTemplate};
