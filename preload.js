const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('presenter', {
  desktop: true,
  checkUpdates: () => ipcRenderer.invoke('screens-check-updates'),
  onUpdateStatus: callback => { const listener = (_event, version) => callback(version); ipcRenderer.on('screens-update-status', listener); return () => ipcRenderer.removeListener('screens-update-status', listener); },
  exportTransfer: (doc,name) => ipcRenderer.invoke('transfer-export',doc,name),
  importTransfer: () => ipcRenderer.invoke('transfer-import'),
  getDisplayConfig: () => ipcRenderer.invoke('get-display-config'),
  applyDisplayConfig: config => ipcRenderer.invoke('apply-display-config', config),
  setStageClock: clock => ipcRenderer.invoke('set-stage-clock', clock),
  identifyDisplays: () => ipcRenderer.invoke('identify-displays'),
  load: () => ipcRenderer.invoke('load-state'),
  save: state => ipcRenderer.invoke('save-state', state),
  displays: () => ipcRenderer.invoke('list-displays'),
  openOutput: (role, displayId) => ipcRenderer.invoke('open-output', role, displayId),
  closeOutput: role => ipcRenderer.invoke('close-output', role),
  sendPresentation: data => ipcRenderer.send('presentation', data),
  onPresentation: callback => { const listener = (_event, data) => callback(data); ipcRenderer.on('presentation-update', listener); return () => ipcRenderer.removeListener('presentation-update', listener); },
  onDisplaysChanged: callback => { const listener = () => callback(); ipcRenderer.on('displays-changed', listener); return () => ipcRenderer.removeListener('displays-changed', listener); }
});
