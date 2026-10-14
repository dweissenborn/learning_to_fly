// LTF-20: checks on content/journey.json routes. Every stop is reachable, every route ends at the last stop
// (Australia), and every route has the same number of stops, so Australia comes after the same number of sessions.

/** LTF-30: the koala keeper arc is one line of stops after Australia, each leading to the next, with five beats each. */
export function arcProblems(arc) {
  const out = [];
  const stops = arc?.stops ?? [];
  stops.forEach((s, i) => {
    const want = stops[i + 1]?.id;
    if (want && (s.next?.length !== 1 || s.next[0] !== want)) out.push(`arc: ${s.id} should lead to ${want}`);
    if (!want && s.next?.length) out.push(`arc: ${s.id} is the last stop and leads nowhere`);
    if (s.beats?.length !== 5) out.push(`arc: ${s.id} has ${s.beats?.length ?? 0} beats, not 5`);
  });
  return out;
}

/** LTF-27: the way home: Cloud Hill, a stop for each themed island (he visits one he skipped), Gull Island and home. */
export function homeProblems(home, stops) {
  const out = [];
  if (!home) return out;
  const ids = new Set(stops.map((s) => s.id));
  const places = new Set(home.stops.map((s) => s.place));
  for (const s of home.stops) {
    if (!ids.has(s.place)) out.push(`home: ${s.id} visits "${s.place}", which is not a stop`);
    if (s.beats?.length !== 5) out.push(`home: ${s.id} has ${s.beats?.length ?? 0} beats, not 5`);
  }
  for (const p of ['airfield', 'fossil', 'reef', 'star', 'rail', 'gull', 'home']) if (!places.has(p)) out.push(`home: no way-home stop for ${p}`);
  return out;
}

/** Problems with the journey's routes. `topics` lists the allowed interest topics. */
export function routeProblems(stops, topics = []) {
  const out = [];
  const byId = new Map(stops.map((s) => [s.id, s]));
  const last = stops.at(-1)?.id;
  for (const s of stops) {
    for (const n of s.next ?? []) if (!byId.has(n)) out.push(`${s.id}: next stop "${n}" does not exist`);
    for (const t of s.topics ?? []) if (topics.length && !topics.includes(t)) out.push(`${s.id}: unknown topic "${t}"`);
    if (!s.next?.length && s.id !== last) out.push(`${s.id}: a route ends here, before ${last}`);
    // LTF-25: a stop reached by flight paths. One path keeps the stop's own beats for learners already on the way.
    if (s.paths) {
      if (s.paths.filter((p) => p.legacy).length !== 1) out.push(`${s.id}: paths need exactly one kept for learners already on the way (legacy)`);
      for (const p of s.paths) if (p.beats && p.beats.length !== s.beats.length) out.push(`${s.id}: path "${p.id}" has ${p.beats.length} beats, not ${s.beats.length}`);
    }
  }
  if (out.length) return out;
  const lengths = new Set();
  const seen = new Set();
  const walk = (id, path) => {
    if (path.includes(id)) { out.push(`routes loop at ${id}`); return; }
    seen.add(id);
    const next = byId.get(id).next ?? [];
    if (!next.length) lengths.add(path.length + 1);
    for (const n of next) walk(n, [...path, id]);
  };
  walk(stops[0].id, []);
  for (const s of stops) if (!seen.has(s.id)) out.push(`${s.id}: no route reaches it`);
  if (lengths.size > 1) out.push(`routes have different numbers of stops (${[...lengths].sort().join(', ')}), so Australia would come at different times`);
  return out;
}
