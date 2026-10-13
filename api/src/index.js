// HTTP API for the family cloud copy, run by Static Web Apps as managed Azure Functions.
// staticwebapp.config.json already limits /api/* to the "family" role; each handler checks it again.
import { app } from '@azure/functions';
import { CosmosClient } from '@azure/cosmos';
import { HttpError, who, learners, createLearner, deleteLearner, sync } from './store.js';

let container;
const c = () => (container ??= new CosmosClient(process.env.COSMOS_CONNECTION).database('learning-to-fly').container('data'));
const all = async (query, partitionKey) => (await c().items.query(query, partitionKey ? { partitionKey } : {}).fetchAll()).resources;

async function batch(learner, ops) {
  for (let i = 0; i < ops.length; i += 100) { // a transactional batch holds at most 100 operations, all in one partition
    const res = await c().items.batch(ops.slice(i, i + 100), learner);
    const failed = res.result?.find((r) => r.statusCode >= 400);
    if (failed) throw new Error(`Cosmos batch failed with ${failed.statusCode}`);
  }
}

export const repo = {
  profiles: () => all("SELECT c.learner, c.name, c.created FROM c WHERE c.kind = 'profile'"),
  get: async (learner, id) => (await c().item(id, learner).read()).resource ?? null,
  put: (learner, docs) => batch(learner, docs.map((d) => ({ operationType: 'Upsert', resourceBody: d }))),
  changes: (learner, since) => all({ query: 'SELECT * FROM c WHERE c._ts >= @since', parameters: [{ name: '@since', value: since }] }, learner),
  remove: async (learner) => batch(learner, (await all('SELECT c.id FROM c', learner)).map(({ id }) => ({ operationType: 'Delete', id }))),
};

function route(name, methods, path, fn) {
  app.http(name, {
    methods, route: path, authLevel: 'anonymous',
    handler: async (req, ctx) => {
      if (!who(req.headers.get('x-ms-client-principal'))) return { status: 403, jsonBody: { error: 'not invited' } };
      try {
        return { jsonBody: await fn(req) };
      } catch (e) {
        if (e instanceof HttpError) return { status: e.status, jsonBody: { error: e.message } };
        if (e instanceof SyntaxError) return { status: 400, jsonBody: { error: 'bad JSON' } };
        ctx.error(e);
        return { status: 500, jsonBody: { error: 'server error' } };
      }
    },
  });
}

route('learners', ['GET', 'POST'], 'learners', async (req) => (req.method === 'GET' ? learners(repo) : createLearner(repo, await req.json())));
route('learner', ['DELETE'], 'learners/{id}', (req) => deleteLearner(repo, req.params.id));
route('sync', ['POST'], 'sync', async (req) => sync(repo, await req.json()));
