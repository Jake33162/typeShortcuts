# TypeWheel

A radial quick-text wheel for Windows. Press your shortcut anywhere, flick the mouse toward a slice, click, and the text is typed into whatever you were using.

## Using it

- **Open the wheel:** default shortcut is `Alt + `` ` `` (the key left of 1).
- **Pick a slice:** move the mouse toward it and left-click, press the shortcut again, or press the slice's number.
- **Close:** right-click or Esc.
- **Settings:** left-click the tray icon, or right-click it → Settings…
- **Text tokens:** `{date}`, `{time}`, `{clipboard}` are filled in when typed.

Settings are stored in `%APPDATA%\TypeWheel\config.json`.

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
- The wheel is hidden from screen capture (OBS, recordings, screenshots). That's what lets it open instantly while the background blur loads.
