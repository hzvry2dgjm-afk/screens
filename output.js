const role = new URLSearchParams(location.search).get('role');
const currentEl = document.getElementById('outputCurrent');
const nextEl = document.getElementById('outputNext');
const headerEl = document.getElementById('nextSectionHeader');
const clockEl = document.getElementById('stageClock');
let clock = { enabled:true, position:'right', size:3, format:'12', seconds:false };
function tickClock() {
  clockEl.hidden = role !== 'stage' || !clock.enabled;
  if (clockEl.hidden) return;
  clockEl.style.textAlign = ['left','center','right'].includes(clock.position) ? clock.position : 'right';
  clockEl.style.fontSize = `${Math.max(1.5,Math.min(6,Number(clock.size)||3))}vw`;
  clockEl.textContent = new Date().toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',...(clock.seconds?{second:'2-digit'}:{}),hour12:clock.format!=='24'});
}
setInterval(tickClock, 1000);
function render(data) {
  clock = { ...clock, ...data.stageClock }; tickClock();
  const blank = data.blackout || !data.current;
  const fonts = data.fonts || {};
  currentEl.style.fontSize = `${role === 'stage' ? fonts.stageCurrent || 4 : fonts.congregation || 4}vw`;
  nextEl.style.fontSize = `${fonts.stageNext || 4.4}vw`;
  currentEl.style.fontWeight = String(fonts.weight || 650);
  nextEl.style.fontWeight = String(fonts.weight || 650);
  window.lyricFit.render(currentEl, blank ? [] : data.current.lines, { caps: data.allCaps });
  window.lyricFit.render(nextEl, blank || role !== 'stage' || !data.next ? [] : [data.next.lines[0] || ''], { caps: data.allCaps });
  headerEl.textContent = blank || role !== 'stage' ? '' : (data.nextSection ? `UP NEXT · ${data.nextSection.toUpperCase()}` : 'END OF ITEM');
  document.body.classList.toggle('stage-output', role === 'stage');
  requestAnimationFrame(() => { window.lyricFit.fit(currentEl); window.lyricFit.fit(nextEl); });
}
window.presenter.onPresentation(render);
window.addEventListener('resize', () => { window.lyricFit.fit(currentEl); window.lyricFit.fit(nextEl); });
