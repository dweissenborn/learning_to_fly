import { describe, expect, it } from 'vitest';
import { createLearner, deleteLearner, learners, sync, who } from '../src/store.js';
import { memoryRepo } from '../src/memory.js';

const header = (roles) => Buffer.from(JSON.stringify({ userId: 'u1', userDetails: 'a@example.com', userRoles: roles })).toString('base64');

describe('family cloud copy', () => {
  it('only lets the family role in', () => {
    expect(who(header(['anonymous', 'authenticated', 'family']))?.userDetails).toBe('a@example.com');
    expect(who(header(['anonymous', 'authenticated']))).toBeNull();
    expect(who(undefined)).toBeNull();
    expect(who('not base64 json')).toBeNull();
  });

  it('creates a learner once, syncs both ways, carries deletions, and pulls only what changed', async () => {
    let now = 1000;
    const repo = memoryRepo(() => now);
    await createLearner(repo, { id: 'kid-1', name: 'Ace' });
    expect(await createLearner(repo, { id: 'kid-1', name: 'Other' })).toMatchObject({ name: 'Ace' }); // reusing, not overwriting
    expect(await learners(repo)).toEqual([{ id: 'kid-1', name: 'Ace', created: expect.any(Number) }]);

    // Device A pushes an event, a note and settings.
    const a = await sync(repo, { learner: 'kid-1', since: 0, events: [{ id: 'e1', ts: 1 }], notes: [{ id: 'n1', text: 'hi' }], settings: { name: 'Ace', onboarded: true } });
    expect(a).toMatchObject({ events: [{ id: 'e1' }], notes: [{ id: 'n1' }], settings: { onboarded: true }, since: 1000 });

    // Device B starts from nothing and gets everything.
    expect(await sync(repo, { learner: 'kid-1', since: 0 })).toMatchObject({ events: [{ id: 'e1' }], notes: [{ id: 'n1' }], gone: [] });

    // Later, A deletes the note and renames; B pulls only the changes.
    now = 1005;
    await sync(repo, { learner: 'kid-1', since: a.since, gone: ['n1'], settings: { name: 'Ace R', onboarded: true } });
    const b = await sync(repo, { learner: 'kid-1', since: 1001 });
    expect(b).toMatchObject({ events: [], notes: [], gone: ['n1'], since: 1005 });
    expect(await learners(repo)).toMatchObject([{ name: 'Ace R' }]);

    // Deleting the learner removes everything; a device still linked to it is told.
    await deleteLearner(repo, 'kid-1');
    expect(await learners(repo)).toEqual([]);
    await expect(sync(repo, { learner: 'kid-1', since: 0 })).rejects.toMatchObject({ status: 404 });
  });

  it('rejects bad input', async () => {
    const repo = memoryRepo();
    await expect(createLearner(repo, { id: '../x', name: 'A' })).rejects.toMatchObject({ status: 400 });
    await expect(createLearner(repo, { id: 'ok', name: '  ' })).rejects.toMatchObject({ status: 400 });
    await createLearner(repo, { id: 'ok', name: 'A' });
    await expect(sync(repo, { learner: 'ok', events: [{ id: 'a/b' }] })).rejects.toMatchObject({ status: 400 });
    await expect(sync(repo, { learner: 'ok', events: 'nope' })).rejects.toMatchObject({ status: 400 });
    await expect(sync(repo, { learner: 'ok', gone: Array(2001).fill('x') })).rejects.toMatchObject({ status: 400 });
  });
});
