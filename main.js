const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, desktopCapturer, nativeImage } = require('electron');
const path = require('path');
const config = require('./lib/config');
const typer = require('./lib/typer');

if (!app.requestSingleInstanceLock()) app.exit(0);

const ICON = path.join(__dirname, 'assets', 'icon.png');
const PRELOAD = path.join(__dirname, 'preload.js');

let cfg;
let tray = null;
let wheelWin = null;
let settingsWin = null;
let currentHotkey = null;
let paused = false;
let wheelState = 'closed'; // closed | opening | open
let hovered = -1;
let showTimer = null;
const wheelKeys = [];

// ---------- startup ----------
app.whenReady().then(() => {
  app.setAppUserModelId('com.jabramson.typewheel');
  cfg = config.load();
  createTray();
  createWheelWindow();

  if (!registerHotkey(cfg.hotkey)) {
    console.warn(`Hotkey ${cfg.hotkey} is taken`);
    openSettings();
  }
  if (!cfg.firstRunDone) {
    cfg = config.save({ ...cfg, firstRunDone: true });
    openSettings();
  }
});

app.on('second-instance', () => openSettings());
app.on('window-all-closed', () => { /* keep running in the tray */ });
app.on('before-quit', () => { app.isQuitting = true; });
app.on('will-quit', () => globalShortcut.unregisterAll());

// ---------- hotkey ----------
function registerHotkey(acc) {
  if (currentHotkey) {
    try { globalShortcut.unregister(currentHotkey); } catch {}
    currentHotkey = null;
  }
  if (paused || !acc) return true;
  let ok = false;
  try { ok = globalShortcut.register(acc, onHotkey); } catch { ok = false; }
  if (ok) currentHotkey = acc;
  return ok;
}

function onHotkey() {
  if (wheelState === 'open') {
    if (hovered >= 0) selectPreset(hovered);
    else hideWheel();
    return;
  }
  if (wheelState === 'closed') openWheel();
}

// Escape and number keys only exist while the wheel is up.
function registerWheelKeys() {
  const add = (acc, fn) => {
    try { if (globalShortcut.register(acc, fn)) wheelKeys.push(acc); } catch {}
  };
  add('Escape', hideWheel);
  cfg.presets.forEach((_, i) => add(String(i + 1), () => selectPreset(i)));
}

function unregisterWheelKeys() {
  while (wheelKeys.length) {
    try { globalShortcut.unregister(wheelKeys.pop()); } catch {}
  }
}

// ---------- wheel ----------
function createWheelWindow() {
  wheelWin = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false, // never steal focus from the app you're typing into
    hasShadow: false,
    alwaysOnTop: true,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  wheelWin.setAlwaysOnTop(true, 'screen-saver');
  wheelWin.loadFile(path.join(__dirname, 'renderer', 'wheel.html'));
  wheelWin.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); hideWheel(); }
  });
}

async function openWheel() {
  if (!cfg.presets.length || !wheelWin) return;
  wheelState = 'opening';
  hovered = -1;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const b = display.bounds;

  // Grab a small screenshot of this monitor before the overlay appears.
  // It gets blurred in the overlay, so a third of full resolution is plenty.
  let background = null;
  if (cfg.blurBackground) {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: Math.round(b.width / 3), height: Math.round(b.height / 3) },
      });
      const src = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
      if (src && !src.thumbnail.isEmpty()) {
        background = 'data:image/jpeg;base64,' + src.thumbnail.toJPEG(72).toString('base64');
      }
    } catch (e) {
      console.warn('screen capture failed', e.message);
    }
  }
  if (wheelState !== 'opening') return;

  wheelWin.setBounds(b);
  wheelWin.webContents.send('wheel:open', {
    presets: cfg.presets.map((p) => ({ icon: p.icon, label: p.label, preview: p.text })),
    accent: cfg.accent,
    size: cfg.size,
    background,
    cursor: { x: cursor.x - b.x, y: cursor.y - b.y },
    width: b.width,
    height: b.height,
  });
  // Show once the renderer has painted the new wheel (or after a short fallback).
  clearTimeout(showTimer);
  showTimer = setTimeout(showWheelNow, 150);
}

function showWheelNow() {
  clearTimeout(showTimer);
  if (wheelState !== 'opening') return;
  wheelWin.showInactive();
  wheelWin.setAlwaysOnTop(true, 'screen-saver');
  wheelWin.moveTop();
  wheelState = 'open';
  registerWheelKeys();
  wheelWin.webContents.send('wheel:shown');
}

function hideWheel() {
  clearTimeout(showTimer);
  unregisterWheelKeys();
  wheelState = 'closed';
  hovered = -1;
  if (wheelWin && !wheelWin.isDestroyed()) {
    wheelWin.webContents.send('wheel:close');
    wheelWin.hide();
  }
}

function selectPreset(i) {
  const p = cfg.presets[i];
  hideWheel();
  if (p) typer.typeText(p.text, { pressEnter: p.pressEnter }).catch((e) => console.error('type failed', e));
}

ipcMain.on('wheel:ready', () => showWheelNow());
ipcMain.on('wheel:hover', (_e, i) => { hovered = Number.isInteger(i) ? i : -1; });
ipcMain.on('wheel:select', (_e, i) => { if (wheelState === 'open') selectPreset(i); });
ipcMain.on('wheel:cancel', () => hideWheel());
ipcMain.on('wheel:test', () => setTimeout(() => { if (wheelState === 'closed') openWheel(); }, 250));

// ---------- start with Windows ----------
function loginOpts() {
  // The portable build runs from a temp folder; point startup at the real .exe.
  return { path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath };
}
const getStartup = () => app.getLoginItemSettings(loginOpts()).openAtLogin;
const setStartup = (on) => app.setLoginItemSettings({ openAtLogin: !!on, ...loginOpts() });

// ---------- tray ----------
function createTray() {
  const img = nativeImage.createFromPath(ICON).resize({ width: 32, height: 32 });
  tray = new Tray(img);
  tray.on('click', openSettings);
  buildTrayMenu();
}

function buildTrayMenu() {
  if (!tray) return;
  tray.setToolTip(paused ? 'TypeWheel (paused)' : `TypeWheel: ${cfg.hotkey}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Shortcut: ${prettyHotkey(cfg.hotkey)}`, enabled: false },
      { type: 'separator' },
      { label: 'Settings…', click: openSettings },
      { label: 'Preview wheel', click: () => setTimeout(openWheel, 200) },
      { type: 'separator' },
      {
        label: 'Pause shortcut',
        type: 'checkbox',
        checked: paused,
        click: (m) => { paused = m.checked; registerHotkey(cfg.hotkey); buildTrayMenu(); },
      },
      { label: 'Start with Windows', type: 'checkbox', checked: getStartup(), click: (m) => setStartup(m.checked) },
      { type: 'separator' },
      { label: 'Quit TypeWheel', click: () => { app.isQuitting = true; app.quit(); } },
    ])
  );
}

const prettyHotkey = (acc) => acc.replace(/Super/g, 'Win');

// ---------- settings ----------
function openSettings() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    if (settingsWin.isMinimized()) settingsWin.restore();
    settingsWin.show();
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 940,
    height: 760,
    minWidth: 760,
    minHeight: 560,
    title: 'TypeWheel',
    icon: ICON,
    backgroundColor: '#141a2b',
    show: false,
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true },
  });
  settingsWin.removeMenu();
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWin.once('ready-to-show', () => settingsWin.show());
  settingsWin.on('closed', () => {
    settingsWin = null;
    registerHotkey(cfg.hotkey); // in case the recorder left it suspended
  });
}

ipcMain.handle('cfg:get', () => ({ ...cfg, startWithWindows: getStartup() }));

ipcMain.handle('cfg:save', (_e, next) => {
  if (config.countValidPresets(next) < config.MIN_PRESETS) {
    return { ok: false, error: `Add text to at least ${config.MIN_PRESETS} slices.` };
  }
  const normalized = config.normalize({ ...next, firstRunDone: true });
  const prev = cfg.hotkey;
  const wasPaused = paused;
  paused = false;
  if (!registerHotkey(normalized.hotkey)) {
    paused = wasPaused;
    registerHotkey(prev);
    return { ok: false, error: `${prettyHotkey(normalized.hotkey)} is already used by Windows or another app. Pick a different shortcut.` };
  }
  cfg = config.save(normalized);
  if (typeof next.startWithWindows === 'boolean') setStartup(next.startWithWindows);
  buildTrayMenu();
  return { ok: true, cfg: { ...cfg, startWithWindows: getStartup() } };
});

ipcMain.on('hotkey:suspend', () => {
  if (currentHotkey) { try { globalShortcut.unregister(currentHotkey); } catch {} currentHotkey = null; }
});
ipcMain.on('hotkey:resume', () => registerHotkey(cfg.hotkey));
ipcMain.handle('app:info', () => ({ version: app.getVersion(), engine: typer.engine, paused }));
