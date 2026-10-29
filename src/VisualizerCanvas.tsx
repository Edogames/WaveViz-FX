import { useEffect, useRef } from 'react';

export type VisualMode = 'spectrum' | 'scope' | 'mirror' | 'tunnel' | 'particles' | 'morph' | 'radial' | 'waterfall' | 'ribbon';
export type PaletteName = 'aurora' | 'electric' | 'ember' | 'ice' | 'orchid';
export type FrequencyEmphasis = 'balanced' | 'bass' | 'mids' | 'treble';

export interface VisualizerAnalyser {
  readonly context: { readonly sampleRate: number };
  readonly fftSize: number;
  readonly frequencyBinCount: number;
  getByteFrequencyData(array: Uint8Array<ArrayBuffer>): void;
  getByteTimeDomainData(array: Uint8Array<ArrayBuffer>): void;
}

interface Props {
  analyser: VisualizerAnalyser | null;
  mode: VisualMode;
  palette: PaletteName;
  sensitivity: number;
  speed: number;
  emphasis: FrequencyEmphasis;
  active: boolean;
  transparent?: boolean;
}

interface Palette {
  a: string;
  b: string;
  c: string;
  d: string;
  glow: string;
}

const palettes: Record<PaletteName, Palette> = {
  aurora: { a: '#46f3e2', b: '#42a6ff', c: '#a17aff', d: '#fd6fe6', glow: '70, 221, 255' },
  electric: { a: '#4cecff', b: '#2b85ff', c: '#a4f858', d: '#f6f36b', glow: '58, 207, 255' },
  ember: { a: '#fff16a', b: '#ff9f48', c: '#ff5575', d: '#bf5cff', glow: '255, 133, 71' },
  ice: { a: '#d6fff9', b: '#80eaff', c: '#64a6ff', d: '#9a8dff', glow: '133, 238, 255' },
  orchid: { a: '#ff8bda', b: '#d46aff', c: '#8e7dff', d: '#46cbff', glow: '217, 105, 255' },
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  phase: number;
}

interface BeatState {
  averageBass: number;
  level: number;
  lastBeatAt: number;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function hzAt(normalized: number): number {
  return 20 * Math.pow(1000, normalized);
}

function sampleFrequency(
  data: Uint8Array<ArrayBuffer>,
  analyser: VisualizerAnalyser | null,
  normalized: number,
  emphasis: FrequencyEmphasis,
  sensitivity: number,
): number {
  if (!analyser || data.length === 0) return 0;
  const hz = hzAt(normalized);
  const binWidth = analyser.context.sampleRate / analyser.fftSize;
  const center = clamp(Math.round(hz / binWidth), 0, data.length - 1);
  const spread = hz < 110 ? 2 : hz < 500 ? 1 : 0;
  let sum = 0;
  let count = 0;
  for (let i = Math.max(0, center - spread); i <= Math.min(data.length - 1, center + spread); i += 1) {
    sum += data[i] / 255;
    count += 1;
  }
  let gain = 1;
  if (emphasis === 'bass') gain += (1 - normalized) * 0.78;
  if (emphasis === 'mids') gain += Math.exp(-Math.pow((normalized - 0.5) / 0.2, 2)) * 0.8;
  if (emphasis === 'treble') gain += normalized * 0.86;
  return clamp((sum / Math.max(1, count)) * gain * sensitivity, 0, 1.35);
}

function getRms(wave: Uint8Array<ArrayBuffer>, analyser: VisualizerAnalyser | null, time: number): number {
  if (!analyser) return 0;
  let sum = 0;
  const stride = 8;
  let samples = 0;
  for (let i = 0; i < wave.length; i += stride) {
    const centered = (wave[i] - 128) / 128;
    sum += centered * centered;
    samples += 1;
  }
  const rms = Math.sqrt(sum / Math.max(samples, 1));
  return clamp(rms * 2.25 + Math.max(0, Math.sin(time / 850)) * 0.018, 0, 1);
}

function detectBeat(data: Uint8Array<ArrayBuffer>, analyser: VisualizerAnalyser | null, active: boolean, time: number, state: BeatState): number {
  if (!analyser || !active) {
    state.level *= 0.88;
    return state.level;
  }
  const binWidth = analyser.context.sampleRate / analyser.fftSize;
  const bassEnd = clamp(Math.floor(250 / binWidth), 2, data.length - 1);
  let bass = 0;
  for (let i = 1; i <= bassEnd; i += 1) bass += data[i] / 255;
  bass /= bassEnd;
  const threshold = Math.max(0.105, state.averageBass * 1.52);
  if (bass > threshold && time - state.lastBeatAt > 185) {
    state.level = 1;
    state.lastBeatAt = time;
  } else {
    state.level *= 0.88;
  }
  state.averageBass = state.averageBass * 0.94 + bass * 0.06;
  return state.level;
}

function focusPosition(emphasis: FrequencyEmphasis): number {
  if (emphasis === 'bass') return 0.31;
  if (emphasis === 'mids') return 0.58;
  if (emphasis === 'treble') return 0.9;
  return 0.52;
}

export function VisualizerCanvas({ analyser, mode, palette, sensitivity, speed, emphasis, active, transparent = false }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const optionsRef = useRef({ mode, palette, sensitivity, speed, emphasis, active, transparent });
  optionsRef.current = { mode, palette, sensitivity, speed, emphasis, active, transparent };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d', { alpha: true });
    if (!canvas || !ctx) return;

    let width = 1;
    let height = 1;
    let frameId = 0;
    let resizeFrame = 0;
    let frequencyData = new Uint8Array(analyser?.frequencyBinCount ?? 2048);
    let waveData = new Uint8Array(analyser?.fftSize ?? 4096);
    const beatState: BeatState = { averageBass: 0.025, level: 0, lastBeatAt: -1000 };
    let particles: Particle[] = Array.from({ length: 112 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: (Math.random() - 0.5) * 0.00025,
      vy: (Math.random() - 0.5) * 0.00025,
      size: Math.random() * 1.8 + 0.6,
      phase: Math.random() * Math.PI * 2,
    }));
    const waterfallRows = Array.from({ length: 72 }, () => new Uint8Array(96));
    let waterfallCursor = 0;
    let lastWaterfallSample = 0;

    const resize = () => {
      resizeFrame = 0;
      const box = (canvas.parentElement ?? canvas).getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5);
      width = Math.max(1, box.width);
      height = Math.max(1, box.height);
      const pixelWidth = Math.floor(width * ratio);
      const pixelHeight = Math.floor(height * ratio);
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    const scheduleResize = () => {
      if (!resizeFrame) resizeFrame = requestAnimationFrame(resize);
    };
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(canvas.parentElement ?? canvas);
    window.addEventListener('resize', scheduleResize);
    document.addEventListener('fullscreenchange', scheduleResize);
    scheduleResize();

    const background = (time: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      if (opts.transparent) {
        ctx.clearRect(0, 0, width, height);
      } else {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, '#061321');
        gradient.addColorStop(0.52, '#080d20');
        gradient.addColorStop(1, '#100a24');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      const bloom = ctx.createRadialGradient(width * 0.5, height * 0.53, 4, width * 0.5, height * 0.53, Math.max(width, height) * 0.63);
      bloom.addColorStop(0, `rgba(${colors.glow}, ${0.035 + Math.sin(time / 1200) * 0.01 + beat * 0.055})`);
      bloom.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = bloom;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.strokeStyle = 'rgba(145, 198, 235, 0.045)';
      ctx.lineWidth = 1;
      const spacing = 42;
      for (let x = (time / 80) % spacing; x < width; x += spacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += spacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    };

    const drawSpectrum = (time: number, energy: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      const count = Math.max(44, Math.min(118, Math.floor(width / 8.5)));
      const gap = Math.max(2, width / (count * 9.5));
      const barWidth = Math.max(2, width / count - gap);
      const baseline = height * 0.82;
      const topRoom = height * 0.65;
      for (let i = 0; i < count; i += 1) {
        const p = i / (count - 1);
        const raw = sampleFrequency(frequencyData, analyser, p, opts.emphasis, opts.sensitivity);
        const idle = opts.active ? 0 : 0.075 + Math.max(0, Math.sin(time / 470 + i * 0.24)) * 0.11;
        const level = clamp(Math.max(raw, idle), 0, 1);
        const shimmer = 0.98 + Math.sin((time * opts.speed) / 720 + i * 0.11) * 0.035;
        const barHeight = Math.max(2, level * topRoom * (0.82 + energy * 0.4 + beat * 0.12) * shimmer);
        const x = i * (width / count) + gap * 0.5;
        const y = baseline - barHeight;
        const gradient = ctx.createLinearGradient(x, y, x, baseline);
        gradient.addColorStop(0, colors.d);
        gradient.addColorStop(0.28, colors.c);
        gradient.addColorStop(0.68, colors.b);
        gradient.addColorStop(1, colors.a);
        ctx.fillStyle = gradient;
        ctx.shadowColor = colors.b;
        ctx.shadowBlur = 9;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x, y, barWidth, barHeight);
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.18;
        ctx.fillRect(x, baseline + 6, barWidth, Math.min(32, barHeight * 0.22));
        ctx.globalAlpha = 1;
        ctx.fillStyle = colors.a;
        ctx.globalAlpha = 0.82;
        ctx.fillRect(x, Math.max(8, y - 3), barWidth, 2);
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(160, 226, 255, 0.34)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, baseline + 4);
      ctx.lineTo(width, baseline + 4);
      ctx.stroke();
    };

    const drawScope = (time: number, energy: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      const center = height * 0.52;
      const focusEnergy = sampleFrequency(frequencyData, analyser, focusPosition(opts.emphasis), opts.emphasis, opts.sensitivity);
      const amplitude = Math.min(height * 0.43, height * (0.1 + energy * 0.4 + beat * 0.045) * opts.sensitivity * (0.85 + focusEnergy * 0.25));
      const lines = [colors.a, colors.c];
      for (let layer = 0; layer < lines.length; layer += 1) {
        ctx.beginPath();
        for (let i = 0; i <= 900; i += 1) {
          const p = i / 900;
          let sample = 0;
          if (analyser && optionsRef.current.active && waveData.length) {
            const index = Math.floor(p * (waveData.length - 1));
            sample = (waveData[index] - 128) / 128;
          } else {
            sample = Math.sin(p * 29 + time / (170 / opts.speed) + layer * 0.9) * 0.16;
            sample += Math.sin(p * 71 - time / (220 / opts.speed)) * 0.055;
          }
          const y = center + sample * amplitude * (layer === 0 ? 1 : 0.67) + Math.sin(p * 17 + time / 700) * energy * 8;
          const x = p * width;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = lines[layer];
        ctx.lineWidth = layer === 0 ? 2.2 : 1.1;
        ctx.globalAlpha = layer === 0 ? 0.95 : 0.58;
        ctx.shadowColor = lines[layer];
        ctx.shadowBlur = 16 - layer * 7;
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      ctx.strokeStyle = 'rgba(210, 239, 255, 0.14)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(width * 0.06, center);
      ctx.lineTo(width * 0.94, center);
      ctx.stroke();
    };

    const drawMorph = (time: number, energy: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      const cx = width / 2;
      const cy = height / 2;
      const base = Math.min(width, height) * (0.22 + energy * 0.075 + beat * 0.045);
      const layers = [
        { color: colors.a, scale: 1, phase: 0 },
        { color: colors.c, scale: 0.78, phase: 1.1 },
        { color: colors.d, scale: 0.56, phase: 2.2 },
      ];
      layers.forEach((layer) => {
        ctx.beginPath();
        for (let i = 0; i <= 260; i += 1) {
          const angle = (i / 260) * Math.PI * 2;
          const band = sampleFrequency(frequencyData, analyser, (i / 260 + layer.phase * 0.13) % 1, opts.emphasis, opts.sensitivity);
          const morph = Math.sin(angle * 3 + time * 0.00075 * opts.speed + layer.phase) * 0.16
            + Math.sin(angle * 5 - time * 0.00043 * opts.speed + layer.phase) * 0.1
            + Math.cos(angle * 2 + time * 0.0003) * 0.07;
          const radius = base * layer.scale * (1 + morph + band * 0.43);
          const x = cx + Math.cos(angle) * radius * (1 + 0.11 * Math.sin(time * 0.0005 + layer.phase));
          const y = cy + Math.sin(angle) * radius * (1 + 0.08 * Math.cos(time * 0.0006 + layer.phase));
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = layer.color;
        ctx.lineWidth = layer.scale === 1 ? 2 : 1.35;
        ctx.globalAlpha = layer.scale === 1 ? 0.9 : 0.58;
        ctx.shadowColor = layer.color;
        ctx.shadowBlur = 18 * layer.scale;
        ctx.stroke();
        ctx.shadowBlur = 0;
      });
      ctx.globalAlpha = 1;
      const core = ctx.createRadialGradient(cx, cy, 1, cx, cy, base * 0.55);
      core.addColorStop(0, `rgba(${colors.glow}, ${0.08 + energy * 0.12 + beat * 0.12})`);
      core.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = core;
      ctx.fillRect(cx - base, cy - base, base * 2, base * 2);
    };

    const drawRadialSpectrum = (time: number, energy: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      const cx = width / 2;
      const cy = height / 2;
      const count = Math.max(64, Math.min(144, Math.floor(Math.min(width, height) * 0.42)));
      const inner = Math.min(width, height) * 0.17;
      const maxLength = Math.min(width, height) * 0.28;
      const lineWidth = Math.max(1.4, Math.min(4, (Math.PI * 2 * inner) / count * 0.55));
      const colorList = [colors.a, colors.b, colors.c, colors.d];
      ctx.lineCap = 'round';
      for (let i = 0; i < count; i += 1) {
        const p = i / count;
        const value = sampleFrequency(frequencyData, analyser, p, opts.emphasis, opts.sensitivity);
        const idle = opts.active ? 0 : 0.08 + Math.max(0, Math.sin(time / 530 + i * 0.22)) * 0.1;
        const magnitude = Math.max(value, idle);
        const length = Math.max(3, maxLength * (0.12 + magnitude * 0.88 + beat * 0.08));
        const angle = p * Math.PI * 2 - time * 0.00006 * opts.speed;
        const x1 = cx + Math.cos(angle) * inner;
        const y1 = cy + Math.sin(angle) * inner;
        const x2 = cx + Math.cos(angle) * (inner + length);
        const y2 = cy + Math.sin(angle) * (inner + length);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = colorList[Math.floor(p * colorList.length) % colorList.length];
        ctx.lineWidth = lineWidth;
        ctx.globalAlpha = 0.58 + Math.min(0.4, magnitude * 0.35);
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 8 + beat * 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, inner * (0.76 + beat * 0.06), 0, Math.PI * 2);
      ctx.strokeStyle = colors.b;
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.35 + energy * 0.22;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineCap = 'butt';
    };

    const drawWaterfall = (time: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      if (time - lastWaterfallSample > 48) {
        const row = waterfallRows[waterfallCursor];
        for (let i = 0; i < row.length; i += 1) {
          const p = i / (row.length - 1);
          const value = sampleFrequency(frequencyData, analyser, p, opts.emphasis, opts.sensitivity);
          const idle = opts.active ? 0 : 0.035 + Math.max(0, Math.sin(time / 650 + i * 0.12)) * 0.08;
          row[i] = Math.round(clamp(Math.max(value, idle), 0, 1) * 255);
        }
        waterfallCursor = (waterfallCursor + 1) % waterfallRows.length;
        lastWaterfallSample = time;
      }

      const columns = waterfallRows[0].length;
      const cellWidth = width / columns + 0.5;
      const cellHeight = height / waterfallRows.length + 0.5;
      const colorList = [colors.a, colors.b, colors.c, colors.d];
      for (let rowIndex = 0; rowIndex < waterfallRows.length; rowIndex += 1) {
        const values = waterfallRows[(waterfallCursor + rowIndex) % waterfallRows.length];
        const y = rowIndex * height / waterfallRows.length;
        for (let column = 0; column < columns; column += 1) {
          const power = values[column] / 255;
          if (power < 0.025) continue;
          ctx.fillStyle = colorList[Math.min(colorList.length - 1, Math.floor(power * colorList.length))];
          ctx.globalAlpha = 0.18 + power * 0.78;
          ctx.fillRect(column * width / columns, y, cellWidth, cellHeight);
        }
      }
      ctx.globalAlpha = 1;
      const scanY = (time * 0.018 * opts.speed) % height;
      const scan = ctx.createLinearGradient(0, scanY - 5, 0, scanY + 5);
      scan.addColorStop(0, 'rgba(255,255,255,0)');
      scan.addColorStop(0.5, `rgba(${colors.glow},0.16)`);
      scan.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = scan;
      ctx.fillRect(0, scanY - 5, width, 10);
    };

    const drawRibbons = (time: number, energy: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      const colorsList = [colors.a, colors.b, colors.c, colors.d];
      const layers = 4;
      for (let layer = 0; layer < layers; layer += 1) {
        const center = height * (0.28 + layer * 0.15);
        const points = 180;
        ctx.beginPath();
        for (let i = 0; i <= points; i += 1) {
          const p = i / points;
          const band = sampleFrequency(frequencyData, analyser, p, opts.emphasis, opts.sensitivity);
          const wave = Math.sin(p * (7 + layer * 1.5) * Math.PI * 2 + time * 0.001 * opts.speed + layer) * height * 0.045;
          const detail = Math.sin(p * 21 * Math.PI + time * 0.0007 * opts.speed + layer * 0.8) * height * 0.018;
          const y = center + wave + detail + (band * (0.11 + energy * 0.14 + beat * 0.04) - height * 0.045);
          const x = p * width;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = colorsList[layer];
        ctx.lineWidth = layer === 0 ? 2 : 1.45;
        ctx.globalAlpha = 0.82 - layer * 0.1;
        ctx.shadowColor = colorsList[layer];
        ctx.shadowBlur = 12 - layer * 2;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    };

    const drawMirror = (time: number, energy: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      const cx = width / 2;
      const cy = height / 2;
      const radius = Math.min(width, height) * (0.14 + energy * 0.07 + beat * 0.045);
      const points = 112;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 0.000055 * opts.speed);
      for (let ring = 0; ring < 4; ring += 1) {
        ctx.beginPath();
        for (let i = 0; i <= points; i += 1) {
          const p = i / points;
          const angle = p * Math.PI * 2;
          const band = sampleFrequency(frequencyData, analyser, p < 0.5 ? p * 2 : (1 - p) * 2, opts.emphasis, opts.sensitivity);
          const petal = Math.sin(angle * 8 + time / 520) * 0.035;
          const r = radius * (1 + ring * 0.39 + band * (0.2 + ring * 0.045) + petal);
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r * 0.68;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = [colors.a, colors.b, colors.c, colors.d][ring];
        ctx.globalAlpha = 0.9 - ring * 0.11;
        ctx.lineWidth = ring === 0 ? 2.2 : 1.15;
        ctx.shadowColor = [colors.a, colors.b, colors.c, colors.d][ring];
        ctx.shadowBlur = 14;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    const drawTunnel = (time: number, energy: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      const cx = width / 2 + Math.sin(time / 1700) * width * 0.035;
      const cy = height / 2 + Math.cos(time / 1900) * height * 0.025;
      const rings = 18;
      for (let i = rings - 1; i >= 0; i -= 1) {
        const depth = (i / rings + ((time * 0.00012 * opts.speed) % 1)) % 1;
        const pulse = sampleFrequency(frequencyData, analyser, (i / rings), opts.emphasis, opts.sensitivity);
        const scale = 0.09 + depth * 1.08 + pulse * 0.08 + energy * 0.02 + beat * 0.035;
        const rw = width * scale;
        const rh = height * scale;
        const twist = (depth - 0.5) * 0.22 + Math.sin(time / 1400 + i) * 0.018;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(twist);
        ctx.beginPath();
        ctx.ellipse(0, 0, rw * 0.5, rh * 0.5, 0, 0, Math.PI * 2);
        ctx.strokeStyle = [colors.a, colors.b, colors.c, colors.d][i % 4];
        ctx.globalAlpha = 0.14 + (1 - depth) * 0.46 + pulse * 0.24 + beat * 0.12;
        ctx.lineWidth = 1 + (1 - depth) * 1.6;
        ctx.shadowColor = colors.b;
        ctx.shadowBlur = 13;
        ctx.stroke();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };

    const drawParticles = (time: number, energy: number, beat: number) => {
      const opts = optionsRef.current;
      const colors = palettes[opts.palette];
      const cx = width / 2;
      const cy = height / 2;
      const focusEnergy = sampleFrequency(frequencyData, analyser, focusPosition(opts.emphasis), opts.emphasis, opts.sensitivity);
      const push = 0.000035 + energy * 0.00019 + beat * 0.00006 + focusEnergy * 0.00006;
      particles.forEach((particle, index) => {
        const dx = particle.x * width - cx;
        const dy = particle.y * height - cy;
        const angle = Math.atan2(dy, dx);
        particle.vx += Math.cos(angle) * push * opts.speed;
        particle.vy += Math.sin(angle) * push * opts.speed;
        particle.vx *= 0.994;
        particle.vy *= 0.994;
        particle.x += particle.vx;
        particle.y += particle.vy;
        if (particle.x < -0.05 || particle.x > 1.05 || particle.y < -0.05 || particle.y > 1.05) {
          particle.x = 0.5 + (Math.random() - 0.5) * 0.13;
          particle.y = 0.5 + (Math.random() - 0.5) * 0.13;
          particle.vx = (Math.random() - 0.5) * 0.00035;
          particle.vy = (Math.random() - 0.5) * 0.00035;
        }
        const x = particle.x * width;
        const y = particle.y * height;
        const radius = particle.size + (Math.sin(time / 220 + particle.phase) + 1) * 0.7 + energy * 2.4 + beat * 1.8 + focusEnergy * 1.2;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = [colors.a, colors.b, colors.c, colors.d][index % 4];
        ctx.globalAlpha = 0.28 + (Math.sin(time / 350 + particle.phase) + 1) * 0.28;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 13;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 0.16;
        ctx.strokeStyle = colors.b;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - particle.vx * width * 30, y - particle.vy * height * 30);
        ctx.stroke();
      });
      ctx.globalAlpha = 1;
    };

    const render = (time: number) => {
      const opts = optionsRef.current;
      if (analyser && (frequencyData.length !== analyser.frequencyBinCount || waveData.length !== analyser.fftSize)) {
        frequencyData = new Uint8Array(analyser.frequencyBinCount);
        waveData = new Uint8Array(analyser.fftSize);
      }
      if (analyser) {
        analyser.getByteFrequencyData(frequencyData);
        analyser.getByteTimeDomainData(waveData);
      }
      const energy = getRms(waveData, opts.active ? analyser : null, time);
      const beat = detectBeat(frequencyData, analyser, opts.active, time, beatState);
      background(time, beat);
      if (opts.mode === 'spectrum') drawSpectrum(time, energy, beat);
      if (opts.mode === 'scope') drawScope(time, energy, beat);
      if (opts.mode === 'mirror') drawMirror(time, energy, beat);
      if (opts.mode === 'tunnel') drawTunnel(time, energy, beat);
      if (opts.mode === 'particles') drawParticles(time, energy, beat);
      if (opts.mode === 'morph') drawMorph(time, energy, beat);
      if (opts.mode === 'radial') drawRadialSpectrum(time, energy, beat);
      if (opts.mode === 'waterfall') drawWaterfall(time);
      if (opts.mode === 'ribbon') drawRibbons(time, energy, beat);
      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frameId);
      cancelAnimationFrame(resizeFrame);
      window.removeEventListener('resize', scheduleResize);
      document.removeEventListener('fullscreenchange', scheduleResize);
      observer.disconnect();
    };
  }, [analyser]);

  return <canvas ref={canvasRef} className="visualizer-canvas" aria-label="Live audio visualization" />;
}
