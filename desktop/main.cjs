const path = require('node:path');
const fs = require('node:fs');
const { app, BrowserWindow, desktopCapturer, ipcMain, session } = require('electron');

let mainWindow = null;
let settingsWindow = null;
let colorPickerWindow = null;
let closeBehavior = 'background';
let windowControlsPosition = 'right';
let isQuitting = false;
const widgetWindows = new Map();
let viteServer = null;

function settingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings() {
  try {
    const settings = JSON.parse(fs.readFileSync(settingsPath(), 'utf8'));
    if (settings.closeBehavior === 'quit' || settings.closeBehavior === 'background') {
      closeBehavior = settings.closeBehavior;
    }
    if (settings.windowControlsPosition === 'left' || settings.windowControlsPosition === 'right') {
      windowControlsPosition = settings.windowControlsPosition;
    }
  } catch {
    // First launch keeps the app running when its main window is closed.
  }
}

function saveSettings() {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify({ closeBehavior, windowControlsPosition }, null, 2));
}

function configureMediaCapture() {
  const appSession = session.defaultSession;

  appSession.setPermissionRequestHandler((_webContents, permission, callback, details) => {
    if (permission === 'media') {
      const mediaTypes = details?.mediaTypes ?? [];
      callback(mediaTypes.includes('audio') && !mediaTypes.includes('video'));
      return;
    }
    if (permission === 'display-capture') {
      callback(true);
      return;
    }
    callback(false);
  });

  appSession.setDisplayMediaRequestHandler(async (request, callback) => {
    if (!request.audioRequested || !request.videoRequested) {
      callback(null);
      return;
    }

    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        fetchWindowIcons: false,
        thumbnailSize: { width: 16, height: 16 },
      });
      const screen = sources[0];
      if (!screen) {
        callback(null);
        return;
      }
      // The renderer immediately stops this screen-video track; only loopback audio is analyzed.
      callback({ video: screen, audio: 'loopback' });
    } catch (error) {
      console.error('Could not create the system-audio loopback stream:', error);
      callback(null);
    }
  }, { useSystemPicker: false });
}

async function loadRenderer(window) {
  const pageQuery = window.__wavevizPage ? `?${window.__wavevizPage}` : '';
  if (app.isPackaged) {
    await window.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), { search: pageQuery.slice(1) });
    return;
  }

  const { createServer } = await import('vite');
  viteServer = await createServer({
    configFile: path.join(__dirname, '..', 'vite.config.ts'),
    root: path.join(__dirname, '..'),
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
      open: false,
    },
    clearScreen: false,
  });
  await viteServer.listen();
  const localUrl = viteServer.resolvedUrls?.local?.[0] ?? 'http://127.0.0.1:4173/';
  await window.loadURL(`${localUrl}${pageQuery}`);
}

async function createWindow() {
  configureMediaCapture();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 980,
    minHeight: 640,
    frame: false,
    title: 'WaveViz FX',
    backgroundColor: '#00000000',
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.setBackgroundThrottling(false);
  mainWindow.on('close', (event) => {
    if (isQuitting) return;
    event.preventDefault();
    if (closeBehavior === 'quit') app.quit();
    else mainWindow.hide();
  });
  mainWindow.on('enter-full-screen', () => mainWindow.webContents.send('waveviz:fullscreen-changed', true));
  mainWindow.on('leave-full-screen', () => mainWindow.webContents.send('waveviz:fullscreen-changed', false));
  await loadRenderer(mainWindow);
  mainWindow.on('closed', () => { mainWindow = null; });
}

async function openSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return settingsWindow.id;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 500,
    minWidth: 460,
    minHeight: 460,
    title: 'WaveViz Settings',
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    modal: false,
    backgroundColor: '#080d18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  settingsWindow.__wavevizPage = 'settings';
  settingsWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  settingsWindow.on('closed', () => { settingsWindow = null; });
  await loadRenderer(settingsWindow);
  settingsWindow.show();
  return settingsWindow.id;
}

async function openColorPickerWindow() {
  if (colorPickerWindow && !colorPickerWindow.isDestroyed()) {
    colorPickerWindow.show();
    colorPickerWindow.focus();
    return colorPickerWindow.id;
  }
  colorPickerWindow = new BrowserWindow({
    width: 560,
    height: 540,
    minWidth: 500,
    minHeight: 480,
    title: 'WaveViz Color Studio',
    parent: mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined,
    backgroundColor: '#080d18',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  colorPickerWindow.__wavevizPage = 'colors';
  colorPickerWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  colorPickerWindow.on('closed', () => { colorPickerWindow = null; });
  await loadRenderer(colorPickerWindow);
  colorPickerWindow.show();
  return colorPickerWindow.id;
}

async function createWidgetWindow(mode) {
  const widget = new BrowserWindow({
    width: 420,
    height: 300,
    minWidth: 220,
    minHeight: 160,
    title: 'WaveViz Widget',
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  widget.__wavevizPage = `widget&mode=${encodeURIComponent(mode)}&id=${widget.id}`;
  if (process.platform !== 'win32') {
    widget.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: false });
  }
  widget.setAlwaysOnTop(false);
  widget.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  widgetWindows.set(widget, { mode, alwaysOnTop: false });
  broadcastWidgetList();
  widget.on('closed', () => {
    widgetWindows.delete(widget);
    broadcastWidgetList();
  });
  await loadRenderer(widget);
  widget.show();
  return widget.id;
}

function broadcastWidgetList() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('waveviz:widgets-changed', Array.from(widgetWindows, ([window, settings]) => ({ id: window.id, ...settings })));
}

ipcMain.handle('waveviz:open-widget', (_event, requestedMode) => {
  const mode = ['spectrum', 'scope', 'mirror', 'tunnel', 'particles', 'morph', 'radial', 'waterfall', 'ribbon'].includes(requestedMode) ? requestedMode : 'spectrum';
  return createWidgetWindow(mode);
});
ipcMain.handle('waveviz:set-widget-mode', (event, id, requestedMode) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return false;
  const modes = ['spectrum', 'scope', 'mirror', 'tunnel', 'particles', 'morph', 'radial', 'waterfall', 'ribbon'];
  if (!modes.includes(requestedMode)) return false;
  const entry = Array.from(widgetWindows).find(([window]) => window.id === id);
  if (!entry) return false;
  const [window, settings] = entry;
  settings.mode = requestedMode;
  window.webContents.send('waveviz:widget-mode-changed', requestedMode);
  broadcastWidgetList();
  return true;
});
ipcMain.handle('waveviz:get-widgets', (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return [];
  return Array.from(widgetWindows, ([window, settings]) => ({ id: window.id, ...settings }));
});
ipcMain.handle('waveviz:focus-widget', (event, id) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return;
  const entry = Array.from(widgetWindows).find(([window]) => window.id === id);
  if (entry) { entry[0].show(); entry[0].focus(); }
});
ipcMain.handle('waveviz:set-widget-always-on-top', (event, id, enabled) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return false;
  const entry = Array.from(widgetWindows).find(([window]) => window.id === id);
  if (!entry) return false;
  const [window, settings] = entry;
  settings.alwaysOnTop = Boolean(enabled);
  window.setAlwaysOnTop(settings.alwaysOnTop, 'floating');
  broadcastWidgetList();
  return true;
});
ipcMain.handle('waveviz:destroy-widget', (event, id) => {
  const sender = BrowserWindow.fromWebContents(event.sender);
  const target = sender && widgetWindows.has(sender)
    ? sender
    : sender === mainWindow
      ? Array.from(widgetWindows.keys()).find((window) => window.id === id)
      : undefined;
  if (target && widgetWindows.has(target)) target.close();
});
ipcMain.on('waveviz:analysis-frame', (event, frame) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return;
  for (const widget of widgetWindows.keys()) {
    if (!widget.isDestroyed()) widget.webContents.send('waveviz:analysis-frame', frame);
  }
});
ipcMain.handle('waveviz:open-settings', () => openSettingsWindow());
ipcMain.handle('waveviz:open-color-picker', (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return;
  return openColorPickerWindow();
});
ipcMain.on('waveviz:custom-palettes-updated', (event, palettes) => {
  if (BrowserWindow.fromWebContents(event.sender) !== colorPickerWindow || !Array.isArray(palettes)) return;
  const safePalettes = palettes.filter((palette) => palette && typeof palette.id === 'string' && typeof palette.label === 'string' && Array.isArray(palette.swatches) && palette.swatches.length === 4 && palette.swatches.every((color) => typeof color === 'string' && /^#[\da-f]{6}$/i.test(color))).slice(0, 48);
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send('waveviz:custom-palettes-changed', safePalettes);
  }
});
ipcMain.handle('waveviz:get-close-behavior', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window === settingsWindow ? closeBehavior : 'background';
});
ipcMain.handle('waveviz:set-close-behavior', (event, behavior) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window !== settingsWindow || (behavior !== 'quit' && behavior !== 'background')) return false;
  closeBehavior = behavior;
  saveSettings();
  return true;
});
ipcMain.handle('waveviz:get-window-controls-position', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  return window === mainWindow || window === settingsWindow ? windowControlsPosition : 'right';
});
ipcMain.handle('waveviz:set-window-controls-position', (event, position) => {
  if (BrowserWindow.fromWebContents(event.sender) !== settingsWindow || (position !== 'left' && position !== 'right')) return false;
  windowControlsPosition = position;
  saveSettings();
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('waveviz:window-controls-position-changed', position);
  return true;
});
ipcMain.handle('waveviz:close-window', (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return;
  if (closeBehavior === 'quit') app.quit();
  else mainWindow.close();
});
ipcMain.handle('waveviz:minimize-window', (event) => {
  if (BrowserWindow.fromWebContents(event.sender) === mainWindow) mainWindow.minimize();
});
ipcMain.handle('waveviz:toggle-fullscreen', (event) => {
  if (BrowserWindow.fromWebContents(event.sender) !== mainWindow) return false;
  const fullscreen = !mainWindow.isFullScreen();
  mainWindow.setFullScreen(fullscreen);
  return fullscreen;
});
ipcMain.handle('waveviz:set-transparency', (event, enabled) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) return false;
  window.setBackgroundColor(enabled ? '#00000000' : '#080d18');
  return true;
});
app.whenReady().then(() => {
  loadSettings();
  return createWindow();
}).catch((error) => {
  console.error('WaveViz could not start:', error);
  app.quit();
});

app.on('activate', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  } else if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (viteServer) void viteServer.close();
});
