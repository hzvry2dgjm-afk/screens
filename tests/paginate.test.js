const test = require('node:test');
const assert = require('node:assert/strict');
const { wrapAuthoredLines, paginateText } = require('../paginate');

test('wraps long scripture into readable lines without losing words', () => {
  const original = '60 When many of his disciples heard it, they said, This is a hard saying; who can listen to it?';
  const lines = wrapAuthoredLines([original], 44);
  assert.ok(lines.length > 1);
  assert.ok(lines.every(line => line.length <= 44));
  assert.equal(lines.join(' '), original);
});

test('limits slides to at most two visual lyric lines', () => {
  const slides = paginateText(['A first long sentence that should naturally fit across multiple projected lines without losing any words at all.'], 2, 32);
  assert.ok(slides.length >= 2);
  assert.ok(slides.every(slide => slide.lines.length <= 2));
});
