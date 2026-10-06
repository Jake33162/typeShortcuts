const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, screen, desktopCapturer, nativeImage } = require('electron');
const path = require('path');
const config = require('./lib/config');
const typer = require('./lib/typer');
const updater = require('./lib/updater');

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
let hideTimer = null;
let openSeq = 0;
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
  updater.init((u) => {
    buildTrayMenu();
    if (settingsWin && !settingsWin.isDestroyed()) settingsWin.webContents.send('update:state', u);
  });

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
    else hideWheel(true);
    return;
  }
  if (wheelState === 'closed') openWheel();
}

// Escape and number keys only exist while the wheel is up.
function registerWheelKeys() {
  const add = (acc, fn) => {
    try { if (globalShortcut.register(acc, fn)) wheelKeys.push(acc); } catch {}
  };
  add('Escape', () => hideWheel(true));
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
  // Keeps the overlay out of screen captures. That lets us grab the desktop for
  // the blurred background *after* the wheel is already showing, so it opens instantly.
  // Side effect: the wheel also won't appear in OBS or screen recordings.
  wheelWin.setContentProtection(true);
  wheelWin.loadFile(path.join(__dirname, 'renderer', 'wheel.html'));
  wheelWin.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); hideWheel(); }
  });
}

function openWheel() {
  if (!cfg.presets.length || !wheelWin) return;
  const seq = ++openSeq;
  wheelState = 'opening';
  hovered = -1;

  const cursor = screen.getCursorScreenPoint();
  const display = screen.getDisplayNearestPoint(cursor);
  const b = display.bounds;

  wheelWin.setBounds(b);
  wheelWin.webContents.send('wheel:open', {
    presets: cfg.presets.map((p) => ({ icon: p.icon, label: p.label, preview: p.text })),
    accent: cfg.accent,
    size: cfg.size,
    cursor: { x: cursor.x - b.x, y: cursor.y - b.y },
    width: b.width,
    height: b.height,
  });
  // Show as soon as the renderer has laid out the wheel (or after a short fallback).
  clearTimeout(showTimer);
  showTimer = setTimeout(showWheelNow, 50);

  // The blurred background loads in parallel and fades in when it's ready.
  if (cfg.blurBackground) {
    captureBackground(display, b).then((bg) => {
      if (bg && seq === openSeq && (wheelState === 'open' || wheelState === 'opening')) {
        wheelWin.webContents.send('wheel:bg', bg);
      }
    });
  }
}

async function captureBackground(display, b) {
  try {
    // It gets blurred anyway, so a quarter of full resolution is plenty and keeps it fast.
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: Math.round(b.width / 4), height: Math.round(b.height / 4) },
    });
    const src = sources.find((s) => String(s.display_id) === String(display.id)) || sources[0];
    if (!src || src.thumbnail.isEmpty()) return null;
    return 'data:image/jpeg;base64,' + src.thumbnail.toJPEG(70).toString('base64');
  } catch (e) {
    console.warn('screen capture failed', e.message);
    return null;
  }
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

// animate = true plays the shrink-away animation (cancel). Picking a slice hides
// instantly so the text gets typed without waiting.
function hideWheel(animate = false) {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  unregisterWheelKeys();
  hovered = -1;
  openSeq++;
  if (!wheelWin || wheelWin.isDestroyed()) { wheelState = 'closed'; return; }
  if (animate && wheelState === 'open') {
    wheelState = 'closing';
    wheelWin.webContents.send('wheel:dismiss');
    hideTimer = setTimeout(finishHide, 140);
  } else {
    finishHide();
  }
}

function finishHide() {
  clearTimeout(hideTimer);
  wheelState = 'closed';
  if (!wheelWin || wheelWin.isDestroyed()) return;
  wheelWin.webContents.send('wheel:close');
  wheelWin.hide();
}

function selectPreset(i) {
  const p = cfg.presets[i];
  hideWheel();
  if (p) typer.typeText(p.text, { pressEnter: p.pressEnter }).catch((e) => console.error('type failed', e));
}

ipcMain.on('wheel:ready', () => showWheelNow());
ipcMain.on('wheel:hover', (_e, i) => { hovered = Number.isInteger(i) ? i : -1; });
ipcMain.on('wheel:select', (_e, i) => { if (wheelState === 'open') selectPreset(i); });
ipcMain.on('wheel:cancel', () => hideWheel(true));
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
      ...updateMenuItems(),
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

function updateMenuItems() {
  const u = updater.getState();
  if (u.status === 'unsupported') return [];
  if (u.status === 'ready') return [{ label: `Restart to update (v${u.version})`, click: () => updater.install() }];
  if (u.status === 'downloading') return [{ label: `Downloading v${u.version}…`, enabled: false }];
  if (u.status === 'checking') return [{ label: 'Checking for updates…', enabled: false }];
  return [{ label: 'Check for updates', click: () => updater.check() }];
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
ipcMain.handle('app:info', () => ({ version: app.getVersion(), engine: typer.engine, paused, update: updater.getState() }));
ipcMain.on('update:check', () => updater.check());
ipcMain.on('update:install', () => updater.install());
