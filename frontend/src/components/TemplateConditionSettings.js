import React, { useEffect, useState, useId } from 'react';
import { buildConditionDetail, readConditionValues, splitConditionTemplate } from '../util/conditionInputSchema';
import '../css/ConditionSettingsPanel.css';
export default function TemplateConditionSettings({ condition, onApply, onCancel, compact = false }) {
 const schema=condition.inputSchema;
 const id=useId();
 const [values,setValues]=useState({});
 const [recognized,setRecognized]=useState(false);
 useEffect(()=>{
  const current=readConditionValues(schema,condition.comment??condition.detail);
  setValues(current||Object.fromEntries(schema.fields.map(field=>[field.packet,field.defaultValue])));
  setRecognized(!!current);
 },[schema,condition.comment,condition.detail]);
 const result=buildConditionDetail(schema,values);
 const update=(packet,value)=>{setValues(previous=>({...previous,[packet]:value}));};
 const renderField=field=>field.type==='number'?<input className="kb-token-number" aria-label={`${schema.name} ${field.packet}`} type="text" inputMode="decimal" title={Number.isFinite(field.maxLength) ? `적용 가능: 숫자 최대 ${field.maxLength}자리` : undefined} value={values[field.packet]??''} onChange={event=>update(field.packet,event.target.value)} />:field.type==='select'?<select aria-label={`${schema.name} ${field.packet}`} value={values[field.packet]??''} onChange={event=>update(field.packet,event.target.value)}><option value="">선택</option>{field.options.map(option=><option key={option.value}>{option.label}</option>)}</select>:<strong className="kb-radio-value">{values[field.packet]||'선택 필요'}</strong>;
 const sentence=<div className="kb-template-sentence">{splitConditionTemplate(schema.template).map((part,index)=>index%2?<React.Fragment key={index}>{renderField(schema.fields.find(field=>field.packet===part))}</React.Fragment>:<span key={index}>{part}</span>)}</div>;
 const apply=<button type="button" className="settings-apply" disabled={!!result.error} title={result.error || '표시된 설정을 적용합니다'} onClick={()=>onApply(result.detail)}>설정 적용</button>;
 if(compact)return <div className="kb-inline-editor">{!recognized&&<p className="settings-notice">현재 문장을 읽지 못해 원본 기본값을 표시했습니다. 확인 후 설정 적용을 눌러 주세요.</p>}{sentence}<div className="settings-heading-actions">{apply}</div>{result.error&&<span className="settings-validation" role="alert">{result.error}</span>}</div>;
 return <section className="condition-settings-panel" aria-label={`${condition.broker} ${schema.name} 상세 설정`}><header className="settings-heading"><div><span className="settings-eyebrow">상세 설정</span><h3>{schema.name}</h3></div><div className="settings-heading-actions"><span className="settings-broker">{condition.broker}</span>{apply}</div></header>
 {result.error&&<p className="settings-validation" role="alert">설정 적용 대기: {result.error}</p>}
 {!recognized&&<p className="settings-notice">현재 문장을 자동으로 옮길 수 없습니다. 원본 기본값을 표시했으며, 적용 전까지 기존 문장은 유지됩니다.</p>}
 {schema.fields.filter(field=>field.type==='radio').map(field=><fieldset className="kb-radio-options" key={field.packet}><legend>조건 선택</legend>{field.options.map(option=><label key={option.value}><input type="radio" name={id+field.packet} value={option.value} checked={values[field.packet]===option.value} onChange={()=>update(field.packet,option.value)} />{option.label}</label>)}</fieldset>)}
 {sentence}<div className="settings-preview" aria-live="polite"><span>적용할 조건 미리보기</span><strong>{result.detail||'선택값을 확인해 주세요'}</strong></div>
 <footer className="settings-footer"><button type="button" className="settings-reset" onClick={()=>{setValues(Object.fromEntries(schema.fields.map(field=>[field.packet,field.defaultValue])));}}>원본 기본값</button><button type="button" onClick={onCancel}>취소</button></footer></section>;
}