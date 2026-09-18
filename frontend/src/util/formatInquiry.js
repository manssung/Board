// Presentation only: keep the source query untouched for recommendation/copying.
export function formatInquiry(value) {
  let text = String(value || '').replace(/\r\n?/g, '\n');
  text = text
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<\/(?:p|div|li|ul|ol|tr|h[1-6])\s*>/gi, '\n')
    .replace(/<\/?(?:p|div|span|strong|b|em|i|u|font|a|ul|ol|table|tbody|tr|td|th|h[1-6])\b[^>]*>/gi, '');
  // Decode entities only, never insert untrusted markup into the live DOM.
  const decoder = document.createElement('textarea');
  text = text.replace(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/gi, (entity) => {
    decoder.innerHTML = entity;
    return decoder.value;
  });
  // Split prose, not decimal points, indicator parameters, or comparison signs.
  // Korean sentence endings also cover pasted text with no space after a period.
  text = text
    .replace(/((?:니다|세요|해요|돼요|네요|어요|아요|까요|지요)\.)[ \t]*(?=[^\s])/g, '$1\n')
    .replace(/([?!])[ \t]*(?=[가-힣A-Za-z])/g, '$1\n')
    .replace(/((?:습니다|입니다|주세요|하나요|인가요|까요|있어요|없어요|네요|더라고요|더라구요))[ \t]+(?=[가-힣A-Za-z0-9])/g, '$1\n')
    .replace(/([^\s\d.])[ \t]+(?=\d{1,2}[.)][ \t]+[^\d\s])/g, '$1\n')
    .replace(/([^\n])[ \t]+(?=[A-Z][ \t]*[:：][ \t]*\S)/g, '$1\n');
  return text.replace(/\u00a0/g, ' ')
    .split('\n').map((line) => line.replace(/[\t ]+/g, ' ').trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n').trim();
}
