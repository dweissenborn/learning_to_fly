import { describe, expect, it } from 'vitest';
import { DEFAULTS } from './db';
import { pieceById } from './art';
import { arcStart, forkMigration, islandsReached, JOURNEY, journeyNow, repace } from './journey';

describe('forkMigration (LTF-20)', () => {
  it('leaves a learner before the fork to choose there, and checks each fork once', () => {
    const fix = forkMigration(DEFAULTS, 3)!;
    expect(fix).toEqual({ routes: {}, forksSeen: ['gull', 'takeoff'] });
    expect(forkMigration({ ...DEFAULTS, ...fix }, 3)).toBeNull();
  });
  it('keeps a learner already on the way to Windy Cape on that route', () => {
    expect(forkMigration(DEFAULTS, 6)).toEqual({ routes: { gull: { to: 'cape', at: 0 } }, forksSeen: ['gull', 'takeoff'] });
  });
  it('offers the fork to a learner who has just reached Gull Island, with his interests first', () => {
    expect(forkMigration(DEFAULTS, 5)!.routes).toEqual({});
    const now = journeyNow(5, { ...DEFAULTS, interests: ['space'] });
    expect(now.fork?.options.map((o) => o.id)).toEqual(['star', 'fossil', 'reef']);
    expect(now.next).toBeUndefined();
  });
  it('a chosen route starts at its first beat and gives the airfield the route-neutral text', () => {
    const s = { ...DEFAULTS, routes: { gull: { to: 'rail', at: 1 } }, forksSeen: ['gull'], journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } };
    expect(journeyNow(5, s).next?.id).toBe('rail');
    const air = journeyNow(11, s);
    expect(air.here.id).toBe('rail');
    expect(air.beat?.text).toMatch(/Captain Ada's boat/);
  });
  it("the Cloud Hill letter comes from the host of the island he sailed from, and Windy Cape keeps Bus 9 (LTF-28)", () => {
    const from = (to: string) => journeyNow(11, { ...DEFAULTS, routes: { gull: { to, at: 1 } }, forksSeen: ['gull'], journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } }).beat?.text;
    expect(from('rail')).toMatch(/^A letter came from Mr\. Haddad\./);
    expect(from('fossil')).toMatch(/nautilus/);
    expect(from('star')).toMatch(/Dr\. Amal/);
    expect(from('reef')).toMatch(/^A letter came from Mari\./);
    expect(from('cape')).toBe('Bus 9 goes from Windy Cape to Cloud Hill. It leaves at 10 AM.');
  });
});

describe('the flight-path fork at Take-off (LTF-25)', () => {
  // Star Point's route: Home Island, Gull Island, Star Point, Cloud Hill, Take-off, Australia. At five sessions a leg,
  // Take-off is reached after 20 sessions.
  const base = { ...DEFAULTS, routes: { gull: { to: 'star', at: 1 } }, forksSeen: ['gull', 'takeoff'], journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 } };
  it('waits at Take-off with two flight paths', () => {
    const now = journeyNow(20, base);
    expect(now.here.id).toBe('takeoff');
    expect(now.fork?.kind).toBe('path');
    expect(now.fork?.options.map((o) => o.id)).toEqual(['island', 'reef']);
    expect(journeyNow(24, base).fork?.id).toBe('takeoff'); // sessions meanwhile do not move him
  });
  it('the reef way has its own story, and both ways land after the same number of sessions', () => {
    const reef = { ...base, routes: { ...base.routes, takeoff: { to: 'reef', at: 1 } }, journeyAnchor: { at: 20, stop: 4, step: 0, after: 0 } };
    const island = { ...reef, routes: { ...base.routes, takeoff: { to: 'island', at: 1 } } };
    expect(journeyNow(20, reef).beat?.text).toMatch(/reef way/);
    expect(journeyNow(22, reef).beat?.text).toMatch(/Shell Island/);
    expect(journeyNow(20, island).beat?.text).toBe(JOURNEY.stops.find((s) => s.id === 'australia')!.beats[0].text);
    expect(journeyNow(25, reef).arrived && journeyNow(25, island).arrived).toBe(true);
    expect(journeyNow(24, reef).arrived || journeyNow(24, island).arrived).toBe(false);
  });
  it("after the reef way's setback, the next beat tells how his plan worked on the reef way", () => {
    const reef = { ...base, routes: { ...base.routes, takeoff: { to: 'reef', at: 1 } }, journeyAnchor: { at: 20, stop: 4, step: 0, after: 0 }, journeyChoices: { australia: 1 } };
    const plan = JOURNEY.stops.find((s) => s.id === 'australia')!.paths!.find((p) => p.id === 'reef')!.beats![2].choice!.options[1];
    expect(journeyNow(23, reef).beat?.text).toBe(plan.after);
  });
  it('anyone already flying when the paths arrive keeps the island way', () => {
    const flying = { ...base, forksSeen: ['gull'] };
    expect(forkMigration(flying, 22)?.routes?.takeoff?.to).toBe('island');
    expect(forkMigration(flying, 20)?.routes?.takeoff).toBeUndefined();
  });
});

describe('the koala keeper arc at Bluegum (LTF-30)', () => {
  // Star Point's route lands in Australia after 25 sessions at five a leg; then one koala a session, eight in all.
  const s = { ...DEFAULTS, routes: { gull: { to: 'star', at: 1 }, takeoff: { to: 'island', at: 1 } }, forksSeen: ['gull', 'takeoff'], journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 }, arcSeen: true };
  it('the eighth koala comes first, then the arc starts at its first beat', () => {
    expect(journeyNow(32, s).koala?.name).toBe('Sunny');
    expect(journeyNow(32, s).arc).toBeUndefined();
    const n = journeyNow(33, s);
    expect(n.koala).toBeUndefined();
    expect(n.next?.id).toBe('nursery');
    expect(n.beat?.text).toMatch(/^Ranger Tess asks for your help this week\./);
    expect(n.here.id).toBe('australia'); // still at Bluegum, for the island and the check-ups
  });
  it('reaches each arc stop after a leg, and stays a junior keeper after Opening Day', () => {
    expect(journeyNow(38, s).arc?.here.id).toBe('nursery');
    expect(journeyNow(38, s).next?.id).toBe('keeper');
    expect(journeyNow(33 + 24, s).arc?.done).toBe(false);
    expect(journeyNow(33 + 25, s).arc?.done).toBe(true);
    expect(journeyNow(33 + 40, s).arc?.here.id).toBe('opening');
    expect(journeyNow(33 + 40, s).beat).toBeUndefined();
  });
  it('a learner who met every koala before the arc existed starts it at its first beat', () => {
    const old = { ...s, arcSeen: undefined };
    const fix = arcStart(old, 45)!; // twenty sessions after landing
    expect(fix).toEqual({ arcSeen: true, arcAnchor: { at: 12, stop: 0, step: 0, after: 0 } });
    expect(journeyNow(45, { ...old, ...fix }).beat?.text).toMatch(/^Ranger Tess asks/);
    expect(arcStart({ ...DEFAULTS }, 3)).toEqual({ arcSeen: true }); // nothing to move for anyone else
  });
  it('a new pace never replays a setback he has already got past', () => {
    const before = journeyNow(3, DEFAULTS); // five-session legs, three in: the storm has passed
    expect(before.beat?.obstacle).toBeUndefined();
    const t = { ...DEFAULTS, ...repace(DEFAULTS, 3, 7) };
    expect(journeyNow(3, t).beat?.text).toBe(before.beat?.text);
    for (const n of [4, 5]) expect(journeyNow(n, t).beat?.obstacle).toBeUndefined();
  });
  it('a new pace mid-arc keeps his place, on the arc and on the way there', () => {
    const before = journeyNow(40, s).arc!; // seven sessions into the arc: Tree Nursery reached, two into the next leg
    const t = { ...s, ...repace(s, 40, 7) };
    const after = journeyNow(40, t).arc!;
    expect([after.stop, after.step]).toEqual([before.stop, before.step]);
    expect(journeyNow(41, t).arc!.step).toBe(before.step + 1);
    expect(journeyNow(40, t).outward).toEqual(journeyNow(40, s).outward);
  });
  it('every arc stop has its souvenir piece', () => {
    for (const st of JOURNEY.arc!.stops) expect(pieceById.get(st.souvenir!), st.id).toBeTruthy();
  });
});

describe('the way home (LTF-27)', () => {
  // Star Point's route; the arc ends after 58 sessions at five a leg.
  const s = { ...DEFAULTS, routes: { gull: { to: 'star', at: 1 }, takeoff: { to: 'island', at: 1 } }, forksSeen: ['gull', 'takeoff'], journeyAnchor: { at: 5, stop: 1, step: 0, after: 0 }, arcSeen: true };
  it('after Opening Day the way home is offered, and nothing moves until he chooses it', () => {
    const n = journeyNow(60, s);
    expect(n.arc?.done).toBe(true);
    expect(n.trip).toBeUndefined();
    expect(n.next).toBeUndefined();
  });
  it('flying home reaches Cloud Hill, then offers only the islands he has not seen, best match first', () => {
    const t = { ...s, interests: ['dinosaurs' as const], homeTrip: { at: 60 } };
    expect(journeyNow(60, t).next?.id).toBe('back-cloud');
    const at = journeyNow(65, t);
    expect(at.here.id).toBe('airfield');
    expect(at.fork?.kind).toBe('home');
    expect(at.fork?.options.map((o) => o.id)).toEqual(['fossil', 'reef', 'rail']);
    expect(journeyNow(69, t).fork?.kind).toBe('home'); // sessions meanwhile do not move him
  });
  it('then the island he picked, Gull Island and home, each after a leg; the new island is his island while there', () => {
    const t = { ...s, homeTrip: { at: 60, island: 'reef', anchor: { at: 5, stop: 1, step: 0, after: 0 } } };
    expect(journeyNow(65, t).next?.id).toBe('back-reef');
    const r = journeyNow(70, t);
    expect(r.here.id).toBe('reef');
    expect(islandsReached(r)).toContain('reef');
    expect(journeyNow(75, t).here.id).toBe('gull');
    expect(journeyNow(79, t).trip?.done).toBe(false);
    expect(journeyNow(80, t).trip?.done).toBe(true);
  });
  it('a new pace on the way home keeps his place', () => {
    const t = { ...s, homeTrip: { at: 60, island: 'reef', anchor: { at: 5, stop: 1, step: 0, after: 0 } } };
    const before = journeyNow(67, t).trip!;
    const u = { ...t, ...repace(t, 67, 7) };
    expect([journeyNow(67, u).trip!.stop, journeyNow(67, u).trip!.step]).toEqual([before.stop, before.step]);
  });
});
