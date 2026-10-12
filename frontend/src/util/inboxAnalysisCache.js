import { inquiryFingerprint } from './inquiryData';
const STORAGE_PREFIX = 'strategy-qna-preanalysis:v1:';
const CACHE_TTL = 3 * 24 * 60 * 60 * 1000;

export { inquiryFingerprint } from './inquiryData';

const storageKey = (id) => `${STORAGE_PREFIX}${id}`;

export function readInboxAnalysis(inquiry, storage = window.localStorage) {
  try {
    const raw = storage.getItem(storageKey(inquiry.id));
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const expired = !saved.savedAt || Date.now() - saved.savedAt > CACHE_TTL;
    if (expired || saved.fingerprint !== inquiryFingerprint(inquiry)) {
      storage.removeItem(storageKey(inquiry.id));
      return null;
    }
    return saved;
  } catch {
    return null;
  }
}

export function writeInboxAnalysis(inquiry, result, storage = window.localStorage) {
  const value = {
    inquiryId: String(inquiry.id),
    fingerprint: inquiryFingerprint(inquiry),
    savedAt: Date.now(),
    result,
  };
  storage.setItem(storageKey(inquiry.id), JSON.stringify(value));
  return value;
}

export function cleanupInboxAnalyses(inquiries, storage = window.localStorage) {
  const activeIds = new Set(inquiries.map((item) => String(item.id)));
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key?.startsWith(STORAGE_PREFIX)) continue;
    const id = key.slice(STORAGE_PREFIX.length);
    if (!activeIds.has(id)) storage.removeItem(key);
  }
}
