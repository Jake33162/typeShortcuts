const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  hotkey: 'Alt+`',
  accent: '#8fb8ff',
  size: 'm',
  blurBackground: true,
  firstRunDone: false,
  presets: [
    { icon: '👋', label: 'Greeting', text: 'Hey! Thanks for reaching out — ', pressEnter: false },
    { icon: '🙏', label: 'Thanks', text: 'Thank you so much, really appreciate it!', pressEnter: false },
    { icon: '📦', label: 'Shipping', text: "Orders ship within 1–2 business days. You'll get tracking by email as soon as it goes out.", pressEnter: false },
    { icon: '✉️', label: 'Email', text: 'you@example.com', pressEnter: false },
    { icon: '📅', label: 'Date', text: '{date}', pressEnter: false },
    { icon: '✍️', label: 'Sign-off', text: 'Best,\nJake', pressEnter: false },
  ],
};

const MAX_PRESETS = 8;
const MIN_PRESETS = 2;

const file = () => path.join(app.getPath('userData'), 'config.json');

function normalize(c = {}) {
  const out = JSON.parse(JSON.stringify(DEFAULTS));
  if (typeof c.hotkey === 'string' && c.hotkey.trim()) out.hotkey = c.hotkey.trim();
  if (/^#[0-9a-f]{6}$/i.test(c.accent || '')) out.accent = c.accent;
  if (['s', 'm', 'l'].includes(c.size)) out.size = c.size;
  if (c.blurBackground !== undefined) out.blurBackground = !!c.blurBackground;
  out.firstRunDone = !!c.firstRunDone;

  if (Array.isArray(c.presets)) {
    const ps = c.presets
      .filter((p) => p && typeof p.text === 'string' && p.text.length)
      .slice(0, MAX_PRESETS)
      .map((p) => ({
        icon: String(p.icon || '').slice(0, 8),
        label: (String(p.label || '').trim() || p.text.replace(/\s+/g, ' ').slice(0, 18)).slice(0, 40),
        text: String(p.text).slice(0, 20000),
        pressEnter: !!p.pressEnter,
      }));
    if (ps.length >= MIN_PRESETS) out.presets = ps;
  }
  return out;
}

function load() {
  try {
    return normalize(JSON.parse(fs.readFileSync(file(), 'utf8')));
  } catch {
    return normalize({});
  }
}

function save(cfg) {
  const c = normalize(cfg);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(c, null, 2));
  return c;
}

function countValidPresets(c) {
  return Array.isArray(c?.presets) ? c.presets.filter((p) => p && typeof p.text === 'string' && p.text.length).length : 0;
}

module.exports = { load, save, normalize, countValidPresets, MAX_PRESETS, MIN_PRESETS };
