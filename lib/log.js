const { app } = require('electron');
const fs = require('fs');
const path = require('path');

// Small rolling log at %APPDATA%\TypeWheel\typewheel.log, for troubleshooting.
const file = () => path.join(app.getPath('userData'), 'typewheel.log');
const MAX = 256 * 1024;

function log(...parts) {
  const line = `[${new Date().toISOString()}] ${parts.map((p) => (p instanceof Error ? p.stack || p.message : typeof p === 'string' ? p : JSON.stringify(p))).join(' ')}\n`;
  try {
    const f = file();
    fs.mkdirSync(path.dirname(f), { recursive: true });
    try { if (fs.statSync(f).size > MAX) fs.renameSync(f, f + '.old'); } catch {}
    fs.appendFileSync(f, line);
  } catch {}
}

module.exports = { log, file };
