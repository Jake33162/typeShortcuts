const { clipboard } = require('electron');
const { execFile } = require('child_process');

// Native keyboard access through user32.dll. koffi ships prebuilt binaries,
// so nothing has to compile in CI. If it fails to load we fall back to PowerShell.
let k = null;
try {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  k = {
    keybd: user32.func('void __stdcall keybd_event(uint8_t bVk, uint8_t bScan, uint32_t dwFlags, uintptr_t dwExtraInfo)'),
    state: user32.func('int16_t __stdcall GetAsyncKeyState(int vKey)'),
  };
} catch (e) {
  console.warn('[typer] koffi unavailable, using PowerShell fallback:', e.message);
}

const engine = k ? 'native' : 'powershell';
const VK = { SHIFT: 0x10, CONTROL: 0x11, MENU: 0x12, LWIN: 0x5b, RWIN: 0x5c, V: 0x56, RETURN: 0x0d };
const KEYUP = 0x0002;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// If the user picked a slice by pressing the hotkey again, its modifiers are
// still held. Pasting now would send Ctrl+Alt+V, so wait for them to come up.
async function waitForModifiers(timeout = 1500) {
  if (!k) return sleep(200);
  const mods = [VK.SHIFT, VK.CONTROL, VK.MENU, VK.LWIN, VK.RWIN];
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (!mods.some((v) => (k.state(v) & 0x8000) !== 0)) return;
    await sleep(15);
  }
}

const tap = (vk) => { k.keybd(vk, 0, 0, 0); k.keybd(vk, 0, KEYUP, 0); };
function ctrlV() {
  k.keybd(VK.CONTROL, 0, 0, 0);
  k.keybd(VK.V, 0, 0, 0);
  k.keybd(VK.V, 0, KEYUP, 0);
  k.keybd(VK.CONTROL, 0, KEYUP, 0);
}
const psSend = (keys) =>
  new Promise((res) =>
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', `(New-Object -ComObject WScript.Shell).SendKeys('${keys}')`],
      { windowsHide: true },
      () => res()
    )
  );

function snapshot() {
  try {
    if (clipboard.availableFormats().some((f) => f.startsWith('image/'))) {
      const img = clipboard.readImage();
      if (!img.isEmpty()) return { image: img };
    }
    const text = clipboard.readText();
    return text ? { text } : null;
  } catch {
    return null;
  }
}

function restore(s) {
  if (!s) return clipboard.clear();
  if (s.image) clipboard.writeImage(s.image);
  else clipboard.writeText(s.text);
}

function expandTokens(text, saved) {
  const now = new Date();
  return text
    .replace(/\{date\}/g, now.toLocaleDateString('en-US'))
    .replace(/\{time\}/g, now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    .replace(/\{clipboard\}/g, saved?.text || '');
}

async function typeText(text, { pressEnter = false } = {}) {
  const saved = snapshot();
  clipboard.writeText(expandTokens(text, saved));
  await waitForModifiers();
  await sleep(30);

  if (k) {
    ctrlV();
    if (pressEnter) { await sleep(60); tap(VK.RETURN); }
  } else {
    await psSend('^v');
    if (pressEnter) await psSend('{ENTER}');
  }

  // Give the target app time to read the clipboard before we put the old contents back.
  await sleep(400);
  restore(saved);
}

module.exports = { typeText, engine };
