# TypeWheel

A radial quick-text wheel for Windows. Press your shortcut anywhere, flick the mouse toward a slice, click, and the text is typed into whatever you were using.

## Using it

- **Open the wheel:** default shortcut is `Alt + `` ` `` (the key left of 1).
- **Pick a slice:** move the mouse toward it and left-click, press the shortcut again, or press the slice's number.
- **Cancel:** Esc, right-click, or click without pointing at a slice.
- **Settings:** left-click the tray icon, or right-click it → Settings…
- **Text tokens:** `{date}`, `{time}`, `{clipboard}` are filled in when typed.

Settings are stored in `%APPDATA%\TypeWheel\config.json`.

## Building (no local tools needed)

Every push to `main` runs the **Build Windows app** workflow. Download the `TypeWheel-windows` artifact from the run. It contains:

- `TypeWheel-Setup-x.y.z.exe` (installs per-user, best if you use Start with Windows)
- `TypeWheel-Portable-x.y.z.exe` (single file, nothing installed)

Push a tag like `v1.0.0` to also attach both files to a GitHub Release.

The builds are unsigned, so Windows SmartScreen will warn the first time. Click **More info → Run anyway**.

## Notes

- Text is pasted via the clipboard and your previous clipboard (text or image) is restored afterward.
- To type into apps running as administrator, TypeWheel also has to run as administrator.
- Exclusive-fullscreen games won't show the overlay; borderless windowed works.
