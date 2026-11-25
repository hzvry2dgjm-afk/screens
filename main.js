const { app, BrowserWindow, ipcMain, screen, powerSaveBlocker, dialog, nativeImage, Menu, shell } = require('electron');
const updates = require('./updates');
const fs = require('node:fs');
const path = require('node:path');
const { makeInitialState } = require('./model');
const { roles, normalizeConfig, describe, resolveAssignments } = require('./display-config');
let operator, config, lastPresentation = null, timer, quitting = false, active = false, blocker;
const outputs = new Map(), identifiers = new Set();
const statePath = () => path.join(app.getPath('userData'), 'presentation.json');
const configPath = () => path.join(app.getPath('userData'), 'displays.json');
function read(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; } }
function write(file, data) { fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2)); fs.renameSync(`${file}.tmp`, file); }
const displays = () => screen.getAllDisplays().map(d => describe(d, screen.getPrimaryDisplay().id));
const physical = id => screen.getAllDisplays().find(d => String(d.id) === id);
const payload = () => ({ ...(lastPresentation || {}), stageClock: config.clock });
function broadcast(data) { if (data) lastPresentation = data; for (const {window} of outputs.values()) if (!window.isDestroyed()) window.webContents.send('presentation-update', payload()); }
const prefs = { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true };
function placeOperator(display) {
  if (!operator || operator.isDestroyed() || !display) return;
  if (process.platform === 'darwin') operator.setSimpleFullScreen(false); else if (operator.isFullScreen()) operator.setFullScreen(false);
  operator.setBounds(config.operatorFullscreen ? display.bounds : display.workArea);
  if (config.operatorFullscreen) { if (process.platform === 'darwin') operator.setSimpleFullScreen(true); else operator.setFullScreen(true); }
}
function closeOutput(role) { const entry = outputs.get(role); outputs.delete(role); if (entry && !entry.window.isDestroyed()) entry.window.destroy(); }
function openOutput(role, id, preview = false) {
  if (!['stage','congregation'].includes(role)) throw Error('Invalid role');
  const d = physical(id);
  if (!d && !preview) return false;
  closeOutput(role);
  const bounds = d && !preview ? d.bounds : { x: 100, y: 100, width: 960, height: 540 };
  const window = new BrowserWindow({ ...bounds, show: false, frame: preview, movable: preview, resizable: preview, skipTaskbar: !preview, title: `${role} output`, backgroundColor: '#000000', autoHideMenuBar: true, webPreferences: prefs });
  outputs.set(role, { window, id, preview });
  window.on('closed', () => { if (outputs.get(role)?.window === window) outputs.delete(role); });
  window.webContents.on('did-finish-load', () => { if (!window.isDestroyed()) { window.webContents.send('presentation-update', payload()); window.showInactive(); } });
  window.loadFile('output.html', { query: { role } });
  return true;
}
function reconcile(force = false) {
  if (!active || quitting || !operator || operator.isDestroyed()) return;
  const resolved = resolveAssignments(config, displays());
  // Reserve a screen for the operator even if its saved display is missing.
  const op = physical(resolved.operator) || screen.getPrimaryDisplay();
  const opId = String(op.id);
  for (const role of ['stage','congregation']) {
    const id = resolved[role]; const existing = outputs.get(role);
    if (!id || id === opId) { if (existing && !existing.preview) closeOutput(role); continue; }
    if (force || !existing || existing.id !== id || existing.preview) openOutput(role,id);
    else existing.window.setBounds(physical(id).bounds);
  }
  if ((force && resolved.operator) || String(screen.getDisplayMatching(operator.getBounds()).id) !== opId) placeOperator(op);
  operator.webContents.send('displays-changed');
}
let updateAvailable = null, updateBusy = false;
function updateMenu() {
  const menu = Menu.getApplicationMenu();
  const item = menu?.getMenuItemById('screens-update');
  if(item) item.label = updateAvailable ? `Update Available (${updateAvailable.version})…` : 'Check for Updates…';
}
function backupForUpdate() {
  const folder=path.join(app.getPath('userData'),'update-backups');
  fs.mkdirSync(folder,{recursive:true});
  const target=fs.mkdtempSync(path.join(folder,'backup-'));
  for(const file of [statePath(),configPath()]) if(fs.existsSync(file)) fs.copyFileSync(file,path.join(target,path.basename(file)));
  return target;
}
async function checkUpdates(manual=false) {
  if(updateBusy || quitting || !operator || operator.isDestroyed()) return;
  updateBusy=true;
  try {
    updateAvailable=await updates.check(app.getVersion(),process.arch);
    updateMenu();
    if(!operator || operator.isDestroyed() || quitting)return;
    // Never steal focus or open a dialog automatically during a service.
    operator.webContents.send('screens-update-status',updateAvailable?.version || null);
    if(!manual)return;
    if(lastPresentation && !lastPresentation.blackout) {
      // Manual requests during live output must not trigger installation or dialogs.
      return;
    }
    if(!updateAvailable) { await dialog.showMessageBox(operator,{message:'No compatible stable update is available.',detail:`Installed: ${app.getVersion()}`});return; }
    const release=updateAvailable;
    const result=await dialog.showMessageBox(operator,{type:'info',message:`Screens ${release.version} is available`,detail:`Installed: ${app.getVersion()}\n\n${release.notes || 'See GitHub for release notes.'}\n\nInstall only after the service. Screens will not quit or restart automatically.`,buttons:['Later','Back Up & Download'],defaultId:0,cancelId:0});
    if(result.response===1 && !quitting && operator && !operator.isDestroyed() && (!lastPresentation || lastPresentation.blackout)) {
      backupForUpdate(); await shell.openExternal(release.url);
    }
  } catch(error) {
    if(manual && operator && !operator.isDestroyed() && !quitting && (!lastPresentation || lastPresentation.blackout)) await dialog.showMessageBox(operator,{type:'warning',message:'Unable to check or download updates.',detail:String(error.message)});
  } finally { updateBusy=false; }
}
function installUpdateMenu() {
  const template=[...(process.platform==='darwin'?[{role:'appMenu'}]:[]),{role:'editMenu'},{role:'viewMenu'},{role:'windowMenu'},{label:'Updates',submenu:[{id:'screens-update',label:'Check for Updates…',click:()=>checkUpdates(true)},{label:'Previous Releases',click:()=>{if(!lastPresentation||lastPresentation.blackout)shell.openExternal(updates.RELEASES).catch(()=>{});}}]}];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
function createOperator() {
  const resolved = resolveAssignments(config, displays());
  const d = physical(resolved.operator) || screen.getPrimaryDisplay();
  operator = new BrowserWindow({ ...d.workArea, minWidth: 800, minHeight: 550, title: 'Screens', backgroundColor: '#101116', webPreferences: prefs });
  if (config.restore && resolved.operator && config.operatorFullscreen) placeOperator(d);
  operator.on('closed', () => { active = false; for (const role of ['stage','congregation']) closeOutput(role); if (blocker != null && powerSaveBlocker.isStarted(blocker)) powerSaveBlocker.stop(blocker); });
  operator.webContents.once('did-finish-load',()=>{ void checkUpdates(false); });
  operator.loadFile('index.html');
}
// Keep the old application data intact; migrate only into an unused Screens folder.
const previousData = ['Worship Presenter', 'simple-worship-presenter'].map(n => path.join(app.getPath('appData'), n));
const screensData = path.join(app.getPath('appData'), 'Screens');
fs.mkdirSync(screensData, {recursive:true});
app.setPath('userData', screensData);
app.whenReady().then(() => {
  fs.mkdirSync(screensData, {recursive:true});
  if (!fs.existsSync(statePath()) && !fs.existsSync(configPath())) {
    const old = previousData.find(d => fs.existsSync(path.join(d,'presentation.json')) || fs.existsSync(path.join(d,'displays.json')));
    if(old) for(const file of ['presentation.json','displays.json']) if(fs.existsSync(path.join(old,file))) fs.copyFileSync(path.join(old,file),path.join(screensData,file),fs.constants.COPYFILE_EXCL);
  }
  if(process.platform==='darwin' && app.dock) app.dock.setIcon(nativeImage.createFromPath(path.join(__dirname,'assets','icon.png')));
  ipcMain.handle('transfer-export', async (_event, doc, name) => {
    const text=JSON.stringify(doc,null,2); if(text.length>25*1024*1024)throw Error('Transfer exceeds 25 MB.');
    const result=await dialog.showSaveDialog(operator,{title:'Export Screens file',defaultPath:name,filters:[{name:'Screens file',extensions:['screens']}]});
    if(result.canceled||!result.filePath)return false;
    const destination=result.filePath;
    fs.writeFileSync(destination,text,'utf8');return true;
  });
  ipcMain.handle('transfer-import', async () => {
    const result=await dialog.showOpenDialog(operator,{title:'Import Screens file',properties:['openFile'],filters:[{name:'Screens or legacy backup',extensions:['screens','json']}]});
    if(result.canceled||!result.filePaths.length)return null;
    const file=result.filePaths[0];if(fs.statSync(file).size>25*1024*1024)throw Error('Transfer exceeds 25 MB.');return fs.readFileSync(file,'utf8');
  });
  ipcMain.handle('screens-check-updates', (event) => { if(event.sender===operator?.webContents) return checkUpdates(true); });
  config = normalizeConfig(read(configPath(), {}));
  ipcMain.handle('load-state', () => ({ ...makeInitialState(), ...read(statePath(), {}) }));
  ipcMain.handle('save-state', (_event, state) => { if (!state || typeof state !== 'object') return false; write(statePath(), state); return true; });
  ipcMain.handle('list-displays', displays);
  ipcMain.handle('get-display-config', () => ({ config, resolved: resolveAssignments(config, displays()) }));
  ipcMain.handle('apply-display-config', (_event, raw) => {
    const next = normalizeConfig(raw); const ids = roles.map(r => next.assignments[r]?.id).filter(Boolean);
    if (new Set(ids).size !== ids.length) throw Error('Assign a different screen to each view.');
    const resolved = resolveAssignments(next, displays());
    if (next.assignments.operator && !resolved.operator) throw Error('Select a connected operator display.');
    write(configPath(), next); config = next; active = true;
    for (const role of ['stage','congregation']) closeOutput(role);
    reconcile(true); broadcast(); return { config, resolved };
  });
  ipcMain.handle('set-stage-clock', (_event, clock) => { const next = normalizeConfig({ ...config, clock }); write(configPath(), next); config = next; broadcast(); return config.clock; });
  ipcMain.handle('identify-displays', () => {
    for (const w of identifiers) if (!w.isDestroyed()) w.destroy(); identifiers.clear();
    screen.getAllDisplays().forEach((d,i) => {
      const w = new BrowserWindow({ x:d.bounds.x+20,y:d.bounds.y+20,width:220,height:110,frame:false,alwaysOnTop:true,focusable:false,skipTaskbar:true,backgroundColor:'#000000',webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false} });
      identifiers.add(w); w.on('closed',()=>identifiers.delete(w));
      w.loadURL('data:text/html,'+encodeURIComponent(`<body style="background:black;color:white;font: bold 42px sans-serif;text-align:center">${i+1}</body>`));
      w.setVisibleOnAllWorkspaces(true,{visibleOnFullScreen:true}); w.showInactive(); setTimeout(()=>{if(!w.isDestroyed())w.destroy();},3500);
    }); return true;
  });
  ipcMain.handle('open-output', (_event, role) => openOutput(role,null,true));
  ipcMain.handle('close-output', (_event, role) => { closeOutput(role); return true; });
  ipcMain.on('presentation', (_event,data) => { broadcast(data); if (!active && config.restore) { active=true; reconcile(); } });
  const changed = () => { clearTimeout(timer); timer=setTimeout(()=>{ reconcile(); if(operator && !operator.isDestroyed()) operator.webContents.send('displays-changed'); },350); };
  screen.on('display-removed', (_event,d)=>{ for(const [role,entry] of outputs) if(!entry.preview && entry.id===String(d.id)) closeOutput(role); changed(); });
  for(const event of ['display-added','display-metrics-changed']) screen.on(event,changed);
  installUpdateMenu();
  createOperator(); blocker = powerSaveBlocker.start('prevent-display-sleep');
  app.on('activate', () => { if (!operator || operator.isDestroyed()) { createOperator(); blocker=powerSaveBlocker.start('prevent-display-sleep'); } });
});
app.on('before-quit',()=>{quitting=true;});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
