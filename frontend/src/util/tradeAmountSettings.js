const { formatConditionDetail } = require('./formatConditionDetail');
const SOURCES = {
  '신한증권': { path: '거래량분석>거래대금>거래대금 범위', file: '/shin_xml/mape.xml', tag: 'E2_3_1' },
  'KB증권': { path: '거래량 분석>거래대금>거래대금 범위', file: '/kb_xml/mapa-b.xml', tag: 'B2_1_13' },
};
const cache = new Map();
function supportsAmountSettings(condition) {
  return SOURCES[condition.broker]?.path === condition.path;
}
function parseAmountSettings(xml, broker) {
  const source = SOURCES[broker];
  if (!source) throw new Error('지원되지 않는 증권사입니다.');
  const start = xml.indexOf('<' + source.tag + ' ');
  const end = xml.indexOf('</' + source.tag + '>', start);
  if (start < 0 || end < 0) throw new Error('원본 조건을 찾지 못했습니다.');
  const node = new DOMParser().parseFromString(xml.slice(start, end + source.tag.length + 3), 'application/xml').documentElement;
  if (node.tagName !== source.tag || node.getAttribute('MAP_NAME') !== '거래대금 범위') throw new Error('원본 조건 형식이 다릅니다.');
  const controls = [...node.querySelectorAll('CONTROL')];
  const field = (key, group) => {
    const c = controls.find(c => c.getAttribute('TYPE') === 'Edit' && c.getAttribute('PACKET_ID') === key && (!group || c.getAttribute('RADIOGROUP_ID') === group || c.getAttribute('TOP_LINE') === group));
    if (!c) throw new Error('입력칸 정보를 확인하지 못했습니다.');
    return { key, value: c.getAttribute('DEFAULT_VALUE'), xmlEditLength: Number(c.getAttribute('EDIT_LENGTH')) || null };
  };
  const clean = value => value.replace(/^.*회 발생,\s*/, '').trim();
  const radios = controls.filter(c => c.getAttribute('TYPE') === 'Radio');
  if (!radios.length) return { broker, source: source.file + '#' + source.tag, hasRadio: false, modes: [{ id: 'range', label: '범위', template: clean(node.getAttribute('COMPLETE_INDEX_NAME')), fields: [field('C1'), field('C2'), field('C3')] }], defaultMode: 'range', comparisons: [] };
  const single = radios.find(c => c.getAttribute('RADIOGROUP_ID') === 'G1_1');
  const range = radios.find(c => c.getAttribute('RADIOGROUP_ID') === 'G1_2');
  const combo = controls.find(c => c.getAttribute('PACKET_ID') === 'T2' && c.getAttribute('TYPE') === 'ComboBox');
  if (!single || !range || !combo) throw new Error('선택지 연결을 확인하지 못했습니다.');
  const comparisons = combo.getAttribute('COMBO_ITEM').split('/');
  if (comparisons.join('/') !== '이상/이하') throw new Error('비교 방식 확인이 필요합니다.');
  return { broker, source: source.file + '#' + source.tag, hasRadio: true, comparisons,
    defaultMode: single.getAttribute('CHECKED') === '1' ? 'single' : 'range',
    modes: [
      { id: 'single', label: '단일 금액', template: clean(node.getAttribute('COMPLETE_INDEX_NAME')), fields: [field('C2', single.getAttribute('TOP_LINE'))] },
      { id: 'range', label: '범위', template: clean(node.getAttribute('COMPLETE_INDEX_NAME2')), fields: [field('C2', 'G1_2'), field('C3', 'G1_2')] },
    ],
  };
}
function loadAmountSettings(broker) {
  if (!cache.has(broker)) cache.set(broker, (async () => {
    const response = await fetch((process.env.PUBLIC_URL || '') + SOURCES[broker].file);
    if (!response.ok) throw new Error('원본 설정을 불러오지 못했습니다.');
    return parseAmountSettings(new TextDecoder('euc-kr').decode(await response.arrayBuffer()), broker);
  })().catch(error => { cache.delete(broker); throw error; }));
  return cache.get(broker);
}
function readAmountValues(schema, detail) {
  const text = String(detail || '').replace(/,/g, '').trim();
  for (const mode of schema.modes) {
    const tokens = mode.template.split(/\((C1|C2|C3|T2)\)/g);
    const escaped = tokens.map((token, i) => i % 2 ? token === 'T2' ? '(이상|이하)' : '(\\d+)' : token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s*')).join('');
    const match = text.match(new RegExp('^' + escaped + '$'));
    if (match) {
      const values = {}; tokens.filter((_, i) => i % 2).forEach((key, i) => { values[key] = match[i + 1]; });
      return { mode: mode.id, values, recognized: true };
    }
  }
  return { mode: schema.defaultMode, values: {}, recognized: false };
}
function buildAmountDetail(schema, modeId, values) {
  const mode = schema.modes.find(mode => mode.id === modeId);
  if (!mode) return { error: '검색 방식을 선택해 주세요.' };
  for (const field of mode.fields) {
    const value = String(values[field.key] ?? '');
    if (!/^\d+$/.test(value) || !Number.isFinite(Number(value))) return { error: '0 이상의 정수를 입력해 주세요.' };
  }
  if (mode.id === 'range' && Number(values.C2) > Number(values.C3)) return { error: '최대 금액은 최소 금액 이상이어야 합니다.' };
  if (mode.template.includes('(T2)') && !schema.comparisons.includes(values.T2)) return { error: '이상 또는 이하를 선택해 주세요.' };
  return { detail: formatConditionDetail(mode.template.replace(/\((C1|C2|C3|T2)\)/g, (_, key) => values[key])) };
}
module.exports = { supportsAmountSettings, parseAmountSettings, loadAmountSettings, readAmountValues, buildAmountDetail };