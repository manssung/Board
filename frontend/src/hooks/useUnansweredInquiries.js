import { useCallback, useEffect, useState } from 'react';
import { normalizeInquiry } from '../util/inquiryData';

// Local CRA development calls the board directly; production always uses Vercel.
const API_URL = process.env.NODE_ENV === 'development'
  ? (process.env.REACT_APP_QNA_API_URL || '/api/unanswered')
  : '/api/unanswered';
export { normalizeInquiry } from '../util/inquiryData';

export function useUnansweredInquiries(isOpen) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!isOpen) return undefined;
    let active = true;
    let controller;
    let timeout;
    let timer;
    let inFlight = false;
    const load = async () => {
      if (!active || inFlight || document.hidden) return;
      clearTimeout(timer);
      inFlight = true;
      controller = new AbortController();
      timeout = setTimeout(() => controller.abort(), 20000);
      setLoading(true);
      setError('');
      try {
        const response = await fetch(API_URL, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error('API 응답 오류');
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('API 형식 오류');
        if (active) {
          const normalized = rows.map(normalizeInquiry);
          setInquiries((previous) => JSON.stringify(previous) === JSON.stringify(normalized) ? previous : normalized);
          setLastUpdatedAt(new Date());
        }
      } catch (err) {
        if (active) setError('최신 문의를 조회하지 못했습니다. 잠시 후 새로고침해 주세요.');
      } finally {
        clearTimeout(timeout);
        inFlight = false;
        if (active) {
          setLoading(false);
          if (!document.hidden) timer = setTimeout(load, 60000);
        }
      }
    };
    load();
    const onVisibilityChange = () => {
      if (document.hidden) clearTimeout(timer);
      else load();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      clearTimeout(timeout);
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isOpen, revision]);
  return { inquiries, loading, error, refresh, lastUpdatedAt };
}
