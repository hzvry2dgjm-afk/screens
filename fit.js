// Render each authored lyric line separately and shrink type to prevent wrapping.
window.lyricFit = {
  render(container, lines, { caps = false } = {}) {
    container.replaceChildren();
    for (const line of lines || []) {
      const el = document.createElement('div');
      el.className = 'lyric-line';
      el.textContent = caps ? line.toUpperCase() : line;
      container.append(el);
    }
    this.fit(container);
  },
  fit(container) {
    if (!container?.isConnected) return;
    // The computed font size is the maximum; all lines share the same fitted size.
    const lines = [...container.querySelectorAll(':scope > .lyric-line')];
    if (!lines.length) return;
    const size = Number.parseFloat(getComputedStyle(container).fontSize) || 20;
    const style = getComputedStyle(container);
    const width = Math.max(20, container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 2);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    const max = Math.max(...lines.map(line => ctx.measureText(line.textContent).width), 1);
    const height = Math.max(15, container.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - 2);
    const heightFit = height / (lines.length * 1.35);
    const fitted = Math.max(6, Math.min(size, size * width / max, heightFit));
    lines.forEach(line => line.style.fontSize = `${fitted}px`);
  }
};
