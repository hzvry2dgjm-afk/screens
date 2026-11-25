// Word-aware lyric/scripture pagination shared by the browser demo and tests.
function wrapAuthoredLines(lines, maxCharacters = 42) {
  const result = [];
  for (const original of lines) {
    const words = String(original).trim().split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      if (current && `${current} ${word}`.length > maxCharacters) {
        result.push(current);
        current = word;
      } else current = current ? `${current} ${word}` : word;
    }
    if (current) result.push(current);
  }
  return result;
}
function paginateText(lines, perSlide = 2, maxCharacters = 42) {
  const wrapped = wrapAuthoredLines(lines, maxCharacters);
  const count = Math.max(1, Math.min(2, Number(perSlide) || 2));
  return Array.from({ length: Math.ceil(wrapped.length / count) }, (_, index) => ({ lines: wrapped.slice(index * count, (index + 1) * count) }));
}
if (typeof module !== 'undefined') module.exports = { wrapAuthoredLines, paginateText };
if (typeof window !== 'undefined') window.textPagination = { wrapAuthoredLines, paginateText };
