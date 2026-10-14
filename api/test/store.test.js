import { describe, expect, it } from 'vitest';
import { createLearner, deleteLearner, deleteModule, learners, sync, who } from '../src/store.js';
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

  it("keeps each module's settings apart, and deletes one module's memory without touching another's (LTF-39)", async () => {
    let now = 2000;
    const repo = memoryRepo(() => now);
    await createLearner(repo, { id: 'kid-2', name: 'Bo' });
    await sync(repo, { learner: 'kid-2', since: 0, settings: { name: 'Bo' }, modules: { math: { ramp: 'choices' } },
      events: [{ id: 'r1', ts: 1 }, { id: 'm1', ts: 2, module: 'math' }], notes: [{ id: 'nr', text: 'r' }, { id: 'nm', text: 'm', module: 'math' }] });
    const other = await sync(repo, { learner: 'kid-2', since: 0 });
    expect(other.modules).toEqual({ math: { ramp: 'choices' } });
    expect(other.settings).toEqual({ name: 'Bo' });
    now = 2010;
    expect(await deleteModule(repo, 'kid-2', 'math')).toEqual({ deleted: 'math', documents: 3 });
    const after = await sync(repo, { learner: 'kid-2', since: 0 });
    expect(after.events.map((e) => e.id)).toEqual(['r1']);
    expect(after.notes.map((n) => n.id)).toEqual(['nr']);
    expect(after.modules).toEqual({});
    expect(after.settings).toEqual({ name: 'Bo' });
    await expect(deleteModule(repo, 'kid-2', 'reading')).rejects.toMatchObject({ status: 400 }); // reading's memory is the learner's own
    await expect(sync(repo, { learner: 'kid-2', modules: { 'no/pe': {} } })).rejects.toMatchObject({ status: 400 });
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
