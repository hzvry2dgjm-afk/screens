const roles = ['operator', 'stage', 'congregation'];
const defaultClock = { enabled: true, position: 'right', size: 3, format: '12', seconds: false };
function normalizeConfig(raw = {}) {
  const assignments = {};
  for (const role of roles) {
    const d = raw.assignments?.[role];
    assignments[role] = d && typeof d.id === 'string' ? { id: d.id, name: String(d.name || ''), width: Number(d.width)||0, height: Number(d.height)||0 } : null;
  }
  const c = raw.clock || {};
  return { assignments, restore: raw.restore !== false, operatorFullscreen: raw.operatorFullscreen !== false, clock: { enabled: c.enabled !== false, position: ['left','center','right'].includes(c.position) ? c.position : defaultClock.position, size: Math.max(1.5, Math.min(6, Number(c.size)||3)), format: c.format === '24' ? '24' : '12', seconds: c.seconds === true } };
}
function describe(d, primaryId) { return { id: String(d.id), name: d.label || '', width: d.size.width, height: d.size.height, label: `${d.label || 'Display'} (${d.size.width}×${d.size.height})`, primary: d.id === primaryId }; }
function resolveAssignments(config, displays) {
  const resolved = {}, used = new Set();
  // Reserve exact matches first, then recover only uniquely identifiable devices.
  for (const role of roles) {
    const saved = config.assignments[role]; if (!saved) continue;
    const match = displays.find(d => d.id === saved.id && (!saved.name || d.name === saved.name));
    if (match && !used.has(match.id)) { resolved[role] = match.id; used.add(match.id); }
  }
  for (const role of roles) {
    const saved = config.assignments[role]; if (!saved?.name || resolved[role]) continue;
    const same = d => d?.name === saved.name && d.width === saved.width && d.height === saved.height;
    if (roles.filter(r => same(config.assignments[r])).length !== 1) continue;
    const matches = displays.filter(same);
    if (matches.length === 1 && !used.has(matches[0].id)) { resolved[role] = matches[0].id; used.add(matches[0].id); }
  }
  return resolved;
}
module.exports = { roles, normalizeConfig, describe, resolveAssignments };
