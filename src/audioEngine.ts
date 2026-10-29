export type AudioInputKind = 'microphone' | 'file' | 'system';

/** All audio remains in the browser; nothing is uploaded or sent to a server. */
export class AudioEngine {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private activeNode: AudioNode | null = null;
  private activeStream: MediaStream | null = null;
  private activeKind: AudioInputKind | null = null;
  private fileElement: HTMLAudioElement | null = null;
  private fileNode: MediaElementAudioSourceNode | null = null;

  get analyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  private async prepare(): Promise<{ context: AudioContext; analyser: AnalyserNode }> {
    const AudioContextConstructor = window.AudioContext;
    if (!AudioContextConstructor) {
      throw new Error('This browser does not provide the Web Audio API. Try a recent version of Safari or Chrome.');
    }
    this.context ??= new AudioContextConstructor({ latencyHint: 'interactive' });
    if (!this.analyser) {
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.minDecibels = -88;
      this.analyser.maxDecibels = -12;
      this.analyser.smoothingTimeConstant = 0.72;
    }
    if (this.context.state === 'suspended') await this.context.resume();
    return { context: this.context, analyser: this.analyser };
  }

  private clearActive(): void {
    try {
      this.activeNode?.disconnect();
    } catch {
      // The graph may already have been disconnected by a browser permission change.
    }
    if (this.activeKind === 'file') this.fileElement?.pause();
    this.activeStream?.getTracks().forEach((track) => track.stop());
    this.activeNode = null;
    this.activeStream = null;
    this.activeKind = null;
  }

  private connect(node: AudioNode, kind: AudioInputKind, stream: MediaStream | null = null): void {
    const analyser = this.analyser;
    if (!analyser) throw new Error('Audio analysis is not ready yet.');
    this.clearActive();
    node.connect(analyser);
    // Local music files are also routed to speakers. Live inputs are analysis-only to avoid feedback.
    if (kind === 'file') node.connect(this.context!.destination);
    this.activeNode = node;
    this.activeStream = stream;
    this.activeKind = kind;
  }

  async startMicrophone(deviceId = '', isCurrentRequest: () => boolean = () => true): Promise<void> {
    const { context } = await this.prepare();
    if (!isCurrentRequest()) throw new DOMException('Microphone request was cancelled.', 'AbortError');
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone capture is unavailable here. Open WaveViz in a browser with microphone access over HTTPS.');
    }
    const deviceConstraint = deviceId ? { deviceId: { exact: deviceId } } : {};
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        ...deviceConstraint,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });
    if (!isCurrentRequest()) {
      stream.getTracks().forEach((track) => track.stop());
      throw new DOMException('Microphone request was cancelled.', 'AbortError');
    }
    try {
      const node = context.createMediaStreamSource(stream);
      this.connect(node, 'microphone', stream);
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop());
      throw error;
    }
  }

  async startSystemAudio(): Promise<void> {
    const { context } = await this.prepare();
    const capture = navigator.mediaDevices?.getDisplayMedia;
    if (!capture) {
      throw new Error('This browser does not expose screen-audio capture. Use a local audio file or microphone instead.');
    }
    let stream: MediaStream;
    try {
      // Screen capture requires video in several browsers; WaveViz immediately discards the video track.
      stream = await capture.call(navigator.mediaDevices, { video: true, audio: true });
    } catch (error) {
      throw error;
    }
    const audioTracks = stream.getAudioTracks();
    stream.getVideoTracks().forEach((track) => track.stop());
    if (!audioTracks.length) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('No system-audio track was shared. In the picker, choose a tab or screen and enable audio sharing, if offered by your browser.');
    }
    const audioOnly = new MediaStream(audioTracks);
    const node = context.createMediaStreamSource(audioOnly);
    this.connect(node, 'system', audioOnly);
  }

  async startFilePlayback(element: HTMLAudioElement): Promise<void> {
    const { context } = await this.prepare();
    if (this.fileElement !== element || !this.fileNode) {
      this.fileElement = element;
      this.fileNode = context.createMediaElementSource(element);
    }
    this.connect(this.fileNode, 'file');
    await element.play();
  }

  async resumeFile(): Promise<void> {
    if (!this.fileElement) return;
    await this.prepare();
    if (this.fileNode && (this.activeNode !== this.fileNode || this.activeKind !== 'file')) {
      this.connect(this.fileNode, 'file');
    }
    await this.fileElement.play();
  }

  pauseFile(): void {
    this.fileElement?.pause();
  }

  seekFile(seconds: number): void {
    if (this.fileElement && Number.isFinite(seconds)) this.fileElement.currentTime = seconds;
  }

  setSmoothing(value: number): void {
    if (this.analyser) this.analyser.smoothingTimeConstant = Math.min(0.96, Math.max(0.05, value));
  }

  stop(): void {
    this.clearActive();
  }

  async dispose(): Promise<void> {
    this.clearActive();
    if (this.context && this.context.state !== 'closed') await this.context.close();
    this.context = null;
    this.analyser = null;
    this.fileNode = null;
    this.fileElement = null;
  }
}
