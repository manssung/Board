const CACHE_ENDPOINT = '/api/analysis-cache';

export async function cacheRequest(body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(CACHE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      // Keep the server's retry policy instead of treating every 429 as a daily limit.
      const data = await response.json().catch(() => ({}));
      const error = new Error(`공용 캐시 요청 실패: ${response.status}`);
      error.status = response.status;
      error.retryInSeconds = data?.retryInSeconds;
      error.isDailyLimit = data?.isDailyLimit;
      throw error;
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}
