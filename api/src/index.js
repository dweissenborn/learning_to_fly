// HTTP API for the family cloud copy, run by Static Web Apps as managed Azure Functions.
// staticwebapp.config.json already limits /api/* to the "family" role; each handler checks it again.
import { app } from '@azure/functions';
import { CosmosClient } from '@azure/cosmos';
import { HttpError, who, learners, createLearner, deleteLearner, deleteModule, sync } from './store.js';
import Anthropic from '@anthropic-ai/sdk';
import { picture } from './picture.js';

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
  drop: (learner, ids) => batch(learner, ids.map((id) => ({ operationType: 'Delete', id }))), // LTF-39: one module's documents
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
route('module', ['DELETE'], 'learners/{id}/modules/{module}', (req) => deleteModule(repo, req.params.id, req.params.module)); // LTF-39

// LTF-51: a picture he asks for, drawn by Claude Sonnet 5.5 as SVG. The key is an app setting (ANTHROPIC_API_KEY) and
// never reaches the browser. Thinking stays off and effort low, so a drawing comes back within the API's time limit.
// No refusal fallback on purpose: when Claude declines a child's request, he is asked for another idea instead.
const PICTURE_SYSTEM = `You draw pictures for a children's reading game. A child types what to draw. Reply with one SVG picture and nothing else.

The picture:
- One <svg> element with viewBox="0 0 400 300" and a full background.
- Simple, friendly flat shapes: bold colours, rounded forms, a clear main subject in the middle, like a picture-book sticker. About 60 shapes at most.
- No words or letters in the picture, unless the child asks for a word.
- Only basic shapes, paths, groups and gradients. No scripts, event attributes, links, images, fonts, or anything loaded from outside.

What to draw:
- Draw what the child asked for, kindly and cheerfully.
- If the request is scary, violent, rude, about a real person, or not right for a young child, draw a gentle, friendly version of the idea instead (a smiling dragon rather than a fighting one), or a cheerful scene if there is no gentle version.
- Never add names, personal details, or anything the child did not ask for.`;
let anthropic;
async function draw(ask) {
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'pictures are not set up');
  anthropic ??= new Anthropic({ timeout: 40_000, maxRetries: 0 });
  const r = await anthropic.messages.create({
    model: 'claude-sonnet-5-5',
    max_tokens: 8000,
    thinking: { type: 'between_tools' },
    output_config: { effort: 'low' },
    system: PICTURE_SYSTEM,
    messages: [{ role: 'user', content: ask }],
  });
  if (r.stop_reason === 'refusal') return { refused: true };
  return { text: r.content.filter((b) => b.type === 'text').map((b) => b.text).join('') };
}
route('picture', ['POST'], 'picture', async (req) => picture(repo, await req.json(), draw));
