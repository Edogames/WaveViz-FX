# macOS system-audio capture notes

WaveViz's desktop build uses Electron's `desktopCapturer` loopback path. The current Electron documentation states that Electron 39 and later use Apple's CoreAudio Tap API by default for system-audio capture on macOS 14.2 and later. Electron requires `NSAudioCaptureUsageDescription` in the app's Info.plist for that path. WaveViz handles the display-media request in its main process, selects a screen source without showing the browser tab picker, requests `audio: 'loopback'`, and discards the returned video track in the renderer.

This does not bypass macOS privacy. The user must grant the OS audio-capture permission; macOS lets them review and disable screen/system-audio access in System Settings → Privacy & Security → Screen & System Audio Recording. WaveViz asks for microphone input only when the user chooses it and exposes an in-app switch that stops active capture and blocks future mic requests. Turning that switch off does not revoke macOS's separate permission; the user can revoke that in System Settings.

The system-audio loopback build targets macOS 14.2 or later. Apple-silicon ZIP packaging can be cross-built on Linux, but electron-builder describes building each architecture on matching Apple hardware as the most reliable approach. A Linux-produced archive is unsigned and not notarized; Gatekeeper may require the user to approve opening it. The Mac build must be tested on actual macOS before claiming verified TCC prompt or loopback behavior.

## Sources

- [Electron `desktopCapturer` API](https://electronjs.org/docs/latest/api/desktop-capturer): macOS 14.2+ CoreAudio Tap loopback, `NSAudioCaptureUsageDescription`, and platform caveats.
- [Apple ScreenCaptureKit](https://developer.apple.com/documentation/screencapturekit): user consent is required before capturing screen/audio content.
- [Apple: Control access to screen and system audio recording on Mac](https://support.apple.com/guide/mac-help/control-access-screen-system-audio-recording-mchld6aa7d23/mac): the user can grant audio-only access and revoke it in Privacy & Security.
- [electron-builder macOS targets and architecture guidance](https://www.electron.build/docs/mac): arm64 ZIP target, cross-compilation caveat, and signing/notarization expectations.
