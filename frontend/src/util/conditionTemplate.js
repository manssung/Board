const { normalizeQuantitySeparators } = require('./formatConditionDetail');
// Commas inside indicator brackets separate parameters, not thousands.
function splitTemplate(detail) {
  const text = normalizeQuantitySeparators(detail);
  const pattern = /[+-]?\d+(?:\.\d+)?/g;
  return { parts: text.split(pattern), values: text.match(pattern) || [] };
}

function applyTemplate(source, result) {
  if (!source || !String(source).trim()) return null;
  if (/\([A-Z][A-Z0-9_]*\)/.test(source)) return null;
  const template = splitTemplate(source);
  const proposed = splitTemplate(result.detail);
  const compact = (parts) => parts.map((part) => part.replace(/\s+/g, '')).join('\u0000');
  // Reject changes to units, operators, fields or captions, even with numericValues.
  if (typeof result.detail === 'string' && compact(template.parts) !== compact(proposed.parts)) return null;
  const values = Array.isArray(result.numericValues) ? result.numericValues : proposed.values;
  if (values.length !== template.values.length || values.some((value) => !/^[+-]?\d+(?:\.\d+)?$/.test(String(value)))) return null;
  const detail = template.parts.map((part, index) => part + (values[index] ?? '')).join('');
  const ranges = detail.matchAll(/([+-]?\d+(?:\.\d+)?)\s*([^\d~]*?)\s*~\s*([+-]?\d+(?:\.\d+)?)/g);
  for (const range of ranges) if (Number(range[1]) > Number(range[3])) return null;
  return detail;
}

module.exports = { splitTemplate, applyTemplate };
