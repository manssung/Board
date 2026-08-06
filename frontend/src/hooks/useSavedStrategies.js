import { useState } from 'react';

export const SAVED_STRATEGIES_LIMIT = 20;
const STORAGE_KEY = 'strategy-qna-saved-strategies-v1';
const STRATEGY_TTL = 24 * 60 * 60 * 1000;

const getValidSavedStrategies = () => {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const saved = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    return Array.isArray(saved) ? saved.filter(item => item?.expiresAt > now) : [];
  } catch {
    return [];
  }
};

const persist = (items) => window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));

export const formatSavedStrategyTime = (timestamp) => new Intl.DateTimeFormat('ko-KR', {
  month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
}).format(new Date(timestamp));

export function useSavedStrategies() {
  const [savedStrategies, setSavedStrategies] = useState(getValidSavedStrategies);

  const saveStrategy = (strategy) => {
    const now = Date.now();
    const item = {
      ...strategy,
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      savedAt: now,
      expiresAt: now + STRATEGY_TTL,
    };
    const next = [item, ...savedStrategies.filter(saved => saved.expiresAt > now)].slice(0, SAVED_STRATEGIES_LIMIT);

    try {
      persist(next);
      setSavedStrategies(next);
      return true;
    } catch {
      return false;
    }
  };

  const deleteSavedStrategy = (id) => {
    const next = savedStrategies.filter(item => item.id !== id);

    try {
      persist(next);
      setSavedStrategies(next);
      return true;
    } catch {
      return false;
    }
  };

  return { savedStrategies, saveStrategy, deleteSavedStrategy };
}
