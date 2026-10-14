import { describe, expect, it } from 'vitest';
import { AREA_AT, areaOpen, drawLook, freeTiles, ISLANDS, islandOf, islandTiles, PATHS, TILES } from './art';
import { DEFAULTS } from './db';
import { islandArrival, islandAreas, islandsReached, journeyNow } from './journey';

const none = { functional: Array(6).fill(false), narrative: Array(6).fill(false), philosophical: Array(6).fill(false) };
const isles = Object.values(ISLANDS).filter((d) => d.id !== 'home');

describe('islands at each stop (LTF-36)', () => {
  it('every island has three quest areas and one that waits for a lantern, all drawn', () => {
    for (const d of isles) {
      expect(d.areas.map((a) => (a.quest ? 'quest' : a.gate ? 'gate' : '?'))).toEqual(['quest', 'quest', 'quest', 'gate']);
      for (const look of [d.arrival ?? 'pier', ...d.areas.map((a) => a.look)]) expect(drawLook(look, false), `${d.id}: ${look}`).toBeTruthy();
    }
  });
  it('keeps his lantern paths, the areas and the landing on every island, with its own coast', () => {
    for (const d of isles) {
      const here = new Set(islandTiles(d).map((t) => `${t.r},${t.c}`));
      for (const [r, c] of [...Object.values(PATHS).flat(), ...AREA_AT, [10, 6]]) expect(here.has(`${r},${c}`), `${d.id} ${r},${c}`).toBe(true);
      expect(here.size).toBeLessThan(TILES.length);
    }
    expect(new Set(isles.map((d) => islandTiles(d).length)).size).toBeGreaterThan(3); // the coasts differ
  });
  it('opens quest areas one session at a time, all of them once he sails on, and the last with its lantern', () => {
    const [a0, a1, , gate] = ISLANDS.gull.areas;
    expect(areaOpen(a0, 0, { sessions: 0, left: false, lit: none })).toBe(false);
    expect(areaOpen(a0, 0, { sessions: 1, left: false, lit: none })).toBe(true);
    expect(areaOpen(a1, 1, { sessions: 1, left: false, lit: none })).toBe(false);
    expect(areaOpen(a1, 1, { sessions: 0, left: true, lit: none })).toBe(true);
    expect(areaOpen(gate, 3, { sessions: 9, left: true, lit: none })).toBe(false);
    expect(areaOpen(gate, 3, { sessions: 0, left: false, lit: { ...none, functional: [true, true, false, false, false, false] } })).toBe(true);
  });
  it('a closed area has no build spots until it opens', () => {
    const d = ISLANDS.fossil;
    const spot = (open: boolean[]) => new Set(freeTiles([], true, false, d, open).map((t) => `${t.r},${t.c}`));
    expect(spot([false, false, false, false]).has('6,4')).toBe(false); // next to the dig
    expect(spot([true, false, false, false]).has('6,4')).toBe(true);
    expect(spot([true, true, true, true]).has('6,5')).toBe(false); // the dig itself is its landmark
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
    expect(islandAreas('gull', journeyNow(7, t), t, none).open).toEqual([true, true, false, false]);
    // On to Star Point: Gull Island's quest areas are all open now, and Star Point starts its own.
    const there = journeyNow(10, t);
    expect(islandsReached(there)).toEqual(['home', 'gull', 'star']);
    expect(islandAreas('gull', there, t, none).open).toEqual([true, true, true, false]);
    expect(islandAreas('star', there, t, none).open).toEqual([false, false, false, false]);
  });
});
