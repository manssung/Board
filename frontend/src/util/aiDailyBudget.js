// Gemini RPD resets at midnight America/Los_Angeles, including DST changes.
const DAILY_AI_REQUEST_LIMIT = 30;
const pacific = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Los_Angeles',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
function getAiQuotaWindow(now = Date.now()) {
  const parts = Object.fromEntries(pacific.formatToParts(new Date(now)).map(part => [part.type, part.value]));
  let resetAt = Date.UTC(Number(parts.year), Number(parts.month)-1, Number(parts.day)+1, 8);
  const resetHour = Number(pacific.formatToParts(new Date(resetAt)).find(part => part.type === 'hour').value);
  resetAt -= resetHour * 3600000;
  return {day:parts.year+'-'+parts.month+'-'+parts.day, resetAt};
}
module.exports = {DAILY_AI_REQUEST_LIMIT, getAiQuotaWindow};
