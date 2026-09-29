import { formatInquiry } from './formatInquiry';

const NON_REQUIREMENT = /^(안녕하세요|감사합니다|문의드립니다|부탁드립니다|검색식 문의)/;

export function extractRequestItems(value, limit = 10) {
  const formatted = formatInquiry(value || '')
    .replace(/\s+(?=(?:\d{1,2}[.)]|[①-⑳])\s*)/g, '\n')
    .replace(/\?(?=(?:\d{1,2}[.)]|[가-힣]{2,12}\s*:))/g, '\n');
  const lines = formatted.split(/\n+/)
    .map((line) => line.replace(/^(?:[-•]|\d{1,2}[.)]|[①-⑳])\s*/, '').trim())
    .filter((line) => line.length >= 4 && !NON_REQUIREMENT.test(line));
  if (lines.length > 1) return lines.slice(0, limit);
  const sentences = formatted.split(/(?<=[?.!])\s+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 4 && !NON_REQUIREMENT.test(line));
  return (sentences.length ? sentences : lines).slice(0, limit);
}

export function createRequestChecklist(requestText, coverage = []) {
  if (coverage.length) return coverage.slice(0, 10).map((item, index) => ({
    id: `ai-${index}`,
    text: item.request.trim(),
    status: item.status === 'covered' ? 'covered' : 'pending',
    verified: false,
    mapped: [],
    reason: item.reason || '',
  }));
  return extractRequestItems(requestText).map((text, index) => ({ id: `manual-${index}`, text, status: 'pending', verified: false, mapped: [], reason: '' }));
}
