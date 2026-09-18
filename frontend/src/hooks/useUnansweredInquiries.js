import { useCallback, useEffect, useState } from 'react';

const API_URL = '/api/unanswered';
const BROKER_NAMES = { 신한: '신한증권', 카이로스: '미래에셋증권', '카이로스(W)': '미래에셋증권(해외)', NH: 'NH증권' , 교보 : '교보증권', KB : 'KB증권'  };

export function normalizeInquiry(row) {
  const company = String(row.company || '').trim();
  return {
    id: String(row.uid),
    broker: BROKER_NAMES[company] || company,
    title: String(row.subject || ''),
    author: String(row.name || ''),
    receivedAt: String(row.s_datetime || ''),
    query: String(row.comment || ''),
    hasImageAttachment: Number(row.file) > 0,
    isFollowUp: row.isFollowUp === true || String(row.isFollowUp) === '1',
  };
}

export function useUnansweredInquiries(isOpen) {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!isOpen) return undefined;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setLoading(true);
    setError('');
    setInquiries([]);
    (async () => {
      try {
        const response = await fetch(API_URL, { signal: controller.signal, cache: 'no-store', credentials: 'omit' });
        if (!response.ok) throw new Error('API 응답 오류');
        const rows = await response.json();
        if (!Array.isArray(rows)) throw new Error('API 형식 오류');
        if (active) setInquiries(rows.map(normalizeInquiry));
      } catch (err) {
        if (active) setError('미답변 문의를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.');
      } finally {
        clearTimeout(timeout);
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [isOpen, revision]);
  return { inquiries, loading, error, refresh };
}
