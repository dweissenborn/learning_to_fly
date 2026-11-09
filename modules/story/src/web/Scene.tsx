// LTF-65: one drawn hilltop for the whole book. Each page says what is true in it (the sky, the dome, who is where), so
// the picture always matches the words. It is decoration: the page's text says everything the picture shows.
import { useId } from 'react';
import { Koala } from '@wayfinder/web/host';
import { pickOf, type Picks, type SceneSpec } from '../book';

const SKY = {
  day: { top: '#8ec5ee', low: '#dff1fb', far: '#a9d6a0', ground: '#7fbf72', wall: '#f4f0e6', dome: '#dfe5ec', wood: '#9a6b43', ink: '#3b4658', leaf: '#4f9a55' },
  dusk: { top: '#454a8c', low: '#f3a970', far: '#5f8f6c', ground: '#4c8259', wall: '#ddd2cb', dome: '#c6c8d8', wood: '#7e5637', ink: '#2b3044', leaf: '#3c7848' },
  night: { top: '#0e1836', low: '#2a3a72', far: '#1f4a40', ground: '#1b4034', wall: '#8f97ad', dome: '#a9b2c8', wood: '#6b5038', ink: '#0c1226', leaf: '#2b6144' },
} as const;
const STARS = [[28, 34], [66, 82], [118, 22], [178, 58], [216, 18], [268, 136], [312, 150], [352, 132], [420, 30], [470, 62], [508, 24], [540, 96], [600, 120], [622, 30], [36, 128], [476, 140]];
const MAST = 440, RIG = 494, POST = 506, STUMP = 531, POLE = 580, GROUND = 222;
/** Where the koala is: walking in on the grass, just below the cups on the mast, or on the bar of his own pole. */
const KOALA = { walk: [372, 211], mast: [MAST, 112], pole: [POLE, 93] } as const;

/** Three wind cups on a cross arm. Spinning ones turn (if motion is on) and always carry drawn motion lines. */
function Cups({ x, y, r, arm, fill, rim, spin }: { x: number; y: number; r: number; arm: string; fill: string; rim?: string; spin?: boolean }) {
  const w = r * 3.4;
  return <g transform={`translate(${x} ${y})`}>
    {spin && <path d={`M${-w - 8} ${-r - 5} Q0 ${-r - 17} ${w + 8} ${-r - 5} M${-w - 8} ${r + 5} Q0 ${r + 17} ${w + 8} ${r + 5}`} stroke="#fff" strokeOpacity="0.85" strokeWidth="2" strokeDasharray="7 6" strokeLinecap="round" fill="none" />}
    <g className={spin ? 'moves story-spin' : undefined}>
      <path d={`M${-w} 0 H${w}`} stroke={arm} strokeWidth="2.5" />
      {[-w, w, 0].map((cx) => <circle key={cx} cx={cx} r={r} fill={fill} stroke={rim} strokeWidth={rim ? 1.5 : 0} />)}
    </g>
  </g>;
}

/** A close look at one thing the page talks about, in a panel above the hill. */
function Inset({ kind, tool, blur }: { kind: NonNullable<SceneSpec['inset']>; tool: string; blur: string }) {
  const screen = (bg: string, a: string, b: string) => <><rect width="180" height="110" rx="12" fill={bg} />
    <text x="90" y="50" textAnchor="middle" fontSize="17" fontWeight="800" fill="#fff">{a}</text><text x="90" y="78" textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">{b}</text></>;
  const body = {
    saturn: () => <><rect width="180" height="110" rx="12" fill="#1c2238" /><circle cx="90" cy="55" r="49" fill="#04060d" />
      <g transform="rotate(-16 90 55)"><ellipse cx="90" cy="55" rx="36" ry="9" fill="none" stroke="#c9a85c" strokeWidth="4" /><circle cx="90" cy="55" r="15" fill="#e6bd62" /><path d="M54 55 a36 9 0 0 0 72 0" fill="none" stroke="#f0d389" strokeWidth="4" /></g></>,
    strong: () => screen('#c0352b', 'WIND: STRONG', 'DOME CLOSING'),
    calm: () => screen('#1f7a4d', 'WIND: CALM', 'DOME OPEN'),
    log: () => <><rect width="180" height="110" rx="12" fill="#f4f6fa" /><text x="16" y="26" fontSize="13" fontWeight="800" fill="#5b6672">WIND LOG</text>
      {['Sunday 9:07 PM', 'Monday 9:01 PM', 'Tuesday 9:04 PM'].map((row, i) => <g key={row}><circle cx="20" cy={46 + i * 22} r="5" fill="#c0352b" /><text x="32" y={51 + i * 22} fontSize="15" fontWeight="700" fill="#1f2d3d">{row}</text></g>)}</>,
    print: () => <><rect width="180" height="110" rx="12" fill="#b9946c" /><g fill="#5e4129">
      <ellipse cx="98" cy="72" rx="24" ry="19" /><ellipse cx="88" cy="38" rx="6.5" ry="10" /><ellipse cx="104" cy="35" rx="6.5" ry="10" /><ellipse cx="120" cy="42" rx="6.5" ry="10" transform="rotate(18 120 42)" />
      <ellipse cx="62" cy="52" rx="6.5" ry="11" transform="rotate(-62 62 52)" /><ellipse cx="60" cy="74" rx="6.5" ry="11" transform="rotate(-88 60 74)" /></g></>,
    catch: () => tool === 'camera'
      ? <><rect width="180" height="110" rx="12" fill="#77808d" /><rect x="84" width="12" height="110" fill="#5a4a3c" />
        <g filter={`url(#${blur})`} fill="#c3c7cd"><circle cx="90" cy="64" r="24" /><circle cx="72" cy="44" r="10" /><circle cx="108" cy="44" r="10" /></g>
        <text x="170" y="100" textAnchor="end" fontSize="12" fontWeight="700" fill="#fff">9:02 PM</text></>
      : <><rect width="180" height="110" rx="12" fill="#10182c" /><g fill="none" stroke="#7ff3e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 55 l4 -14 4 26 4 -22 4 18 4 -24 4 28 4 -16 4 12 4 -8" /><path d="M62 55 q9 -30 18 0 t18 0 t18 0 t18 0 t18 0 t18 0" /></g>
        <text x="170" y="100" textAnchor="end" fontSize="12" fontWeight="700" fill="#fff">9:02 PM</text></>,
    cups: () => <><rect width="180" height="110" rx="12" fill="#f4f0e6" />
      {[16, 44, 72, 100].map((x) => <path key={x} d={`M${x} 14 h20 l-3 24 h-14z`} fill="#fff" stroke="#c0352b" strokeWidth="1.5" />)}
      <path d="M16 58 H124" stroke="#3b82c4" strokeWidth="4" strokeLinecap="round" /><path d="M16 72 H124" stroke="#d9534f" strokeWidth="4" strokeLinecap="round" />
      <path d="M20 94 h84 l10 4 l-10 4 h-84z" fill="#f1c84b" /><rect x="12" y="94" width="10" height="8" rx="2" fill="#e58aa0" />
      <path d="M140 22 V56" stroke="#7a8696" strokeWidth="2" /><circle cx="140" cy="20" r="4" fill="#c0352b" /></>,
  }[kind];
  return <g transform="translate(214 10)">{body()}<rect width="180" height="110" rx="12" fill="none" stroke="#fff" strokeWidth="3" /></g>;
}

export function Scene({ spec, picks }: { spec: SceneSpec; picks: Picks }) {
  const id = useId().replace(/\W/g, '');
  const c = SKY[spec.sky], night = spec.sky === 'night', lit = spec.sky !== 'day' && !spec.dark;
  const tool = spec.tool ? pickOf(picks, 'tool') : null, band = spec.band ? pickOf(picks, 'band') : null, stall = spec.stall ? pickOf(picks, 'night') : null;
  const at = spec.koala ? KOALA[spec.koala] : null;
  const [tx, ty] = at ?? KOALA.walk; // where the dim red light points
  const fogFill = !night ? '#fff' : spec.dark ? '#2b3349' : '#cfd6e4';
  const tree = (x: number) => <g key={x}><path d={`M${x} ${GROUND} V150`} stroke={c.wood} strokeWidth="7" /><g fill={c.leaf}><ellipse cx={x} cy="138" rx="34" ry="22" /><ellipse cx={x - 22} cy="156" rx="22" ry="14" /><ellipse cx={x + 22} cy="158" rx="22" ry="14" /></g></g>;
  return <svg className="story-scene" viewBox="0 0 640 300" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.top} /><stop offset="1" stopColor={c.low} /></linearGradient>
      <filter id={`${id}b`}><feGaussianBlur stdDeviation="3.5" /></filter>
      <filter id={`${id}f`} x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="14" /></filter>
    </defs>
    <rect width="640" height={GROUND} fill={`url(#${id})`} />
    {night && !spec.fog && !spec.cloud && STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.2 : 1.9} fill="#fff" opacity="0.85" />)}
    {spec.sky === 'day' && <circle cx="585" cy="48" r="22" fill="#ffe08a" />}
    {spec.sky === 'dusk' && <circle cx="590" cy="204" r="26" fill="#ffd27a" />}
    {spec.moon && <g><circle cx="585" cy="48" r="19" fill="#f4f1de" /><circle cx="579" cy="43" r="4" fill="#dcd8c2" /><circle cx="592" cy="55" r="3" fill="#dcd8c2" /></g>}
    {spec.meteors && <g className="moves story-meteor" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><path d="M500 34 l-46 22" /><path d="M606 84 l-38 18" /><path d="M96 44 l-40 19" /></g>}
    {spec.cloud && <g fill={night ? '#4c556e' : '#c9d2de'}>
      {[[80, 50, 110, 34], [250, 36, 130, 30], [420, 58, 120, 36], [580, 40, 110, 32], [330, 88, 150, 26], [130, 98, 120, 24], [540, 100, 120, 26]].map(([x, y, rx, ry]) => <ellipse key={x} cx={x} cy={y} rx={rx} ry={ry} />)}
    </g>}
    <path d={`M0 ${GROUND} V204 Q90 186 190 202 T400 196 T640 198 V${GROUND}Z`} fill={c.far} />
    {[38, 640].map(tree)}
    <rect y={GROUND} width="640" height="78" fill={c.ground} />
    <path d="M141 222 H159 Q172 258 236 300 H168 Q138 260 141 222Z" fill={c.wall} opacity="0.3" />

    {/* the dome, its roof open or shut, and the deck */}
    <rect x="95" y="160" width="110" height="62" fill={c.wall} />
    <rect x="140" y="188" width="20" height="34" rx="2" fill={c.ink} opacity="0.55" />
    {[108, 174].map((x) => <rect key={x} x={x} y="176" width="18" height="16" rx="2" fill={spec.sky === 'day' ? '#bcd7ea' : '#ffd97a'} />)}
    {!spec.shut && <path d="M150 142 L165 97" stroke="#f4f0e6" strokeWidth="9" strokeLinecap="round" />}
    <path d="M92 160 A58 58 0 0 1 208 160 Z" fill={c.dome} />
    {spec.shut ? <path d="M150 103 V156" stroke={c.ink} strokeOpacity="0.4" strokeWidth="2" />
      : <><path d="M142 107 Q150 100 158 107 V158 H142Z" fill="#070b18" /><path d="M150 146 L161 112" stroke="#f4f0e6" strokeWidth="8" strokeLinecap="round" /></>}
    <rect x="90" y="156" width="120" height="7" rx="3" fill={c.ink} opacity="0.35" />
    <path d="M208 184 H300 M212 184 V202 M256 184 V202 M298 184 V202" stroke={c.wood} strokeWidth="3" fill="none" />
    <rect x="205" y="202" width="97" height="6" fill={c.wood} />
    <path d={`M210 208 V${GROUND} M254 208 V${GROUND} M298 208 V${GROUND}`} stroke={c.wood} strokeWidth="4" />
    {stall === 'talk' && <g><rect x="238" y="160" width="36" height="26" rx="3" fill="#f4f6fa" stroke={c.ink} strokeWidth="1.5" /><path d="M244 168 h24 M244 174 h24 M244 180 h16" stroke="#c0352b" strokeWidth="2" /></g>}

    {/* the path lights: on at dusk and at night until 9 PM */}
    {[320, 360, 400].map((x) => <g key={x}><rect x={x - 1.5} y="204" width="3" height="18" fill={c.ink} />
      {lit && <circle cx={x} cy="202" r="14" fill="#ffd97a" opacity="0.28" />}<circle cx={x} cy="202" r="4.5" fill={lit ? '#ffe9a8' : night ? '#48506a' : '#e8e8e8'} /></g>)}

    {/* the fence, the stump of the old gum tree, and (later) his own pole and the young tree */}
    <path d={`M${POST} 198 H640 M${POST} 210 H640`} stroke={c.wood} strokeWidth="3" opacity="0.8" />
    {[POST, 556, 606].map((x) => <rect key={x} x={x - 3} y="188" width="6" height="34" fill={c.wood} />)}
    <rect x={STUMP - 14} y="208" width="28" height="16" fill={c.wood} /><ellipse cx={STUMP} cy="208" rx="14" ry="4.5" fill="#d9b98a" /><ellipse cx={STUMP} cy="208" rx="7" ry="2.2" fill="none" stroke={c.wood} />
    {spec.pole && <g>
      <path d={`M622 ${GROUND} V186`} stroke={c.wood} strokeWidth="3" /><g fill={c.leaf}><ellipse cx="622" cy="180" rx="11" ry="8" /><ellipse cx="614" cy="190" rx="7" ry="5" /><ellipse cx="630" cy="191" rx="7" ry="5" /></g>
      <rect x={POLE - 5} y="112" width="10" height="112" fill={c.wood} /><path d={`M${POLE - 3} 130 v14 M${POLE + 2} 160 v16 M${POLE - 2} 190 v12`} stroke={c.ink} strokeOpacity="0.35" />
      <rect x={POLE - 18} y="110" width="36" height="6" rx="2" fill={c.wood} />
      <rect x={POLE - 13} y="176" width="26" height="14" rx="2" fill="#f4f0e6" stroke={c.ink} strokeWidth="1" /><path d={`M${POLE - 8} 181 h16 M${POLE - 8} 185 h10`} stroke={c.ink} strokeWidth="1.2" />
    </g>}

    {/* the weather mast: a wooden pole, three cups, and the wire to the dome */}
    <path d={`M${MAST} 126 Q330 192 205 172`} stroke={c.ink} strokeOpacity="0.6" strokeWidth="1.5" fill="none" />
    <rect x={MAST - 3} y="84" width="6" height="140" fill={c.wood} />
    {band && <g><rect x={MAST - 7} y="150" width="14" height="46" rx="3" fill={band === 'blue' ? '#3b82c4' : '#d5dbe3'} stroke={band === 'blue' ? '#2a659c' : '#8f98a4'} /><path d={`M${MAST - 3} 154 v38`} stroke="#fff" strokeOpacity="0.7" strokeWidth="2" /></g>}
    <Cups x={MAST} y={80} r={6.5} arm={c.ink} fill="#f08a4b" spin={spec.spin} />
    <circle cx={MAST} cy="80" r="3.5" fill={c.ink} />
    {spec.rig && <g><path d={`M${RIG} ${GROUND} V84`} stroke="#c9a66b" strokeWidth="3" /><Cups x={RIG} y={80} r={5} arm="#f1c84b" fill="#fff" rim="#c0352b" /></g>}
    {tool === 'camera' && <g><rect x={POST - 9} y="172" width="18" height="16" rx="3" fill="#4f8a5a" stroke={c.ink} /><circle cx={POST - 2} cy="180" r="4" fill="#10182c" /></g>}
    {tool === 'recorder' && <g><rect x={POST - 7} y="168" width="14" height="20" rx="4" fill="#9aa1aa" stroke={c.ink} /><circle cx={POST} cy="183" r="2.5" fill="#c0352b" /></g>}
    {stall === 'build' && <g><rect x="236" y="234" width="84" height="5" fill={c.wood} /><path d="M242 239 V256 M314 239 V256" stroke={c.wood} strokeWidth="4" />
      {[246, 262, 278, 294].map((x) => <path key={x} d={`M${x} 222 h12 l-2 12 h-8z`} fill="#fff" stroke="#c0352b" />)}</g>}

    {spec.torch && <g fill="#ff5a4d"><path d={`M296 190 L${tx} ${ty - 22} L${tx} ${ty + 24}Z`} opacity="0.16" /><ellipse cx={tx} cy={ty + 4} rx="34" ry="30" opacity="0.2" /><circle cx="296" cy="190" r="4" /></g>}
    {at && (spec.shadow
      ? <g transform={`translate(${at[0]} ${at[1]}) scale(0.5)`} fill="#05080f" stroke="#5a6690" strokeWidth="2"><ellipse cy="16" rx="20" ry="22" /><circle cx="-17" cy="-20" r="11" /><circle cx="17" cy="-20" r="11" /><circle cy="-8" r="18" /></g>
      : <Koala x={at[0]} y={at[1]} s={0.5} sleepy={spec.sleepy} />)}
    {spec.crowd && ([[60, '#c8553d'], [190, '#3d7dc8'], [338, '#d9a441'], [470, '#7a5cc0'], [590, '#3fa37a']] as const).map(([x, col]) => <g key={x} transform={`translate(${x} 270)`}>
      <ellipse rx="46" ry="12" fill={col} /><g fill={c.ink}><circle cx="-14" cy="-22" r="8" /><path d="M-27 -2 q13 -26 26 0z" /><circle cx="13" cy="-16" r="6" /><path d="M3 -1 q10 -19 20 0z" /></g></g>)}

    {spec.fog && <g fill={fogFill}><rect width="640" height="300" opacity="0.62" />
      <g className="moves story-fog" filter={`url(#${id}f)`}><ellipse cx="160" cy="120" rx="230" ry="46" opacity="0.5" /><ellipse cx="480" cy="180" rx="250" ry="52" opacity="0.55" /><ellipse cx="300" cy="252" rx="320" ry="40" opacity="0.5" /></g></g>}
    {spec.fog && tool && <circle cx={POST} cy="166" r="2.5" fill="#7dff9c" />}
    {spec.inset && <Inset kind={spec.inset} tool={pickOf(picks, 'tool')} blur={`${id}b`} />}
  </svg>;
}
