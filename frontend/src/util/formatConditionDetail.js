// Format quantities without changing indicator arguments, identifiers, or dates.
function formatConditionDetail(value) {
  const text = String(value ?? '');
  const protectedParts = /\[[^\]\r\n]*\]|\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b|\b\d{1,2}:\d{2}(?::\d{2})?\b|\b\d{2,3}-\d{3,4}-\d{4}\b|(?:종목코드|종목번호)\s*[:：]?\s*\d+/g;
  const formatNumbers = (part) => part.replace(/-?\d+(?:,\d+)*(?:\.\d+)?/g, (number, offset) => {
    const previous = part[offset - 1] || '';
    const next = part[offset + number.length] || '';
    if (/[\w.]/.test(previous) || /[A-Za-z_.]/.test(next)) return number;
    const [integer, fraction] = number.split('.');
    const digits = integer.replace(/,/g, '');
    // During editing, existing separators may no longer sit at three-digit boundaries.
    // Regroup the whole number, while leaving short comma-separated values alone.
    if (integer.includes(',') && digits.replace(/^-/, '').length < 4) return number;
    if (/^-?0\d/.test(digits)) return number;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return fraction === undefined ? grouped : `${grouped}.${fraction}`;
  });
  let output = '', offset = 0;
  for (const match of text.matchAll(protectedParts)) {
    output += formatNumbers(text.slice(offset, match.index)) + match[0];
    offset = match.index + match[0].length;
  }
  return output + formatNumbers(text.slice(offset));
}

module.exports = { formatConditionDetail };
