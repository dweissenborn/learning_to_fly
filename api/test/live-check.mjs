// Live check of the Cosmos DB adapter: creates a throwaway learner, syncs both ways, deletes it.
// Run from api/ with the connection string in the environment (never commit it):
//   COSMOS_CONNECTION="$(az cosmosdb keys list ... --type connection-strings --query "connectionStrings[0].connectionString" -o tsv)" node test/live-check.mjs
import assert from 'node:assert/strict';
import { repo } from '../src/index.js';
import { createLearner, deleteLearner, learners, sync } from '../src/store.js';

const id = `check-${Date.now()}`;
try {
  await createLearner(repo, { id, name: 'Live check' });
  assert.ok((await learners(repo)).some((l) => l.id === id), 'new learner is listed');
  const events = Array.from({ length: 150 }, (_, i) => ({ id: `ev${i}`, ts: i, type: 'answer' })); // more than one batch of 100
  const up = await sync(repo, { learner: id, since: 0, events, notes: [{ id: 'n1', text: 'hi' }], settings: { name: 'Live check 2', onboarded: true } });
  assert.equal(up.events.length, 150);
  assert.equal(up.settings.onboarded, true);
  assert.ok(up.since > 0, 'server timestamps come back');
  await new Promise((r) => setTimeout(r, 1100)); // Cosmos _ts is whole seconds
  await sync(repo, { learner: id, since: up.since, gone: ['n1'] });
  const later = await sync(repo, { learner: id, since: up.since + 1 });
  assert.deepEqual(later.gone, ['n1']);
  assert.equal(later.events.length, 0, 'an incremental pull does not resend old events');
  assert.equal((await learners(repo)).find((l) => l.id === id)?.name, 'Live check 2', 'the profile follows the nickname');
  console.log('live check passed');
} finally {
  await deleteLearner(repo, id);
  assert.ok(!(await learners(repo)).some((l) => l.id === id), 'deleted learner is gone');
}
