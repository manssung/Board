// Server-only URL: never expose the upstream address in responses or logs.
module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: '허용되지 않는 요청입니다.' });
  }
  let url;
  try {
    url = new URL(process.env.QNA_API_URL);
    if (url.protocol !== 'https:') throw new Error('Invalid protocol');
  } catch {
    return res.status(503).json({ error: '문의 조회 서버 설정이 필요합니다.' });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Upstream failure');
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Invalid response');
    return res.status(200).json(rows.map((row) => ({
      uid: row.uid, company: row.company, subject: row.subject,
      name: row.name, s_datetime: row.s_datetime, comment: row.comment,
      file: row.file, isFollowUp: row.isFollowUp,
    })));
  } catch {
    return res.status(502).json({ error: '게시판 문의를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.' });
  } finally {
    clearTimeout(timeout);
  }
};
