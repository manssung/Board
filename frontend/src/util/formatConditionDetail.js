// Thousands separators belong to explicit quantities, never to arbitrary indicator numbers.
const PROTECTED = /\[[^\]\r\n]*\]|\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b|\b\d{2,3}-\d{3,4}-\d{4}\b|(?:종목코드|종목번호)\s*[:：]?\s*\d+/g;
const UNIT = '(?:(?:백만|천만|백억|천억|십억|백|천|만|억|조)?원|백만|(?:천|만|억)?주|%|퍼센트|배)';
const SUFFIX = new RegExp('^\\s*(' + UNIT + ')(?=$|\\s|[~,+.)]|이상|이하|초과|미만|부터|까지|대비|인|가|를|이고)');
const RANGE_SUFFIX = new RegExp('^\\s*~\\s*[+-]?\\d+(?:,\\d+)*(?:\\.\\d+)?\\s*(' + UNIT + ')(?=$|\\s|[~,+.)]|이상|이하|초과|미만|부터|까지)');
function mapQuantities(value, transform) {
  const text = String(value ?? '');
  const map = part => part.replace(/[+-]?\d+(?:,\d+)*(?:\.\d+)?/g, (number, offset) => {
    if (/[\w.]/.test(part[offset - 1] || '')) return number;
    const tail = part.slice(offset + number.length);
    const unit = tail.match(SUFFIX)?.[1] || tail.match(RANGE_SUFFIX)?.[1];
    if (!unit) return number;
    // 주 also means a week. Only treat it as shares with an explicit quantity context.
    if (unit.endsWith('주') && (/^\s*(?:천|만|억)?주\s*(?:이동평균|이평|평균|봉|전|후|기간|동안|이내|간)/.test(tail) || !/거래량|주식|수량|체결|잔량|매수|매도|보유|발행|유통/.test(part.slice(0, offset)))) return number;
    return transform(number);
  });
  let output = '', offset = 0;
  for (const match of text.matchAll(PROTECTED)) {
    output += map(text.slice(offset, match.index)) + match[0];
    offset = match.index + match[0].length;
  }
  return output + map(text.slice(offset));
}
function normalizeQuantitySeparators(value) {
  return mapQuantities(value, number => number.replace(/,/g, ''));
}
function formatConditionDetail(value) {
  return mapQuantities(value, number => {
    const [integer, fraction] = number.split('.');
    const digits = integer.replace(/,/g, '');
    if (/^[+-]?0\d/.test(digits)) return number;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
  });
}
module.exports = { formatConditionDetail, normalizeQuantitySeparators };