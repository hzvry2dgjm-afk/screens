const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { makeInitialState } = require('../model');

test('operator boots, creates scripture, separates libraries and edits slides', async () => {
  const root = path.join(__dirname, '..');
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), { url: 'http://localhost/', runScripts: 'outside-only' });
  const w = dom.window;
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.HTMLCanvasElement.prototype.getContext = () => ({ measureText: value => ({ width: value.length * 12 }), set font(_value) {} });
  Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { get() { return 440; } });
  Object.defineProperty(w.HTMLElement.prototype, 'clientHeight', { get() { return 250; } });
  w.crypto.randomUUID = () => Math.random().toString(36).slice(2);
  w.confirm = () => true;
  let saved;
  w.presenter = {
    load: async () => makeInitialState(), save: async state => { saved = JSON.parse(JSON.stringify(state)); return true; },
    displays: async () => [], sendPresentation: () => {}, onDisplaysChanged: () => {}, onPresentation: () => {}
  };
  for (const script of ['paginate.js', 'fit.js', 'transfer.js', 'renderer.js']) w.eval(fs.readFileSync(path.join(root, script), 'utf8'));
  const $ = id => w.document.getElementById(id);
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal($('activeTitle').textContent, 'Amazing Grace');
  $('scriptureButton').click();
  $('scriptureReference').value = 'John 6:60–61';
  $('scriptureText').value = '60 The first verse.\n61 The second verse.';
  $('saveScriptureButton').click();
  assert.match($('setlist').textContent, /John 6:60–61/);
  $('libraryButton').click();
  assert.doesNotMatch($('libraryList').textContent, /John 6:60–61/);
  $('libraryDialog').close();
  $('slidesLibraryButton').click();
  assert.match($('slidesLibraryList').textContent, /John 6:60–61/);
  $('slidesLibraryDialog').close();
  $('editSlidesButton').click();
  assert.equal($('editorSlideList').children.length, 1);
  $('editorText').value = 'Edited verse';
  $('editorText').dispatchEvent(new w.Event('input', { bubbles: true }));
  assert.match($('editorPreview').textContent, /Edited verse/);
  $('editorDuplicate').click();
  assert.equal($('editorSlideList').children.length, 2);
  $('editorDelete').click();
  assert.equal($('editorSlideList').children.length, 1);
  $('slideEditorDialog').close();
  $('announcementButton').click();
  $('customSlideTitle').value = 'Welcome';
  $('customSlideText').value = 'Welcome everyone!\n\nService begins soon';
  $('saveCustomSlideButton').click();
  assert.match($('setlist').textContent, /Welcome/);
  $('editSlidesButton').click();
  assert.equal($('editorSlideList').children.length, 2);
  await new Promise(resolve => setTimeout(resolve, 250));
  assert.ok(saved?.songs.some(song => song.type === 'scripture'));
  dom.window.close();
});

test('stage output shows only first upcoming line with next-section heading', () => {
  const root = path.join(__dirname, '..');
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'output.html'), 'utf8'), { url: 'http://localhost/output.html?role=stage', runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  let listener;
  w.presenter = { onPresentation: fn => { listener = fn; } };
  w.lyricFit = { render: (element, lines) => { element.textContent = lines.join(' / '); }, fit: () => {} };
  w.eval(fs.readFileSync(path.join(root, 'output.js'), 'utf8'));
  listener({ current: { lines: ['Current one', 'Current two'] }, next: { lines: ['Coming first', 'Coming second'] }, nextSection: 'Chorus', fonts: { stageNext: 5 }, blackout: false });
  assert.equal(w.document.getElementById('outputCurrent').textContent, 'Current one / Current two');
  assert.equal(w.document.getElementById('outputNext').textContent, 'Coming first');
  assert.equal(w.document.getElementById('nextSectionHeader').textContent, 'UP NEXT · CHORUS');
  assert.equal(w.document.getElementById('stageClock').hidden,false);
  listener({stageClock:{enabled:false}});
  assert.equal(w.document.getElementById('stageClock').hidden,true);
  dom.window.close();
});
