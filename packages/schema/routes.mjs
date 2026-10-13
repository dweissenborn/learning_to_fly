// LTF-20: checks on content/journey.json routes. Every stop is reachable, every route ends at the last stop
// (Australia), and every route has the same number of stops, so Australia comes after the same number of sessions.

/** Problems with the journey's routes. `topics` lists the allowed interest topics. */
export function routeProblems(stops, topics = []) {
  const out = [];
  const byId = new Map(stops.map((s) => [s.id, s]));
  const last = stops.at(-1)?.id;
  for (const s of stops) {
    for (const n of s.next ?? []) if (!byId.has(n)) out.push(`${s.id}: next stop "${n}" does not exist`);
    for (const t of s.topics ?? []) if (topics.length && !topics.includes(t)) out.push(`${s.id}: unknown topic "${t}"`);
    if (!s.next?.length && s.id !== last) out.push(`${s.id}: a route ends here, before ${last}`);
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
