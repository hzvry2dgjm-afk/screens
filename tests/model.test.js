const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSections, buildSlides, makeInitialState, presentation } = require('../model');
test('recognizes bracketed and plain headings and groups by two lines', () => {
  const sections = parseSections('[Verse 1]\nOne\nTwo\nThree\n\nChorus:\nFour\nFive');
  assert.deepEqual(sections.map(x => x.name), ['Verse 1', 'Chorus']);
  assert.deepEqual(sections[0].slides.map(x => x.lines), [['One', 'Two'], ['Three']]);
});
test('repeats sections in arrangement', () => {
  const sections = parseSections('[Verse 1]\nOne\n[Chorus]\nTwo');
  const slides = buildSlides({ sections }, ['section-0', 'section-1', 'section-1']);
  assert.deepEqual(slides.map(x => x.lines[0]), ['One', 'Two', 'Two']);
});
test('initial presentation includes current and next slides', () => {
  const p = presentation(makeInitialState());
  assert.equal(p.current.lines.length, 2);
  assert.ok(p.next);
});
