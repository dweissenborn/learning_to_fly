// All art is drawn in code: the guides, the island, and every piece the learner adds to it.
import { createContext, useContext, useId, type ReactNode } from 'react';
import type { GuideId } from './db';

// ---------------------------------------------------------------- guides
export type Mood = 'idle' | 'think' | 'happy';
export const GUIDES: Record<GuideId, { name: string; blurb: string; color: string }> = {
  bolt: { name: 'Bolt', blurb: 'A robot who likes facts, maps and machines.', color: '#5f9fb6' },
  rook: { name: 'Rook', blurb: 'A raven who collects words and loves to fly.', color: '#3b4152' },
  moss: { name: 'Moss', blurb: 'A stone giant who likes building things.', color: '#7f8a7a' },
};

function eyes(mood: Mood, l: [number, number], r: [number, number], color: string, size = 5) {
  if (mood === 'happy')
    return <g stroke={color} strokeWidth="3.2" fill="none" strokeLinecap="round">
      <path d={`M${l[0] - size} ${l[1] + 1} Q${l[0]} ${l[1] - size - 2} ${l[0] + size} ${l[1] + 1}`} />
      <path d={`M${r[0] - size} ${r[1] + 1} Q${r[0]} ${r[1] - size - 2} ${r[0] + size} ${r[1] + 1}`} />
    </g>;
  const dy = mood === 'think' ? -3 : 0, dx = mood === 'think' ? 2 : 0;
  return <g className="blink moves" fill={color}>
    <circle cx={l[0] + dx} cy={l[1] + dy} r={size} /><circle cx={r[0] + dx} cy={r[1] + dy} r={size} />
  </g>;
}

/** The flight gear his guide has earned, by GEAR id. The app shell provides it, so every guide on screen wears it. */
export const GearContext = createContext<readonly string[]>([]);

/** Where gear sits on each guide, in the guides' 100 x 100 drawing. */
const FIT: Record<GuideId, { top: number; headW: number; ears: [number, number]; earY: number; neckY: number; neckW: number; bodyY: number; bodyW: number; bottom: number; vest?: string }> = {
  bolt: { top: 18, headW: 58, ears: [18, 82], earY: 42, neckY: 69, neckW: 40, bodyY: 70, bodyW: 38, bottom: 94 },
  rook: { top: 17, headW: 44, ears: [30, 70], earY: 38, neckY: 57, neckW: 40, bodyY: 62, bodyW: 46, bottom: 90, vest: 'M26 68 Q26 92 50 92 Q74 92 74 68 Q74 61 66 61 L34 61 Q26 61 26 68 Z' },
  moss: { top: 23, headW: 60, ears: [21, 79], earY: 46, neckY: 71, neckW: 58, bodyY: 74, bodyW: 58, bottom: 94 },
};

function gearArt(id: GuideId, has: (g: string) => boolean) {
  const f = FIT[id], cx = 50, w = f.headW;
  return <g className="gear">
    {has('jacket') && <g>
      {f.vest ? <path d={f.vest} fill="#8b5a2b" stroke="#5e3b1b" strokeWidth="2" />
        : <rect x={cx - f.bodyW / 2} y={f.bodyY} width={f.bodyW} height={f.bottom - f.bodyY} rx="9" fill="#8b5a2b" stroke="#5e3b1b" strokeWidth="2" />}
      <path d={`M${cx - 9} ${f.bodyY} L${cx} ${f.bodyY + 10} L${cx + 9} ${f.bodyY} Z`} fill="#f2e6cf" />
      <line x1={cx} y1={f.bodyY + 10} x2={cx} y2={f.bottom - 3} stroke="#d9b36c" strokeWidth="1.6" />
    </g>}
    {has('backpack') && <g>
      <rect x={cx - f.bodyW / 2 - 8} y={f.bodyY + 2} width="10" height="19" rx="3.5" fill="#d0743a" stroke="#8f4a1e" strokeWidth="1.6" />
      <g stroke="#5a3a20" strokeWidth="3.4" strokeLinecap="round"><line x1={cx - f.bodyW * 0.28} y1={f.bodyY + 1} x2={cx - f.bodyW * 0.28} y2={f.bottom - 3} /><line x1={cx + f.bodyW * 0.28} y1={f.bodyY + 1} x2={cx + f.bodyW * 0.28} y2={f.bottom - 3} /></g>
    </g>}
    {has('wings') && <g transform={`translate(${cx + f.bodyW * 0.14} ${f.bodyY + 9})`}>
      <path d="M0 0 Q-6 -4 -12 -1 Q-7 1 -1 2 Z M0 0 Q6 -4 12 -1 Q7 1 1 2 Z" fill="#f5c542" stroke="#a67c00" strokeWidth="0.8" />
      <circle r="2.4" fill="#f5c542" stroke="#a67c00" strokeWidth="0.8" />
    </g>}
    {has('scarf') && <g>
      <rect x={cx - f.neckW / 2} y={f.neckY - 3.5} width={f.neckW} height="7" rx="3.5" fill="#d64545" stroke="#9e2c2c" strokeWidth="1.2" />
      <path d={`M${cx + f.neckW / 2 - 11} ${f.neckY + 2} q 5 9 -1 17 l 7 -1 q 4 -9 0 -16 z`} fill="#c43c3c" stroke="#9e2c2c" strokeWidth="1.2" />
    </g>}
    {has('cap') && <g>
      <path d={`M${cx - w / 2} ${f.top + 7} Q${cx - w / 2} ${f.top - 13} ${cx} ${f.top - 13} Q${cx + w / 2} ${f.top - 13} ${cx + w / 2} ${f.top + 7} Z`} fill="#7a4a2a" stroke="#4e2f19" strokeWidth="2" />
      <path d={`M${cx} ${f.top - 13} L${cx} ${f.top + 5}`} stroke="#4e2f19" strokeWidth="1.4" />
    </g>}
    {has('goggles') && <g>
      <line x1={cx - w / 2} y1={f.top} x2={cx + w / 2} y2={f.top} stroke="#3a3a3a" strokeWidth="2.4" />
      <circle cx={cx - 9} cy={f.top - 1} r="6.2" fill="#a8e0ff" stroke="#333" strokeWidth="2.2" />
      <circle cx={cx + 9} cy={f.top - 1} r="6.2" fill="#a8e0ff" stroke="#333" strokeWidth="2.2" />
      <circle cx={cx - 11} cy={f.top - 3} r="1.6" fill="#fff" /><circle cx={cx + 7} cy={f.top - 3} r="1.6" fill="#fff" />
    </g>}
    {has('headset') && <g>
      <path d={`M${f.ears[0]} ${f.earY - 6} Q${cx} ${f.top - 30} ${f.ears[1]} ${f.earY - 6}`} stroke="#2b2b2b" strokeWidth="3.2" fill="none" />
      <rect x={f.ears[0] - 5} y={f.earY - 9} width="10" height="15" rx="4" fill="#2b2b2b" /><rect x={f.ears[1] - 5} y={f.earY - 9} width="10" height="15" rx="4" fill="#2b2b2b" />
      <path d={`M${f.ears[0]} ${f.earY + 5} Q${f.ears[0] + 2} ${f.earY + 16} ${f.ears[0] + 14} ${f.earY + 15}`} stroke="#2b2b2b" strokeWidth="2" fill="none" />
      <circle cx={f.ears[0] + 15} cy={f.earY + 15} r="2.4" fill="#2b2b2b" />
    </g>}
  </g>;
}

export function Guide({ id, mood = 'idle', size = 84, label, gear }: { id: GuideId; mood?: Mood; size?: number; label?: boolean; gear?: readonly string[] }) {
  const earned = useContext(GearContext);
  const worn = gear ?? earned;
  const has = (g: string) => worn.includes(g);
  const glow = useId();
  const art: Record<GuideId, ReactNode> = {
    bolt: <>
      <line x1="50" y1="19" x2="50" y2="8" stroke="#4d6f7d" strokeWidth="3" />
      <circle cx="50" cy="7" r="5" fill={mood === 'think' ? '#ffd166' : '#f4a259'} />
      <rect x="14" y="34" width="8" height="16" rx="3" fill="#4d7f92" /><rect x="78" y="34" width="8" height="16" rx="3" fill="#4d7f92" />
      <rect x="20" y="18" width="60" height="50" rx="16" fill="#8fc1d3" stroke="#4d7f92" strokeWidth="2.5" />
      <rect x="28" y="27" width="44" height="31" rx="9" fill="#1f2d3d" />
      {eyes(mood, [40, 42], [60, 42], '#7ff3e1')}
      {mood !== 'think' && <path d="M44 51 Q50 55 56 51" stroke="#7ff3e1" strokeWidth="2.5" fill="none" strokeLinecap="round" />}
      {mood === 'think' && <g fill="#7ff3e1"><circle cx="45" cy="52" r="1.6" /><circle cx="50" cy="52" r="1.6" /><circle cx="55" cy="52" r="1.6" /></g>}
      <rect x="31" y="70" width="38" height="24" rx="9" fill="#6fa6ba" stroke="#4d7f92" strokeWidth="2.5" />
      <circle cx="50" cy="82" r="5" fill={mood === 'happy' ? '#9be37c' : '#ffd166'} />
    </>,
    rook: <>
      <ellipse cx="50" cy="66" rx="27" ry="27" fill="#2b2f3a" />
      <path d="M30 60 Q24 80 40 90 L36 70 Z" fill="#3c4357" />
      <circle cx="50" cy="38" r="21" fill="#323848" />
      <path d="M36 28 Q46 20 58 24" stroke="#5c78b8" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d="M31 54 Q50 62 69 54 L66 61 Q50 68 34 61 Z" fill="#e8913a" />
      <path d="M50 42 L71 47 L50 52 Z" fill="#8b8f9c" /><path d="M50 42 L71 47 L50 47 Z" fill="#b3b7c2" />
      {eyes(mood, [41, 35], [58, 34], '#f4f1e8', 4.5)}
      {mood !== 'happy' && <g fill="#1b1e26"><circle cx={mood === 'think' ? 43 : 42} cy={mood === 'think' ? 32 : 35} r="2.2" /><circle cx={mood === 'think' ? 60 : 59} cy={mood === 'think' ? 31 : 34} r="2.2" /></g>}
      <g stroke="#e8913a" strokeWidth="3" strokeLinecap="round"><line x1="44" y1="92" x2="42" y2="98" /><line x1="56" y1="92" x2="58" y2="98" /></g>
    </>,
    moss: <>
      <rect x="10" y="48" width="14" height="30" rx="6" fill="#737b70" /><rect x="76" y="48" width="14" height="30" rx="6" fill="#737b70" />
      <rect x="20" y="24" width="60" height="70" rx="14" fill="#949c90" stroke="#6b7368" strokeWidth="2.5" />
      <path d="M20 40 Q20 22 36 22 L64 22 Q80 22 80 40 Q72 34 64 38 Q56 30 48 37 Q40 31 32 38 Q26 34 20 40 Z" fill="#79b05f" />
      <path d="M50 22 Q46 10 38 9 Q44 16 50 22 Q54 12 62 11 Q56 16 50 22" fill="#8cc56f" />
      <path d="M30 70 L38 76 M64 64 L70 72 L66 80" stroke="#6b7368" strokeWidth="2" fill="none" />
      {eyes(mood, [38, 52], [62, 52], '#ffcf5c', 5.5)}
      {mood === 'happy' && <path d="M42 64 Q50 70 58 64" stroke="#4d544b" strokeWidth="3" fill="none" strokeLinecap="round" />}
    </>,
  };
  return <span className="guide" title={label ? GUIDES[id].name : undefined}>
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${GUIDES[id].name}, your guide${worn.length ? ', in flight gear' : ''}`} className={mood === 'happy' ? 'bob moves' : undefined} overflow="visible">
      {has('ready') && <g className="ready-glow" aria-hidden><circle cx="50" cy="52" r="48" fill={`url(#${glow})`} /><defs><radialGradient id={glow}><stop offset="55%" stopColor="#ffd166" stopOpacity="0.45" /><stop offset="100%" stopColor="#ffd166" stopOpacity="0" /></radialGradient></defs></g>}
      {art[id]}
      {worn.length > 0 && gearArt(id, has)}
    </svg>
  </span>;
}

export function BrandMark() {
  return <svg viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#2f7fb0" />
    <path d="M8 44 Q32 36 56 44 L56 52 Q32 62 8 52 Z" fill="#f2dfae" />
    <path d="M12 46 L21 28 L30 46 Z" fill="#b9b3db" /><path d="M21 28 L24 34 L18 34 Z" fill="#fff" />
    <circle cx="40" cy="44" r="5" fill="#6fae5a" />
    <Plane x={40} y={20} s={0.24} rot={-14} />
  </svg>;
}

/** The Kookaburra: Captain Ada's small red plane, side view, facing right. */
export function Plane({ x = 0, y = 0, s = 1, rot = 0 }: { x?: number; y?: number; s?: number; rot?: number }) {
  return <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
    <path d="M-46 -4 L-52 -28 L-40 -28 L-30 -4 Z" fill="#b8322f" />
    <path d="M-48 -6 Q-40 -12 10 -12 Q40 -12 48 0 Q40 10 10 10 L-40 6 Q-50 2 -48 -6 Z" fill="#d64545" />
    <path d="M-44 1 L42 1" stroke="#fff" strokeWidth="2.5" />
    <rect x="6" y="-9" width="13" height="7" rx="2" fill="#bfe3f5" /><rect x="22" y="-8" width="10" height="6" rx="2" fill="#bfe3f5" />
    <rect x="-12" y="-17" width="42" height="5" rx="2.5" fill="#a52a2a" />
    <rect x="-52" y="-6" width="18" height="4" rx="2" fill="#a52a2a" />
    <ellipse cx="49" cy="0" rx="2" ry="15" fill="#555" opacity="0.7" />
    <line x1="8" y1="10" x2="8" y2="17" stroke="#444" strokeWidth="2.5" /><circle cx="8" cy="19" r="4.5" fill="#333" />
  </g>;
}

/** A koala sitting up: gray fur, round fluffy ears, a big dark nose. */
export function Koala({ x = 0, y = 0, s = 1, sleepy = false }: { x?: number; y?: number; s?: number; sleepy?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx="0" cy="16" rx="20" ry="22" fill="#9aa1aa" />
    <ellipse cx="0" cy="20" rx="11" ry="14" fill="#e9e5df" />
    <path d="M-17 6 q-8 8 -5 18 M17 6 q8 8 5 18" stroke="#8d949d" strokeWidth="7" strokeLinecap="round" fill="none" />
    <circle cx="-17" cy="-20" r="11" fill="#9aa1aa" /><circle cx="17" cy="-20" r="11" fill="#9aa1aa" />
    <circle cx="-17" cy="-20" r="6.5" fill="#efe9e2" /><circle cx="17" cy="-20" r="6.5" fill="#efe9e2" />
    <circle cx="0" cy="-8" r="18" fill="#a7adb5" />
    {sleepy
      ? <path d="M-11 -12 q3 3 6 0 M5 -12 q3 3 6 0" stroke="#222" strokeWidth="2" fill="none" strokeLinecap="round" />
      : <g fill="#222"><circle cx="-8" cy="-12" r="2.6" /><circle cx="8" cy="-12" r="2.6" /></g>}
    <ellipse cx="0" cy="-3" rx="5.5" ry="7.5" fill="#33363d" />
  </g>;
}

// ---------------------------------------------------------------- isometric drawing kit
const TW = 64, TH = 32, ZH = 18;
type P3 = [number, number, number];
const pr = ([u, v, z]: P3): [number, number] => [((u - v) * TW) / 2, ((u + v) * TH) / 2 - z * ZH];
const pts = (ps: P3[]) => ps.map((p) => pr(p).map((n) => n.toFixed(1)).join(',')).join(' ');
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.round(Math.min(255, Math.max(0, amt > 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}
const Poly = ({ p, fill, cls }: { p: P3[]; fill: string; cls?: string }) => <polygon points={pts(p)} fill={fill} className={cls} />;

function box(u: number, v: number, w: number, d: number, z: number, h: number, c: string) {
  return <g>
    <Poly p={[[u + w, v, z], [u + w, v + d, z], [u + w, v + d, z + h], [u + w, v, z + h]]} fill={shade(c, -0.22)} />
    <Poly p={[[u, v + d, z], [u + w, v + d, z], [u + w, v + d, z + h], [u, v + d, z + h]]} fill={shade(c, -0.06)} />
    <Poly p={[[u, v, z + h], [u + w, v, z + h], [u + w, v + d, z + h], [u, v + d, z + h]]} fill={shade(c, 0.14)} />
  </g>;
}
function gable(u: number, v: number, w: number, d: number, z: number, h: number, c: string, wall = '#e9dcc3') {
  const m = v + d / 2;
  return <g>
    <Poly p={[[u, v, z], [u + w, v, z], [u + w, m, z + h], [u, m, z + h]]} fill={shade(c, 0.12)} />
    <Poly p={[[u + w, v, z], [u + w, v + d, z], [u + w, m, z + h]]} fill={shade(wall, -0.2)} />
    <Poly p={[[u, v + d, z], [u + w, v + d, z], [u + w, m, z + h], [u, m, z + h]]} fill={c} />
  </g>;
}
function pyramid(u: number, v: number, w: number, d: number, z: number, h: number, c: string) {
  const a: P3 = [u + w / 2, v + d / 2, z + h];
  return <g>
    <Poly p={[[u, v + d, z], [u + w, v + d, z], a]} fill={shade(c, -0.04)} />
    <Poly p={[[u + w, v, z], [u + w, v + d, z], a]} fill={shade(c, -0.24)} />
  </g>;
}
function cyl(cu: number, cv: number, r: number, z: number, h: number, c: string) {
  const [x, yb] = pr([cu, cv, z]); const [, yt] = pr([cu, cv, z + h]);
  const rx = r * TW * 0.7071, ry = r * TH * 0.7071;
  const body = `M${x - rx},${yb} A${rx},${ry} 0 0 0 ${x + rx},${yb} L${x + rx},${yt} A${rx},${ry} 0 0 1 ${x - rx},${yt} Z`;
  return <g>
    <path d={body} fill={c} /><path d={body} fill="url(#cylshade)" />
    <ellipse cx={x} cy={yt} rx={rx} ry={ry} fill={shade(c, 0.16)} />
  </g>;
}
function cone(cu: number, cv: number, r: number, z: number, h: number, c: string) {
  const [x, yb] = pr([cu, cv, z]); const [, ya] = pr([cu, cv, z + h]);
  const rx = r * TW * 0.7071, ry = r * TH * 0.7071;
  const d = `M${x - rx},${yb} A${rx},${ry} 0 0 0 ${x + rx},${yb} L${x},${ya} Z`;
  return <g><path d={d} fill={c} /><path d={d} fill="url(#cylshade)" /></g>;
}
function ball(cu: number, cv: number, z: number, r: number, c: string) {
  const [x, y] = pr([cu, cv, z]);
  const R = r * TW * 0.5;
  return <g><circle cx={x} cy={y - R * 0.6} r={R} fill={c} /><circle cx={x} cy={y - R * 0.6} r={R} fill="url(#ballshade)" /></g>;
}
const at = (u: number, v: number, z: number) => pr([u, v, z]);
const Defs = () => <defs>
  <linearGradient id="cylshade" x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0.28" /><stop offset="0.45" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.28" /></linearGradient>
  <radialGradient id="ballshade" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stopColor="#fff" stopOpacity="0.35" /><stop offset="0.5" stopColor="#fff" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.25" /></radialGradient>
  <radialGradient id="glow"><stop offset="0" stopColor="#ffe08a" stopOpacity="0.95" /><stop offset="1" stopColor="#ffe08a" stopOpacity="0" /></radialGradient>
</defs>;

// ---------------------------------------------------------------- pieces the learner can add
export interface Piece {
  id: string; name: string; region: 'functional' | 'narrative' | 'philosophical'; topic?: string; beach?: boolean;
  /** A souvenir: offered once the journey reaches this stop. */
  stop?: string;
  draw: (night: boolean) => ReactNode;
}
const win = (night: boolean) => (night ? '#ffd56b' : '#a9d6ec');
export const PIECES: Piece[] = [
  { id: 'house', name: 'Cottage', region: 'functional', draw: (n) => <>{box(0.2, 0.25, 0.6, 0.5, 0, 0.9, '#f2e6d0')}<Poly p={[[0.42, 0.75, 0], [0.56, 0.75, 0], [0.56, 0.75, 0.55], [0.42, 0.75, 0.55]]} fill="#7a4a2a" /><Poly p={[[0.8, 0.35, 0.4], [0.8, 0.55, 0.4], [0.8, 0.55, 0.68], [0.8, 0.35, 0.68]]} fill={win(n)} />{gable(0.14, 0.2, 0.72, 0.6, 0.9, 0.75, '#d9634c', '#f2e6d0')}</> },
  { id: 'bakery', name: 'Bakery', region: 'functional', topic: 'food', draw: (n) => <>{box(0.15, 0.2, 0.7, 0.6, 0, 1, '#f4d9b0')}<Poly p={[[0.18, 0.8, 0.75], [0.82, 0.8, 0.75], [0.82, 0.98, 0.5], [0.18, 0.98, 0.5]]} fill="#e58f8f" />{[0.3, 0.5, 0.7].map((u) => <Poly key={u} p={[[u, 0.8, 0.75], [u + 0.1, 0.8, 0.75], [u + 0.1, 0.98, 0.5], [u, 0.98, 0.5]]} fill="#fff4ea" />)}<Poly p={[[0.85, 0.3, 0.35], [0.85, 0.7, 0.35], [0.85, 0.7, 0.7], [0.85, 0.3, 0.7]]} fill={win(n)} />{box(0.12, 0.17, 0.76, 0.66, 1, 0.12, '#b5835a')}{cyl(0.3, 0.3, 0.07, 1.1, 0.5, '#9a6a4a')}</> },
  { id: 'busstop', name: 'Bus stop', region: 'functional', topic: 'transport', draw: () => <>{box(0.2, 0.3, 0.05, 0.05, 0, 1.1, '#4a5568')}{box(0.75, 0.3, 0.05, 0.05, 0, 1.1, '#4a5568')}{box(0.15, 0.2, 0.7, 0.3, 1.1, 0.08, '#3f88c5')}{box(0.25, 0.42, 0.5, 0.12, 0.3, 0.06, '#8b5e3c')}{cyl(0.85, 0.75, 0.03, 0, 1.2, '#4a5568')}{ball(0.85, 0.75, 1.25, 0.18, '#3f88c5')}</> },
  { id: 'clocktower', name: 'Clock tower', region: 'functional', draw: () => <>{box(0.3, 0.3, 0.4, 0.4, 0, 2.2, '#dccaa4')}{(() => { const [x, y] = at(0.5, 0.7, 1.7); return <><ellipse cx={x} cy={y} rx="9" ry="10" fill="#fffaf0" stroke="#6b5a3a" strokeWidth="1.5" /><path d={`M${x} ${y} L${x} ${y - 6} M${x} ${y} L${x + 4} ${y + 2}`} stroke="#333" strokeWidth="1.5" /></>; })()}{pyramid(0.26, 0.26, 0.48, 0.48, 2.2, 0.9, '#5a6b8c')}</> },
  { id: 'windmill', name: 'Windmill', region: 'functional', draw: () => { const [x, y] = at(0.45, 0.72, 1.55); return <>{box(0.3, 0.3, 0.4, 0.4, 0, 1.7, '#f1e6cc')}{pyramid(0.26, 0.26, 0.48, 0.48, 1.7, 0.6, '#a0583d')}<g className="spin moves" style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}>{[0, 90, 180, 270].map((a) => <rect key={a} x={x - 3} y={y - 34} width="6" height="34" rx="2" fill="#fff" stroke="#8a7a5a" transform={`rotate(${a} ${x} ${y})`} />)}</g><circle cx={x} cy={y} r="3.5" fill="#5a4a3a" /></>; } },
  { id: 'train', name: 'Steam train', region: 'functional', topic: 'transport', draw: () => <><Poly p={[[0, 0.42, 0.02], [1, 0.42, 0.02], [1, 0.46, 0.02], [0, 0.46, 0.02]]} fill="#6b5a4a" /><Poly p={[[0, 0.62, 0.02], [1, 0.62, 0.02], [1, 0.66, 0.02], [0, 0.66, 0.02]]} fill="#6b5a4a" />{box(0.1, 0.36, 0.6, 0.34, 0.12, 0.5, '#2f6f4f')}{box(0.1, 0.36, 0.25, 0.34, 0.62, 0.42, '#2f6f4f')}{box(0.06, 0.33, 0.33, 0.4, 1.04, 0.07, '#1f3a2c')}{cyl(0.6, 0.53, 0.06, 0.62, 0.35, '#222')}{[0.2, 0.42, 0.62].map((u) => { const [x, y] = at(u, 0.7, 0.14); return <ellipse key={u} cx={x} cy={y} rx="6" ry="6" fill="#1b1b1b" />; })}{box(0.72, 0.38, 0.25, 0.3, 0.12, 0.4, '#c8553d')}</> },
  { id: 'market', name: 'Market stall', region: 'functional', topic: 'food', draw: () => <>{box(0.2, 0.3, 0.6, 0.4, 0, 0.55, '#a87a4f')}{[[0.2, 0.3], [0.78, 0.3], [0.2, 0.68], [0.78, 0.68]].map(([u, v]) => <g key={`${u}${v}`}>{box(u, v, 0.03, 0.03, 0.55, 0.7, '#7a5a3a')}</g>)}{pyramid(0.14, 0.24, 0.72, 0.52, 1.25, 0.45, '#f2c14e')}{ball(0.35, 0.55, 0.55, 0.12, '#e4572e')}{ball(0.5, 0.5, 0.55, 0.12, '#76b041')}{ball(0.62, 0.6, 0.55, 0.12, '#f2a541')}</> },
  { id: 'fountain', name: 'Fountain', region: 'functional', draw: () => <>{cyl(0.5, 0.5, 0.36, 0, 0.3, '#c7c2b8')}{(() => { const [x, y] = at(0.5, 0.5, 0.3); return <ellipse cx={x} cy={y} rx="20" ry="10" fill="#7fc4e8" />; })()}{cyl(0.5, 0.5, 0.06, 0.3, 0.6, '#c7c2b8')}{ball(0.5, 0.5, 0.95, 0.14, '#9ad3f0')}</> },
  { id: 'weather', name: 'Weather station', region: 'functional', topic: 'weather', draw: () => { const [x, y] = at(0.35, 0.35, 2.1); return <>{box(0.55, 0.45, 0.3, 0.3, 0.4, 0.4, '#f7f7f2')}{box(0.62, 0.52, 0.04, 0.04, 0, 0.4, '#777')}{cyl(0.35, 0.35, 0.03, 0, 2.1, '#777')}<g className="spin moves" style={{ transformOrigin: `${x}px ${y}px`, transformBox: 'view-box' }}>{[0, 120, 240].map((a) => <g key={a} transform={`rotate(${a} ${x} ${y})`}><line x1={x} y1={y} x2={x + 14} y2={y} stroke="#555" strokeWidth="2" /><circle cx={x + 14} cy={y} r="3.5" fill="#e4572e" /></g>)}</g><path d={`M${x} ${y - 8} l12 -3 l-12 -3 z`} fill="#3f88c5" /></>; } },
  { id: 'arcade', name: 'Arcade', region: 'functional', topic: 'games', draw: () => <>{box(0.2, 0.25, 0.6, 0.5, 0, 1.1, '#5b4b8a')}<Poly p={[[0.3, 0.75, 0.45], [0.7, 0.75, 0.45], [0.7, 0.75, 0.9], [0.3, 0.75, 0.9]]} fill="#7ff3e1" /><Poly p={[[0.8, 0.35, 0.95], [0.8, 0.65, 0.95], [0.8, 0.65, 1.05], [0.8, 0.35, 1.05]]} fill="#ffd166" />{box(0.18, 0.23, 0.64, 0.54, 1.1, 0.1, '#3d2f6b')}</> },
  { id: 'goal', name: 'Football pitch', region: 'functional', topic: 'sports', draw: () => <><Poly p={[[0.05, 0.05, 0.02], [0.95, 0.05, 0.02], [0.95, 0.95, 0.02], [0.05, 0.95, 0.02]]} fill="#5fae5a" /><Poly p={[[0.48, 0.05, 0.03], [0.52, 0.05, 0.03], [0.52, 0.95, 0.03], [0.48, 0.95, 0.03]]} fill="#ffffffaa" />{box(0.1, 0.3, 0.03, 0.03, 0, 0.6, '#fff')}{box(0.1, 0.67, 0.03, 0.03, 0, 0.6, '#fff')}{box(0.1, 0.3, 0.03, 0.4, 0.6, 0.03, '#fff')}{ball(0.65, 0.55, 0.02, 0.1, '#f5f5f5')}</> },
  { id: 'robot', name: 'Robot statue', region: 'functional', topic: 'robots', draw: () => <>{box(0.3, 0.3, 0.4, 0.4, 0, 0.25, '#9aa5b1')}{box(0.38, 0.42, 0.08, 0.08, 0.25, 0.4, '#6b7b8c')}{box(0.54, 0.42, 0.08, 0.08, 0.25, 0.4, '#6b7b8c')}{box(0.34, 0.38, 0.32, 0.24, 0.65, 0.5, '#8fc1d3')}{box(0.38, 0.4, 0.24, 0.2, 1.15, 0.32, '#8fc1d3')}<Poly p={[[0.41, 0.6, 1.24], [0.59, 0.6, 1.24], [0.59, 0.6, 1.38], [0.41, 0.6, 1.38]]} fill="#1f2d3d" />{cyl(0.5, 0.5, 0.02, 1.47, 0.3, '#4d6f7d')}{ball(0.5, 0.5, 1.75, 0.08, '#f4a259')}</> },
  { id: 'rocket', name: 'Rocket', region: 'functional', topic: 'space', draw: () => <>{box(0.15, 0.15, 0.7, 0.7, 0, 0.12, '#8a8f99')}<Poly p={[[0.3, 0.62, 0.12], [0.5, 0.62, 0.12], [0.5, 0.62, 0.7]]} fill="#d64545" /><Poly p={[[0.62, 0.3, 0.12], [0.62, 0.5, 0.12], [0.62, 0.5, 0.7]]} fill="#b03030" />{cyl(0.5, 0.5, 0.15, 0.12, 1.9, '#f2f2f2')}{cone(0.5, 0.5, 0.15, 2.02, 0.7, '#d64545')}{(() => { const [x, y] = at(0.5, 0.65, 1.4); return <circle cx={x} cy={y} r="5" fill="#7fb8e8" stroke="#555" />; })()}</> },
  { id: 'bandstand', name: 'Bandstand', region: 'functional', topic: 'music', draw: () => <>{cyl(0.5, 0.5, 0.4, 0, 0.2, '#e8dcc6')}{[[0.25, 0.5], [0.75, 0.5], [0.5, 0.25], [0.5, 0.75]].map(([u, v]) => <g key={`${u}${v}`}>{cyl(u, v, 0.025, 0.2, 0.9, '#fff')}</g>)}{cone(0.5, 0.5, 0.45, 1.1, 0.6, '#3f88c5')}</> },
  { id: 'boat', name: 'Sailboat', region: 'functional', topic: 'ocean', beach: true, draw: () => <><Poly p={[[0.15, 0.35, 0.15], [0.85, 0.35, 0.15], [0.75, 0.6, 0], [0.25, 0.6, 0]]} fill="#b5683a" /><Poly p={[[0.15, 0.35, 0.15], [0.85, 0.35, 0.15], [0.85, 0.3, 0.2], [0.15, 0.3, 0.2]]} fill="#d18a5a" />{cyl(0.5, 0.42, 0.02, 0.15, 1.6, '#5a4030')}<Poly p={[[0.52, 0.42, 0.3], [0.52, 0.42, 1.7], [0.95, 0.42, 0.35]]} fill="#fbfbf5" /></> },
  { id: 'oak', name: 'Old oak', region: 'narrative', draw: () => <>{cyl(0.5, 0.5, 0.08, 0, 0.7, '#7a5034')}{ball(0.4, 0.55, 0.7, 0.42, '#5c9e4a')}{ball(0.62, 0.42, 0.75, 0.38, '#6fb15a')}{ball(0.5, 0.5, 1.2, 0.36, '#7cc164')}</> },
  { id: 'pine', name: 'Pine trees', region: 'narrative', draw: () => <>{cyl(0.32, 0.4, 0.04, 0, 0.3, '#6b4630')}{cone(0.32, 0.4, 0.22, 0.25, 0.8, '#2f7d4f')}{cone(0.32, 0.4, 0.16, 0.75, 0.6, '#3a9160')}{cyl(0.66, 0.66, 0.04, 0, 0.25, '#6b4630')}{cone(0.66, 0.66, 0.2, 0.2, 0.75, '#2a7048')}{cone(0.66, 0.66, 0.14, 0.65, 0.55, '#358a59')}</> },
  { id: 'tent', name: 'Camp tent', region: 'narrative', topic: 'nature', draw: () => <>{gable(0.2, 0.25, 0.6, 0.5, 0, 0.7, '#e8913a', '#e8913a')}<Poly p={[[0.8, 0.42, 0], [0.8, 0.58, 0], [0.8, 0.5, 0.45]]} fill="#5a3a20" /></> },
  { id: 'campfire', name: 'Campfire', region: 'narrative', draw: () => { const [x, y] = at(0.5, 0.5, 0.1); return <>{[[0.3, 0.5], [0.7, 0.5], [0.5, 0.3], [0.5, 0.7], [0.36, 0.36], [0.64, 0.64], [0.36, 0.64], [0.64, 0.36]].map(([u, v]) => <g key={`${u}${v}`}>{ball(u, v, 0, 0.08, '#9a958c')}</g>)}<circle cx={x} cy={y - 8} r="22" fill="url(#glow)" opacity="0.6" /><path className="flame moves" d={`M${x - 8} ${y} Q${x - 9} ${y - 14} ${x} ${y - 26} Q${x + 9} ${y - 14} ${x + 8} ${y} Z`} fill="#f4a259" /><path className="flame moves" d={`M${x - 4} ${y} Q${x - 4} ${y - 9} ${x} ${y - 16} Q${x + 4} ${y - 9} ${x + 4} ${y} Z`} fill="#ffd166" /></>; } },
  { id: 'cabin', name: 'Log cabin', region: 'narrative', draw: (n) => <>{box(0.2, 0.25, 0.6, 0.5, 0, 0.8, '#9a6a42')}{[0.2, 0.4, 0.6].map((z) => <Poly key={z} p={[[0.2, 0.75, z], [0.8, 0.75, z], [0.8, 0.75, z + 0.03], [0.2, 0.75, z + 0.03]]} fill="#7a5034" />)}<Poly p={[[0.8, 0.38, 0.35], [0.8, 0.55, 0.35], [0.8, 0.55, 0.6], [0.8, 0.38, 0.6]]} fill={win(n)} />{gable(0.14, 0.2, 0.72, 0.6, 0.8, 0.6, '#4a5a3a', '#9a6a42')}{box(0.3, 0.3, 0.1, 0.1, 1.1, 0.4, '#8a8a8a')}</> },
  { id: 'well', name: 'Wishing well', region: 'narrative', draw: () => <>{cyl(0.5, 0.5, 0.25, 0, 0.4, '#a9a39a')}{box(0.28, 0.48, 0.04, 0.04, 0.4, 0.6, '#7a5034')}{box(0.68, 0.48, 0.04, 0.04, 0.4, 0.6, '#7a5034')}{gable(0.22, 0.3, 0.56, 0.4, 1, 0.3, '#a0583d', '#7a5034')}</> },
  { id: 'treehouse', name: 'Treehouse', region: 'narrative', draw: (n) => <>{cyl(0.5, 0.5, 0.1, 0, 1.2, '#7a5034')}{box(0.25, 0.25, 0.5, 0.5, 1.1, 0.08, '#a87a4f')}{box(0.32, 0.32, 0.36, 0.36, 1.18, 0.45, '#d9b98a')}<Poly p={[[0.68, 0.42, 1.3], [0.68, 0.56, 1.3], [0.68, 0.56, 1.5], [0.68, 0.42, 1.5]]} fill={win(n)} />{pyramid(0.28, 0.28, 0.44, 0.44, 1.63, 0.4, '#4a7a3a')}{ball(0.3, 0.75, 1.5, 0.25, '#6fb15a')}</> },
  { id: 'stones', name: 'Stone circle', region: 'narrative', draw: () => <>{[0, 1, 2, 3, 4, 5].map((k) => { const a = (k / 6) * Math.PI * 2; const u = 0.45 + Math.cos(a) * 0.3, v = 0.45 + Math.sin(a) * 0.3; return <g key={k}>{box(u, v, 0.1, 0.1, 0, 0.5 + (k % 2) * 0.2, '#9a9fa8')}</g>; })}</> },
  { id: 'garden', name: 'Flower garden', region: 'narrative', topic: 'nature', draw: () => <>{box(0.15, 0.15, 0.7, 0.7, 0, 0.12, '#7a5a3a')}{[[0.3, 0.3, '#ff8fa3'], [0.5, 0.25, '#ffd166'], [0.7, 0.35, '#c39bd3'], [0.3, 0.55, '#ffd166'], [0.55, 0.5, '#ff8fa3'], [0.7, 0.65, '#ffffff'], [0.4, 0.75, '#c39bd3']].map(([u, v, c]) => <g key={`${u}${v}`}>{ball(u as number, v as number, 0.12, 0.09, c as string)}</g>)}</> },
  { id: 'dino', name: 'Dinosaur statue', region: 'narrative', topic: 'dinosaurs', draw: () => <>{box(0.2, 0.3, 0.6, 0.4, 0, 0.15, '#a9a39a')}<Poly p={[[0.2, 0.5, 0.5], [0.05, 0.5, 0.3], [0.3, 0.5, 0.4]]} fill="#4f8a52" />{ball(0.45, 0.5, 0.25, 0.32, '#5fa463')}{cyl(0.62, 0.5, 0.06, 0.6, 0.8, '#5fa463')}{ball(0.66, 0.5, 1.35, 0.14, '#6fb873')}{box(0.38, 0.45, 0.06, 0.06, 0.15, 0.2, '#4f8a52')}{box(0.55, 0.45, 0.06, 0.06, 0.15, 0.2, '#4f8a52')}</> },
  { id: 'mine', name: 'Crystal mine', region: 'narrative', topic: 'mining', draw: () => { const [x, y] = at(0.5, 0.78, 0.05); return <>{cone(0.5, 0.5, 0.45, 0, 0.9, '#8a8478')}<path d={`M${x - 10} ${y} L${x - 10} ${y - 12} Q${x} ${y - 22} ${x + 10} ${y - 12} L${x + 10} ${y} Z`} fill="#2a2420" /><Poly p={[[0.78, 0.3, 0], [0.84, 0.36, 0.7], [0.9, 0.32, 0]]} fill="#b48ef0" /><Poly p={[[0.82, 0.42, 0], [0.88, 0.46, 0.5], [0.92, 0.42, 0]]} fill="#d5bcff" /><Poly p={[[0.15, 0.7, 0], [0.2, 0.75, 0.45], [0.27, 0.72, 0]]} fill="#7fd6f0" /></>; } },
  { id: 'doghouse', name: 'Dog house', region: 'narrative', topic: 'animals', draw: () => { const [x, y] = at(0.55, 0.8, 0.02); return <>{box(0.25, 0.3, 0.45, 0.4, 0, 0.5, '#d9634c')}<path d={`M${x - 6} ${y - 1} L${x - 6} ${y - 10} Q${x} ${y - 16} ${x + 6} ${y - 10} L${x + 6} ${y - 1} Z`} fill="#3a2a20" />{gable(0.2, 0.25, 0.55, 0.5, 0.5, 0.35, '#6b4a3a', '#d9634c')}{ball(0.85, 0.75, 0, 0.13, '#b07a4a')}{ball(0.92, 0.82, 0.18, 0.08, '#c08a5a')}</>; } },
  { id: 'lantern', name: 'Peak lantern', region: 'philosophical', draw: () => { const [x, y] = at(0.5, 0.5, 1.5); return <>{cyl(0.5, 0.5, 0.04, 0, 1.4, '#4a4a5a')}<circle cx={x} cy={y} r="18" fill="url(#glow)" />{box(0.43, 0.43, 0.14, 0.14, 1.35, 0.25, '#ffe08a')}{pyramid(0.4, 0.4, 0.2, 0.2, 1.6, 0.15, '#4a4a5a')}</>; } },
  { id: 'bench', name: 'Thinking bench', region: 'philosophical', draw: () => <>{box(0.2, 0.4, 0.6, 0.2, 0.3, 0.06, '#a87a4f')}{box(0.2, 0.38, 0.6, 0.05, 0.36, 0.3, '#a87a4f')}{box(0.25, 0.45, 0.05, 0.1, 0, 0.3, '#5a4a3a')}{box(0.7, 0.45, 0.05, 0.1, 0, 0.3, '#5a4a3a')}</> },
  { id: 'telescope', name: 'Telescope', region: 'philosophical', topic: 'space', draw: () => { const [x, y] = at(0.5, 0.5, 0.9); const [fx, fy] = at(0.5, 0.5, 0); return <><g stroke="#4a4a5a" strokeWidth="2.5"><line x1={x} y1={y} x2={fx - 12} y2={fy + 4} /><line x1={x} y1={y} x2={fx + 12} y2={fy + 4} /><line x1={x} y1={y} x2={fx} y2={fy + 10} /></g><rect x={x - 22} y={y - 8} width="40" height="10" rx="4" fill="#c9a24a" transform={`rotate(-28 ${x} ${y})`} /></>; } },
  { id: 'flag', name: 'Summit flag', region: 'philosophical', draw: () => { const [x, y] = at(0.5, 0.5, 1.6); return <>{box(0.42, 0.42, 0.16, 0.16, 0, 0.15, '#9a9fa8')}{cyl(0.5, 0.5, 0.025, 0.15, 1.5, '#4a4a5a')}<path className="flame moves" d={`M${x} ${y} l22 6 l-22 6 z`} fill="#9b7fd4" /></>; } },
  // Souvenirs from the journey.
  { id: 'seal', name: 'Seal rock', region: 'functional', topic: 'animals', stop: 'gull', draw: () => { const [x, y] = at(0.5, 0.5, 0.75); return <>{ball(0.45, 0.55, 0, 0.42, '#8d8a85')}{ball(0.66, 0.4, 0, 0.26, '#9a968f')}<ellipse cx={x - 2} cy={y} rx="17" ry="6" fill="#5e646d" /><circle cx={x + 14} cy={y - 5} r="5.5" fill="#6b717a" /><circle cx={x + 16} cy={y - 6} r="1.2" fill="#111" /><path d={`M${x - 18} ${y} l-6 -4 l1 7 z`} fill="#4f545c" /></>; } },
  { id: 'kite', name: 'Windsock and kite', region: 'functional', topic: 'weather', stop: 'cape', draw: () => { const [x, y] = at(0.5, 0.5, 1.5); return <>{cyl(0.5, 0.5, 0.025, 0, 1.5, '#6b6458')}<path d={`M${x} ${y - 4} L${x + 24} ${y - 1} L${x + 24} ${y + 5} L${x} ${y + 8} Z`} fill="#f28c28" /><path d={`M${x + 8} ${y - 3} L${x + 8} ${y + 7} M${x + 16} ${y - 2} L${x + 16} ${y + 6}`} stroke="#fff" strokeWidth="3" /><path d={`M${x} ${y - 4} Q${x + 10} ${y - 30} ${x + 22} ${y - 44}`} stroke="#555" strokeWidth="0.8" fill="none" /><path d={`M${x + 22} ${y - 56} l9 10 l-9 12 l-9 -12 z`} fill="#4fa3d1" stroke="#2f6f99" /><path d={`M${x + 22} ${y - 34} q-6 6 0 10 q6 4 0 10`} stroke="#e4572e" strokeWidth="1.5" fill="none" /></>; } },
  { id: 'plane', name: 'The Kookaburra', region: 'functional', topic: 'transport', stop: 'airfield', draw: () => { const [x, y] = at(0.5, 0.5, 0.42); return <><Poly p={[[0.05, 0.3, 0.02], [0.95, 0.3, 0.02], [0.95, 0.7, 0.02], [0.05, 0.7, 0.02]]} fill="#6a6f78" />{[0.15, 0.4, 0.65].map((u) => <Poly key={u} p={[[u, 0.48, 0.03], [u + 0.15, 0.48, 0.03], [u + 0.15, 0.52, 0.03], [u, 0.52, 0.03]]} fill="#f5f5f0" />)}<Plane x={x} y={y} s={0.36} /></>; } },
  // LTF-20: souvenirs from the themed islands.
  { id: 'ammonite', name: 'Ammonite fossil', region: 'narrative', topic: 'dinosaurs', stop: 'fossil', draw: () => { const [x, y] = at(0.5, 0.5, 0.32); return <>{box(0.2, 0.25, 0.6, 0.5, 0, 0.3, '#b9b2a4')}<path d={`M${x} ${y} m-12 0 a12 9 0 1 1 24 0 a9 7 0 1 1 -18 0 a6 4.5 0 1 1 12 0 a3 2.5 0 1 1 -6 0`} stroke="#6b5a3a" strokeWidth="2.5" fill="none" /></>; } },
  { id: 'turtle', name: 'Sea turtle', region: 'functional', topic: 'ocean', beach: true, stop: 'reef', draw: () => { const [x, y] = at(0.5, 0.5, 0.2); return <><ellipse cx={x + 22} cy={y - 2} rx="7" ry="5" fill="#7cae7a" /><ellipse cx={x} cy={y} rx="22" ry="13" fill="#4f8a52" /><path d={`M${x - 12} ${y - 2} l8 -6 l8 6 l-8 6 z M${x + 4} ${y - 2} l7 -5 l6 5 l-6 5 z`} fill="#6fae66" /><ellipse cx={x - 16} cy={y + 10} rx="6" ry="3" fill="#7cae7a" /><ellipse cx={x + 14} cy={y + 10} rx="6" ry="3" fill="#7cae7a" /></>; } },
  { id: 'dome', name: 'Observatory dome', region: 'narrative', topic: 'space', stop: 'star', draw: () => { const [x, y] = at(0.5, 0.5, 0.75); return <>{cyl(0.5, 0.5, 0.36, 0, 0.75, '#ecebe4')}<path d={`M${x - 26} ${y} A26 24 0 0 1 ${x + 26} ${y} Z`} fill="#ffffff" stroke="#c9c6bb" /><rect x={x - 3} y={y - 23} width="6" height="23" fill="#4a5568" /></>; } },
  { id: 'signal', name: 'Railway signal', region: 'functional', topic: 'transport', stop: 'rail', draw: () => { const [x, y] = at(0.5, 0.5, 1.5); return <>{cyl(0.5, 0.5, 0.03, 0, 1.4, '#4a4a5a')}<rect x={x - 8} y={y - 14} width="16" height="28" rx="3" fill="#2b2b2b" /><circle cx={x} cy={y - 6} r="4.5" fill="#3fbf5a" /><circle cx={x} cy={y + 6} r="4.5" fill="#5a2b2b" /></>; } },
  // LTF-30: souvenirs from the koala keeper arc.
  { id: 'sapling', name: 'Eucalyptus sapling', region: 'narrative', topic: 'nature', stop: 'nursery', draw: () => <>{cyl(0.5, 0.5, 0.2, 0, 0.3, '#b5653a')}{cyl(0.5, 0.5, 0.03, 0.3, 0.7, '#8a6a46')}{ball(0.42, 0.55, 0.85, 0.18, '#86b5a2')}{ball(0.6, 0.45, 1, 0.16, '#9cc5b4')}{ball(0.5, 0.5, 1.15, 0.14, '#7aa996')}</> },
  { id: 'scale', name: "Keeper's scale", region: 'functional', topic: 'animals', stop: 'keeper', draw: () => { const [x, y] = at(0.5, 0.5, 0.55); return <>{box(0.3, 0.3, 0.4, 0.4, 0, 0.12, '#9aa3ab')}{cyl(0.5, 0.5, 0.04, 0.12, 0.8, '#6b6458')}
    <path d={`M${x - 22} ${y - 14} L${x + 22} ${y - 14}`} stroke="#8a6a46" strokeWidth="4" strokeLinecap="round" /><circle cx={x} cy={y + 6} r="8" fill="#fffdf6" stroke="#4a4a52" strokeWidth="1.5" /><path d={`M${x} ${y + 6} l4 -4`} stroke="#d64545" strokeWidth="1.5" /></>; } },
  { id: 'vetbag', name: "Vet's bag", region: 'functional', topic: 'animals', stop: 'clinic', draw: () => { const [x, y] = at(0.5, 0.5, 0.55); return <>{box(0.25, 0.3, 0.5, 0.4, 0, 0.5, '#7a4a2a')}
    <path d={`M${x - 8} ${y - 6} q8 -12 16 0`} stroke="#4a2e1a" strokeWidth="2.5" fill="none" /><circle cx={x} cy={y + 8} r="3" fill="#fffdf6" />{[-5, -2, 2, 5].map((d) => <circle key={d} cx={x + d} cy={y + 3 - Math.abs(d) * 0.3} r="1.4" fill="#fffdf6" />)}</>; } },
  { id: 'viewpath', name: 'Viewing path', region: 'narrative', topic: 'nature', stop: 'habitat', draw: () => <>{[0.1, 0.3, 0.5, 0.7].map((v) => <g key={v}>{box(0.15, v, 0.7, 0.16, 0.05, 0.06, '#c9a46a')}</g>)}{[0.15, 0.85].map((u) => [0.1, 0.9].map((v) => <g key={`${u}${v}`}>{cyl(u, v, 0.025, 0.1, 0.5, '#8a6a46')}</g>))}</> },
  { id: 'koalasign', name: 'Koala sign', region: 'functional', topic: 'animals', stop: 'opening', draw: () => { const [x, y] = at(0.5, 0.5, 1.1); return <>{cyl(0.5, 0.5, 0.03, 0, 1.1, '#6b4a2f')}<rect x={x - 22} y={y - 16} width="44" height="26" rx="4" fill="#fffdf6" stroke="#6b4a2f" strokeWidth="2" /><Koala x={x} y={y + 6} s={0.22} /></>; } },
  { id: 'koala', name: 'Koala tree', region: 'narrative', topic: 'animals', stop: 'australia', draw: () => { const [x, y] = at(0.5, 0.5, 0.75); return <>{cyl(0.5, 0.5, 0.09, 0, 1.4, '#e3dccf')}{ball(0.36, 0.56, 1.25, 0.36, '#86b5a2')}{ball(0.64, 0.42, 1.35, 0.32, '#9cc5b4')}{ball(0.5, 0.5, 1.7, 0.3, '#7aa996')}<Koala x={x + 6} y={y} s={0.34} /></>; } },
];
export const pieceById = new Map(PIECES.map((p) => [p.id, p]));

export function PiecePreview({ id }: { id: string }) {
  const p = pieceById.get(id);
  return <svg viewBox="-36 -58 72 94" aria-hidden="true">
    <Defs />
    <polygon points={pts([[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]])} fill={p?.beach ? '#efdca2' : p?.region === 'narrative' ? '#9fcf7a' : p?.region === 'philosophical' ? '#cfcadf' : '#e7d7b5'} />
    {p?.draw(false)}
  </svg>;
}

// ---------------------------------------------------------------- the island
export type Region = 'town' | 'forest' | 'peaks' | 'beach';
export interface Tile { r: number; c: number; region: Region; z: number }
const N = 11;
const VB = { x: -300, y: -100, w: 600, h: 413 };
const labelAt = (r: number, c: number, z: number) => {
  const [x, y] = pr([c + 0.5, r + 0.5, z]);
  return { left: `${((x - VB.x) / VB.w) * 100}%`, top: `${((y - VB.y) / VB.h) * 100}%` };
};
const noise = (r: number, c: number) => { const s = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453; return s - Math.floor(s); };
export const TILES: Tile[] = (() => {
  const out: Tile[] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    const h = c - r, d = r + c;
    const e = (h / 6.6) ** 2 + ((d - 10) / 7.6) ** 2;
    if (e > 1) continue;
    const region: Region = d <= 7 ? 'peaks' : d >= 16 || (e > 0.78 && d >= 12) ? 'beach' : h <= 0 ? 'town' : 'forest';
    const z = region === 'peaks' ? Math.max(0.8, 3.3 - (d - 3) * 0.45 - Math.abs(h) * 0.35) : region === 'beach' ? 0.25 : 0.5;
    out.push({ r, c, region, z: Math.round(z * 4) / 4 });
  }
  return out;
})();
export const PATHS: Record<'functional' | 'narrative' | 'philosophical', [number, number][]> = {
  functional: [[9, 6], [8, 5], [8, 4], [7, 3], [6, 3], [5, 3]],
  narrative: [[6, 9], [5, 8], [4, 8], [3, 7], [3, 6], [3, 5]],
  philosophical: [[4, 3], [3, 3], [3, 2], [2, 2], [2, 1], [1, 2]],
};
const LANDMARKS: { r: number; c: number; kind: 'lighthouse' | 'bigoak' | 'observatory' | 'bakery' }[] = [
  { r: 10, c: 6, kind: 'lighthouse' }, { r: 2, c: 6, kind: 'bigoak' }, { r: 2, c: 3, kind: 'observatory' }, { r: 7, c: 6, kind: 'bakery' },
];
const reserved = new Set([...Object.values(PATHS).flat().map(([r, c]) => `${r},${c}`), ...LANDMARKS.map((l) => `${l.r},${l.c}`)]);

export interface Placed { piece: string; x: number; y: number; id: string; ts: number; island: string }
/** Where a piece can go: not on a path, a landmark or mark, another piece, a closed place, or Home Island's closed peaks. */
export function freeTiles(placed: Placed[], peaksOpen: boolean, beach?: boolean, island: IslandDef = ISLANDS.home, st?: IslandState) {
  const used = new Set(settle(placed, island).map((p) => `${p.y},${p.x}`));
  const res = reservedOn(island);
  const closed = new Set(placesOf(island, st).filter((p) => !p.open).flatMap((p) => spotsAround(island, p.at)));
  return islandTiles(island).filter((t) => !res.has(`${t.r},${t.c}`) && !used.has(`${t.r},${t.c}`) && !closed.has(`${t.r},${t.c}`) && (peaksOpen || island.land.length > 0 || t.region !== 'peaks') && (beach ? t.region === 'beach' : t.region !== 'beach'));
}

const TOP: Record<Region, [string, string]> = { town: ['#e9d9b8', '#e2cfa9'], forest: ['#9fcf7a', '#93c56d'], peaks: ['#cfcadf', '#c4bfd6'], beach: ['#f0dca0', '#ead396'] };
const SIDE: Record<Region, string> = { town: '#b99d72', forest: '#8a6a46', peaks: '#9a95ad', beach: '#d4b977' };

// ---------------------------------------------------------------- an island at each stop (LTF-36, LTF-45 to LTF-48)
// Home Island keeps his three lantern paths. Every other island is its own place: its own land and heights (LTF-48), its
// own names for its three parts (LTF-45), a quest of its own length and kinds of step, shown as numbered stones on its map
// (LTF-46), and a keepsake to take home when the quest is done (LTF-47). One place waits for a lantern, for later.
export interface Step {
  /** What he does, in the island's story. */
  text: string;
  /** Finished sessions it takes; 1 when left out. */
  sessions?: number;
  /** Said after a session that did part of it. */
  then?: string;
  /** Or a thing from the island he builds: done once it stands on this island. */
  build?: string;
  /** The place it opens. Where the place and the step's stone sit is marked on the island's land. */
  place?: { name: string; look: string };
}
export interface IslandDef {
  id: string; name: string;
  top: Record<Region, [string, string]>; side: Record<Region, string>;
  relief: 'mountain' | 'boulders' | 'layers' | 'palms' | 'hills' | 'redrock';
  /** LTF-48: the land, row by row: '.' sea, 'b' beach, 't' town, 'f' green, 'p' high ground, 'P' its tops. Marks: 'L'
   * where he comes ashore, '1' to '5' each step's stone, 'A' to 'E' the place step 1 to 5 opens, 'G' the place that waits
   * for a lantern. Home Island has none: it keeps its own. */
  land: string[];
  /** LTF-45: its names for its three parts. */
  names: Record<'town' | 'forest' | 'peaks', string>;
  /** What stands where he comes ashore. */
  arrival?: string;
  steps: Step[];
  /** The place that waits for a lantern, so he can come back for it. */
  later?: { name: string; look: string; gate: { strand: 'functional' | 'narrative'; step: number } };
  /** LTF-47: what he takes home when the quest is done. */
  keepsake?: { icon: string; name: string };
  /** Things to build that belong here, offered first while he is on this island. */
  pieces: string[];
}

const pal = (t: string, f: string, p: string, b: string, s: [string, string, string, string]) => ({
  top: { town: [t, shade(t, -0.04)], forest: [f, shade(f, -0.05)], peaks: [p, shade(p, -0.04)], beach: [b, shade(b, -0.04)] } as Record<Region, [string, string]>,
  side: { town: s[0], forest: s[1], peaks: s[2], beach: s[3] } as Record<Region, string>,
});

export const ISLANDS: Record<string, IslandDef> = {
  home: { id: 'home', name: 'Home Island', top: TOP, side: SIDE, relief: 'mountain', land: [], names: { town: 'Harbor Town', forest: 'Story Woods', peaks: 'Lantern Peaks' }, steps: [], pieces: [] },
  gull: { id: 'gull', name: 'Gull Island', ...pal('#dfe2e4', '#b9d59c', '#c9cac4', '#ebe3cb', ['#9aa3ab', '#7d8f5a', '#8d8e88', '#c2b590']), relief: 'boulders', arrival: 'pier',
    names: { town: 'Ferry Dock', forest: 'Gull Meadow', peaks: 'Lookout Rocks' },
    land: [
      '...........',
      '.....bb....',
      '....bPpb...',
      '...bpPpfb..',
      '..bCppffBb.',
      '..b3fpf2fb.',
      '.bttfff1Ab.',
      '.bGtttftb..',
      '..btt4ttb..',
      '...bbLbb...',
      '...........'],
    steps: [
      { text: 'Count the gull nests with Ranger Jo.', place: { name: 'The gull nests', look: 'nest' } },
      { text: 'Watch the seals from far away, so they can rest.', place: { name: 'Seal Rocks', look: 'seal' } },
      { text: 'Find a crab in the rock pools.', place: { name: 'The rock pools', look: 'pool' } },
      { text: 'Build a sailboat for the ferry dock.', build: 'boat' },
    ],
    later: { name: 'The ranger hut', look: 'cabin', gate: { strand: 'functional', step: 2 } },
    keepsake: { icon: '🪶', name: 'a gull feather' }, pieces: ['seal', 'boat', 'telescope'] },
  cape: { id: 'cape', name: 'Windy Cape', ...pal('#e6dcc4', '#a9c98b', '#cbc4b6', '#ecdcae', ['#b39d78', '#7f8f58', '#958c7c', '#cdb67c']), relief: 'hills', arrival: 'busstop',
    names: { town: 'Cape Village', forest: 'Long Grass', peaks: 'The Cliffs' },
    land: [
      '...........',
      '...........',
      '......bbb..',
      '....bbpPPb.',
      '..bbffp3Cb.',
      '.bfffAfppb.',
      'bttt1ffbb..',
      'bGt2Bfb....',
      '.bttttb....',
      '..bbLbb....',
      '...........'],
    steps: [
      { text: 'Help fly a kite in the strong wind.', sessions: 2, then: 'The wind dropped. Next session, try the kite again.', place: { name: 'The kite field', look: 'kite' } },
      { text: 'Watch the windmill turn in the wind.', place: { name: 'The windmill', look: 'windmill' } },
      { text: 'Walk the cliff path, far from the edge.', place: { name: 'The cliff path', look: 'flag' } },
    ],
    later: { name: 'The weather station', look: 'weather', gate: { strand: 'narrative', step: 2 } },
    keepsake: { icon: '🪁', name: 'a small kite' }, pieces: ['kite', 'windmill', 'weather'] },
  fossil: { id: 'fossil', name: 'Fossil Bay', ...pal('#ddd3c2', '#a9c590', '#c6bead', '#e9d7a9', ['#a8977c', '#7c8a5a', '#8e8574', '#c9b27a']), relief: 'layers', arrival: 'pier',
    names: { town: 'Bay Village', forest: 'Fern Gully', peaks: 'Rock Layers' },
    land: [
      '...........',
      '..bPPPPb...',
      '.bpPPPPpb..',
      'bfpppppfAb.',
      'bff2Bff1fb.',
      'bttfffftfb.',
      'btG...ttfb.',
      'btb...tt4b.',
      '.bC3..btbb.',
      '..bbLbbb...',
      '...........'],
    steps: [
      { text: 'Help Dr. Bell brush the sand off a bone.', sessions: 2, then: 'The bone is big. Next session, brush some more.', place: { name: 'The dig', look: 'dig' } },
      { text: 'Help wrap the bone in a plaster jacket.', place: { name: 'The plaster tent', look: 'tent' } },
      { text: 'Find an ammonite shell in the rocks.', place: { name: 'Ammonite Beach', look: 'ammonite' } },
      { text: 'Help Dr. Bell label the bone for the museum.' },
    ],
    later: { name: 'The dinosaur garden', look: 'dino', gate: { strand: 'narrative', step: 3 } },
    keepsake: { icon: '🐚', name: 'a fossil shell' }, pieces: ['ammonite', 'dino', 'mine'] },
  reef: { id: 'reef', name: 'Reef Island', ...pal('#f4e8c8', '#92d38c', '#a9d9a1', '#fbefc6', ['#c9b07a', '#5f9a58', '#6f9a5a', '#d6c08a']), relief: 'palms', arrival: 'pier',
    names: { town: 'Reef Village', forest: 'Palm Grove', peaks: 'Lookout Dune' },
    land: [
      '...........',
      '....bbbb...',
      '..bbfPfbb..',
      '.bff5bbffb.',
      '.bfb...bAb.',
      'bGfb...b1b.',
      'btfB...btb.',
      '.bt2b.bCb..',
      '.bttbbb3b..',
      '..bt4tLb...',
      '....bbb....'],
    steps: [
      { text: 'Find a sea star in the tide pools with Mari.', place: { name: 'The tide pools', look: 'pool' } },
      { text: 'Look for a clownfish through the glass floor.', place: { name: 'The glass-bottom boat', look: 'boat' } },
      { text: 'Help Mari mark where the turtles laid their eggs.', place: { name: 'Turtle Beach', look: 'turtle' } },
      { text: 'Help Mari pick up rubbish on the beach.' },
      { text: 'Help Mari count the parrotfish on the reef.' },
    ],
    later: { name: 'The lagoon hut', look: 'cabin', gate: { strand: 'functional', step: 3 } },
    keepsake: { icon: '🐢', name: "Mari's turtle badge" }, pieces: ['turtle', 'boat', 'garden'] },
  star: { id: 'star', name: 'Star Point', ...pal('#dadce6', '#93bb8d', '#bcc4d7', '#e5ddc6', ['#9a9db0', '#5f8a5a', '#7c87a3', '#c4b68e']), relief: 'hills', arrival: 'pier',
    names: { town: 'Point Village', forest: 'Pine Slope', peaks: 'Star Hill' },
    land: [
      '...........',
      '...bpb.....',
      '..bpPPpb...',
      '..bpPCPpb..',
      '.bfpp3ppfb.',
      '.bff2Bfffb.',
      '.btttfffb..',
      '.bGt1Atfb..',
      '..bttttb...',
      '...bbLb....',
      '...........'],
    steps: [
      { text: 'Watch the weather balloon go up at 6 AM.', place: { name: 'The balloon field', look: 'weather' } },
      { text: 'Look at the Moon through the telescope.', place: { name: 'The telescope', look: 'telescope' } },
      { text: 'Help Dr. Amal open the dome on a clear night.', sessions: 2, then: 'The first night was cloudy. Next session, try again.', place: { name: 'The dome', look: 'dome' } },
    ],
    later: { name: 'The rocket garden', look: 'rocket', gate: { strand: 'narrative', step: 4 } },
    keepsake: { icon: '⭐', name: 'a star chart' }, pieces: ['dome', 'telescope', 'rocket'] },
  rail: { id: 'rail', name: 'Rail Coast', ...pal('#e5d3c1', '#a5c886', '#c8c1b4', '#ebdaaf', ['#b08a6a', '#728d55', '#928a7b', '#c9b27c']), relief: 'hills', arrival: 'pier',
    names: { town: 'Station Town', forest: 'Green Fields', peaks: 'Tunnel Hill' },
    land: [
      '...........',
      '......bbb..',
      '.....bpP5b.',
      '....btpp4b.',
      '...btttDb..',
      '..bt3Btb...',
      '.btt2fb....',
      '.bftA1b....',
      '.bGttb.....',
      '..bLbb.....',
      '...........'],
    steps: [
      { text: 'Help Mr. Haddad pull the signal lever.', place: { name: 'The signal box', look: 'signal' } },
      { text: 'Check the clock before the train comes in.', place: { name: 'The platform', look: 'clocktower' } },
      { text: 'Build a bus stop by the station.', build: 'busstop' },
      { text: 'Find Home Island on the big map.', place: { name: 'The map room', look: 'house' } },
      { text: 'Ride the train to the end of the line.' },
    ],
    later: { name: 'The engine shed', look: 'train', gate: { strand: 'functional', step: 4 } },
    keepsake: { icon: '🎫', name: 'a train ticket' }, pieces: ['signal', 'train', 'busstop'] },
  airfield: { id: 'airfield', name: 'Cloud Hill', ...pal('#d9ddd0', '#b6d791', '#d0e1c1', '#e7ddb9', ['#9aa08e', '#7e9a5c', '#8fa585', '#c7b88a']), relief: 'hills', arrival: 'plane',
    names: { town: 'The Runway', forest: 'Hill Meadow', peaks: 'Cloud Top' },
    land: [
      '...........',
      '...bffb....',
      '..bfpPpfb..',
      '.bfpGPppfb.',
      '.bfpp4pptb.',
      '.bttttttttb',
      '.bA1ttt2Bb.',
      '.bffftC3fb.',
      '..bfffffb..',
      '...bbLbb...',
      '...........'],
    steps: [
      { text: 'Help Captain Ada open the hangar doors.', place: { name: 'The hangar', look: 'hangar' } },
      { text: 'Check the windsock to see which way the wind blows.', place: { name: 'The windsock', look: 'kite' } },
      { text: 'Hand Captain Ada the tools to fix the plane.', sessions: 2, then: 'The plane needs one more fix. Next session, finish the job.', place: { name: 'The workshop', look: 'house' } },
      { text: 'Build a weather station so pilots know the wind.', build: 'weather' },
    ],
    later: { name: 'The lookout', look: 'telescope', gate: { strand: 'narrative', step: 4 } },
    keepsake: { icon: '✈️', name: "a pilot's badge" }, pieces: ['plane', 'weather', 'rocket'] },
  australia: { id: 'australia', name: 'Australia', ...pal('#ebcda5', '#abca90', '#da9470', '#f1dbab', ['#b98a5c', '#76935a', '#a85f3d', '#cdb27a']), relief: 'redrock', arrival: 'plane',
    names: { town: 'Bluegum Town', forest: 'Gum Forest', peaks: 'Red Rock' },
    land: [
      '....bb.....',
      '..bffffb...',
      '.bfffBffb..',
      'bfff2ffpfb.',
      'bttfffPPpfb',
      'bttt3pPPpfb',
      'bGtttppp4Db',
      '.btA1tttffb',
      '.bbtttttfb.',
      '..bbbLbbb..',
      '...........'],
    steps: [
      { text: 'Help Ranger Tess plant a young gum tree.', place: { name: 'The young gum trees', look: 'garden' } },
      { text: 'Find Gumnut asleep in a tree.', place: { name: 'The koala walk', look: 'koala' } },
      { text: 'Put up a camp tent for the night walk.', build: 'tent' },
      { text: 'Have a picnic with Ranger Tess by the creek.', place: { name: 'The picnic spot', look: 'bench' } },
    ],
    later: { name: "The keeper's hut", look: 'cabin', gate: { strand: 'functional', step: 5 } },
    keepsake: { icon: '🍃', name: 'a gum leaf' }, pieces: ['koala', 'garden', 'tent'] },
};
/** The island for a journey stop. The take-off is still Cloud Hill; anything unknown is Home Island. */
export const islandOf = (stop: string) => (stop === 'takeoff' ? 'airfield' : ISLANDS[stop] ? stop : 'home');

// LTF-48: an island's land, read once from its rows.
const HEIGHT: Record<string, number> = { b: 0.25, t: 0.5, f: 0.75, p: 1.5, P: 2.75 };
const GROUND: Record<string, Region> = { b: 'beach', t: 'town', f: 'forest', p: 'peaks', P: 'peaks' };
export interface Layout { tiles: Tile[]; landing?: string; stones: string[]; places: Map<number | 'later', string>; high: Set<string> }
const layouts = new Map<string, Layout>();
export function layoutOf(def: IslandDef): Layout {
  if (!def.land.length) return { tiles: TILES, stones: [], places: new Map(), high: new Set() };
  if (!layouts.has(def.id)) {
    const ch = (r: number, c: number) => def.land[r]?.[c] ?? '.';
    const out: Layout = { tiles: [], stones: [], places: new Map(), high: new Set() };
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const k = `${r},${c}`, m = ch(r, c);
      if (m === '.') continue;
      if (m >= '1' && m <= '5') out.stones[+m - 1] = k;
      else if (m >= 'A' && m <= 'E') out.places.set(m.charCodeAt(0) - 65, k);
      else if (m === 'G') out.places.set('later', k);
      else if (m === 'L') out.landing = k;
      if (m === 'P') out.high.add(k);
      // A mark stands on the ground most of its neighbours have (the landing on the beach).
      const near = [ch(r - 1, c), ch(r + 1, c), ch(r, c - 1), ch(r, c + 1)];
      const g = m === 'L' ? 'b' : GROUND[m] ? m : [...'tfbpP'].sort((x, y) => near.filter((n) => n === y).length - near.filter((n) => n === x).length)[0];
      out.tiles.push({ r, c, region: GROUND[g], z: HEIGHT[g] });
    }
    layouts.set(def.id, out);
  }
  return layouts.get(def.id)!;
}
export const islandTiles = (def: IslandDef) => layoutOf(def).tiles;

type Lit = Record<'functional' | 'narrative' | 'philosophical', boolean[]>;
export interface IslandState { done: boolean[]; count: number[]; later: boolean }
/** LTF-46: the quest's steps take finished sessions in order, or a thing he builds there; all of them are done once he
 * has sailed on. The place that waits for a lantern opens with it. */
export function questState(def: IslandDef, o: { sessions: number; left: boolean; built: ReadonlySet<string>; lit: Lit }): IslandState {
  let spare = o.sessions;
  const count = def.steps.map((s) => { if (s.build) return 0; const n = Math.min(spare, s.sessions ?? 1); spare -= n; return n; });
  return {
    done: def.steps.map((s, i) => o.left || (s.build ? o.built.has(s.build) : count[i] >= (s.sessions ?? 1))),
    count,
    later: !!def.later && !!o.lit[def.later.gate.strand][def.later.gate.step - 1],
  };
}
/** The places on an island, each step's and then the one that waits for a lantern: where each sits and whether it is open. */
export function placesOf(def: IslandDef, st?: IslandState) {
  const at = layoutOf(def).places;
  return [...def.steps.flatMap((s, i) => (s.place ? [{ ...s.place, at: at.get(i)!, open: !!st?.done[i] }] : [])),
    ...(def.later ? [{ name: def.later.name, look: def.later.look, at: at.get('later')!, open: !!st?.later }] : [])];
}

/** What nothing can be built on: Home Island's paths and landmarks; elsewhere the marks, the tops and a few features. */
function marksOn(def: IslandDef) {
  const lay = layoutOf(def);
  return new Set([...(lay.landing ? [lay.landing] : []), ...lay.stones, ...lay.places.values(), ...lay.high]);
}
const decoFor = new Map<string, Set<string>>();
/** A few of the island's own features (boulders, palms, rock layers) on open ground, so it reads as a different place. */
function islandDeco(def: IslandDef): Set<string> {
  if (!def.land.length) return new Set();
  if (!decoFor.has(def.id)) {
    const marks = marksOn(def), seed = [...def.id].reduce((h, ch) => h + ch.charCodeAt(0), 0);
    const spots = new Set(placesOf(def).flatMap((p) => spotsAround(def, p.at)));
    const open = islandTiles(def).filter((t) => t.region !== 'peaks' && t.region !== 'beach' && !marks.has(`${t.r},${t.c}`) && !spots.has(`${t.r},${t.c}`));
    decoFor.set(def.id, new Set(open.sort((a, b) => noise(b.r * 7 + seed, b.c * 5) - noise(a.r * 7 + seed, a.c * 5)).slice(0, 3).map((t) => `${t.r},${t.c}`)));
  }
  return decoFor.get(def.id)!;
}
/** The build spots around a place: the land next to it. */
function spotsAround(def: IslandDef, at: string): string[] {
  const [r, c] = at.split(',').map(Number);
  const land = new Set(islandTiles(def).map((t) => `${t.r},${t.c}`)), marks = marksOn(def);
  const out: string[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const k = `${r + dr},${c + dc}`;
    if ((dr || dc) && land.has(k) && !marks.has(k)) out.push(k);
  }
  return out;
}
function reservedOn(def: IslandDef) {
  return def.land.length ? new Set([...marksOn(def), ...islandDeco(def)]) : reserved;
}
/** LTF-48: things he built before an island had its own shape stay where they can, and otherwise stand on the nearest
 * free spot. His log is never rewritten. */
export function settle(placed: Placed[], def: IslandDef): Placed[] {
  if (!def.land.length) return placed;
  const tiles = islandTiles(def), res = reservedOn(def), used = new Set<string>();
  return placed.map((p) => {
    const free = (t: Tile) => !res.has(`${t.r},${t.c}`) && !used.has(`${t.r},${t.c}`);
    const far = (t: Tile) => (t.r - p.y) ** 2 + (t.c - p.x) ** 2;
    const beach = !!pieceById.get(p.piece)?.beach;
    const near = (list: Tile[]) => [...list].sort((a, b) => far(a) - far(b))[0];
    const t = tiles.find((x) => x.r === p.y && x.c === p.x && free(x)) ?? near(tiles.filter((x) => free(x) && (x.region === 'beach') === beach)) ?? near(tiles.filter(free));
    if (!t) return p;
    used.add(`${t.r},${t.c}`);
    return t.r === p.y && t.c === p.x ? p : { ...p, x: t.c, y: t.r };
  });
}
/** Where an island's name for a part sits: toward the side Home Island has it on (town left, green right, high ground at
 * the back), so the names never sit on top of each other. */
function labelSpot(def: IslandDef, region: Region) {
  const side = (t: Tile) => (region === 'town' ? t.r - t.c : region === 'forest' ? t.c - t.r : -(t.r + t.c) * 2 + t.z);
  return islandTiles(def).filter((t) => t.region === region).sort((a, b) => side(b) - side(a))[0] ?? null;
}

/** Island drawings that are not pieces he can build. */
const ISLAND_ART: Record<string, (night: boolean) => ReactNode> = {
  pier: () => <>{[0.12, 0.88].map((u) => [0.3, 0.7].map((v) => <g key={`${u}${v}`}>{cyl(u, v, 0.04, -0.4, 0.55, '#6b4a2f')}</g>))}{box(0.05, 0.25, 0.9, 0.5, 0.15, 0.06, '#a8814f')}
    {box(0.55, 0.78, 0.4, 0.2, -0.1, 0.18, '#f5f5f0')}{box(0.62, 0.8, 0.18, 0.14, 0.08, 0.14, '#3f88c5')}</>,
  nest: () => { const [x, y] = at(0.5, 0.5, 0.1); return <><ellipse cx={x} cy={y} rx="16" ry="7" fill="#8a6a46" /><ellipse cx={x} cy={y - 1} rx="11" ry="4.5" fill="#5e4630" />
    {[-5, 0, 5].map((d) => <ellipse key={d} cx={x + d} cy={y - 3} rx="3" ry="4" fill="#e9e4d6" />)}<ellipse cx={x + 18} cy={y - 12} rx="9" ry="6" fill="#ffffff" /><path d={`M${x + 12} ${y - 14} l10 -4 l2 5 z`} fill="#9aa3ab" /><circle cx={x + 25} cy={y - 15} r="3.5" fill="#ffffff" /><path d={`M${x + 28} ${y - 15} l4 1 l-4 1 z`} fill="#f2b04a" /></>; },
  pool: () => { const [x, y] = at(0.5, 0.5, 0.05); return <>{ball(0.2, 0.5, 0, 0.2, '#9a968f')}{ball(0.75, 0.3, 0, 0.18, '#8d8a85')}{ball(0.6, 0.8, 0, 0.16, '#a39f97')}<ellipse cx={x} cy={y} rx="20" ry="9" fill="#5fb0dc" stroke="#d8d2c4" strokeWidth="2" />
    <ellipse cx={x - 4} cy={y} rx="5" ry="3" fill="#e4572e" /><path d={`M${x - 9} ${y - 1} l-4 -3 M${x + 1} ${y - 1} l4 -3 M${x - 8} ${y + 2} l-4 2 M${x} ${y + 2} l4 2`} stroke="#e4572e" strokeWidth="1.4" /><path d={`M${x + 9} ${y - 2} l2 4 l4 0 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 l4 0 z`} fill="#f28c28" /></>; },
  dig: () => { const [x, y] = at(0.5, 0.5, 0); return <><Poly p={[[0.2, 0.2, 0.01], [0.8, 0.2, 0.01], [0.8, 0.8, 0.01], [0.2, 0.8, 0.01]]} fill="#8a6a46" />{[[0.2, 0.2], [0.8, 0.2], [0.8, 0.8], [0.2, 0.8]].map(([u, v]) => <g key={`${u}${v}`}>{cyl(u, v, 0.02, 0, 0.35, '#c9a46a')}</g>)}
    <path d={`M${x - 12} ${y - 2} l24 0`} stroke="#f2ecdc" strokeWidth="4" strokeLinecap="round" /><circle cx={x - 13} cy={y - 4} r="3" fill="#f2ecdc" /><circle cx={x - 13} cy={y} r="3" fill="#f2ecdc" /><circle cx={x + 13} cy={y - 4} r="3" fill="#f2ecdc" /><circle cx={x + 13} cy={y} r="3" fill="#f2ecdc" /></>; },
  hangar: (n) => { const [x, y] = at(0.5, 0.95, 0); return <>{box(0.1, 0.15, 0.8, 0.8, 0, 0.9, '#c9ccd2')}{gable(0.06, 0.1, 0.88, 0.9, 0.9, 0.5, '#d64545', '#c9ccd2')}<rect x={x - 14} y={y - 30} width="28" height="24" fill={n ? '#ffd56b' : '#5b6170'} /></>; },
};
/** What stands on an island's high ground, by `relief`. */
function Relief({ kind, seed }: { kind: IslandDef['relief']; seed: number }) {
  const h = 0.7 + seed * 0.8;
  if (kind === 'mountain') return <Mountain seed={seed} />;
  if (kind === 'boulders') return <g>{ball(0.4, 0.55, 0, 0.3 + seed * 0.15, '#9a9a94')}{ball(0.68, 0.38, 0, 0.22, '#a9a9a3')}</g>;
  if (kind === 'layers') return <g>{box(0.12, 0.12, 0.76, 0.76, 0, h * 0.4, '#c4bcab')}{box(0.2, 0.2, 0.6, 0.6, h * 0.4, h * 0.35, '#b1a998')}{box(0.3, 0.3, 0.4, 0.4, h * 0.75, h * 0.3, '#cfc7b5')}</g>;
  if (kind === 'palms') { const [x, y] = at(0.5, 0.5, 1.3 + seed * 0.3); return <g>{cyl(0.5, 0.5, 0.04, 0, 1.3 + seed * 0.3, '#8a6a46')}{[-1, 1].map((s) => <ellipse key={s} cx={x + s * 12} cy={y + 2} rx="14" ry="5" fill="#4f9a48" transform={`rotate(${s * 18} ${x + s * 12} ${y + 2})`} />)}<ellipse cx={x} cy={y - 2} rx="12" ry="5" fill="#5fae5a" /></g>; }
  if (kind === 'redrock') return <g>{ball(0.5, 0.5, 0, 0.42 + seed * 0.18, '#c8643c')}{ball(0.72, 0.35, 0, 0.2, '#b75a36')}</g>;
  const [x, y] = at(0.5, 0.5, 0), ry = 14 + seed * 12;
  return <g><path d={`M${x - 28} ${y} A28 ${ry} 0 0 1 ${x + 28} ${y} Z`} fill="#93c27c" /><path d={`M${x} ${y - ry} A28 ${ry} 0 0 1 ${x + 28} ${y} L${x} ${y} Z`} fill="#000" opacity="0.12" /></g>;
}
export const drawLook = (look: string, night: boolean) => ISLAND_ART[look]?.(night) ?? pieceById.get(look)?.draw(night);

function skyFor(hour: number) {
  if (hour >= 20 || hour < 6) return { sky: '#1d2b4f', sea: '#2b4a78', sea2: '#3c5d8f', night: true };
  if (hour >= 17) return { sky: '#f3b98f', sea: '#6f8fc0', sea2: '#8fa9d4', night: false };
  if (hour < 10) return { sky: '#cde8f5', sea: '#69b6dc', sea2: '#94cfe9', night: false };
  return { sky: '#a9d8f0', sea: '#5fb0dc', sea2: '#8ccbec', night: false };
}

export interface IslandProps {
  placed: Placed[];
  lit: Record<'functional' | 'narrative' | 'philosophical', boolean[]>;
  here: Partial<Record<'functional' | 'narrative' | 'philosophical', number>>;
  peaksOpen: boolean;
  placing?: { piece: string; onPlace: (x: number, y: number) => void };
  fresh?: string;
  hour?: number;
  /** How far along the journey: 0 Home Island to 5 Australia. Shows small clues on the horizon. */
  stage?: number;
  /** LTF-36: which island, and how far its quest has come. Home Island when left out. */
  island?: IslandDef;
  state?: IslandState;
}

export function Island({ placed, lit, here, peaksOpen, placing, fresh, hour = new Date().getHours(), stage = 0, island = ISLANDS.home, state }: IslandProps) {
  const t = skyFor(hour);
  const home = island.id === 'home';
  const deco = islandDeco(island);
  const spots = placing ? new Set(freeTiles(placed, peaksOpen, pieceById.get(placing.piece)?.beach, island, state).map((x) => `${x.r},${x.c}`)) : null;
  const lay = layoutOf(island);
  const places = placesOf(island, state);
  const look = new Map<string, { draw: ReactNode; title: string }>(home ? [] : [
    [lay.landing!, { draw: drawLook(island.arrival ?? 'pier', t.night), title: `Where you came ashore on ${island.name}` }],
    ...places.filter((p) => p.open).map((p) => [p.at, { draw: drawLook(p.look, t.night), title: p.name }] as [string, { draw: ReactNode; title: string }]),
  ]);
  const byTile = new Map(settle(placed, island).map((p) => [`${p.y},${p.x}`, p]));
  // His lantern paths on Home Island; elsewhere the island's own steps (LTF-46).
  const pathAt = new Map<string, { strand: 'functional' | 'narrative' | 'philosophical'; i: number }>();
  if (home) (Object.keys(PATHS) as (keyof typeof PATHS)[]).forEach((strand) => PATHS[strand].forEach(([r, c], i) => pathAt.set(`${r},${c}`, { strand, i })));
  const stoneAt = new Map(lay.stones.map((k, i) => [k, i]));
  const next = state ? state.done.indexOf(false) : -1;
  const strandColor = { functional: '#f2b04a', narrative: '#58b38a', philosophical: '#a68be0' };
  const sorted = [...islandTiles(island)].sort((a, b) => a.r + a.c - (b.r + b.c) || a.c - b.c);

  const tile = (tl: Tile) => {
    const [ox, oy] = pr([tl.c, tl.r, 0]);
    const key = `${tl.r},${tl.c}`;
    const top = island.top[tl.region][(tl.r + tl.c) % 2];
    const z = tl.z, base = -0.6;
    const L = <Poly p={[[0, 1, z], [1, 1, z], [1, 1, base], [0, 1, base]]} fill={shade(island.side[tl.region], -0.05)} />;
    const R = <Poly p={[[1, 0, z], [1, 1, z], [1, 1, base], [1, 0, base]]} fill={shade(island.side[tl.region], -0.25)} />;
    const topPts: P3[] = [[0, 0, z], [1, 0, z], [1, 1, z], [0, 1, z]];
    const p = byTile.get(key);
    const piece = p && pieceById.get(p.piece);
    const lm = home ? LANDMARKS.find((l) => l.r === tl.r && l.c === tl.c) : undefined;
    const isle = look.get(key);
    const path = pathAt.get(key);
    const stone = stoneAt.get(key);
    const canPlace = spots?.has(key);
    const [zx, zy] = pr([0, 0, z]);
    return <g key={key} transform={`translate(${ox} ${oy})`}>
      {L}{R}
      <polygon className="top" points={pts(topPts)} fill={top} stroke={shade(top, -0.06)} strokeWidth="0.6" />
      <g transform={`translate(${zx} ${zy + z * ZH})`}>
        <g transform={`translate(0 ${-z * ZH})`}>
          {path && <PathStone strand={path.strand} lit={lit[path.strand][path.i]} here={here[path.strand] === path.i} color={strandColor[path.strand]} n={path.i + 1} night={t.night} />}
          {stone !== undefined && <PathStone strand="quest" lit={!!state?.done[stone]} here={next === stone} color="#d9714e" n={stone + 1} night={t.night} lantern={false} />}
          {lm && <Landmark kind={lm.kind} night={t.night} peaksOpen={peaksOpen} />}
          {isle && <g><title>{isle.title}</title>{isle.draw}</g>}
          {!lm && !isle && !path && stone === undefined && !piece && ((home ? tl.region === 'peaks' && tl.r + tl.c <= 4 : lay.high.has(key)) || deco.has(key)) && <Relief kind={island.relief} seed={noise(tl.r, tl.c)} />}
          {piece && <g className={fresh === p!.id ? 'newpiece moves' : undefined}><title>{piece.name}</title>{piece.draw(t.night)}</g>}
        </g>
      </g>
      {canPlace && <g className="tile-btn" role="button" tabIndex={0} aria-label={`Put it here: ${tl.region === 'beach' ? 'the beach' : island.names[tl.region]}, spot ${tl.r + 1}-${tl.c + 1}`}
        onClick={() => placing!.onPlace(tl.c, tl.r)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); placing!.onPlace(tl.c, tl.r); } }}>
        <polygon className="tile-spot top" points={pts(topPts)} />
      </g>}
    </g>;
  };

  return <div className="island-wrap" style={{ ['--sky' as string]: `linear-gradient(${t.sky}, ${t.sea2} 28%, ${t.sea})` }}>
    <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMid meet" role={placing ? 'group' : 'img'} aria-label={`${home ? 'Your island' : island.name}. ${island.names.town}, ${island.names.forest} and ${island.names.peaks}.${places.some((p) => !p.open) ? ` Still closed: ${places.filter((p) => !p.open).map((p) => p.name).join(', ')}.` : ''}`}>
      <Defs />
      {t.night && Array.from({ length: 40 }, (_, i) => <circle key={i} cx={VB.x + noise(i, 3) * VB.w} cy={VB.y + noise(i, 7) * 90} r={noise(i, 11) * 1.4 + 0.4} fill="#fff" opacity={0.4 + noise(i, 5) * 0.5} />)}
      {Array.from({ length: 14 }, (_, i) => <path key={i} className="wave moves" style={{ animationDelay: `${-i * 0.7}s` }} d={`M${VB.x + noise(i, 1) * VB.w} ${VB.y + 40 + noise(i, 2) * (VB.h - 40)} q10 -4 20 0 t20 0`} stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" fill="none" />)}
      <ellipse cx="0" cy="175" rx="290" ry="135" fill="#ffffff" opacity="0.14" />
      <Horizon stage={stage} night={t.night} />
      {sorted.map(tile)}
      {places.filter((p) => !p.open).map((p) => { const [r, c] = p.at.split(',').map(Number); const [x, y] = pr([c + 0.5, r + 0.5, 0.6]); return <g key={p.name} pointerEvents="none">
        <ellipse className="mist moves" cx={x} cy={y} rx="40" ry="19" fill="#fff" opacity="0.72" /><text x={x} y={y + 6} textAnchor="middle" fontSize="17">🔒</text></g>; })}
      {home && !peaksOpen && <g className="mist moves" opacity="0.55" pointerEvents="none">
        <ellipse cx="-20" cy="20" rx="150" ry="40" fill="#fff" /><ellipse cx="40" cy="-10" rx="110" ry="30" fill="#fff" /><ellipse cx="-70" cy="-15" rx="80" ry="24" fill="#fff" />
      </g>}
      {!t.night && [0, 1].map((i) => <g key={i} className="cloud moves" style={{ animationDelay: `${-i * 45}s` }} opacity="0.75"><ellipse cx={-420} cy={-80 + i * 60} rx="46" ry="14" fill="#fff" /><ellipse cx={-400} cy={-90 + i * 60} rx="30" ry="14" fill="#fff" /></g>)}
    </svg>
    {home ? <>
      <span className="island-label" style={labelAt(8, 2, 0.6)}>Harbor Town</span>
      <span className="island-label" style={labelAt(2, 8, 0.6)}>Story Woods</span>
      <span className="island-label" style={labelAt(0, 1, 4.6)}>Lantern Peaks{peaksOpen ? '' : ' · coming up'}</span>
    </> : (['town', 'forest', 'peaks'] as const).map((g) => { const at = labelSpot(island, g); return at && <span key={g} className="island-label" style={labelAt(at.r, at.c, at.z + (g === 'peaks' ? 1.4 : 0.5))}>{island.names[g]}</span>; })}
  </div>;
}

function PathStone({ strand, lit, here, color, n, night, lantern = true }: { strand: string; lit: boolean; here: boolean; color: string; n: number; night: boolean; lantern?: boolean }) {
  const [x, y] = pr([0.5, 0.5, 0]);
  return <g aria-label={`${strand} step ${n}${lit ? ', done' : ''}`}>
    <ellipse cx={x} cy={y} rx="20" ry="10" fill={lit ? color : '#d8d2c4'} stroke={shade(lit ? color : '#d8d2c4', -0.3)} strokeWidth="1.5" />
    <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill={lit ? '#fff' : '#7a7466'}>{n}</text>
    {lit && lantern && cyl(0.78, 0.25, 0.025, 0, 1, '#5a5a66')}
    {lit && lantern && (() => { const [lx, ly] = pr([0.78, 0.25, 1.1]); return <><circle cx={lx} cy={ly} r={night ? 20 : 12} fill="url(#glow)" /><rect x={lx - 5} y={ly - 7} width="10" height="12" rx="3" fill="#ffe08a" stroke="#4a4a52" /></>; })()}
    {here && (() => { const [fx, fy] = pr([0.3, 0.6, 0]); return <g><line x1={fx} y1={fy} x2={fx} y2={fy - 40} stroke="#3a3a44" strokeWidth="2.5" /><path className="flame moves" d={`M${fx} ${fy - 40} l20 6 l-20 7 z`} fill={color} stroke={shade(color, -0.3)} /></g>; })()}
  </g>;
}

/** Clues about the journey, out at sea and in the sky. */
function Horizon({ stage, night }: { stage: number; night: boolean }) {
  return <g aria-hidden="true">
    <g opacity={night ? 0.6 : 0.85}>
      <ellipse cx="215" cy="-58" rx="34" ry="8" fill="#8fb3a0" />
      <path d="M196 -60 Q206 -76 218 -66 Q226 -74 234 -60 Z" fill="#9a968f" />
      <path d="M204 -76 l4 -2 l4 2 M222 -80 l3 -2 l3 2" stroke="#fff" strokeWidth="1.2" fill="none" />
      {stage >= 1 && <><line x1="226" y1="-70" x2="226" y2="-86" stroke="#4a4a52" strokeWidth="1.5" /><path d="M226 -86 l10 3 l-10 3 z" fill="#f2b04a" /></>}
    </g>
    {stage >= 1 && <g transform="translate(222 282)"><g className="bob moves">
      <path d="M-20 0 L20 0 L14 9 L-14 9 Z" fill="#f5f5f0" /><path d="M-18 3 L18 3" stroke="#3f88c5" strokeWidth="2" />
      <rect x="-8" y="-9" width="14" height="9" rx="2" fill="#f5f5f0" /><rect x="-5" y="-7" width="4" height="3" fill="#3f88c5" />
    </g></g>}
    {stage >= 2 && <g className="sway moves">
      <path d="M130 70 Q140 10 158 -38" stroke="#555" strokeWidth="0.8" fill="none" />
      <path d="M158 -52 l10 12 l-10 14 l-10 -14 z" fill="#4fa3d1" stroke="#2f6f99" />
      <path d="M158 -26 q-6 6 0 10 q6 5 0 10" stroke="#e4572e" strokeWidth="1.5" fill="none" />
    </g>}
    {stage >= 4 && <g className="flyby moves"><Plane x={-150} y={-78} s={0.42} rot={-4} /></g>}
  </g>;
}

function Mountain({ seed }: { seed: number }) {
  const h = 1.1 + seed * 1.1;
  const [x, y] = pr([0.5, 0.5, 0]);
  const [, ay] = pr([0.5, 0.5, h]);
  const [, sy] = pr([0.5, 0.5, h * 0.62]);
  const k = (sy - ay) / (y - ay);
  return <g>
    <path d={`M${x - 30} ${y} L${x} ${ay} L${x} ${y + 8} Z`} fill="#b7b1cc" />
    <path d={`M${x + 30} ${y} L${x} ${ay} L${x} ${y + 8} Z`} fill="#9690ae" />
    <path d={`M${x - 30 * k} ${sy} L${x} ${ay} L${x + 30 * k} ${sy} L${x} ${sy + 4} Z`} fill="#f4f2fa" />
  </g>;
}

function Landmark({ kind, night, peaksOpen }: { kind: string; night: boolean; peaksOpen: boolean }) {
  if (kind === 'lighthouse') {
    const [x, y] = pr([0.5, 0.5, 2.55]);
    return <g><title>Lighthouse</title>{cyl(0.5, 0.5, 0.26, 0, 0.6, '#f5f5f0')}{cyl(0.5, 0.5, 0.23, 0.6, 0.6, '#d64545')}{cyl(0.5, 0.5, 0.2, 1.2, 0.6, '#f5f5f0')}{cyl(0.5, 0.5, 0.17, 1.8, 0.5, '#d64545')}{cyl(0.5, 0.5, 0.14, 2.3, 0.35, '#ffe08a')}{cone(0.5, 0.5, 0.18, 2.65, 0.35, '#3a3a44')}{night && <circle cx={x} cy={y} r="34" fill="url(#glow)" />}</g>;
  }
  if (kind === 'bigoak') return <g><title>The old oak of Story Woods</title>{cyl(0.5, 0.5, 0.12, 0, 0.9, '#6b4630')}{ball(0.35, 0.6, 0.9, 0.5, '#4f9440')}{ball(0.68, 0.38, 1, 0.46, '#5ea64c')}{ball(0.5, 0.5, 1.5, 0.45, '#6fb85a')}</g>;
  if (kind === 'bakery') return <g><title>Rose's Bakery</title>{PIECES[1].draw(night)}</g>;
  const [x, y] = pr([0.5, 0.5, 1.2]);
  return <g opacity={peaksOpen ? 1 : 0.7}><title>The observatory</title>{cyl(0.5, 0.5, 0.34, 0, 0.8, '#e6e2f0')}<path d={`M${x - 22} ${y} A22 22 0 0 1 ${x + 22} ${y} Z`} fill={peaksOpen ? '#b9a6e8' : '#c9c5d6'} /><rect x={x - 3} y={y - 20} width="6" height="14" fill="#5a5a72" transform={`rotate(25 ${x} ${y})`} /></g>;
}
