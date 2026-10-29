type WaveVizMode = 'spectrum' | 'scope' | 'mirror' | 'tunnel' | 'particles' | 'morph' | 'radial' | 'waterfall' | 'ribbon';
interface WaveVizWidgetInfo { id: number; mode: WaveVizMode; alwaysOnTop: boolean; }
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
    widgetMode: string | null;
    widgetId: number | null;
    openWidget: (mode: WaveVizMode) => Promise<number | undefined>;
    destroyWidget: (id?: number) => Promise<void>;
    getWidgets: () => Promise<WaveVizWidgetInfo[]>;
    focusWidget: (id: number) => Promise<void>;
    setWidgetAlwaysOnTop: (id: number, enabled: boolean) => Promise<boolean>;
    onWidgetsChanged: (callback: (widgets: WaveVizWidgetInfo[]) => void) => () => void;
    publishAnalysisFrame: (frame: WaveVizAnalysisFrame) => void;
    onAnalysisFrame: (callback: (frame: WaveVizAnalysisFrame) => void) => () => void;
    openSettings: () => Promise<number | undefined>;
    getCloseBehavior: () => Promise<'quit' | 'background'>;
    setCloseBehavior: (behavior: 'quit' | 'background') => Promise<boolean>;
    closeWindow: () => Promise<void>;
    minimizeWindow: () => Promise<void>;
    toggleFullScreen: () => Promise<boolean>;
    onFullScreenChanged: (callback: (fullscreen: boolean) => void) => () => void;
    setTransparency: (enabled: boolean) => Promise<boolean>;
  };
}
