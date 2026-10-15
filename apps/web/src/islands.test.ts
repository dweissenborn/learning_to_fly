import { describe, expect, it } from 'vitest';
import { drawLook, freeTiles, ISLANDS, islandOf, islandTiles, layoutOf, pieceById, placesOf, questState, settle, TILES } from './art';
import { DEFAULTS } from './db';
import { islandArrival, islandView, islandsReached, journeyNow } from './journey';

const none = { functional: Array(6).fill(false), narrative: Array(6).fill(false), philosophical: Array(6).fill(false) };
const isles = Object.values(ISLANDS).filter((d) => d.id !== 'home');
const nothing = new Set<string>();
const key = (t: { r: number; c: number }) => `${t.r},${t.c}`;

describe('islands at each stop (LTF-36)', () => {
  it('every island has a quest, a place that waits for a lantern, and drawings for all of them', () => {
    for (const d of isles) {
      expect(d.later, d.id).toBeTruthy();
      for (const look of [d.arrival ?? 'pier', ...placesOf(d).map((p) => p.look)]) expect(drawLook(look, false), `${d.id}: ${look}`).toBeTruthy();
    }
  });
  it('the take-off is still Cloud Hill', () => {
    expect(islandOf('takeoff')).toBe('airfield');
    expect(islandOf('nowhere')).toBe('home');
  });
  it('counts sessions on an island from when he first came ashore', () => {
    const s = { ...DEFAULTS, interests: ['space' as const], routes: { gull: { to: 'star', at: 1 } }, forksSeen: ['gull'], journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } };
    expect(islandsReached(journeyNow(5, s))).toEqual(['home', 'gull']);
    const ashore = islandArrival(s, 5)!;
    expect(ashore).toEqual({ islandsSeen: { gull: 5 } });
    const t = { ...s, ...ashore };
    expect(islandArrival(t, 6)).toBeNull();
    expect(islandView('gull', journeyNow(7, t), t, none, nothing).state.done).toEqual([true, true, false, false]);
    // On to Star Point: Gull Island's quest is all done now, and Star Point starts its own.
    const there = journeyNow(10, t);
    expect(islandsReached(there)).toEqual(['home', 'gull', 'star']);
    expect(islandView('gull', there, t, none, nothing).state.done.every(Boolean)).toBe(true);
    expect(islandView('star', there, t, none, nothing).state.done.some(Boolean)).toBe(false);
  });
});

describe('each island its own place (LTF-45 to LTF-48)', () => {
  it('has its own land: inside the view, a different shape on every island, with high tops', () => {
    for (const d of isles) {
      expect(d.land, d.id).toHaveLength(11);
      for (const row of d.land) expect(row, d.id).toHaveLength(11);
      for (const t of islandTiles(d)) expect((((t.c - t.r) / 6.6) ** 2 + ((t.r + t.c - 10) / 7.6) ** 2), `${d.id} ${key(t)}`).toBeLessThan(1.45);
      expect(layoutOf(d).high.size, d.id).toBeGreaterThan(0);
      expect(islandTiles(d).length, d.id).toBeGreaterThan(30);
    }
    const shapes = isles.map((d) => islandTiles(d).map(key).sort().join(' '));
    expect(new Set(shapes).size).toBe(isles.length);
    expect(shapes).not.toContain(TILES.map(key).sort().join(' '));
  });
  it('marks its landing, a stone for every step, and every place, all on land and apart', () => {
    for (const d of isles) {
      const lay = layoutOf(d);
      const land = new Set(islandTiles(d).map(key));
      expect(lay.landing, d.id).toBeTruthy();
      expect(lay.stones.filter(Boolean), d.id).toHaveLength(d.steps.length);
      d.steps.forEach((s, i) => expect(lay.places.has(i), `${d.id} step ${i + 1}`).toBe(!!s.place));
      expect(lay.places.has('later'), d.id).toBe(true);
      const marks = [lay.landing!, ...lay.stones, ...lay.places.values()];
      for (const m of marks) expect(land.has(m), `${d.id} ${m}`).toBe(true);
      expect(new Set(marks).size, d.id).toBe(marks.length);
      expect(lay.places.size, d.id).toBe(d.steps.filter((s) => s.place).length + 1); // no stray letters
    }
  });
  it('names its three parts for itself (LTF-45)', () => {
    const core = ['Harbor Town', 'Story Woods', 'Lantern Peaks'];
    expect(Object.values(ISLANDS.home.names)).toEqual(core);
    const all = isles.flatMap((d) => Object.values(d.names));
    expect(all).toHaveLength(isles.length * 3);
    expect(new Set(all).size).toBe(all.length);
    for (const n of all) expect(core).not.toContain(n);
  });
  it('quests differ in length and kind, and fit one stay on the island (LTF-46)', () => {
    const lengths = new Set(isles.map((d) => d.steps.length));
    expect([...lengths].every((n) => n >= 3 && n <= 5)).toBe(true);
    expect(lengths.size).toBeGreaterThan(2);
    expect(isles.some((d) => d.steps.some((s) => (s.sessions ?? 1) > 1))).toBe(true);
    expect(isles.filter((d) => d.steps.some((s) => s.build)).length).toBeGreaterThan(3);
    for (const d of isles) {
      expect(d.steps.reduce((n, s) => n + (s.build ? 0 : s.sessions ?? 1), 0), d.id).toBeLessThanOrEqual(5);
      for (const s of d.steps) if ((s.sessions ?? 1) > 1) expect(s.then, `${d.id}: ${s.text}`).toBeTruthy();
    }
  });
  it('a thing to build is from the island, offered there, and can stand there', () => {
    for (const d of isles) for (const s of d.steps.filter((x) => x.build)) {
      const p = pieceById.get(s.build!);
      expect(p, s.build).toBeTruthy();
      expect(d.pieces, d.id).toContain(s.build);
      expect(p!.region, s.build).not.toBe('philosophical'); // never waits for Lantern Peaks
      if (p!.stop) expect(islandOf(p!.stop), s.build).toBe(d.id);
      expect(freeTiles([], false, p!.beach, d, questState(d, { sessions: 0, left: false, built: nothing, lit: none })).length, s.build).toBeGreaterThan(0);
      expect(s.place, `${d.id}: a build step opens no place`).toBeUndefined();
    }
  });
  it('steps take sessions in order, a build step its thing, all once he sails on; the last place its lantern', () => {
    const d = ISLANDS.fossil; // the dig takes two sessions
    const at = (sessions: number, left = false, lit = none) => questState(d, { sessions, left, built: nothing, lit });
    expect(d.steps.map((s) => (s.build ? 'build' : s.sessions ?? 1))).toEqual([2, 1, 1, 1]);
    expect(at(0).done).toEqual([false, false, false, false]);
    expect(at(1)).toMatchObject({ done: [false, false, false, false], count: [1, 0, 0, 0] });
    expect(at(2).done).toEqual([true, false, false, false]);
    expect(at(3)).toMatchObject({ done: [true, true, false, false], count: [2, 1, 0, 0] });
    expect(at(9).done).toEqual([true, true, true, true]);
    expect(at(0, true).done).toEqual([true, true, true, true]);
    expect(at(9, true).later).toBe(false);
    expect(at(0, false, { ...none, narrative: [true, true, true, false, false, false] }).later).toBe(true);
    const g = ISLANDS.gull; // the sailboat is built, whenever he picks it
    const gull = (sessions: number, built: string[]) => questState(g, { sessions, left: false, built: new Set(built), lit: none }).done;
    expect(g.steps.map((s) => (s.build ? 'build' : s.sessions ?? 1))).toEqual([1, 1, 1, 'build']);
    expect(gull(0, ['boat'])).toEqual([false, false, false, true]);
    expect(gull(9, ['seal'])).toEqual([true, true, true, false]);
  });
  it('a closed place has no build spots until its step is done', () => {
    const d = ISLANDS.gull, lay = layoutOf(d);
    const [r, c] = lay.places.get(0)!.split(',').map(Number);
    const around = islandTiles(d).filter((t) => Math.abs(t.r - r) <= 1 && Math.abs(t.c - c) <= 1 && key(t) !== `${r},${c}`).map(key);
    const spots = (sessions: number) => new Set(freeTiles([], true, false, d, questState(d, { sessions, left: false, built: nothing, lit: none })).map(key));
    expect(around.some((k) => spots(1).has(k))).toBe(true);
    expect(around.some((k) => spots(0).has(k))).toBe(false);
    expect(spots(9).has(`${r},${c}`)).toBe(false); // the place itself is its landmark
  });
  it('things he built before an island had its own shape stay where they can, and otherwise move to the nearest free spot', () => {
    const d = ISLANDS.reef, lay = layoutOf(d);
    const free = freeTiles([], true, false, d, questState(d, { sessions: 9, left: true, built: nothing, lit: none }));
    const ok = free[0];
    const stone = lay.stones[0].split(',').map(Number);
    const p = (x: number, y: number, id: string) => ({ piece: 'house', x, y, id, ts: 0, island: 'reef' });
    const out = settle([p(ok.c, ok.r, 'a'), p(5, 5, 'sea'), p(stone[1], stone[0], 'stone'), p(ok.c, ok.r, 'twin')], d);
    expect(out[0]).toMatchObject({ x: ok.c, y: ok.r });
    const spots = out.map((q) => `${q.y},${q.x}`);
    expect(new Set(spots).size).toBe(4);
    const land = new Set(islandTiles(d).map(key));
    for (const s of spots) expect(land.has(s), s).toBe(true);
    expect(spots).not.toContain(lay.stones[0]);
    // A moved thing keeps to its kind of ground: a house inland, a sailboat on the beach.
    const ground = new Map(islandTiles(d).map((t) => [key(t), t.region]));
    expect(ground.get(spots[1])).not.toBe('beach');
    const boat = settle([{ ...p(5, 5, 'boat'), piece: 'boat' }], d)[0];
    expect(ground.get(`${boat.y},${boat.x}`)).toBe('beach');
    expect(settle([p(5, 5, 'home')], ISLANDS.home)[0]).toMatchObject({ x: 5, y: 5 }); // Home Island never moves anything
  });
  it('a keepsake for every island, each its own (LTF-47)', () => {
    const k = isles.map((d) => d.keepsake?.name);
    expect(k.every(Boolean)).toBe(true);
    expect(new Set(k).size).toBe(isles.length);
  });
});
