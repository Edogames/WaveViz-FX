type WaveVizMode = 'spectrum' | 'scope' | 'mirror' | 'tunnel' | 'particles' | 'morph' | 'radial' | 'waterfall' | 'ribbon';
interface WaveVizWidgetInfo { id: number; mode: WaveVizMode; alwaysOnTop: boolean; }
interface WaveVizCustomPalette { id: string; label: string; swatches: [string, string, string, string]; }
interface WaveVizAnalysisFrame {
  frequencyData: Uint8Array<ArrayBuffer>;
  waveformData: Uint8Array<ArrayBuffer>;
  sampleRate: number;
  fftSize: number;
  active: boolean;
}

interface Window {
  wavevizDesktop?: {
    platform: NodeJS.Platform;
    isWidget: boolean;
    isSettings: boolean;
    isColorPicker: boolean;
    widgetMode: string | null;
    widgetId: number | null;
    openWidget: (mode: WaveVizMode) => Promise<number | undefined>;
    destroyWidget: (id?: number) => Promise<void>;
    getWidgets: () => Promise<WaveVizWidgetInfo[]>;
    focusWidget: (id: number) => Promise<void>;
    setWidgetAlwaysOnTop: (id: number, enabled: boolean) => Promise<boolean>;
    setWidgetMode: (id: number, mode: WaveVizMode) => Promise<boolean>;
    onWidgetModeChanged: (callback: (mode: WaveVizMode) => void) => () => void;
    onWidgetsChanged: (callback: (widgets: WaveVizWidgetInfo[]) => void) => () => void;
    openColorPicker: () => Promise<number | undefined>;
    publishCustomPalettes: (palettes: WaveVizCustomPalette[]) => void;
    onCustomPalettesChanged: (callback: (palettes: WaveVizCustomPalette[]) => void) => () => void;
    publishAnalysisFrame: (frame: WaveVizAnalysisFrame) => void;
    onAnalysisFrame: (callback: (frame: WaveVizAnalysisFrame) => void) => () => void;
    openSettings: () => Promise<number | undefined>;
    getCloseBehavior: () => Promise<'quit' | 'background'>;
    setCloseBehavior: (behavior: 'quit' | 'background') => Promise<boolean>;
    getWindowControlsPosition: () => Promise<'left' | 'right'>;
    setWindowControlsPosition: (position: 'left' | 'right') => Promise<boolean>;
    onWindowControlsPositionChanged: (callback: (position: 'left' | 'right') => void) => () => void;
    closeWindow: () => Promise<void>;
    minimizeWindow: () => Promise<void>;
    toggleFullScreen: () => Promise<boolean>;
    onFullScreenChanged: (callback: (fullscreen: boolean) => void) => () => void;
    setTransparency: (enabled: boolean) => Promise<boolean>;
  };
}
