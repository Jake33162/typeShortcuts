# TypeWheel

A radial quick-text wheel for Windows. Press your shortcut anywhere, flick the mouse toward a slice, click, and the text is typed into whatever you were using.

## Using it

- **Open the wheel:** default shortcut is `Alt + `` ` `` (the key left of 1).
- **Pick a slice:** move the mouse toward it and left-click, press the shortcut again, or press the number shown on the slice (1–9, then 0 for a tenth slice; numpad works too).
- **Close:** right-click or Esc.
- **Settings:** left-click the tray icon, or right-click it → Settings…

## Text tokens

Put these anywhere in a slice's text. They're replaced at the moment the slice is typed.

| Token | Becomes | Example |
|---|---|---|
| `{date}` | Today's date | 10/6/2026 |
| `{time}` | Current time | 2:45 PM |
| `{clipboard}` | Whatever text you last copied | `Thanks for sending {clipboard}!` |

Settings are stored in `%APPDATA%\TypeWheel\config.json`. Only settings you've changed are saved there. Anything left at its default follows the defaults of whatever version you're running, so updates can improve the defaults without ever overwriting your own shortcut, colors or slices.

## Building and updates (no local tools needed)

Every push to `main` builds a new version (`1.1.<run number>`) and publishes it as a GitHub Release with the installer, the portable exe, and `latest.yml`.

The installed (Setup) version checks for new releases at launch and every 4 hours, downloads them in the background, and shows a notification. Click it, or use **Restart to update** in the tray menu. Otherwise it installs the next time TypeWheel quits. The portable exe doesn't auto-update.

**The repo must be public** for installed copies to download releases.

To change the major/minor version, edit `version` in `package.json` (e.g. `2.0.0`). The patch number is set by the build.

The builds are unsigned, so Windows SmartScreen will warn the first time. Click **More info → Run anyway**.

## Notes

- Text is pasted via the clipboard and your previous clipboard (text or image) is restored afterward.
- To type into apps running as administrator, TypeWheel also has to run as administrator.
- Exclusive-fullscreen games won't show the overlay; borderless windowed works.
- If something doesn't work, right-click the tray icon → **Open log file** and send the last few lines.
- The wheel is hidden from screen capture (OBS, recordings, screenshots). That's what lets it open instantly while the background blur loads.
