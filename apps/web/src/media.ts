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

type VoiceLike = Pick<SpeechSynthesisVoice, 'name' | 'lang' | 'localService' | 'default'>;
/**
 * The chosen voice, or else the most natural one the device has: Edge's online "Natural" voices, Apple's Enhanced and
 * Premium ones, Google's, before the old desktop voices that sound flat. Offline, only voices on the device itself.
 */
export function pickVoice<V extends VoiceLike>(list: readonly V[], chosen: string, online: boolean): V | undefined {
  const named = list.find((v) => v.name === chosen);
  if (named && (online || named.localService)) return named;
  const score = (v: V) => (/Natural|Neural/.test(v.name) ? 8 : /Enhanced|Premium/.test(v.name) ? 6 : /Google/.test(v.name) ? 4 : 0)
    + (/\b(Ava|Andrew|Emma|Brian)\b/.test(v.name) ? 2 : 0) + (v.lang === 'en-US' ? 1 : 0) + (v.default ? 0.5 : 0);
  return list.filter((v) => online || v.localService).sort((a, b) => score(b) - score(a))[0] ?? list[0];
}
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
  const voice = pickVoice(voices(), opts.voice, navigator.onLine);
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
  gear: () => [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.08, 0.5, 0.04, i % 2 ? 'triangle' : 'sine')),
  boost: () => { tone(523, 0, 0.3, 0.05, 'triangle'); tone(784, 0.1, 0.45, 0.05, 'triangle'); },
};
