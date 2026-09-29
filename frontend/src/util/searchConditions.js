// Same-indicator spellings only. Do not expand to related trading concepts.
export const CONDITION_ALIASES = [
  ['이동평균', '이평선', '이평'],
  ['볼린저밴드', '볼린저', '볼밴', 'bollinger'],
  ['macd', '맥디'],
  ['stochastics', 'stochastic', '스토캐스틱', '스토케스틱'],
  ['rsi', '알에스아이'],
  ['cci', '씨씨아이', '시시아이'],
  ['adx', '에이디엑스'],
  ['obv', '오비브이'],
  ['parabolic', '파라볼릭'],
  ['envelope', '엔벨로프'],
];

const normalize = (value) => String(value || '').toLowerCase().replace(/\s+/g, '');

export function searchConditions(conditions = [], query = '') {
  const needle = normalize(query);
  if (!needle) return conditions;
  const alternatives = new Set();
  CONDITION_ALIASES.forEach((group) => {
    // Longest matching alias avoids replacing 이평 inside 이평선.
    const alias = [...group].sort((a, b) => b.length - a.length).find((term) => {
      if (/^[a-z]+$/.test(term)) {
        return new RegExp(`(^|[^a-z])${term}(?![a-z])`).test(needle);
      }
      return needle.includes(term);
    });
    if (alias) group.forEach((term) => alternatives.add(needle.replace(alias, term)));
  });
  const direct = [];
  const expanded = [];
  conditions.forEach((condition) => {
    const fields = [condition?.path, condition?.detail, condition?.type].map(normalize);
    if (fields.some((field) => field.includes(needle))) direct.push(condition);
    else if ([...alternatives].some((term) => fields.some((field) => field.includes(term)))) expanded.push(condition);
  });
  return [...direct, ...expanded];
}
