let state;
let displayList = [];
let displayConfig = { assignments: {}, restore: true, operatorFullscreen: true, clock: { enabled:true, position:"right", size:3, format:"12", seconds:false } };
let creatingSong = false;
let editorIndex = 0;
let history = [], redoHistory = [], lastSnapshot = '', historyPaused = false;
const clone = value => JSON.parse(JSON.stringify(value));
function checkpoint() {
  if (historyPaused || !state) return;
  const snapshot = JSON.stringify(state);
  if (lastSnapshot && snapshot !== lastSnapshot) { history.push(lastSnapshot); if (history.length > 100) history.shift(); redoHistory = []; }
  lastSnapshot = snapshot;
}
function restoreHistory(stack, counterpart) {
  if (!stack.length) return;
  counterpart.push(JSON.stringify(state)); historyPaused = true;
  state = JSON.parse(stack.pop()); lastSnapshot = JSON.stringify(state);
  populateEditor(); update(false); historyPaused = false;
  if ($('slideEditorDialog').open) renderSlideEditor();
  window.presenter.save(state);
}
function moveArray(arr, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= arr.length || to >= arr.length || from === to) return false;
  const [item] = arr.splice(from, 1); arr.splice(to, 0, item); return true;
}
const $ = id => document.getElementById(id);
const parseSections = (input, count = 2) => {
  const sections = [];
  let current = { name: 'Verse 1', lines: [] };
  const flush = () => { if (current.lines.length) sections.push(current); };
  for (const raw of input.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^\[([^\]]+)\]$/) || line.match(/^((?:verse|chorus|bridge|tag|intro|outro|pre[ -]?chorus|refrain|ending|instrumental)(?:\s*\d+|\s*[a-z])?)\s*:?$/i);
    if (match) { flush(); current = { name: match[1].trim(), lines: [] }; }
    else current.lines.push(line);
  }
  flush();
  return sections.map((s, i) => ({ id: `section-${i}`, name: s.name, slides: window.textPagination.paginateText(s.lines, count, 42) }));
};
const activeSong = () => state.songs.find(s => s.id === state.setlist[state.activeItem]?.songId);
const allSlides = () => {
  const song = activeSong(), item = state.setlist[state.activeItem];
  const output = [];
  const appendExtras = key => {
    for (const extra of item?.customSlides || []) if (extra.after === key) {
      const slideKey = `custom:${extra.id}`;
      output.push({ section: extra.section, lines: item.slideOverrides?.[slideKey] || extra.lines, slideKey });
      appendExtras(slideKey);
    }
  };
  (item?.sequence || []).forEach((id, sectionIndex) => {
    const section = song?.sections.find(s => s.id === id);
    section?.slides.forEach((slide, slideIndex) => {
      const slideKey = `${sectionIndex}:${slideIndex}`;
      output.push({ ...slide, section: section.name, slideKey, lines: item.slideOverrides?.[slideKey] || slide.lines });
      appendExtras(slideKey);
    });
  });
  const ordered = item?.slideOrder || [];
  if (ordered.length) {
    const originalIndex = new Map(output.map((slide, index) => [slide.slideKey, index]));
    output.sort((a, b) => {
    const ai = ordered.indexOf(a.slideKey), bi = ordered.indexOf(b.slideKey);
    return (ai < 0 ? ordered.length + originalIndex.get(a.slideKey) : ai) - (bi < 0 ? ordered.length + originalIndex.get(b.slideKey) : bi);
    });
  }
  return output.filter(slide => !item?.deletedSlides?.includes(slide.slideKey));
};
const slides = () => allSlides().filter(slide => !state.setlist[state.activeItem]?.hiddenSlides?.includes(slide.slideKey));
const currentPresentation = () => {
  const all = slides();
  state.activeSlide = Math.max(0, Math.min(state.activeSlide, Math.max(0, all.length - 1)));
  return { title: activeSong()?.title || 'No song', current: all[state.activeSlide] || null, next: all[state.activeSlide + 1] || null, nextSection: all[state.activeSlide + 1]?.section || null, blackout: state.blackout };
};
let saveTimer;
function update(persist = true) {
  if (persist) checkpoint();
  const p = currentPresentation();
  $('activeTitle').textContent = p.title;
  $('slidePosition').textContent = p.current ? `${p.current.section} · Slide ${state.activeSlide + 1} of ${slides().length}` : 'No slides';
  window.lyricFit.render($('currentPreview'), p.blackout ? ['BLACKOUT'] : (p.current?.lines || ['No slide']), { caps: state.allCaps });
  window.lyricFit.render($('nextPreview'), p.blackout ? ['BLACKOUT'] : (p.next?.lines || ['End of song']), { caps: state.allCaps });
  $('capsButton').classList.toggle('selected', Boolean(state.allCaps));
  $('capsButton').setAttribute('aria-pressed', String(Boolean(state.allCaps)));
  $('flowTitle').textContent = p.title;
  $('blackoutButton').classList.toggle('active', state.blackout);
  $('blackoutButton').textContent = state.blackout ? '● Restore screens (B)' : '● Blackout (B)';
  $('setlist').replaceChildren(...state.setlist.map((item, i) => {
    if (item.type === 'divider') {
      const wrapper = document.createElement('div'); wrapper.className = 'service-divider';
      const label = document.createElement('span'); label.textContent = item.title || 'Section';
      const edit = document.createElement('button'); edit.textContent = '✎'; edit.title = 'Rename divider';
      edit.onclick = () => { const title = prompt('Divider title', item.title); if (title?.trim()) { item.title = title.trim(); update(); } };
      const remove = document.createElement('button'); remove.textContent = '×'; remove.title = 'Remove divider';
      remove.onclick = () => { state.setlist.splice(i, 1); if (i < state.activeItem) state.activeItem--; update(); };
      wrapper.append(label, edit, remove); attachServiceDrag(wrapper, i); return wrapper;
    }
    const button = document.createElement('button');
    button.className = `setlist-item ${i === state.activeItem ? 'active' : ''}`;
    const title = document.createElement('strong'), subtitle = document.createElement('span');
    title.textContent = state.songs.find(s => s.id === item.songId)?.title || 'Missing song';
    const itemSong = state.songs.find(s => s.id === item.songId);
    subtitle.textContent = `${i + 1} · ${itemSong?.type === 'custom' ? 'Announcement / Slide' : itemSong?.type === 'scripture' ? 'Scripture' : 'Song'}`;
    button.append(title, subtitle);
    button.onclick = () => { state.activeItem = i; state.activeSlide = 0; populateEditor(); update(); };
    attachServiceDrag(button, i);
    return button;
  }));
  $('slideGrid').replaceChildren(...allSlides().map((slide, i) => {
    const item = state.setlist[state.activeItem];
    const hidden = Boolean(item?.hiddenSlides?.includes(slide.slideKey));
    const activeIndex = slides().findIndex(s => s.slideKey === slide.slideKey);
    const card = document.createElement('div');
    card.className = `slide-card ${groupClass(slide.section)} ${activeIndex === state.activeSlide && !hidden ? 'active' : ''} ${hidden ? 'hidden-slide' : ''}`;
    const preview = document.createElement('div'), meta = document.createElement('div');
    preview.className = 'mini-screen';
    window.lyricFit.render(preview, slide.lines, { caps: state.allCaps });
    meta.className = 'meta';
    const name = document.createElement('span'), number = document.createElement('span');
    name.textContent = slide.section; number.textContent = `${i + 1}`;
    const hide = document.createElement('button');
    hide.className = 'hide-slide'; hide.textContent = hidden ? '◉' : '◌';
    hide.title = hidden ? 'Show this slide' : 'Hide this slide from presentation';
    hide.setAttribute('aria-label', hide.title);
    hide.onclick = event => { event.stopPropagation(); item.hiddenSlides ||= []; if (hidden) item.hiddenSlides = item.hiddenSlides.filter(key => key !== slide.slideKey); else item.hiddenSlides.push(slide.slideKey); state.activeSlide = 0; update(); };
    meta.append(name, number, hide); card.append(preview, meta);
    card.onclick = () => { if (hidden) return; state.activeSlide = activeIndex; update(); };
    return card;
  }));
  document.querySelectorAll('.mini-screen').forEach(el => window.lyricFit.fit(el));
  renderArrangement();
  window.presenter.sendPresentation({ ...p, allCaps: Boolean(state.allCaps), fonts: state.fonts || {}, stageClock: displayConfig.clock });
  if (persist) {
    $('saveStatus').textContent = 'Saving…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => { try { await window.presenter.save(state); $('saveStatus').textContent = 'Saved locally'; } catch { $('saveStatus').textContent = 'Save failed'; } }, 180);
  }
}
function populateEditor() {
  const song = activeSong();
  $('songTitle').value = song?.title || '';
  $('lyricsInput').value = song?.source || '';
}
function renderArrangement() {
  const song = activeSong(), item = state.setlist[state.activeItem];
  $('editSongButton').textContent = song?.type === 'scripture' ? '✎ Edit scripture' : '✎ Edit current song';
  $('sectionPalette').replaceChildren(...(song?.sections || []).map(section => {
    const button = document.createElement('button'); button.className = `chip ${groupClass(section.name)}`; button.textContent = `＋ ${section.name}`;
    button.onclick = () => { item.sequence.push(section.id); update(); }; return button;
  }));
  $('sequence').replaceChildren(...(item?.sequence || []).map((id, i) => {
    const el = document.createElement('div'); el.className = `sequence-item ${groupClass(song?.sections.find(s => s.id === id)?.name)}`; el.draggable = true;
    el.append(document.createTextNode(song?.sections.find(s => s.id === id)?.name || id));
    const remove = document.createElement('button'); remove.textContent = '×'; remove.title = 'Remove occurrence';
    remove.onclick = () => { item.sequence.splice(i, 1); update(); }; el.append(remove);
    el.onclick = event => { if (event.target === remove) return; const first = item.sequence.slice(0, i).reduce((sum, sectionId) => sum + (song?.sections.find(s => s.id === sectionId)?.slides.length || 0), 0); state.activeSlide = first; update(); };
    el.ondragstart = event => { event.dataTransfer.setData('text/plain', String(i)); el.classList.add('dragging'); };
    el.ondragend = () => el.classList.remove('dragging');
    el.ondragover = event => { event.preventDefault(); el.classList.add('over'); };
    el.ondragleave = () => el.classList.remove('over');
    el.ondrop = event => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from) && from >= 0 && from < item.sequence.length) { const [moved] = item.sequence.splice(from, 1); item.sequence.splice(i, 0, moved); update(); } };
    return el;
  }));
}
function groupClass(name = '') {
  if (/^verse/i.test(name)) return 'group-verse';
  if (/chorus|refrain/i.test(name)) return 'group-chorus';
  if (/bridge/i.test(name)) return 'group-bridge';
  return 'group-other';
}
function attachServiceDrag(element, index) {
  element.draggable = true;
  element.title = `${element.title ? `${element.title} · ` : ''}Drag to reorder service`;
  element.ondragstart = event => { event.dataTransfer.setData('application/x-service-index', String(index)); element.classList.add('dragging'); };
  element.ondragend = () => element.classList.remove('dragging');
  element.ondragover = event => { if (event.dataTransfer.types.includes('application/x-service-index')) { event.preventDefault(); element.classList.add('drop-target'); } };
  element.ondragleave = () => element.classList.remove('drop-target');
  element.ondrop = event => {
    event.preventDefault(); element.classList.remove('drop-target');
    const from = Number(event.dataTransfer.getData('application/x-service-index'));
    const selectedId = state.setlist[state.activeItem]?.id;
    if (moveArray(state.setlist, from, index)) { state.activeItem = state.setlist.findIndex(item => item.id === selectedId); update(); }
  };
}
function confirmLibraryDeletion(song) {
  const uses = state.setlist.filter(item => item.songId === song.id).length;
  const savedUses = (state.services || []).reduce((total, service) => total + service.setlist.filter(item => item.songId === song.id).length, 0);
  if (!confirm(`Delete “${song.title}” from its library? It is used ${uses} time(s) in the current service and ${savedUses} time(s) in saved services.`)) return;
  if (!confirm(`SECOND CONFIRMATION: Permanently remove “${song.title}” and all its service occurrences?`)) return;
  state.songs = state.songs.filter(entry => entry.id !== song.id);
  const selectedId = state.setlist[state.activeItem]?.id;
  state.setlist = state.setlist.filter(item => item.songId !== song.id);
  for (const service of state.services || []) { service.setlist = service.setlist.filter(item => item.songId !== song.id); service.songs = (service.songs || []).filter(entry => entry.id !== song.id); }
  state.activeItem = Math.max(0, state.setlist.findIndex(item => item.id === selectedId));
  if (state.setlist[state.activeItem]?.type === 'divider') state.activeItem = state.setlist.findIndex(item => item.songId);
  state.activeSlide = 0; update(); renderLibrary('song'); renderLibrary('slides');
}
function renderSlideEditor() {
  const list = allSlides();
  editorIndex = Math.max(0, Math.min(editorIndex, list.length - 1));
  const selected = list[editorIndex];
  $('slideEditorTitle').textContent = `Edit Slides · ${activeSong()?.title || 'Service item'}`;
  $('editorSlideLabel').textContent = selected ? `${selected.section.toUpperCase()} · SLIDE ${editorIndex + 1} OF ${list.length}` : 'NO SLIDES';
  $('editorText').value = selected?.lines.join('\n') || '';
  $('editorNotes').value = selected ? state.setlist[state.activeItem]?.slideNotes?.[selected.slideKey] || '' : '';
  $('editorPrevious').disabled = editorIndex === 0;
  $('editorNext').disabled = editorIndex >= list.length - 1;
  window.lyricFit.render($('editorPreview'), selected?.lines || ['No slide'], { caps: state.allCaps });
  $('editorSlideList').replaceChildren(...list.map((slide, index) => {
    const button = document.createElement('button');
    button.className = `editor-slide-item ${groupClass(slide.section)} ${index === editorIndex ? 'selected' : ''}`;
    const heading = document.createElement('strong'); heading.textContent = `${index + 1} · ${slide.section}`;
    const excerpt = document.createElement('span'); excerpt.textContent = slide.lines.join(' / ');
    button.append(heading, excerpt);
    button.onclick = () => { editorIndex = index; renderSlideEditor(); };
    button.draggable = true;
    button.ondragstart = event => event.dataTransfer.setData('application/x-slide-index', String(index));
    button.ondragover = event => { event.preventDefault(); button.classList.add('drop-target'); };
    button.ondragleave = () => button.classList.remove('drop-target');
    button.ondrop = event => {
      event.preventDefault(); button.classList.remove('drop-target');
      const from = Number(event.dataTransfer.getData('application/x-slide-index'));
      const keys = allSlides().map(x => x.slideKey);
      if (moveArray(keys, from, index)) { state.setlist[state.activeItem].slideOrder = keys; editorIndex = index; update(); renderSlideEditor(); }
    };
    return button;
  }));
  $('editorSlideList').querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
}
function openSlideEditor() {
  editorIndex = Math.max(0, allSlides().findIndex(slide => slide.slideKey === slides()[state.activeSlide]?.slideKey));
  $('slideEditorDialog').showModal();
  renderSlideEditor();
}
function navigate(delta) {
  if (!state) return;
  const last = slides().length - 1;
  if (delta > 0 && state.activeSlide >= last && state.activeItem < state.setlist.length - 1) {
    const nextIndex = state.setlist.findIndex((item, i) => i > state.activeItem && item.type !== 'divider');
    if (nextIndex >= 0) { state.activeItem = nextIndex; state.activeSlide = 0; populateEditor(); }
  }
  else if (delta < 0 && state.activeSlide === 0 && state.activeItem > 0) {
    let previousIndex = -1;
    state.setlist.forEach((item, i) => { if (i < state.activeItem && item.type !== 'divider') previousIndex = i; });
    if (previousIndex >= 0) { state.activeItem = previousIndex; state.activeSlide = Math.max(0, slides().length - 1); populateEditor(); }
  }
  else state.activeSlide = Math.max(0, Math.min(last, state.activeSlide + delta));
  update();
}
async function refreshDisplays() {
  displayList = await window.presenter.displays();
  const result = window.presenter.getDisplayConfig ? await window.presenter.getDisplayConfig() : {config:displayConfig,resolved:{}};
  displayConfig = result.config;
  for (const role of ['operator','stage','congregation']) {
    const select = $(`${role}Display`); select.replaceChildren();
    const off = document.createElement('option'); off.value=''; off.textContent=role==='operator'?'Primary display':'Disabled'; select.append(off);
    displayList.forEach((d,i)=>{const o=document.createElement('option');o.value=d.id;o.textContent=`${i+1} · ${d.label}${d.primary?' · Primary':''}`;select.append(o);});
    const saved=displayConfig.assignments[role];
    if(saved && !result.resolved[role] && !displayList.some(d=>d.id===saved.id)) { const o=document.createElement('option');o.value=saved.id;o.textContent=`Missing · ${saved.name||saved.id}`;select.append(o); }
    select.value=result.resolved[role] || saved?.id || '';
  }
  $('restoreDisplays').checked=displayConfig.restore; $('operatorFullscreen').checked=displayConfig.operatorFullscreen;
  const c=displayConfig.clock; $('clockEnabled').checked=c.enabled; $('clockSeconds').checked=c.seconds; $('clockPosition').value=c.position; $('clockFormat').value=c.format; $('clockSize').value=c.size;
  $('displayStatus').textContent=window.presenter.desktop ? `${displayList.length} display(s) detected. ${['operator','stage','congregation'].filter(r=>displayConfig.assignments[r]&&!result.resolved[r]).map(r=>r+' missing').join(' · ')}` : 'Browser demo: use windowed previews. Physical screen assignments require the Mac app.';
}
function renderLibrary(kind = 'song') {
  const isSong = kind === 'song';
  const term = $(isSong ? 'songSearch' : 'slidesSearch').value.toLowerCase();
  $(isSong ? 'libraryList' : 'slidesLibraryList').replaceChildren(...state.songs.filter(song => (isSong ? song.type !== 'scripture' && song.type !== 'custom' : song.type === 'scripture' || song.type === 'custom') && song.title.toLowerCase().includes(term)).map(song => {
    const row = document.createElement('div'); row.className = 'library-row';
    const title = document.createElement('strong'); title.textContent = song.title;
    const add = document.createElement('button'); add.className = 'primary'; add.textContent = 'Add to service';
    add.onclick = () => { state.setlist.push({ id: crypto.randomUUID(), songId: song.id, sequence: song.sections.map(s => s.id) }); state.activeItem = state.setlist.length - 1; state.activeSlide = 0; populateEditor(); $(isSong ? 'libraryDialog' : 'slidesLibraryDialog').close(); update(); };
    const del = document.createElement('button'); del.className = 'danger'; del.textContent = 'Delete'; del.onclick = () => confirmLibraryDeletion(song);
    const exp = document.createElement('button'); exp.className='secondary'; exp.textContent='Export'; exp.onclick=()=>exportDoc(()=>window.screensTransfer.item(song),song.title);
    row.append(title, add, exp, del); return row;
  }));
}
function renderServices() {
  $('servicesList').replaceChildren(...state.services.map(service => {
    const row = document.createElement('div'); row.className = 'library-row';
    const title = document.createElement('strong'); title.textContent = `${service.name} · ${new Date(service.savedAt).toLocaleDateString()}`;
    const load = document.createElement('button'); load.className = 'primary'; load.textContent = 'Open';
    load.onclick = () => { if (!confirm(`Open “${service.name}”? Current service will be replaced. Save it first if needed.`)) return; try { const doc=window.screensTransfer.service({...service,songs:service.songs||state.songs.filter(song=>service.setlist.some(item=>item.songId===song.id))}); state=window.screensTransfer.merge(state,doc,()=>crypto.randomUUID(),{open:true}).state; populateEditor();update();$('servicesDialog').close(); } catch(error){alert(error.message);} };
    const del = document.createElement('button'); del.className = 'secondary'; del.textContent = 'Remove';
    del.onclick = () => { if (!confirm(`Remove saved service “${service.name}”?`)) return; state.services = state.services.filter(s => s.id !== service.id); update(); renderServices(); };
    const exp=document.createElement('button');exp.className='secondary';exp.textContent='Export';exp.onclick=()=>exportDoc(()=>window.screensTransfer.service({...service,songs:service.songs||state.songs.filter(song=>service.setlist.some(item=>item.songId===song.id))}),service.name);
    row.append(title, load, exp, del); return row;
  }));
}
function renderQuickSearch() {
  const term = $('quickSearchInput').value.trim().toLowerCase();
  $('quickSearchResults').replaceChildren(...state.songs.filter(song => !term || song.title.toLowerCase().includes(term) || song.source?.toLowerCase().includes(term)).slice(0, 30).map(song => {
    const row = document.createElement('div'); row.className = 'library-row';
    const title = document.createElement('strong'); title.textContent = `${song.type === 'scripture' ? '▣' : '♫'} ${song.title}`;
    const existing = state.setlist.findIndex(item => item.songId === song.id);
    const action = document.createElement('button'); action.className = 'primary'; action.textContent = existing >= 0 ? 'Jump' : 'Add';
    action.onclick = () => { if (existing >= 0) state.activeItem = existing; else { state.setlist.push({ id: crypto.randomUUID(), songId: song.id, sequence: song.sections.map(s => s.id) }); state.activeItem = state.setlist.length - 1; } state.activeSlide = 0; populateEditor(); update(); $('searchDialog').close(); };
    row.append(title, action); return row;
  }));
}
async function exportDoc(build,name){
  try{const doc=build();const filename=(String(name||'Screens').replace(/[^a-zA-Z0-9 ._-]/g,'_').trim().slice(0,100)||'Screens')+'.screens';
    if(window.presenter.exportTransfer){if(await window.presenter.exportTransfer(doc,filename))$('saveStatus').textContent='Exported successfully';}
    else {const url=URL.createObjectURL(new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  }catch(error){alert(`Export failed: ${error.message}`);}
}
async function importDoc(text){
  const transfer=window.screensTransfer, makeId=()=>crypto.randomUUID();const doc=transfer.parse(JSON.parse(text),makeId);
  if(!confirm('Import this Screens file? Existing library content will be retained.'))return;
  let open=false;
  if(doc.kind==='service'||doc.kind==='library')open=confirm(doc.kind==='service'?`Open “${doc.payload.name}” now? Cancel keeps it in the Service Library without changing your current service.`:'Open the exported current service now? Cancel merges the library without changing your current service.');
  const base=clone(state);
  if(open&&base.setlist.length){base.services||=[];base.services.push(transfer.snapshot(base,`${base.serviceName} (before import)`,makeId));}
  const result=transfer.merge(base,doc,makeId,{open});
  // An imported service must never take the congregation live automatically.
  clearTimeout(saveTimer);await window.presenter.save(result.state);state=result.state;populateEditor();update(false);checkpoint();$('serviceName').value=state.serviceName;renderServices();$('saveStatus').textContent='Imported · saved locally';$('servicesDialog').close();
  alert(`Imported ${result.counts.items} library item(s) and ${result.counts.services} service(s). Existing items retained.${result.counts.conflicts?' Conflicting versions were kept separately.':''}`);
}
async function init() {
  if(window.presenter.onUpdateStatus) window.presenter.onUpdateStatus(version=>{const button=$('updateButton');button.hidden=!version;button.textContent=version ? `Update ${version}` : 'Update available';});
  $('updateButton').onclick=()=>{if(state?.blackout) window.presenter.checkUpdates?.();};
  state = await window.presenter.load();
  if (window.presenter.desktop) state.blackout = true;
  if (window.presenter.getDisplayConfig) displayConfig = (await window.presenter.getDisplayConfig()).config;
  state.outputs ||= { congregation: null, stage: null };
  state.services ||= [];
  state.serviceName ||= 'Current Service';
  state.fonts ||= { congregation: 4, stageCurrent: 4, stageNext: 4.4, weight: 650 };
  if (state.setlist[state.activeItem]?.type === 'divider') state.activeItem = state.setlist.findIndex(item => item.type !== 'divider');
  // Re-paginate earlier saved imports that allowed excessively long lines.
  for (const song of state.songs || []) {
    if (song.layoutVersion >= 2 || song.type === "custom" || !song.source) continue;
    if (song.type === 'scripture') {
      const lines = song.source.replace(/\r\n?/g, '\n').split('\n').map(s => s.trim()).filter(Boolean);
      song.sections = [{ id: 'scripture', name: 'Scripture', slides: window.textPagination.paginateText(lines, song.linesPerSlide || 1, 44) }];
    } else song.sections = parseSections(song.source, song.linesPerSlide || 2);
    song.layoutVersion = 2;
  }
  populateEditor(); update(false); lastSnapshot = JSON.stringify(state); await refreshDisplays();
  $('undoButton').onclick = () => restoreHistory(history, redoHistory);
  $('redoButton').onclick = () => restoreHistory(redoHistory, history);
  window.addEventListener('resize', () => document.querySelectorAll('.preview-screen,.mini-screen').forEach(el => window.lyricFit.fit(el)));
  $('capsButton').onclick = () => { state.allCaps = !state.allCaps; update(); };
  $('quickSearchButton').onclick = () => { $('quickSearchInput').value = ''; renderQuickSearch(); $('searchDialog').showModal(); $('quickSearchInput').focus(); };
  $('quickSearchInput').oninput = renderQuickSearch;
  $('fontsButton').onclick = () => {
    $('congregationSize').value = state.fonts.congregation; $('stageCurrentSize').value = state.fonts.stageCurrent;
    $('stageNextSize').value = state.fonts.stageNext; $('fontWeight').value = String(state.fonts.weight); $('fontDialog').showModal();
  };
  for (const [id, key] of [['congregationSize', 'congregation'], ['stageCurrentSize', 'stageCurrent'], ['stageNextSize', 'stageNext']]) $(id).oninput = () => { state.fonts[key] = Number($(id).value); update(); };
  $('fontWeight').onchange = () => { state.fonts.weight = Number($('fontWeight').value); update(); };
  $('fontReset').onclick = () => { state.fonts = { congregation: 4, stageCurrent: 4, stageNext: 4.4, weight: 650 }; $('congregationSize').value = 4; $('stageCurrentSize').value = 4; $('stageNextSize').value = 4.4; $('fontWeight').value = '650'; update(); };
  $('nextButton').onclick = () => navigate(1); $('previousButton').onclick = () => navigate(-1);
  $('blackoutButton').onclick = () => { state.blackout = !state.blackout; update(); };
  $('importButton').onclick = () => {
    const title = $('songTitle').value.trim(), source = $('lyricsInput').value;
    if (!title || !source.trim()) { $('buildMessage').textContent = 'Add a title and lyrics first.'; return; }
    const sections = parseSections(source, Number($('lineCount').value));
    if (!sections.length) { $('buildMessage').textContent = 'No lyric lines found.'; return; }
    let song = creatingSong ? null : activeSong();
    if (!song) { song = { id: crypto.randomUUID() }; state.songs.push(song); state.setlist.push({ id: crypto.randomUUID(), songId: song.id, sequence: [] }); state.activeItem = state.setlist.length - 1; }
    Object.assign(song, { title, source, sections, linesPerSlide: Number($('lineCount').value), layoutVersion: 2 });
    state.setlist[state.activeItem].sequence = sections.map(s => s.id);
    state.activeSlide = 0; creatingSong = false; $('buildMessage').textContent = `${sections.length} sections imported. Ready to present.`; update(); $('builderDialog').close();
  };
  $('resetSequence').onclick = () => { const item = state.setlist[state.activeItem]; if (!item) return; item.sequence = activeSong().sections.map(s => s.id); update(); };
  $('dividerButton').onclick = () => { $('dividerTitle').value = ''; $('dividerPosition').value = 'before'; $('dividerDialog').showModal(); $('dividerTitle').focus(); };
  $('saveDividerButton').onclick = () => {
    const title = $('dividerTitle').value.trim();
    if (!title) { $('dividerTitle').focus(); return; }
    const where = $('dividerPosition').value;
    const index = where === 'end' ? state.setlist.length : Math.max(0, state.activeItem + (where === 'after' ? 1 : 0));
    state.setlist.splice(index, 0, { id: crypto.randomUUID(), type: 'divider', title });
    if (index <= state.activeItem) state.activeItem++;
    $('dividerDialog').close(); update();
  };
  $('toggleSlidesButton').onclick = () => { const panel = document.querySelector('.slides-section'); const hidden = panel.classList.toggle('collapsed'); $('toggleSlidesButton').textContent = hidden ? 'Show slide grid' : 'Hide slide grid'; };
  $('editSlidesButton').onclick = openSlideEditor;
  $('editorPrevious').onclick = () => { editorIndex--; renderSlideEditor(); };
  $('editorNext').onclick = () => { editorIndex++; renderSlideEditor(); };
  $('editorText').oninput = () => {
    const slide = allSlides()[editorIndex]; if (!slide) return;
    const lines = $('editorText').value.replace(/\r\n?/g, '\n').split('\n');
    const item = state.setlist[state.activeItem]; item.slideOverrides ||= {}; item.slideOverrides[slide.slideKey] = lines;
    window.lyricFit.render($('editorPreview'), lines, { caps: state.allCaps });
    const excerpt = $('editorSlideList').children[editorIndex]?.querySelector('span');
    if (excerpt) excerpt.textContent = lines.join(' / ');
    update();
  };
  $('editorNotes').oninput = () => { const slide = allSlides()[editorIndex]; if (!slide) return; const item = state.setlist[state.activeItem]; item.slideNotes ||= {}; item.slideNotes[slide.slideKey] = $('editorNotes').value; update(); };
  $('editorDelete').onclick = () => {
    const slide = allSlides()[editorIndex]; if (!slide) return;
    const item = state.setlist[state.activeItem]; item.deletedSlides ||= []; item.deletedSlides.push(slide.slideKey);
    editorIndex = Math.min(editorIndex, allSlides().length - 1); update(); renderSlideEditor();
  };
  function insertExtra(lines) {
    const slide = allSlides()[editorIndex]; if (!slide) return;
    const item = state.setlist[state.activeItem]; item.customSlides ||= [];
    item.customSlides.push({ id: crypto.randomUUID(), after: slide.slideKey, section: slide.section, lines });
    item.slideOrder = []; editorIndex++; update(); renderSlideEditor();
  }
  $('editorDuplicate').onclick = () => insertExtra([...allSlides()[editorIndex]?.lines || []]);
  $('editorBlank').onclick = () => insertExtra(['']);
  $('editorReset').onclick = () => {
    const slide = allSlides()[editorIndex]; if (!slide) return;
    const item = state.setlist[state.activeItem]; delete item.slideOverrides?.[slide.slideKey];
    update(); renderSlideEditor();
  };
  $('editorSplit').onclick = () => {
    const slide = allSlides()[editorIndex]; if (!slide) return;
    const text = $('editorText').value; const point = $('editorText').selectionStart;
    if (point <= 0 || point >= text.length) { alert('Place your cursor between the text you want on the two slides.'); return; }
    const first = text.slice(0, point).trim(), second = text.slice(point).trim();
    if (!first || !second) return;
    const item = state.setlist[state.activeItem]; item.slideOverrides ||= {}; item.customSlides ||= [];
    item.slideOverrides[slide.slideKey] = first.split('\n');
    item.customSlides.push({ id: crypto.randomUUID(), after: slide.slideKey, section: slide.section, lines: second.split('\n') });
    update(); editorIndex++; renderSlideEditor();
  };
  $('scriptureButton').onclick = () => { $('scriptureReference').value = ''; $('scriptureText').value = ''; $('scriptureMessage').textContent = ''; $('saveScriptureButton').textContent = 'Add passage to service'; $('scriptureDialog').dataset.editId = ''; $('scriptureDialog').showModal(); };
  $('saveScriptureButton').onclick = () => {
    const reference = $('scriptureReference').value.trim();
    const body = $('scriptureText').value.trim();
    if (!reference || !body) { $('scriptureMessage').textContent = 'Enter the scripture reference and text.'; return; }
    const normalized = body.replace(/\r\n?/g, '\n');
    const verseNumbers = [...normalized.matchAll(/(?:^|\n)\s*(?:\[(\d{1,3})\]|(\d{1,3})[.:]?)\s+(?=\S)/g)].map(match => Number(match[1] || match[2]));
    const lines = window.textPagination.wrapAuthoredLines(normalized.split('\n').map(s => s.trim()).filter(Boolean), 52);
    const sections = [{ id: 'scripture', name: 'Scripture', slides: [{ lines }] }];
    const existing = $('scriptureDialog').dataset.editId;
    let song = existing ? state.songs.find(s => s.id === existing) : null;
    if (!song) { song = { id: crypto.randomUUID() }; state.songs.push(song); state.setlist.push({ id: crypto.randomUUID(), songId: song.id, sequence: ['scripture'] }); state.activeItem = state.setlist.length - 1; }
    Object.assign(song, { title: reference, reference, source: body, sections, type: 'scripture', detectedVerses: verseNumbers, layoutVersion: 3 });
    state.setlist[state.activeItem].hiddenSlides = [];
    state.setlist[state.activeItem].slideOverrides = {};
    state.setlist[state.activeItem].customSlides = [];
    state.activeSlide = 0; update(); $('scriptureDialog').close();
  };
  $('addSongButton').onclick = () => { creatingSong = true; $('songTitle').value = ''; $('lyricsInput').value = ''; $('buildMessage').textContent = ''; $('builderHeading').textContent = 'Add New Song'; $('builderDialog').showModal(); $('songTitle').focus(); };
  $('editSongButton').onclick = () => {
    if (activeSong()?.type === 'scripture') {
      const song = activeSong(); $('scriptureReference').value = song.reference || ''; $('scriptureText').value = song.source || ''; $('scriptureDialog').dataset.editId = song.id; $('saveScriptureButton').textContent = 'Update passage'; $('scriptureMessage').textContent = ''; $('scriptureDialog').showModal(); return;
    }
    creatingSong = false; populateEditor(); $('builderHeading').textContent = 'Edit Song'; $('buildMessage').textContent = ''; $('builderDialog').showModal();
  };
  $('screenButton').onclick = async () => { await refreshDisplays(); $('displayDialog').showModal(); };
  $('libraryButton').onclick = () => { renderLibrary('song'); $('libraryDialog').showModal(); };
  $('slidesLibraryButton').onclick = () => { renderLibrary('slides'); $('slidesLibraryDialog').showModal(); };
  $('announcementButton').onclick = $('newCustomSlideButton').onclick = () => { $('slidesLibraryDialog').close(); $('customSlideTitle').value = ''; $('customSlideText').value = ''; $('customSlideDialog').showModal(); };
  $('saveCustomSlideButton').onclick = () => {
    const title = $('customSlideTitle').value.trim(), source = $('customSlideText').value.trim();
    if (!title) { $('customSlideTitle').focus(); return; }
    const id = crypto.randomUUID();
    const song = { id, type: 'custom', title, source, sections: [{ id: 'custom', name: 'Custom', slides: (source || title).split(/\n\s*\n/).map(block => ({ lines: block.split('\n') })) }], layoutVersion: 3 };
    state.songs.push(song); state.setlist.push({ id: crypto.randomUUID(), songId: id, sequence: ['custom'] });
    state.activeItem = state.setlist.length - 1; state.activeSlide = 0; $('customSlideDialog').close(); update();
  };
  $('songSearch').oninput = () => renderLibrary('song');
  $('slidesSearch').oninput = () => renderLibrary('slides');
  $('servicesButton').onclick = () => { $('serviceName').value = state.serviceName; renderServices(); $('servicesDialog').showModal(); };
  $('saveServiceButton').onclick = () => { const name = $('serviceName').value.trim() || 'Untitled Service'; state.serviceName = name; const referenced = new Set(state.setlist.map(item => item.songId).filter(Boolean)); const snapshot = { id: crypto.randomUUID(), name, setlist: clone(state.setlist), songs: clone(state.songs.filter(song => referenced.has(song.id))), savedAt: new Date().toISOString() }; state.services.push(snapshot); update(); renderServices(); };
  $('duplicateServiceButton').onclick = () => { $('serviceName').value = `${state.serviceName} Copy`; $('saveServiceButton').click(); };
  $('newServiceButton').onclick = () => { if (!confirm('Start a blank service? Save the current one first if you want to keep it.')) return; state.setlist = []; state.activeItem = 0; state.activeSlide = 0; state.serviceName = 'New Service'; $('serviceName').value = state.serviceName; update(); $('servicesDialog').close(); };
  $('exportServiceButton').onclick=()=>exportDoc(()=>window.screensTransfer.service(window.screensTransfer.snapshot(state,$('serviceName').value||state.serviceName,()=>crypto.randomUUID())), $('serviceName').value||state.serviceName);
  $('exportCurrentItem').onclick=()=>{const item=state.setlist[state.activeItem];if(!item||item.type==='divider')return alert('Select a presentation first.');exportDoc(()=>window.screensTransfer.service(window.screensTransfer.snapshot(state,activeSong().title,()=>crypto.randomUUID(),[item])),activeSong().title);};
  $('exportBackupButton').onclick=()=>exportDoc(()=>window.screensTransfer.library(state,()=>crypto.randomUUID()),'Screens Library');
  $('importBackupButton').onclick=async()=>{try{if(window.presenter.importTransfer){const text=await window.presenter.importTransfer();if(text!==null)await importDoc(text);}else $('backupFile').click();}catch(error){alert(`Import failed: ${error.message}`);}};
  $('backupFile').onchange=async()=>{const file=$('backupFile').files?.[0];try{if(file){if(file.size>25*1024*1024)throw Error('Transfer exceeds 25 MB.');await importDoc(await file.text());}}catch(error){alert(`Import failed: ${error.message}`);}finally{$('backupFile').value='';}};
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(b.dataset.close).close());
  $('refreshDisplays').onclick=refreshDisplays;
  $('identifyDisplays').onclick=()=>window.presenter.identifyDisplays?.();
  $('applyDisplays').onclick=async()=>{
    if(!window.presenter.applyDisplayConfig) return;
    const assignments={};
    for(const role of ['operator','stage','congregation']) {const id=$(`${role}Display`).value; assignments[role]=displayList.find(d=>d.id===id) || (id && displayConfig.assignments[role]?.id===id ? displayConfig.assignments[role]:null);}
    const ids=Object.values(assignments).filter(Boolean).map(d=>d.id);
    if(new Set(ids).size!==ids.length || (!assignments.operator && Object.values(assignments).some(d=>d?.primary))) { $('displayStatus').textContent='Choose a separate physical screen for every view.';return; }
    try { const r=await window.presenter.applyDisplayConfig({...displayConfig,assignments,restore:$('restoreDisplays').checked,operatorFullscreen:$('operatorFullscreen').checked});displayConfig=r.config;await refreshDisplays();$('displayStatus').textContent+=' · Saved'; } catch(e){$('displayStatus').textContent=e.message;}
  };
  const changeClock=async()=>{const clock={enabled:$('clockEnabled').checked,seconds:$('clockSeconds').checked,position:$('clockPosition').value,format:$('clockFormat').value,size:Number($('clockSize').value)};try{displayConfig.clock=window.presenter.setStageClock?await window.presenter.setStageClock(clock):clock;update(false);}catch(e){$('displayStatus').textContent=e.message;}};
  for(const id of ['clockEnabled','clockSeconds','clockPosition','clockFormat','clockSize']) $(id).onchange=changeClock;
  document.querySelectorAll('[data-open-output]').forEach(b=>b.onclick=()=>window.presenter.openOutput(b.dataset.openOutput,null));
  document.querySelectorAll('[data-close-output]').forEach(b=>b.onclick=()=>window.presenter.closeOutput(b.dataset.closeOutput));
  window.presenter.onDisplaysChanged(refreshDisplays);
  document.addEventListener('keydown', event => {
    const tag = event.target.tagName;
    if ((event.metaKey || event.ctrlKey) && event.code === 'KeyK') { event.preventDefault(); $('quickSearchButton').click(); return; }
    if ((event.metaKey || event.ctrlKey) && event.code === 'KeyZ') { event.preventDefault(); (event.shiftKey ? $('redoButton') : $('undoButton')).click(); return; }
    if (['INPUT','TEXTAREA','SELECT'].includes(tag) || event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
    if (event.code === 'ArrowRight' || event.code === 'Space') { event.preventDefault(); navigate(1); }
    if (event.code === 'ArrowLeft') { event.preventDefault(); navigate(-1); }
    if (event.code === 'KeyB') { event.preventDefault(); state.blackout = !state.blackout; update(); }
  });
}
init().catch(error => { $('saveStatus').textContent = `Startup error: ${error.message}`; });
