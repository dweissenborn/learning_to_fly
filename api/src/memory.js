// An in-memory stand-in for the Cosmos DB repository, used by the API tests and the end-to-end tests.
// _ts mimics Cosmos: whole server seconds, stamped on every write.
export function memoryRepo(clock = () => Math.floor(Date.now() / 1000)) {
  const parts = new Map(); // learner -> Map(id -> doc)
  const part = (l) => parts.get(l) ?? parts.set(l, new Map()).get(l);
  return {
    profiles: async () => [...parts.values()].map((p) => p.get('profile')).filter(Boolean),
    get: async (learner, id) => part(learner).get(id) ?? null,
    put: async (learner, docs) => { for (const d of docs) part(learner).set(d.id, { ...structuredClone(d), _ts: clock() }); },
    changes: async (learner, since) => [...part(learner).values()].filter((d) => d._ts >= since),
    remove: async (learner) => { parts.delete(learner); },
  };
}
