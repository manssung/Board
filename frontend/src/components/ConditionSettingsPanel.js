import React, { useEffect, useId, useState } from 'react';
import { buildAmountDetail, loadAmountSettings, readAmountValues } from '../util/tradeAmountSettings';
import '../css/ConditionSettingsPanel.css';
import KBTemplateSettings from './KBTemplateSettings';

function AmountSettingsPanel({ condition, onApply, onCancel }) {
  const id = useId();
  const [schema, setSchema] = useState(null);
  const [mode, setMode] = useState('');
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [recognized, setRecognized] = useState(true);
  useEffect(() => {
    let active = true;
    setSchema(null); setError('');
    loadAmountSettings(condition.broker).then(schema => {
      if (!active) return;
      const current = readAmountValues(schema, condition.comment ?? condition.detail);
      const defaults = Object.fromEntries(schema.modes.flatMap(mode => mode.fields.map(field => [field.key, field.value])));
      setSchema(schema); setMode(current.mode); setValues({ ...defaults, ...current.values });
      setRecognized(current.recognized);
    }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [condition.broker, condition.detail, condition.comment]);
  if (!schema) return <section className="condition-settings-panel" aria-live="polite"><p>{error || '증권사 원본 설정을 불러오는 중입니다…'}</p><button type="button" onClick={onCancel}>닫기</button></section>;
  const selected = schema.modes.find(item => item.id === mode);
  const result = buildAmountDetail(schema, mode, values);
  const update = (key, value) => { setValues(previous => ({ ...previous, [key]: value })); };
  const reset = () => {
    setMode(schema.defaultMode);
    setValues(Object.fromEntries(schema.modes.flatMap(mode => mode.fields.map(field => [field.key, field.value]))));

  };
  return <section className="condition-settings-panel" aria-label={`${condition.broker} 거래대금 상세 설정`}>
    <header className="settings-heading"><div><span className="settings-eyebrow">상세 설정</span><h3>거래대금 범위</h3></div><div className="settings-heading-actions"><span className="settings-broker">{condition.broker}</span><button type="button" className="settings-apply" disabled={!!result.error} title={result.error || '표시된 설정을 적용합니다'} onClick={() => onApply(result.detail)}>설정 적용</button></div></header>
    {result.error && <p className="settings-validation" role="alert">설정 적용 대기: {result.error}</p>}
    <p className="settings-description">{schema.hasRadio ? '검색 방식을 선택한 뒤 금액을 입력하세요.' : '이 조건은 최소·최대 금액을 함께 입력합니다.'}</p>
    {schema.hasRadio ? <fieldset className="settings-modes"><legend>검색 방식</legend>{schema.modes.map(item => <label className={mode === item.id ? 'selected' : ''} key={item.id}><input type="radio" name={`${id}-mode`} value={item.id} checked={mode === item.id} onChange={() => { setMode(item.id);  }} /><span>{item.label}</span><small>{item.id === 'single' ? '금액 하나와 비교 기준' : '최소 금액부터 최대 금액까지'}</small></label>)}</fieldset> : <div className="settings-fixed">범위 입력 <span>별도의 선택 항목 없음</span></div>}
    {!recognized && <p className="settings-notice">현재 문장을 입력칸으로 정확히 옮길 수 없습니다. 기존 값은 적용 전까지 유지됩니다. 아래 설정을 확인하거나 원본 기본값을 불러와 주세요.</p>}
    <div className="settings-fields">{selected.fields.map(field => <label className={`settings-field ${field.key === 'C1' ? 'settings-bar-field' : ''}`} key={field.key}><span>{field.key === 'C1' ? '기준 시점' : mode === 'single' ? '거래대금' : field.key === 'C2' ? '최소 거래대금' : '최대 거래대금'}</span><div><input aria-label={field.key === 'C1' ? '기준 봉전' : field.key === 'C2' ? '거래대금 최소값' : '거래대금 최대값'} type="text" inputMode="numeric" value={values[field.key] ?? ''} onChange={event => update(field.key, event.target.value)} /><span>{field.key === 'C1' ? '봉전' : '백만원'}</span></div></label>)}
    {mode === 'single' && <label className="settings-field settings-comparison"><span>비교 기준</span><select value={values.T2 || ''} onChange={event => update('T2', event.target.value)}><option value="">선택해 주세요</option>{schema.comparisons.map(value => <option key={value}>{value}</option>)}</select></label>}</div>
    <div className="settings-preview" aria-live="polite"><span>적용할 조건 미리보기</span><strong>{result.detail || '입력값을 확인해 주세요'}</strong></div>

    <footer className="settings-footer"><button className="settings-reset" type="button" onClick={reset}>원본 기본값</button><div><button type="button" onClick={onCancel}>취소</button></div></footer>
  </section>;
}
export default function ConditionSettingsPanel(props) {
  return ['settings','inline'].includes(props.condition.inputSchema?.kind) ? <KBTemplateSettings {...props} /> : <AmountSettingsPanel {...props} />;
}
