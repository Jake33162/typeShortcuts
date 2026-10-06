const { app, Notification } = require('electron');

// Auto-update from GitHub Releases. Works for the installed (Setup) build only;
// the portable exe and dev runs skip it.
let autoUpdater = null;
const state = { status: 'idle', version: null, error: null };
let onChange = () => {};

function set(status, version, error = null) {
  state.status = status;
  if (version) state.version = version;
  state.error = error;
  onChange({ ...state });
}

function init(cb) {
  if (cb) onChange = cb;
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_FILE) return set('unsupported');
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    return set('unsupported', null, e.message);
  }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => set('checking'));
  autoUpdater.on('update-available', (i) => set('downloading', i.version));
  autoUpdater.on('update-not-available', () => set('current'));
  autoUpdater.on('update-downloaded', (i) => {
    set('ready', i.version);
    if (Notification.isSupported()) {
      const n = new Notification({ title: 'TypeWheel update ready', body: `Click to restart into v${i.version}.` });
      n.on('click', install);
      n.show();
    }
  });
  autoUpdater.on('error', (e) => set('error', null, e?.message || String(e)));

  check();
  setInterval(check, 4 * 60 * 60 * 1000); // every 4 hours while running
}

function check() {
  if (!autoUpdater || state.status === 'downloading' || state.status === 'ready') return;
  autoUpdater.checkForUpdates().catch((e) => set('error', null, e?.message || String(e)));
}

function install() {
  if (!autoUpdater || state.status !== 'ready') return;
  app.isQuitting = true;
  autoUpdater.quitAndInstall(true, true); // silent install, relaunch afterward
}

const getState = () => ({ ...state });

module.exports = { init, check, install, getState };
