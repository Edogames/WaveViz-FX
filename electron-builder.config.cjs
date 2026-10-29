module.exports = {
  appId: 'com.waveviz.fx',
  productName: 'WaveViz FX',
  directories: {
    output: 'release',
  },
  files: [
    'package.json',
    'desktop/**/*',
    'dist/**/*',
  ],
  asar: true,
  mac: {
    target: [
      {
        target: 'zip',
        arch: ['arm64'],
      },
    ],
    icon: 'build/waveviz.icns',
    category: 'public.app-category.music',
    minimumSystemVersion: '14.2.0',
    extendInfo: {
      NSAudioCaptureUsageDescription: 'WaveViz analyzes audio currently playing on this Mac to animate the visualizer. Audio is processed locally and not saved or uploaded.',
      NSMicrophoneUsageDescription: 'WaveViz can analyze audio from the selected microphone only when you choose Microphone input.',
    },
  },
  win: {
    target: [
      { target: 'nsis', arch: ['x64', 'arm64'] },
    ],
    icon: 'build/waveviz.ico',
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },
  linux: {
    target: [
      { target: 'AppImage', arch: ['x64', 'arm64'] },
      { target: 'deb', arch: ['x64', 'arm64'] },
    ],
    icon: 'build/icons',
    category: 'AudioVideo',
    synopsis: 'Retro real-time audio visualizer',
    maintainer: 'WaveViz',
  },
};
