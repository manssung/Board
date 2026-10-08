import { useCallback, useEffect, useRef, useState } from 'react';
import { getRecommendationCandidates } from '../util/conditionCandidateFilter';
import { cleanupInboxAnalyses, inquiryFingerprint, readInboxAnalysis, writeInboxAnalysis } from '../util/inboxAnalysisCache';
import { buildPreanalysisQueue, getResultStatus } from '../util/inboxPreanalysis';

const CACHE_ENDPOINT = '/api/analysis-cache';
const cacheRequest = async (body) => {
  const response = await fetch(CACHE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`공용 캐시 요청 실패: ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
};
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function useInboxPreanalysis({ enabled, hasLoaded, inquiries, selectedBroker, allConditions, generateStrategy }) {
  const [statuses, setStatuses] = useState({});
  const runningRef = useRef(false);
  const remoteVerifiedRef = useRef(new Set());
  const generatorRef = useRef(generateStrategy);
  generatorRef.current = generateStrategy;

  const setStatus = useCallback((id, status) => {
    setStatuses((previous) => ({ ...previous, [String(id)]: status }));
  }, []);

  useEffect(() => {
    if (!hasLoaded) return;
    let active = true;
    cleanupInboxAnalyses(inquiries);
    const next = {};
    inquiries.forEach((inquiry) => {
      if (inquiry.hasImageAttachment) {
        next[inquiry.id] = 'attachment';
        return;
      }
      const cached = readInboxAnalysis(inquiry);
      if (cached) next[inquiry.id] = getResultStatus(cached.result);
    });
    setStatuses((previous) => ({ ...previous, ...next }));
    if (enabled) {
      const hydrateSharedResults = async () => {
        try {
          await cacheRequest({ action: 'sync' });
          const analyzableInquiries = inquiries.filter((inquiry) => !inquiry.hasImageAttachment);
          const shared = await cacheRequest({
            action: 'get_many',
            inquiries: analyzableInquiries.map((inquiry) => ({
              id: inquiry.id,
              fingerprint: inquiryFingerprint(inquiry),
            })),
          });
          if (!active) return;
          const hydratedStatuses = {};
          analyzableInquiries.forEach((inquiry) => {
            const result = shared.results?.[String(inquiry.id)];
            if (!result) return;
            writeInboxAnalysis(inquiry, result);
            remoteVerifiedRef.current.add(`${inquiry.id}:${inquiryFingerprint(inquiry)}`);
            hydratedStatuses[inquiry.id] = getResultStatus(result);
          });
          setStatuses((previous) => ({ ...previous, ...hydratedStatuses }));
        } catch (error) {
          console.warn(error.message);
        }
      };
      hydrateSharedResults();
    }
    return () => { active = false; };
  }, [enabled, hasLoaded, inquiries]);

  useEffect(() => {
    if (!enabled || !selectedBroker || !allConditions.length || runningRef.current) return undefined;
    let active = true;
    const queue = buildPreanalysisQueue({
      inquiries,
      selectedBroker,
      verifiedKeys: remoteVerifiedRef.current,
    });
    if (!queue.length) return undefined;

    const run = async () => {
      runningRef.current = true;
      for (const inquiry of queue) {
        if (!active) break;
        const fingerprint = inquiryFingerprint(inquiry);
        const verificationKey = `${inquiry.id}:${fingerprint}`;
        const localCached = readInboxAnalysis(inquiry);
        let claim;
        try {
          claim = await cacheRequest({ action: 'claim', inquiryId: inquiry.id, fingerprint });
          for (let attempt = 0; claim.status === 'analyzing' && attempt < 10 && active; attempt += 1) {
            setStatus(inquiry.id, 'analyzing');
            await wait(1500);
            claim = await cacheRequest({ action: 'claim', inquiryId: inquiry.id, fingerprint });
          }
        } catch (error) {
          console.warn(error.message);
          claim = { status: error.status === 429 ? 'limit_reached' : 'unavailable' };
        }
        if (!active) break;
        if (claim.status === 'limit_reached') {
          setStatus(inquiry.id, 'limit_reached');
          break;
        }
        if (claim.status === 'ready') {
          writeInboxAnalysis(inquiry, claim.result);
          remoteVerifiedRef.current.add(verificationKey);
          setStatus(inquiry.id, getResultStatus(claim.result));
          continue;
        }
        if (claim.status === 'analyzing') {
          setStatus(inquiry.id, 'queued');
          continue;
        }
        if (localCached?.result && claim.claimToken) {
          try {
            await cacheRequest({ action: 'store', inquiryId: inquiry.id, fingerprint, claimToken: claim.claimToken, result: localCached.result });
            remoteVerifiedRef.current.add(verificationKey);
            setStatus(inquiry.id, getResultStatus(localCached.result));
            continue;
          } catch (error) {
            console.warn(error.message);
          }
        }
        setStatus(inquiry.id, 'analyzing');
        const candidates = getRecommendationCandidates(inquiry.query, allConditions);
        const result = await generatorRef.current(inquiry.query, candidates, inquiry.broker, null);
        if (!active) break;
        if (!result) {
          if (claim.claimToken) cacheRequest({ action: 'release', inquiryId: inquiry.id, fingerprint, claimToken: claim.claimToken }).catch(() => {});
          setStatus(inquiry.id, 'failed');
          break;
        }
        if (claim.claimToken) {
          try {
            await cacheRequest({ action: 'store', inquiryId: inquiry.id, fingerprint, claimToken: claim.claimToken, result });
            remoteVerifiedRef.current.add(verificationKey);
          } catch (error) {
            console.warn(error.message);
          }
        }
        writeInboxAnalysis(inquiry, result);
        setStatus(inquiry.id, getResultStatus(result));
      }
      runningRef.current = false;
    };
    queue.forEach((inquiry) => setStatus(inquiry.id, 'queued'));
    run();
    return () => { active = false; runningRef.current = false; };
  }, [allConditions, enabled, inquiries, selectedBroker, setStatus]);

  const getStatus = useCallback((inquiry) => {
    if (inquiry.hasImageAttachment) return 'attachment';
    const cached = readInboxAnalysis(inquiry);
    if (cached) return getResultStatus(cached.result);
    return statuses[String(inquiry.id)] || (inquiry.broker === selectedBroker ? 'queued' : 'idle');
  }, [selectedBroker, statuses]);

  const getCachedAnalysis = useCallback((inquiry) => (
    inquiry?.hasImageAttachment ? null : readInboxAnalysis(inquiry)
  ), []);

  return { getStatus, getCachedAnalysis };
}
