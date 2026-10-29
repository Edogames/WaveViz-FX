# WaveViz — TODO

- [x] **Capture and analyze local audio**
  - Make a music visualizer for a Mac mini with Apple silicon as the target.
  - Listen to audio across the approximately 20 Hz–20 kHz human-audible frequency spectrum in real time using FFT-based analysis.
  - Capture live audio from the Mac microphone and let the user select an available input device; provide clear macOS permission handling.
  - Offer optional system-audio capture for music playing on the Mac through supported browser capture APIs, with permission and compatibility guidance.
  - Provide a local audio-file playback input so music can be visualized without relying on unsupported system-audio capture.

- [x] **Render reactive retro visualizations**
  - Make visuals inspired by classic Windows Media Player visualizations.
  - Include spectrum bars, oscilloscope waves, mirrored geometry, tunnels, and psychedelic particle patterns.
  - React to bass, midrange, treble, amplitude, beat, and spectral energy.

- [x] **Provide visualization controls and presets**
  - Let the user adjust sensitivity, smoothing, color palette, animation speed, and frequency emphasis.
  - Include a preset browser with quick switching, a randomize mode, and automatic cycling between visualizations.

- [x] **Support an adaptable Mac display experience**
  - Provide a resizable window and a distraction-free full-screen mode suitable for an external display.
  - Optimize rendering for Apple silicon using hardware-accelerated graphics and keep audio analysis low-latency.

- [x] **Remember local preferences**
  - Persist the last-used input, visualization preset, and control settings locally.

- [x] **Fix the reported canvas resize error**
  - Fix the reported `ResizeObserver loop completed with undelivered notifications` error on page `/`.

- [x] **Provide a native-like Mac desktop build with direct system audio**
  - Make this a native app, not just a website, or at least let it run like a native app with a Mac build.
  - Let the Mac build listen directly to system sounds without a browser screen/tab chooser after the user grants the required macOS system-audio permission; do not bypass macOS consent.

- [x] **Give the user a microphone-off option**
  - Include an option to turn off the microphone for this app; when off, stop active mic capture and block new microphone use until re-enabled.
