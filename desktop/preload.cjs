const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('wavevizDesktop', {
  platform: process.platform,
  isWidget: new URLSearchParams(window.location.search).has('widget'),
  isSettings: new URLSearchParams(window.location.search).has('settings'),
  widgetMode: new URLSearchParams(window.location.search).get('mode'),
  widgetId: Number(new URLSearchParams(window.location.search).get('id')) || null,
  openWidget: (mode) => ipcRenderer.invoke('waveviz:open-widget', mode),
  destroyWidget: (id) => ipcRenderer.invoke('waveviz:destroy-widget', id),
  getWidgets: () => ipcRenderer.invoke('waveviz:get-widgets'),
  focusWidget: (id) => ipcRenderer.invoke('waveviz:focus-widget', id),
  setWidgetAlwaysOnTop: (id, enabled) => ipcRenderer.invoke('waveviz:set-widget-always-on-top', id, Boolean(enabled)),
  onWidgetsChanged: (callback) => {
    const listener = (_event, widgets) => callback(widgets);
    ipcRenderer.on('waveviz:widgets-changed', listener);
    return () => ipcRenderer.removeListener('waveviz:widgets-changed', listener);
  },
  publishAnalysisFrame: (frame) => ipcRenderer.send('waveviz:analysis-frame', frame),
  onAnalysisFrame: (callback) => {
    const listener = (_event, frame) => callback(frame);
    ipcRenderer.on('waveviz:analysis-frame', listener);
    return () => ipcRenderer.removeListener('waveviz:analysis-frame', listener);
  },
  openSettings: () => ipcRenderer.invoke('waveviz:open-settings'),
  getCloseBehavior: () => ipcRenderer.invoke('waveviz:get-close-behavior'),
  setCloseBehavior: (behavior) => ipcRenderer.invoke('waveviz:set-close-behavior', behavior),
  closeWindow: () => ipcRenderer.invoke('waveviz:close-window'),
  minimizeWindow: () => ipcRenderer.invoke('waveviz:minimize-window'),
  toggleFullScreen: () => ipcRenderer.invoke('waveviz:toggle-fullscreen'),
  onFullScreenChanged: (callback) => {
    const listener = (_event, fullscreen) => callback(fullscreen);
    ipcRenderer.on('waveviz:fullscreen-changed', listener);
    return () => ipcRenderer.removeListener('waveviz:fullscreen-changed', listener);
  },
  setTransparency: (enabled) => ipcRenderer.invoke('waveviz:set-transparency', Boolean(enabled)),
});
