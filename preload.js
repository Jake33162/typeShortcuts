const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tw', {
  // Wheel overlay
  onOpen: (cb) => ipcRenderer.on('wheel:open', (_e, d) => cb(d)),
  onShown: (cb) => ipcRenderer.on('wheel:shown', () => cb()),
  onBackground: (cb) => ipcRenderer.on('wheel:bg', (_e, img) => cb(img)),
  onDismiss: (cb) => ipcRenderer.on('wheel:dismiss', () => cb()),
  onClose: (cb) => ipcRenderer.on('wheel:close', () => cb()),
  ready: () => ipcRenderer.send('wheel:ready'),
  hover: (i) => ipcRenderer.send('wheel:hover', i),
  select: (i) => ipcRenderer.send('wheel:select', i),
  cancel: () => ipcRenderer.send('wheel:cancel'),

  // Settings
  getConfig: () => ipcRenderer.invoke('cfg:get'),
  saveConfig: (c) => ipcRenderer.invoke('cfg:save', c),
  suspendHotkey: () => ipcRenderer.send('hotkey:suspend'),
  resumeHotkey: () => ipcRenderer.send('hotkey:resume'),
  testWheel: () => ipcRenderer.send('wheel:test'),
  info: () => ipcRenderer.invoke('app:info'),
  onUpdate: (cb) => ipcRenderer.on('update:state', (_e, u) => cb(u)),
  checkUpdate: () => ipcRenderer.send('update:check'),
  installUpdate: () => ipcRenderer.send('update:install'),
});
