type WindowWithAudio = Window & { webkitAudioContext?: typeof AudioContext };

let audioContext: AudioContext | null = null;

const getContext = () => {
  if (typeof window === 'undefined') return null;
  if (!audioContext) {
    const AudioContextCtor = window.AudioContext || (window as WindowWithAudio).webkitAudioContext;
    if (!AudioContextCtor) return null;
    audioContext = new AudioContextCtor();
  }
  return audioContext;
};

const playChime = (ctx: AudioContext) => {
  const now = ctx.currentTime;
  [880, 1174.66].forEach((frequency, index) => {
    const start = now + index * 0.18;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.5);
  });
};

export const unlockAudio = () => {
  const ctx = getContext();
  if (ctx?.state === 'suspended') {
    ctx.resume().catch(() => undefined);
  }
};

export const playDing = () => {
  const ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx
      .resume()
      .then(() => playChime(ctx))
      .catch(() => undefined);
    return;
  }
  playChime(ctx);
};

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', unlockAudio, { once: true });
}
