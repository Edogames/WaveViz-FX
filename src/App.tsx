import { type CSSProperties, type ChangeEvent, useEffect, useRef, useState } from 'react';
import { AudioEngine } from './audioEngine';
import { VisualizerCanvas, type FrequencyEmphasis, type PaletteName, type VisualMode, type VisualizerAnalyser } from './VisualizerCanvas';

type Source = 'microphone' | 'file' | 'system' | null;
type CloseBehavior = 'quit' | 'background';
type IconName = 'mic' | 'file' | 'screen' | 'stop' | 'play' | 'pause' | 'fullscreen' | 'minimize' | 'close' | 'widget' | 'shuffle' | 'spark' | 'cycle' | 'chevron' | 'speaker' | 'wave';

interface Preferences {
  mode: VisualMode;
  palette: PaletteName;
  sensitivity: number;
  smoothing: number;
  speed: number;
  emphasis: FrequencyEmphasis;
  selectedDeviceId: string;
  autoCycle: boolean;
}

interface AudioInput {
  deviceId: string;
  label: string;
}

const preferenceKey = 'waveviz.preferences.v1';
const modes: { id: VisualMode; label: string; number: string; hint: string }[] = [
  { id: 'spectrum', label: 'Spectrum', number: '01', hint: 'Frequency bars' },
  { id: 'scope', label: 'Oscilloscope', number: '02', hint: 'Waveform trace' },
  { id: 'mirror', label: 'Mirrored', number: '03', hint: 'Symmetry engine' },
  { id: 'tunnel', label: 'Tunnel', number: '04', hint: 'Infinite depth' },
  { id: 'particles', label: 'Particles', number: '05', hint: 'Solar drift' },
  { id: 'morph', label: 'Morphing', number: '06', hint: 'Organic frequency form' },
  { id: 'radial', label: 'Radial Spectrum', number: '07', hint: 'Circular frequency bars' },
  { id: 'waterfall', label: 'Waterfall', number: '08', hint: 'Scrolling spectrogram' },
  { id: 'ribbon', label: 'Spectral Ribbons', number: '09', hint: 'Layered frequency waves' },
];
const palettes: { id: PaletteName; label: string; swatches: string[] }[] = [
  { id: 'aurora', label: 'Aurora', swatches: ['#46f3e2', '#42a6ff', '#a17aff', '#fd6fe6'] },
  { id: 'electric', label: 'Electric', swatches: ['#4cecff', '#2b85ff', '#a4f858', '#f6f36b'] },
  { id: 'ember', label: 'Ember', swatches: ['#fff16a', '#ff9f48', '#ff5575', '#bf5cff'] },
  { id: 'ice', label: 'Ice', swatches: ['#d6fff9', '#80eaff', '#64a6ff', '#9a8dff'] },
  { id: 'orchid', label: 'Orchid', swatches: ['#ff8bda', '#d46aff', '#8e7dff', '#46cbff'] },
];
const defaults: Preferences = {
  mode: 'spectrum',
  palette: 'aurora',
  sensitivity: 1.15,
  smoothing: 0.72,
  speed: 1,
  emphasis: 'balanced',
  selectedDeviceId: '',
  autoCycle: false,
};

function loadPreferences(): Preferences {
  try {
    const stored = localStorage.getItem(preferenceKey);
    if (!stored) return defaults;
    const parsed = JSON.parse(stored) as Partial<Preferences>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true as const };
  switch (name) {
    case 'mic': return <svg {...common}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3m-4 0h8" /></svg>;
    case 'file': return <svg {...common}><path d="M13.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9.5Z" /><path d="M13 3v7h7M10 14l5 3-5 3z" /></svg>;
    case 'screen': return <svg {...common}><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4m-4-9 3-3 2 2 3-4" /></svg>;
    case 'stop': return <svg {...common}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>;
    case 'play': return <svg {...common} fill="currentColor" stroke="none"><path d="M7 4.8c0-.8.9-1.3 1.6-.9l11 7.1a1.2 1.2 0 0 1 0 2L8.6 20.1c-.7.5-1.6 0-1.6-.9z" /></svg>;
    case 'pause': return <svg {...common} fill="currentColor" stroke="none"><rect x="6" y="5" width="4.5" height="14" rx="1" /><rect x="13.5" y="5" width="4.5" height="14" rx="1" /></svg>;
    case 'fullscreen': return <svg {...common}><path d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3" /></svg>;
    case 'minimize': return <svg {...common}><path d="M5 12h14" /></svg>;
    case 'close': return <svg {...common}><path d="m6 6 12 12M18 6 6 18" /></svg>;
    case 'widget': return <svg {...common}><rect x="3" y="4" width="18" height="14" rx="2" /><path d="M8 21h8m-4-3v3m-4-9 2-2 2 2 4-4" /></svg>;
    case 'shuffle': return <svg {...common}><path d="m16 3 4 4-4 4m-12-7h2.5c5 0 6 10 11 10H20m-4 3 4 4-4 4m-12-4h2.5c1.7 0 2.8-1.2 3.7-2.6M12 8.5c1-.9 2-1.5 3.5-1.5H20" /></svg>;
    case 'spark': return <svg {...common}><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 12 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15ZM5 16l.7 1.3L7 18l-1.3.7L5 20l-.7-1.3L3 18l1.3-.7L5 16Z" /></svg>;
    case 'cycle': return <svg {...common}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3" /></svg>;
    case 'chevron': return <svg {...common}><path d="m7 10 5 5 5-5" /></svg>;
    case 'speaker': return <svg {...common}><path d="M4 10v4h4l5 4V6l-5 4H4Z" /><path d="M17 9a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12" /></svg>;
    case 'wave': return <svg {...common}><path d="M2 12h3l2.2-7L12 19l3.2-14 2.2 7H22" /></svg>;
  }
}

function readableError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Permission was blocked. Check your operating system privacy settings for microphone or screen capture access, then try again.';
    }
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') {
      return 'That input is unavailable. Choose another device or reconnect it, then retry.';
    }
    if (error.name === 'NotReadableError') return 'The input is busy or unavailable. Close other apps using it and try again.';
  }
  return error instanceof Error ? error.message : 'Could not start audio capture. Check browser permissions and try again.';
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value < 0) return '0:00';
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function startupMessage(): string {
  try {
    const lastInput = localStorage.getItem('waveviz.last-input');
    if (lastInput === 'microphone') return 'Last used input: microphone. Reconnect it when you are ready.';
    if (lastInput === 'system') return 'Last used input: system audio. Reconnect through the sharing picker when ready.';
    if (lastInput === 'file') return 'Last used input: local file. Choose the file again; browsers do not restore local-file access automatically.';
  } catch {
    // Keep the visualizer usable when local storage is disabled.
  }
  return 'Choose an input to wake the spectrum.';
}

export default function App() {
  const isWidget = Boolean(window.wavevizDesktop?.isWidget);
  const isSettings = Boolean(window.wavevizDesktop?.isSettings);
  const initialWidgetMode = window.wavevizDesktop?.widgetMode;
  const transparencyKey = isWidget ? `waveviz.widget-transparent.${window.wavevizDesktop?.widgetId ?? 'widget'}` : 'waveviz.window-transparent';
  const [preferences, setPreferences] = useState<Preferences>(() => {
    const saved = loadPreferences();
    return isWidget && modes.some((mode) => mode.id === initialWidgetMode)
      ? { ...saved, mode: initialWidgetMode as VisualMode }
      : saved;
  });
  const [micEnabled, setMicEnabled] = useState(() => {
    try { return localStorage.getItem('waveviz.mic-enabled') !== 'false'; } catch { return true; }
  });
  const [activeSource, setActiveSource] = useState<Source>(null);
  const [sourceName, setSourceName] = useState('No audio source');
  const [message, setMessage] = useState<string>(startupMessage);
  const [inputs, setInputs] = useState<AudioInput[]>([]);
  const [playing, setPlaying] = useState(false);
  const [trackName, setTrackName] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [closeBehavior, setCloseBehavior] = useState<CloseBehavior>('background');
  const [widgets, setWidgets] = useState<WaveVizWidgetInfo[]>([]);
  const [widgetModeChoice, setWidgetModeChoice] = useState<VisualMode>(() => loadPreferences().mode);
  const [widgetHasSignal, setWidgetHasSignal] = useState(false);
  const [transparent, setTransparent] = useState(() => {
    try { return localStorage.getItem(transparencyKey) === 'true'; } catch { return false; }
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const fileUrlRef = useRef<string | null>(null);
  const micRequestRef = useRef(0);
  const engineRef = useRef<AudioEngine | null>(null);
  if (!engineRef.current) engineRef.current = new AudioEngine();
  const engine = engineRef.current;
  const isDesktopShell = Boolean(window.wavevizDesktop);
  const sharedAnalysisRef = useRef<WaveVizAnalysisFrame | null>(null);
  const sharedAnalyserRef = useRef<VisualizerAnalyser | null>(null);
  if (!sharedAnalyserRef.current) {
    sharedAnalyserRef.current = {
      get context() { return { sampleRate: sharedAnalysisRef.current?.sampleRate ?? 44100 }; },
      get fftSize() { return sharedAnalysisRef.current?.fftSize ?? 4096; },
      get frequencyBinCount() { return sharedAnalysisRef.current?.frequencyData.length ?? 2048; },
      getByteFrequencyData(array) {
        const values = sharedAnalysisRef.current?.frequencyData;
        if (values) array.set(values.subarray(0, array.length));
        else array.fill(0);
      },
      getByteTimeDomainData(array) {
        const values = sharedAnalysisRef.current?.waveformData;
        if (values) array.set(values.subarray(0, array.length));
        else array.fill(128);
      },
    };
  }

  useEffect(() => {
    void window.wavevizDesktop?.setTransparency(transparent);
    document.body.classList.toggle('window-transparent', transparent);
    document.documentElement.classList.toggle('window-transparent', transparent);
    document.body.classList.toggle('widget-window', isWidget);
    document.documentElement.classList.toggle('widget-window', isWidget);
    try { localStorage.setItem(transparencyKey, String(transparent)); } catch { /* optional window preference */ }
  }, [isWidget, transparencyKey, transparent]);

  useEffect(() => {
    if (isWidget) {
      return window.wavevizDesktop?.onAnalysisFrame((frame) => {
        const wasActive = sharedAnalysisRef.current?.active ?? false;
        sharedAnalysisRef.current = frame;
        if (wasActive !== frame.active) setWidgetHasSignal(frame.active);
      });
    }
  }, [isWidget]);

  useEffect(() => {
    if (!isDesktopShell || isWidget || isSettings) return;
    void window.wavevizDesktop?.getWidgets().then(setWidgets);
    return window.wavevizDesktop?.onWidgetsChanged(setWidgets);
  }, [isDesktopShell, isSettings, isWidget]);

  useEffect(() => {
    if (!isDesktopShell || isWidget || isSettings || widgets.length === 0) return;
    let frequencyData = new Uint8Array(engine.analyserNode?.frequencyBinCount ?? 2048);
    let waveformData = new Uint8Array(engine.analyserNode?.fftSize ?? 4096);
    const publish = () => {
      const analyser = engine.analyserNode;
      if (analyser && frequencyData.length !== analyser.frequencyBinCount) frequencyData = new Uint8Array(analyser.frequencyBinCount);
      if (analyser && waveformData.length !== analyser.fftSize) waveformData = new Uint8Array(analyser.fftSize);
      if (analyser) {
        analyser.getByteFrequencyData(frequencyData);
        analyser.getByteTimeDomainData(waveformData);
      } else {
        frequencyData.fill(0);
        waveformData.fill(128);
      }
      window.wavevizDesktop?.publishAnalysisFrame({
        frequencyData,
        waveformData,
        sampleRate: analyser?.context.sampleRate ?? 44100,
        fftSize: analyser?.fftSize ?? waveformData.length,
        active: Boolean(activeSource && (activeSource !== 'file' || playing)),
      });
    };
    const timer = window.setInterval(publish, 34);
    publish();
    return () => window.clearInterval(timer);
  }, [activeSource, engine, isDesktopShell, isSettings, isWidget, playing, widgets.length]);

  useEffect(() => {
    if (!isSettings) return;
    void window.wavevizDesktop?.getCloseBehavior().then(setCloseBehavior);
  }, [isSettings]);

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences((previous) => ({ ...previous, [key]: value }));
  };

  useEffect(() => {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(preferences));
    } catch {
      // Private browsing or storage restrictions should not prevent visualization.
    }
  }, [preferences]);

  useEffect(() => {
    try { localStorage.setItem('waveviz.mic-enabled', String(micEnabled)); } catch { /* optional privacy preference */ }
  }, [micEnabled]);

  useEffect(() => {
    engine.setSmoothing(preferences.smoothing);
  }, [engine, preferences.smoothing]);

  useEffect(() => {
    if (activeSource) {
      try { localStorage.setItem('waveviz.last-input', activeSource); } catch { /* optional preference */ }
    }
  }, [activeSource]);

  useEffect(() => () => {
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    micRequestRef.current += 1;
    void engine.dispose();
  }, [engine]);

  useEffect(() => {
    const onFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    const unsubscribe = window.wavevizDesktop?.onFullScreenChanged(setFullscreen);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreen);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (!preferences.autoCycle) return;
    const timer = window.setInterval(() => {
      setPreferences((previous) => {
        const currentIndex = modes.findIndex((preset) => preset.id === previous.mode);
        const next = modes[(currentIndex + 1) % modes.length];
        return { ...previous, mode: next.id };
      });
    }, 12000);
    return () => window.clearInterval(timer);
  }, [preferences.autoCycle]);

  useEffect(() => {
    if (activeSource !== 'file' || !playing) return;
    const timer = window.setInterval(() => {
      const element = audioRef.current;
      if (!element) return;
      setCurrentTime(element.currentTime || 0);
      if (Number.isFinite(element.duration)) setDuration(element.duration);
    }, 220);
    return () => window.clearInterval(timer);
  }, [activeSource, playing]);

  const refreshInputs = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const available = devices.filter((device) => device.kind === 'audioinput').map((device, index) => ({
        deviceId: device.deviceId,
        label: device.label || `Audio input ${index + 1}`,
      }));
      setInputs(available);
      setPreferences((previous) => ({
        ...previous,
        selectedDeviceId: previous.selectedDeviceId || available[0]?.deviceId || '',
      }));
    } catch {
      setInputs([]);
    }
  };

  useEffect(() => {
    void refreshInputs();
  }, []);

  const startMicrophone = async (deviceId = preferences.selectedDeviceId) => {
    if (!micEnabled) {
      setMessage('Microphone is off in WaveViz. Turn it on in Input Source before connecting it.');
      return;
    }
    const requestId = ++micRequestRef.current;
    const isCurrentRequest = () => micRequestRef.current === requestId;
    setMessage('Waiting for microphone permission…');
    try {
      await engine.startMicrophone(deviceId, isCurrentRequest);
      if (!isCurrentRequest()) return;
      setActiveSource('microphone');
      const input = inputs.find((item) => item.deviceId === deviceId);
      setSourceName(input?.label || 'Microphone input');
      setMessage('Live microphone analysis · 20 Hz–20 kHz');
      setPlaying(false);
      await refreshInputs();
    } catch (error) {
      if (!isCurrentRequest()) return;
      // A remembered device can disappear; retry the system default once for that specific case.
      if (deviceId && error instanceof DOMException && ['OverconstrainedError', 'NotFoundError'].includes(error.name)) {
        try {
          updatePreference('selectedDeviceId', '');
          await engine.startMicrophone('', isCurrentRequest);
          if (!isCurrentRequest()) return;
          setActiveSource('microphone');
          setSourceName('Default microphone input');
          setMessage('Live microphone analysis · 20 Hz–20 kHz');
          await refreshInputs();
          return;
        } catch (fallbackError) {
          if (isCurrentRequest()) setMessage(readableError(fallbackError));
          return;
        }
      }
      setMessage(readableError(error));
    }
  };

  const startSystemAudio = async () => {
    micRequestRef.current += 1;
    setMessage(isDesktopShell
      ? `Starting system-audio loopback on ${window.wavevizDesktop?.platform ?? 'this computer'}…`
      : 'Choose a screen or tab, then enable audio sharing if your browser offers it…');
    try {
      await engine.startSystemAudio();
      setActiveSource('system');
      setSourceName('System audio capture');
      setMessage(`${isDesktopShell ? 'Capturing system audio' : 'Capturing shared system audio'} · 20 Hz–20 kHz`);
      setPlaying(false);
    } catch (error) {
      setMessage(readableError(error));
    }
  };

  const chooseFile = () => pickerRef.current?.click();

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    const element = audioRef.current;
    if (!element) return;
    micRequestRef.current += 1;
    if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    fileUrlRef.current = URL.createObjectURL(file);
    element.src = fileUrlRef.current;
    setTrackName(file.name);
    setDuration(0);
    setCurrentTime(0);
    setMessage('Opening local audio file…');
    try {
      await engine.startFilePlayback(element);
      setActiveSource('file');
      setSourceName('Local audio file');
      setPlaying(true);
      setMessage('Playing locally · audio never leaves this browser');
    } catch (error) {
      setPlaying(false);
      setMessage(readableError(error));
    }
    event.currentTarget.value = '';
  };

  const togglePlayback = async () => {
    const element = audioRef.current;
    if (!element?.src) {
      chooseFile();
      return;
    }
    if (playing) {
      engine.pauseFile();
      setPlaying(false);
      return;
    }
    try {
      micRequestRef.current += 1;
      await engine.resumeFile();
      setActiveSource('file');
      setPlaying(true);
      setMessage('Playing locally · audio never leaves this browser');
    } catch (error) {
      setMessage(readableError(error));
    }
  };

  const stopInput = () => {
    micRequestRef.current += 1;
    engine.stop();
    setActiveSource(null);
    setPlaying(false);
    setSourceName('No audio source');
    setMessage('Input paused. Your control settings are saved on this computer.');
  };

  const changeInput = (deviceId: string) => {
    updatePreference('selectedDeviceId', deviceId);
    if (activeSource === 'microphone') void startMicrophone(deviceId);
  };

  const toggleMicrophone = () => {
    micRequestRef.current += 1;
    const nextEnabled = !micEnabled;
    setMicEnabled(nextEnabled);
    if (!nextEnabled && activeSource === 'microphone') {
      engine.stop();
      setActiveSource(null);
      setSourceName('No audio source');
      setPlaying(false);
    }
    setMessage(nextEnabled
      ? 'Microphone use is enabled in WaveViz, but stays inactive until you select Microphone.'
      : 'Microphone is off in WaveViz. This stops capture; use your system privacy settings to remove OS access.');
  };

  const randomize = () => {
    const mode = modes[Math.floor(Math.random() * modes.length)].id;
    const palette = palettes[Math.floor(Math.random() * palettes.length)].id;
    setPreferences((previous) => ({
      ...previous,
      mode,
      palette,
      sensitivity: Number((0.75 + Math.random() * 1.45).toFixed(2)),
      speed: Number((0.7 + Math.random() * 1.2).toFixed(2)),
    }));
    setMessage('New mix of color, motion, and frequency emphasis.');
  };

  const toggleFullscreen = async () => {
    try {
      if (window.wavevizDesktop) {
        await window.wavevizDesktop.toggleFullScreen();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current?.requestFullscreen();
    } catch {
      setMessage('Full-screen mode was blocked by the browser. Try its full-screen shortcut instead.');
    }
  };

  const seek = (value: number) => {
    engine.seekFile(value);
    setCurrentTime(value);
  };

  const selectedMode = modes.find((item) => item.id === preferences.mode) ?? modes[0];
  const activePalette = palettes.find((item) => item.id === preferences.palette) ?? palettes[0];
  const analyser = engine.analyserNode;
  const sampleRateLabel = analyser ? `${(analyser.context.sampleRate / 1000).toFixed(1)} kHz` : '— kHz';
  const signalLive = Boolean(activeSource && (activeSource !== 'file' || playing));
  const fileReady = Boolean(audioRef.current?.src);

  if (isSettings) {
    const chooseCloseBehavior = (behavior: CloseBehavior) => {
      setCloseBehavior(behavior);
      void window.wavevizDesktop?.setCloseBehavior(behavior);
    };
    return (
      <main className="settings-shell">
        <header className="settings-heading"><span className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></span><div><span className="settings-eyebrow">WAVEVIZ FX</span><h1>Settings</h1></div></header>
        <section className="settings-section">
          <div className="settings-section-title">WHEN YOU CLOSE THE MAIN WINDOW</div>
          <button type="button" className={`settings-choice ${closeBehavior === 'background' ? 'is-selected' : ''}`} role="radio" aria-checked={closeBehavior === 'background'} onClick={() => chooseCloseBehavior('background')}>
            <span className="choice-radio" /><span><strong>Keep WaveViz running</strong><small>Close the window and leave the app available in the dock or taskbar. Select its app icon to reopen it.</small></span>
          </button>
          <button type="button" className={`settings-choice ${closeBehavior === 'quit' ? 'is-selected' : ''}`} role="radio" aria-checked={closeBehavior === 'quit'} onClick={() => chooseCloseBehavior('quit')}>
            <span className="choice-radio" /><span><strong>Quit WaveViz</strong><small>Closing the main window quits the app and closes its desktop widgets.</small></span>
          </button>
        </section>
        <footer className="settings-footer">Changes are saved automatically on this computer.</footer>
      </main>
    );
  }

  if (isWidget) {
    return (
      <main className={`widget-shell ${transparent ? 'is-transparent' : ''}`}>
        <header className="widget-titlebar">
          <div className="widget-window-actions">
            <button type="button" className={`widget-toggle ${transparent ? 'is-on' : ''}`} onClick={() => setTransparent((value) => !value)} title="Toggle transparent background">GLASS {transparent ? 'ON' : 'OFF'}</button>
            <button type="button" className="widget-close" onClick={() => void window.wavevizDesktop?.destroyWidget()} aria-label="Destroy widget" title="Destroy widget">×</button>
          </div>
        </header>
        <div className="widget-visual" aria-label={`${selectedMode.label} visualizer`}>
          <VisualizerCanvas analyser={sharedAnalyserRef.current} mode={preferences.mode} palette={preferences.palette} sensitivity={preferences.sensitivity} speed={preferences.speed} emphasis={preferences.emphasis} active={widgetHasSignal} transparent={transparent} />
        </div>
      </main>
    );
  }

  return (
    <main className={`app-shell ${fullscreen ? 'is-fullscreen' : ''} ${transparent ? 'is-transparent' : ''}`} ref={stageRef}>
      <audio
        ref={audioRef}
        className="audio-element"
        onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setMessage('Track finished. Choose another file or replay this one.'); }}
      />
      <input ref={pickerRef} className="visually-hidden" type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.flac,.ogg,.aiff" onChange={onFileSelected} />

      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div className="brand-name">wave<span>viz</span><sup>FX</sup></div>
          <div className="brand-divider" />
          <div className="brand-kicker">REAL-TIME AUDIO LAB</div>
        </div>
        <div className="topbar-right">
          <div className={`live-status ${signalLive ? 'is-live' : ''}`}>
            <span className="status-dot" />
            {signalLive ? 'SIGNAL LIVE' : activeSource === 'file' ? 'PAUSED' : 'STANDBY'}
          </div>
          <div className="topbar-separator" />
          {isDesktopShell && <button className={`topbar-action ${transparent ? 'action-active' : ''}`} type="button" onClick={() => setTransparent((value) => !value)} title="Toggle transparent window background">{transparent ? 'GLASS ON' : 'GLASS OFF'}</button>}
          {isDesktopShell && <button className="topbar-action" type="button" onClick={() => void window.wavevizDesktop?.openSettings()} title="Open settings">SETTINGS</button>}
          {isDesktopShell && <button className="round-button window-control" type="button" onClick={() => void window.wavevizDesktop?.minimizeWindow()} title="Minimize window" aria-label="Minimize window"><Icon name="minimize" size={15} /></button>}
          <button className={`round-button window-control ${fullscreen ? 'control-active' : ''}`} type="button" title={fullscreen ? 'Exit full screen' : 'Enter full screen'} onClick={() => void toggleFullscreen()} aria-label={fullscreen ? 'Exit full screen' : 'Enter full screen'}><Icon name="fullscreen" size={15} /></button>
          {isDesktopShell && <button className="round-button window-control window-close-control" type="button" onClick={() => void window.wavevizDesktop?.closeWindow()} title={closeBehavior === 'quit' ? 'Close window and quit WaveViz' : 'Close window and keep WaveViz running'} aria-label="Close window"><Icon name="close" size={15} /></button>}
        </div>
      </header>

      <div className="app-body">
        <section className="main-workspace">
          <div className="section-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> NOW PLAYING</div>
              <h1>{activeSource === 'file' ? trackName : activeSource ? sourceName : 'Audio in motion'}</h1>
            </div>
            <div className="section-heading-actions">
              <div className="visual-mode-chip"><span className="chip-diamond" /> {selectedMode.label.toUpperCase()} <span className="chip-sep">/</span> {selectedMode.number}</div>
              {isDesktopShell && <button className="turn-widget-button" type="button" onClick={() => void window.wavevizDesktop?.openWidget(preferences.mode)} title={`Create a ${selectedMode.label} desktop widget`}><Icon name="widget" size={13} /><span>TURN THIS INTO WIDGET</span></button>}
            </div>
          </div>

          <div className="visualizer-frame">
            <div className="frame-topline">
              <div className="frame-telemetry"><span className="telemetry-square" /> SPECTRUM ENGINE <span className="telemetry-divider">/</span> FFT 4096</div>
              <div className="frame-frequencies"><span>20 Hz</span><span className="frequency-rule" /><span>20 kHz</span></div>
            </div>
            <div className="visualizer-stage">
              <VisualizerCanvas
                analyser={analyser}
                mode={preferences.mode}
                palette={preferences.palette}
                sensitivity={preferences.sensitivity}
                speed={preferences.speed}
                emphasis={preferences.emphasis}
                active={Boolean(activeSource)}
                transparent={transparent}
              />
              {!activeSource && <div className="stage-empty-state"><span className="empty-glyph"><Icon name="wave" size={26} /></span><strong>Give the sound a shape.</strong><span>Connect a source or drop in a track to begin.</span></div>}
              {activeSource && <div className="stage-overlay-label"><span className="stage-activity-bars"><i /><i /><i /><i /><i /></span> {sourceName}</div>}
              <div className="stage-corner stage-corner-tl" /><div className="stage-corner stage-corner-tr" /><div className="stage-corner stage-corner-bl" /><div className="stage-corner stage-corner-br" />
              <div className="stage-coordinate">WZ–{selectedMode.number} <span>●</span> {sampleRateLabel}</div>
            </div>
            <div className="frequency-labels"><span>LOW / SUB-BASS</span><span>MIDS</span><span>UPPER / AIR</span></div>
          </div>

          <div className="transport-row">
            <button className={`transport-play ${playing ? 'is-playing' : ''}`} type="button" onClick={() => void togglePlayback()} aria-label={playing ? 'Pause local track' : fileReady ? 'Resume local track' : 'Choose a local audio file'} title={fileReady ? (playing ? 'Pause track' : 'Resume track') : 'Choose a local audio file'}>
              <Icon name={playing ? 'pause' : 'play'} size={16} />
            </button>
            <div className="track-info"><span className="track-title">{trackName || (activeSource ? sourceName : 'No track loaded')}</span><span className="track-subtitle">{activeSource === 'file' ? 'LOCAL PLAYBACK' : activeSource ? 'LIVE INPUT' : 'LOAD A TRACK OR CONNECT AUDIO'}</span></div>
            <span className="track-time">{formatTime(currentTime)}</span>
            <input className="timeline" type="range" min={0} max={Math.max(1, duration)} step={0.1} value={Math.min(currentTime, duration || 1)} onChange={(event) => seek(Number(event.currentTarget.value))} disabled={activeSource !== 'file' || !duration} aria-label="Seek through track" style={{ '--progress': `${duration ? (currentTime / duration) * 100 : 0}%` } as CSSProperties} />
            <span className="track-time">{formatTime(duration)}</span>
            <button className="stop-button" type="button" onClick={stopInput} disabled={!activeSource} title="Stop audio input"><Icon name="stop" size={13} /></button>
          </div>

          <div className="signal-note"><span className="signal-note-icon"><Icon name="spark" size={14} /></span><span>{message}</span><span className="signal-note-right">LOCAL PROCESSING <b>·</b> NO UPLOAD</span></div>
        </section>

        <aside className="control-panel">
          {isDesktopShell && <div className="panel-section desktop-widgets-section">
            <div className="panel-heading"><div><span className="panel-number">00</span><h2>DESKTOP WIDGETS</h2></div><span className="palette-name">{widgets.length} OPEN</span></div>
            <div className="widget-create-row">
              <div className="select-container widget-mode-select"><select aria-label="New widget visualizer" value={widgetModeChoice} onChange={(event) => setWidgetModeChoice(event.currentTarget.value as VisualMode)}>
                {modes.map((mode) => <option key={mode.id} value={mode.id}>{mode.label}</option>)}
              </select></div>
              <button className="widget-create-button" type="button" onClick={() => void window.wavevizDesktop?.openWidget(widgetModeChoice)}>CREATE WIDGET</button>
            </div>
            <div className="desktop-widget-list">
              {widgets.length === 0 && <span className="widget-list-empty">No widgets yet</span>}
              {widgets.map((widget, index) => {
                const mode = modes.find((preset) => preset.id === widget.mode) ?? modes[0];
                return <div className="desktop-widget-row" key={widget.id}>
                  <button className="desktop-widget-focus" type="button" onClick={() => void window.wavevizDesktop?.focusWidget(widget.id)} title={`Focus ${mode.label} widget`}><span className="widget-row-dot" /> WIDGET {index + 1} <b>{mode.label.toUpperCase()}</b></button>
                  <button className={`desktop-widget-pin ${widget.alwaysOnTop ? 'is-on' : ''}`} type="button" onClick={() => void window.wavevizDesktop?.setWidgetAlwaysOnTop(widget.id, !widget.alwaysOnTop)} aria-label={`${widget.alwaysOnTop ? 'Unpin' : 'Pin'} ${mode.label} widget`} title={`${widget.alwaysOnTop ? 'Turn off' : 'Turn on'} always on top`}>PIN</button>
                  <button className="desktop-widget-destroy" type="button" onClick={() => void window.wavevizDesktop?.destroyWidget(widget.id)} aria-label={`Destroy ${mode.label} widget`} title="Destroy widget">×</button>
                </div>;
              })}
            </div>
          </div>}
          <div className="panel-section input-section">
            <div className="panel-heading input-heading-tools"><div><span className="panel-number">01</span><h2>INPUT SOURCE</h2></div><div className="input-heading-actions"><button className={`mic-gate ${micEnabled ? 'mic-gate-enabled' : 'mic-gate-off'} ${activeSource === 'microphone' ? 'mic-gate-live' : ''}`} type="button" onClick={toggleMicrophone} aria-pressed={micEnabled} title={micEnabled ? 'Microphone is available only after you select its input. Click to block WaveViz from using it.' : 'Microphone is blocked in WaveViz. Click to make it available.'}><span>MIC</span><strong>{micEnabled ? activeSource === 'microphone' ? 'ON' : 'READY' : 'OFF'}</strong></button><span className={`mini-led ${activeSource ? 'led-on' : ''}`} /></div></div>
            <button className={`source-card ${activeSource === 'microphone' ? 'source-selected' : ''}`} type="button" onClick={() => void startMicrophone()} disabled={!micEnabled}>
              <span className="source-icon"><Icon name="mic" size={16} /></span><span className="source-label"><strong>Microphone</strong><small>{micEnabled ? 'Live room / line input' : 'Disabled in WaveViz'}</small></span><span className="source-arrow"><Icon name="chevron" size={13} /></span>
            </button>
            <div className="input-select-wrap">
              <label htmlFor="input-device">INPUT DEVICE</label>
              <select id="input-device" value={preferences.selectedDeviceId} onChange={(event) => changeInput(event.currentTarget.value)}>
                {inputs.length === 0 && <option value="">System default input</option>}
                {inputs.map((input, index) => <option key={input.deviceId || index} value={input.deviceId}>{input.label}</option>)}
              </select>
              <span className="select-chevron"><Icon name="chevron" size={12} /></span>
            </div>
            <button className={`source-card ${activeSource === 'system' ? 'source-selected' : ''}`} type="button" onClick={() => void startSystemAudio()}>
              <span className="source-icon"><Icon name="screen" size={16} /></span><span className="source-label"><strong>System audio</strong><small>{isDesktopShell ? 'Native desktop loopback' : 'Share a screen or browser tab'}</small></span><span className="source-arrow"><Icon name="chevron" size={13} /></span>
            </button>
            <div className="source-help">{isDesktopShell ? 'The desktop build requests system loopback audio through screen capture. Availability and permissions depend on your desktop environment. Mic input can stay off.' : 'System audio depends on browser support and the sharing picker. If no audio option appears, use a file or microphone.'}</div>
            <button className="file-button" type="button" onClick={chooseFile}><Icon name="file" size={15} /><span>OPEN LOCAL AUDIO FILE</span><span className="file-format">MP3 · WAV · M4A</span></button>
          </div>

          <div className="panel-section preset-section">
            <div className="panel-heading"><div><span className="panel-number">02</span><h2>VISUAL PRESETS</h2></div><button className="shuffle-button" type="button" onClick={randomize} title="Randomize visualization"><Icon name="shuffle" size={14} /> <span>RANDOM</span></button></div>
            <div className="preset-list">
              {modes.map((preset) => <button key={preset.id} type="button" className={`preset-row ${preferences.mode === preset.id ? 'preset-active' : ''}`} onClick={() => updatePreference('mode', preset.id)}>
                <span className={`preset-icon preset-icon-${preset.id}`}><i /><i /><i /><i /><i /></span><span className="preset-copy"><strong>{preset.label}</strong><small>{preset.hint}</small></span><span className="preset-index">{preset.number}</span><span className="preset-check">{preferences.mode === preset.id ? '●' : ''}</span>
              </button>)}
            </div>
            <button className={`auto-cycle ${preferences.autoCycle ? 'cycle-on' : ''}`} type="button" onClick={() => updatePreference('autoCycle', !preferences.autoCycle)}><Icon name="cycle" size={15} /><span>AUTO-CYCLE PRESETS</span><span className="toggle-track"><i /></span></button>
          </div>

          <div className="panel-section tuning-section">
            <div className="panel-heading"><div><span className="panel-number">03</span><h2>FINE TUNING</h2></div><span className="tune-icon"><Icon name="spark" size={14} /></span></div>
            <label className="slider-control"><span><b>SENSITIVITY</b><em>{preferences.sensitivity.toFixed(2)}×</em></span><input type="range" min="0.45" max="2.6" step="0.05" value={preferences.sensitivity} onChange={(event) => updatePreference('sensitivity', Number(event.currentTarget.value))} /></label>
            <label className="slider-control"><span><b>SMOOTHING</b><em>{Math.round(preferences.smoothing * 100)}%</em></span><input type="range" min="0.05" max="0.94" step="0.01" value={preferences.smoothing} onChange={(event) => updatePreference('smoothing', Number(event.currentTarget.value))} /></label>
            <label className="slider-control"><span><b>ANIMATION SPEED</b><em>{preferences.speed.toFixed(1)}×</em></span><input type="range" min="0.5" max="2.2" step="0.1" value={preferences.speed} onChange={(event) => updatePreference('speed', Number(event.currentTarget.value))} /></label>
            <div className="emphasis-select"><label htmlFor="frequency-emphasis">FREQUENCY EMPHASIS</label><div className="select-container"><select id="frequency-emphasis" value={preferences.emphasis} onChange={(event) => updatePreference('emphasis', event.currentTarget.value as FrequencyEmphasis)}><option value="balanced">Balanced · full spectrum</option><option value="bass">Bass · 20–250 Hz</option><option value="mids">Mids · 250–4 kHz</option><option value="treble">Treble · 4–20 kHz</option></select><span><Icon name="chevron" size={12} /></span></div></div>
          </div>

          <div className="panel-section palette-section">
            <div className="panel-heading"><div><span className="panel-number">04</span><h2>COLOR FIELD</h2></div><span className="palette-name">{activePalette.label.toUpperCase()}</span></div>
            <div className="palette-list" role="group" aria-label="Color palette">
              {palettes.map((item) => <button key={item.id} className={`palette-swatch ${preferences.palette === item.id ? 'palette-selected' : ''}`} type="button" onClick={() => updatePreference('palette', item.id)} aria-label={`${item.label} color palette`} title={item.label}>
                <span>{item.swatches.map((color) => <i key={color} style={{ backgroundColor: color }} />)}</span>{preferences.palette === item.id && <b>✓</b>}
              </button>)}
            </div>
          </div>

          <div className="panel-footer"><span className="footer-pulse" /><span>ANALYSIS RANGE</span><b>20 Hz – 20 kHz</b></div>
        </aside>
      </div>

      <footer className="app-footer"><span><span className="footer-brand-dot" /> WAVEVIZ FX <b>·</b> AUDIO IN MOTION</span><span>RUNNING LOCALLY IN YOUR BROWSER <b>·</b> BUILT FOR APPLE SILICON</span><span className="footer-version">v1.0 <Icon name="speaker" size={12} /></span></footer>
    </main>
  );
}
