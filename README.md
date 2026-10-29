# WaveViz FX

WaveViz is a locally processed audio visualizer with a retro media-player feel. It runs in a browser and as an Electron desktop app on macOS, Windows, and Linux.

## Desktop builds

Install dependencies with `pnpm install`, then use one of these commands:

| Command | Output |
| --- | --- |
| `pnpm package:mac` | Apple-silicon macOS app ZIP, macOS 14.2 or later |
| `pnpm package:win` | Windows x64 and arm64 NSIS installers |
| `pnpm package:linux` | Linux x64 and arm64 AppImage and Debian packages |
| `pnpm package:all` | All of the above, when the required platform build tools are available |

Packages are written to `release/`. For the most reliable result, run each build on its target OS. macOS packages use the host's Apple-silicon architecture and are unsigned/not notarized unless signing credentials are configured. Linux packages need Linux packaging tools or Docker; Windows packages need Windows or Wine. This project has no native Node add-ons, so x64 and arm64 desktop bundles are configured for all three operating systems.

### Window transparency and desktop behavior

The main window and widgets use frameless native windows with alpha transparency. Their **GLASS** controls enable or disable the translucent visualizer backgrounds. On Windows and X11 Linux, transparency depends on the desktop compositor being enabled. Wayland compositors vary in their support for transparent surfaces; Wayland also restricts programmatic window positioning and may restrict resizing and always-on-top behavior. The widget's drag area uses the native frameless-window drag region so the desktop can move it.

Always-on-top and showing on all workspaces are delegated to Electron and the window manager. Electron does not support always-on-top on Wayland, and all-workspace visibility is unavailable on Windows.

### Audio capture

The desktop app requests screen capture with system loopback audio. OS privacy prompts, PipeWire or desktop portal configuration, and the selected capture source can affect availability. Microphone use is only requested when Microphone is selected. Audio is processed locally and is not saved or uploaded.

## Browser Preview

In a current browser, choose a local audio file for reliable playback or grant microphone access to visualize a room or line input. Browser system-audio capture is best-effort and depends on screen/tab sharing support.

The app analyzes roughly 20 Hz–20 kHz and includes Spectrum, Oscilloscope, Mirrored, Tunnel, Particles, Morphing, Radial Spectrum, Waterfall, and Spectral Ribbons modes. Sensitivity, smoothing, speed, color palette, frequency emphasis, the last-used source type, and selected microphone are stored locally. The browser asks you to reconnect an audio source and choose a local file again on a later session.

## Local development

```sh
pnpm install
pnpm dev
```

Run the desktop development shell with `pnpm desktop:dev`. Create the production static bundle with `pnpm build`.
