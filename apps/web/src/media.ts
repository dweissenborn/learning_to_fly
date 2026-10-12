// Read-aloud through the browser's own voices, and soft synthesized sounds. Nothing to license or store.
import { useSyncExternalStore } from 'react';

// ---------------------------------------------------------------- read-aloud
export interface ReadState { key: string | null; line: number; char: number; len: number }
let state: ReadState = { key: null, line: -1, char: -1, len: 0 };
const subs = new Set<() => void>();
const set = (s: Partial<ReadState>) => { state = { ...state, ...s }; subs.forEach((f) => f()); };
export const useReading = () => useSyncExternalStore((f) => (subs.add(f), () => subs.delete(f)), () => state);

const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
export const canSpeak = !!synth;
export const voices = () => (synth?.getVoices() ?? []).filter((v) => v.lang.startsWith('en'));
let opts = { rate: 0.9, voice: '' };
export const setVoice = (o: Partial<typeof opts>) => { opts = { ...opts, ...o }; };

export function stopSpeaking() {
  synth?.cancel();
  set({ key: null, line: -1, char: -1 });
}

/** Speaks lines one at a time. Highlights the line, and the word where the browser reports word boundaries. */
export function speak(lines: string[], key = 'any'): Promise<void> {
  if (!synth) return Promise.resolve();
  synth.cancel();
  const voice = voices().find((v) => v.name === opts.voice) ?? voices().find((v) => v.default) ?? voices()[0];
  return new Promise((resolve) => {
    lines.forEach((text, i) => {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = opts.rate;
      if (voice) u.voice = voice;
      u.onstart = () => set({ key, line: i, char: -1, len: 0 });
      u.onboundary = (e) => { if (e.name === 'word') set({ char: e.charIndex, len: e.charLength || 0 }); };
      u.onend = u.onerror = () => { if (i === lines.length - 1) { set({ key: null, line: -1, char: -1 }); resolve(); } };
      synth.speak(u);
    });
    if (!lines.length) resolve();
  });
}

// ---------------------------------------------------------------- sound
// Quiet pentatonic notes, only ever in answer to the learner's own action. No surprise sounds.
let ctx: AudioContext | null = null;
let soundOn = true;
export const setSound = (on: boolean) => { soundOn = on; };
function tone(freq: number, at: number, dur: number, gain = 0.05, type: OscillatorType = 'sine') {
  if (!soundOn) return;
  ctx ??= new AudioContext();
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
export const sfx = {
  good: () => { tone(659, 0, 0.35); tone(988, 0.1, 0.5); },
  lantern: () => tone(784, 0, 0.6, 0.04, 'triangle'),
  place: () => { tone(392, 0, 0.25, 0.06, 'triangle'); tone(523, 0.08, 0.4, 0.05); },
  finish: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.7, 0.045)),
  soft: () => tone(440, 0, 0.18, 0.025, 'triangle'),
};
