import { cacheRequest } from '../util/cacheRequest';
import { retryPolicy } from '../util/inquiryData';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getRecommendationCandidates } from '../util/conditionCandidateFilter';
import { cleanupInboxAnalyses, inquiryFingerprint, readInboxAnalysis, writeInboxAnalysis } from '../util/inboxAnalysisCache';
import { buildPreanalysisQueue, getResultStatus } from '../util/inboxPreanalysis';
import { summarizePreanalysis } from '../util/preanalysisProgress';
import { loadBrokerConditions, supportsBroker } from '../util/brokerConditions';

const RETRY_DELAY = 30000;

export function useInboxPreanalysis({ enabled, hasLoaded, inquiries, generateStrategy, getConditions = loadBrokerConditions }) {
  const [statuses, setStatuses] = useState({});
  const [revision, setRevision] = useState(0);
  const [paused, setPaused] = useState(false);
  const [issues, setIssues] = useState({});
  const [quotaWait, setQuotaWait] = useState(null);
  const [completionTimes, setCompletionTimes] = useState({});
  // A replacement effect waits for its predecessor, including lock release.
  const runRef = useRef(Promise.resolve());
  const remoteVerifiedRef = useRef(new Set());
  const pendingResultsRef = useRef(new Map());
  const failuresRef = useRef(new Map());
  const retryAfterRef = useRef(new Map());
  const quotaRetryAtRef = useRef(0);
  const generatorRef = useRef(generateStrategy);
  generatorRef.current = generateStrategy;
  const conditionsLoaderRef = useRef(getConditions);
  conditionsLoaderRef.current = getConditions;

  const setStatus = useCallback((inquiry, status) => {
    setStatuses((previous) => ({ ...previous, [`${inquiry.id}:${inquiryFingerprint(inquiry)}`]: status }));
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    let active = true;
    let pollTimer;
    try { cleanupInboxAnalyses(inquiries); } catch (error) { console.warn(error.message); }
    const next = {};
    inquiries.forEach((inquiry) => {
      if (inquiry.hasImageAttachment) next[`${inquiry.id}:${inquiryFingerprint(inquiry)}`] = 'attachment';
      else {
        const cached = readInboxAnalysis(inquiry);
        if (cached) next[`${inquiry.id}:${inquiryFingerprint(inquiry)}`] = getResultStatus(cached.result);
      }
    });
    setStatuses((previous) => ({ ...previous, ...next }));
    if (enabled) {
      const hydrateSharedResults = async () => {
        // Cleanup is run once when the list changes; polling only reads cached results.
        const analyzable = inquiries.filter((inquiry) => !inquiry.hasImageAttachment);
        // The shared API accepts at most 100 inquiries per request.
        for (let offset = 0; active && offset < analyzable.length; offset += 100) {
          const batch = analyzable.slice(offset, offset + 100);
          try {
            const shared = await cacheRequest({ action: 'get_many', inquiries: batch.map((inquiry) => ({
              id: inquiry.id, fingerprint: inquiryFingerprint(inquiry),
            })) });
            if (!active) return;
            const hydratedStatuses = {};
            batch.forEach((inquiry) => {
              const result = shared.results?.[String(inquiry.id)];
              if (!result) return;
              const key = `${inquiry.id}:${inquiryFingerprint(inquiry)}`;
              remoteVerifiedRef.current.add(key);
              pendingResultsRef.current.delete(key);
              try { writeInboxAnalysis(inquiry, result); } catch (error) { console.warn(error.message); }
              hydratedStatuses[key] = getResultStatus(result);
            });
            setStatuses((previous) => ({ ...previous, ...hydratedStatuses }));
          } catch (error) {
            console.warn(error.message);
            if (error.status === 429) break;
          }
        }
      };
      cacheRequest({ action: 'sync' }).catch((error) => console.warn(error.message));
      const poll = async () => { await hydrateSharedResults(); if (active) pollTimer = setTimeout(poll, 60000); };
      poll();
    }
    return () => { active = false; clearTimeout(pollTimer); };
  }, [enabled, hasLoaded, inquiries]);

  useEffect(() => {
    if (!enabled || paused || !hasLoaded) return undefined;
    let active = true;
    let timer;
    const previousRun = runRef.current;
    const run = async () => {
      await previousRun;
      if (!active) return;
      if (Date.now() >= quotaRetryAtRef.current) setQuotaWait(null);
      try {
        const queue = buildPreanalysisQueue({ inquiries: inquiries.filter((inquiry) => supportsBroker(inquiry.broker)), verifiedKeys: remoteVerifiedRef.current });
        for (const inquiry of queue) {
          if (!active || Date.now() < quotaRetryAtRef.current) break;
          const fingerprint = inquiryFingerprint(inquiry);
          const key = `${inquiry.id}:${fingerprint}`;
          if (remoteVerifiedRef.current.has(key) || Date.now() < (retryAfterRef.current.get(key) || 0)) continue;
          let claim;
          let stored = false;
          try {
            let result = pendingResultsRef.current.get(key) || readInboxAnalysis(inquiry)?.result;
            claim = await cacheRequest({ action: 'claim', inquiryId: inquiry.id, fingerprint });
            if (!active) continue;
            if (claim.status === 'ready') {
              remoteVerifiedRef.current.add(key);
              pendingResultsRef.current.delete(key);
              try { writeInboxAnalysis(inquiry, claim.result); } catch (error) { console.warn(error.message); }
              setStatus(inquiry, getResultStatus(claim.result));
              continue;
            }
            if (claim.status === 'limit_reached') {
              const error = new Error('공용 캐시 한도에 도달했습니다.');
              error.status = 429;
              throw error;
            }
            if (claim.status === 'deferred') {
              retryAfterRef.current.set(key, claim.permanent ? Infinity : claim.retryAt);
              setStatus(inquiry, 'failed');
              setIssues((previous) => ({ ...previous, [key]: { reason: claim.permanent ? '서버 설정 확인이 필요합니다.' : '서버에서 재시도를 기다리고 있습니다.', retryAt: claim.permanent ? null : claim.retryAt } }));
              continue;
            }
            if (claim.status === 'analyzing') {
              setStatus(inquiry, 'waiting_remote');
              retryAfterRef.current.set(key, Date.now() + RETRY_DELAY);
              continue;
            }
            if (!claim.claimToken) throw new Error('공용 캐시 분석 권한을 얻지 못했습니다.');
            result = claim.pendingResult || result;
            if (!result) {
              setStatus(inquiry, 'loading_conditions');
              const brokerConditions = await conditionsLoaderRef.current(inquiry.broker);
              if (!brokerConditions?.length) throw new Error('증권사 조건을 불러오지 못했습니다.');
              if (!active || remoteVerifiedRef.current.has(key)) continue;
              setStatus(inquiry, 'analyzing');
              const candidates = getRecommendationCandidates(inquiry.query, brokerConditions);
              result = await generatorRef.current(inquiry.query, candidates, inquiry.broker, null, { background: true });
              if (!result) throw new Error('AI 분석 결과를 받지 못했습니다.');
            }
            // Retain generated results even when the effect was replaced or storage fails.
            pendingResultsRef.current.set(key, result);
            try { writeInboxAnalysis(inquiry, result); } catch (error) { console.warn(error.message); }
            if (!active) continue;
            setStatus(inquiry, 'storing');
            await cacheRequest({ action: 'store', inquiryId: inquiry.id, fingerprint, claimToken: claim.claimToken, result });
            stored = true;
            remoteVerifiedRef.current.add(key);
            pendingResultsRef.current.delete(key);
            retryAfterRef.current.delete(key);
            failuresRef.current.delete(key);
            if (active) {
              setStatus(inquiry, getResultStatus(result));
              setCompletionTimes((previous) => ({ ...previous, [inquiry.broker]: Date.now() }));
              setIssues((previous) => { const next = { ...previous }; delete next[key]; return next; });
            }
          } catch (error) {
            console.warn(`미답변 문의 ${inquiry.id} 사전 분석 실패:`, error.message);
            const failures = (failuresRef.current.get(key) || 0) + 1;
            failuresRef.current.set(key, failures);
            const { delay, permanent } = retryPolicy(error, failures);
            retryAfterRef.current.set(key, permanent ? Infinity : Date.now() + delay);
            if (error.status === 429) quotaRetryAtRef.current = Date.now() + delay;
            if (active) {
              const reason = permanent ? '요청 또는 서버 설정 확인이 필요합니다.' : error.status === 429 ? error.isDailyLimit ? '오늘의 AI 분석 요청 한도에 도달했습니다. 남은 문의는 한도 갱신 후 재시도합니다.' : error.limitSource === 'application' ? '다른 분석을 기다리고 있습니다. 잠시 후 자동 재시도합니다.' : 'AI 요청 제한으로 대기 중입니다. 잠시 후 자동 재시도합니다.'
                : pendingResultsRef.current.has(key) ? '분석은 끝났지만 공용 저장소에 저장하지 못했습니다.'
                  : error.name === 'AbortError' ? '요청 시간이 초과되었습니다.' : '분석 요청에 실패했습니다.';
              setIssues((previous) => ({ ...previous, [key]: { reason, retryAt: permanent ? null : Date.now() + delay } }));
              if (error.status === 429) setQuotaWait({ reason, retryAt: quotaRetryAtRef.current });
              setStatus(inquiry, pendingResultsRef.current.has(key) ? 'save_pending' : error.status === 429 ? 'limit_reached' : 'failed');
            }
          } finally {
            if (!active) setStatus(inquiry, pendingResultsRef.current.has(key) ? 'save_pending' : 'queued');
            if (claim?.claimToken && !stored) {
              try { await cacheRequest({ action: 'release', inquiryId: inquiry.id, fingerprint, claimToken: claim.claimToken }); }
              catch (error) { console.warn(error.message); }
            }
          }
        }
      } finally {
        // Retry pending work after errors and expired locks without requiring a reload.
        if (active) timer = setTimeout(() => setRevision((value) => value + 1), Math.max(RETRY_DELAY, quotaRetryAtRef.current - Date.now()));
      }
    };
    runRef.current = run().catch((error) => console.warn(error.message));
    return () => { active = false; clearTimeout(timer); };
  }, [enabled, hasLoaded, inquiries, paused, revision, setStatus]);

  const getStatus = useCallback((inquiry) => {
    if (inquiry.hasImageAttachment) return 'attachment';
    if (!supportsBroker(inquiry.broker)) return 'unsupported';
    const key = `${inquiry.id}:${inquiryFingerprint(inquiry)}`;
    const status = statuses[key];
    const cached = readInboxAnalysis(inquiry);
    if (remoteVerifiedRef.current.has(key)) return cached ? getResultStatus(cached.result) : ['ready', 'needs_confirmation', 'no_result'].includes(status) ? status : 'ready';
    if (['loading_conditions', 'analyzing', 'storing'].includes(status)) return status;
    if (pendingResultsRef.current.has(key) || cached) return 'save_pending';
    return status || 'queued';
  }, [statuses]);

  const getAnalysisDetail = useCallback((inquiry) => (
    issues[`${inquiry.id}:${inquiryFingerprint(inquiry)}`] || null
  ), [issues]);
  const retryFailed = useCallback(async () => {
    await Promise.all(inquiries.map(async (inquiry) => {
      const key = `${inquiry.id}:${inquiryFingerprint(inquiry)}`;
      if (!issues[key]) return;
      try { await cacheRequest({action:'retry', inquiryId:inquiry.id, fingerprint:inquiryFingerprint(inquiry)}); } catch (error) { console.warn(error.message); return; }
      retryAfterRef.current.delete(key);
      failuresRef.current.delete(key);
    }));
    setRevision((value) => value + 1);
  }, [inquiries, issues]);
  const counts = summarizePreanalysis(inquiries, null, getStatus);
  const currentInquiry = inquiries.find((inquiry) => ['loading_conditions', 'analyzing', 'storing'].includes(getStatus(inquiry)));
  const phase = !hasLoaded ? 'loading' : paused ? 'paused'
    : quotaWait && quotaWait.retryAt > Date.now() ? 'quota_wait'
      : !counts.total ? 'empty'
        : counts.processed === counts.total ? 'complete'
          : counts.analyzing || currentInquiry ? 'running' : counts.saving ? 'saving'
            : counts.retrying ? 'retry_wait' : 'queued';
  const progress = { ...counts, phase, paused, currentInquiry, quotaWait, lastCompletedAt: Math.max(0, ...Object.values(completionTimes)) || null };

  const getCachedAnalysis = useCallback((inquiry) => (
    inquiry?.hasImageAttachment ? null : readInboxAnalysis(inquiry)
  ), []);

  return { getStatus, getCachedAnalysis, getAnalysisDetail, progress, togglePaused: () => setPaused((value) => !value), retryFailed };
}
