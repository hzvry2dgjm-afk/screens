const DEFAULT_SONG = `[Verse 1]
Amazing grace, how sweet the sound
That saved a wretch like me
I once was lost, but now am found
Was blind, but now I see

[Verse 2]
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed`;

function parseSections(input, linesPerSlide = 2) {
  const count = Math.max(1, Math.min(4, Number(linesPerSlide) || 2));
  const sections = [];
  let section = { name: 'Verse 1', lines: [] };
  const flush = () => { if (section.lines.length) sections.push(section); };
  for (const raw of String(input || '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const heading = line.match(/^\[([^\]]+)\]$/) || line.match(/^((?:verse|chorus|bridge|tag|intro|outro|pre[ -]?chorus|refrain|ending|instrumental)(?:\s*\d+|\s*[a-z])?)\s*:?$/i);
    if (heading) { flush(); section = { name: heading[1].trim(), lines: [] }; }
    else section.lines.push(line);
  }
  flush();
  return sections.map((s, index) => ({ id: `section-${index}`, name: s.name, slides: chunk(s.lines, count).map(lines => ({ lines })) }));
}

function chunk(items, length) {
  const result = [];
  for (let i = 0; i < items.length; i += length) result.push(items.slice(i, i + length));
  return result;
}

function buildSlides(song, sequence) {
  const order = sequence?.length ? sequence : song.sections.map(s => s.id);
  return order.flatMap(id => {
    const section = song.sections.find(s => s.id === id);
    return section ? section.slides.map((slide, i) => ({ id: `${id}-${i}-${Math.random().toString(36).slice(2, 7)}`, section: section.name, lines: slide.lines })) : [];
  });
}

function makeInitialState() {
  const sections = parseSections(DEFAULT_SONG);
  return {
    songs: [{ id: 'amazing-grace', title: 'Amazing Grace', source: DEFAULT_SONG, sections }],
    setlist: [{ id: 'item-1', songId: 'amazing-grace', sequence: sections.map(s => s.id) }],
    activeItem: 0, activeSlide: 0, blackout: false,
    hotkeys: { next: 'ArrowRight', previous: 'ArrowLeft', blackout: 'KeyB' },
    outputs: { congregation: null, stage: null }
  };
}

function presentation(state) {
  const item = state.setlist[state.activeItem];
  const song = item && state.songs.find(s => s.id === item.songId);
  const slides = song ? buildSlides(song, item.sequence) : [];
  const index = Math.max(0, Math.min(state.activeSlide, Math.max(0, slides.length - 1)));
  return { title: song?.title || 'No song selected', current: slides[index] || null, next: slides[index + 1] || null, slides, index, blackout: state.blackout };
}

module.exports = { parseSections, buildSlides, makeInitialState, presentation };
