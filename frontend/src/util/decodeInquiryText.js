// Decode entity tokens as text only; never render API content as HTML.
export function decodeInquiryText(value) {
  const decoder = document.createElement('textarea');
  return String(value ?? '').replace(/&(?:#\d+|#x[\da-f]+|[a-z][a-z\d]+);/gi, (entity) => {
    decoder.innerHTML = entity;
    return decoder.value;
  }).replace(/\u00ad/g, ''); // Invisible copy/paste hyphen; preserve real minus signs.
}
