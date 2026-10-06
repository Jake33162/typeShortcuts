const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  hotkey: 'Alt+`',
  accent: '#8fb8ff',
  size: 'm',
  blurBackground: true,
  presets: [
    { icon: '👋', label: 'Greeting', text: 'Hi! Thanks for reaching out. ', pressEnter: false },
    { icon: '🙏', label: 'Thanks', text: 'Thank you so much, really appreciate it!', pressEnter: false },
    { icon: '👍', label: 'Sounds good', text: 'Sounds good to me!', pressEnter: false },
    { icon: '✉️', label: 'Email', text: 'your.email@example.com', pressEnter: false },
    { icon: '📅', label: 'Date', text: '{date}', pressEnter: false },
    { icon: '✍️', label: 'Sign-off', text: 'Best regards,\n', pressEnter: false },
  ],
};

// Defaults shipped by earlier versions. A saved value that still matches one of
// these was never changed by the user, so it's dropped and the current default applies.
const LEGACY_DEFAULTS = {
  presets: [
    [
      { icon: '👋', label: 'Greeting', text: 'Hey! Thanks for reaching out — ', pressEnter: false },
      { icon: '🙏', label: 'Thanks', text: 'Thank you so much, really appreciate it!', pressEnter: false },
      { icon: '📦', label: 'Shipping', text: "Orders ship within 1–2 business days. You'll get tracking by email as soon as it goes out.", pressEnter: false },
      { icon: '✉️', label: 'Email', text: 'you@example.com', pressEnter: false },
      { icon: '📅', label: 'Date', text: '{date}', pressEnter: false },
      { icon: '✍️', label: 'Sign-off', text: 'Best,\nJake', pressEnter: false },
    ],
  ],
};

const MAX_PRESETS = 10;
const MIN_PRESETS = 2;

const file = () => path.join(app.getPath('userData'), 'config.json');

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Fills in anything missing with the current defaults and cleans up bad values.
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

// Only values the user actually changed are written to disk. Anything left at
// its default keeps following the default, so updates can improve defaults
// without ever overwriting the user's own choices.
function toStored(full) {
  const stored = { firstRunDone: !!full.firstRunDone };
  for (const key of Object.keys(DEFAULTS)) {
    if (!same(full[key], DEFAULTS[key])) stored[key] = full[key];
  }
  return stored;
}

function dropLegacyDefaults(raw) {
  const out = { ...raw };
  for (const [key, olds] of Object.entries(LEGACY_DEFAULTS)) {
    if (key in out && olds.some((old) => same(normalize({ [key]: out[key] })[key], normalize({ [key]: old })[key]))) {
      delete out[key];
    }
  }
  return out;
}

function load() {
  let raw = {};
  try { raw = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch {}
  const cleaned = dropLegacyDefaults(raw);
  const full = normalize(cleaned);
  // Rewrite older full-copy config files in the new changed-values-only format.
  if (!same(raw, toStored(full)) && Object.keys(raw).length) {
    try { fs.writeFileSync(file(), JSON.stringify(toStored(full), null, 2)); } catch {}
  }
  return full;
}

function save(cfg) {
  const full = normalize(cfg);
  fs.mkdirSync(path.dirname(file()), { recursive: true });
  fs.writeFileSync(file(), JSON.stringify(toStored(full), null, 2));
  return full;
}

function countValidPresets(c) {
  return Array.isArray(c?.presets) ? c.presets.filter((p) => p && typeof p.text === 'string' && p.text.length).length : 0;
}

module.exports = { load, save, normalize, countValidPresets, MAX_PRESETS, MIN_PRESETS };
