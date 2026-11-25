// Browser-only adapter: the same operator and output UI works without Electron.
// The desktop preload defines window.presenter first, so this never replaces it.
if (!window.presenter) {
  const storageKey = 'worship-presenter-demo-v1';
  const sampleLyrics = `[Verse 1]\nAmazing grace, how sweet the sound\nThat saved a wretch like me\nI once was lost, but now am found\nWas blind, but now I see\n\n[Verse 2]\n'Twas grace that taught my heart to fear\nAnd grace my fears relieved\nHow precious did that grace appear\nThe hour I first believed`;
  const sampleSections = [
    { id: 'section-0', name: 'Verse 1', slides: [{ lines: ['Amazing grace, how sweet the sound', 'That saved a wretch like me'] }, { lines: ['I once was lost, but now am found', 'Was blind, but now I see'] }] },
    { id: 'section-1', name: 'Verse 2', slides: [{ lines: ["'Twas grace that taught my heart to fear", 'And grace my fears relieved'] }, { lines: ['How precious did that grace appear', 'The hour I first believed'] }] }
  ];
  const initial = () => ({ songs: [{ id: 'amazing-grace', title: 'Amazing Grace', source: sampleLyrics, sections: sampleSections }], setlist: [{ id: 'item-1', songId: 'amazing-grace', sequence: ['section-0', 'section-1'] }], activeItem: 0, activeSlide: 0, blackout: false, outputs: { congregation: null, stage: null } });
  const windows = {};
  let latest = null;
  const subscribers = new Set();
  window.addEventListener('message', event => {
    if (event.data?.type === 'worship-presentation') subscribers.forEach(fn => fn(event.data.payload));
    if (event.data?.type === 'worship-output-ready' && latest) event.source?.postMessage({ type: 'worship-presentation', payload: latest }, '*');
  });
  window.presenter = {
    getDisplayConfig: async () => { let clock; try { clock=JSON.parse(localStorage.getItem('worship-presenter-clock')); } catch {} return { config:{ assignments:{},restore:false,operatorFullscreen:false,clock:clock||{enabled:true,position:'right',size:3,format:'12',seconds:false}},resolved:{} }; },
    setStageClock: async clock => {localStorage.setItem('worship-presenter-clock',JSON.stringify(clock));return clock;},
    load: async () => { try { return JSON.parse(localStorage.getItem(storageKey)) || initial(); } catch { return initial(); } },
    save: async state => { localStorage.setItem(storageKey, JSON.stringify(state)); return true; },
    displays: async () => [{ id: 'demo', label: 'Browser demo · windowed output', primary: true }],
    openOutput: async role => {
      if (!['stage', 'congregation'].includes(role)) throw Error('Invalid role');
      if (windows[role] && !windows[role].closed) windows[role].focus();
      else windows[role] = window.open(`output.html?role=${role}`, `worship-${role}`, 'width=960,height=540');
      if (!windows[role]) alert('Allow pop-ups for this demo to open the output screen.');
      else setTimeout(() => { if (latest && !windows[role].closed) windows[role].postMessage({ type: 'worship-presentation', payload: latest }, '*'); }, 350);
      return Boolean(windows[role]);
    },
    closeOutput: async role => { windows[role]?.close(); return true; },
    sendPresentation: data => {
      latest = data;
      for (const output of Object.values(windows)) if (output && !output.closed) output.postMessage({ type: 'worship-presentation', payload: data }, '*');
    },
    onPresentation: callback => {
      subscribers.add(callback);
      if (window.opener) window.opener.postMessage({ type: 'worship-output-ready' }, '*');
      return () => subscribers.delete(callback);
    },
    onDisplaysChanged: () => () => {}
  };
}
