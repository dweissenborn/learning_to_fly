// The chapter book, end to end (LTF-65): off until a grown-up turns it on, a chapter read and answered, a choice that
// changes the words, and a chapter that finishes like any session.
import { test, expect, type Page } from '@playwright/test';
import { axe, onboard, quiet, setSettings } from '../../../e2e/helpers';

test.beforeEach(quiet);

const NEXT = /^Next( →)?$/;
const picker = (page: Page) => page.getByRole('region', { name: 'What would you like to do?' });
const paths = (page: Page) => page.getByRole('region', { name: 'Your paths' });

/** What the app has saved for the story, straight from IndexedDB: his answers (oldest first) and the story's own memory. */
const saved = (page: Page) => page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = await new Promise<{ type: string; module?: string; ts: number; action?: string; item: string; correct: boolean; hint: number; tries: number; points?: number; shown?: boolean; rapid?: boolean }[]>((res) => { const q = db.transaction('events').objectStore('events').getAll(); q.onsuccess = () => res(q.result); });
  const own = await new Promise<{ value?: { chapter?: number; picks?: Record<string, string>; place?: { chapter: number; stage: string; step: number; guessed?: boolean } | null } } | undefined>((res) => { const g = db.transaction('kv').objectStore('kv').get('settings:story'); g.onsuccess = () => res(g.result); });
  db.close();
  return {
    answers: all.filter((e) => e.type === 'answer' && e.module === 'story').sort((a, b) => a.ts - b.ts).map(({ item, correct, hint, tries, points, shown, rapid }) => ({ item, correct, hint, tries, points, shown, rapid })),
    sessions: all.filter((e) => e.type === 'session' && e.module === 'story').sort((a, b) => a.ts - b.ts).map((e) => e.action),
    own: own?.value,
  };
});

test('story: a grown-up turns it on, he reads a chapter, a miss opens the lines to read again, and the chapter moves the journey (LTF-65)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await expect(picker(page).getByRole('button', { name: /Story/ })).toHaveCount(0); // off until a grown-up turns it on
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Story: a chapter book with choices').click();
  await page.getByRole('button', { name: /Back to/ }).first().click();
  await expect(paths(page)).toContainText('Next: Chapter 1: A Calm Night');
  await picker(page).getByRole('button', { name: /Story/ }).click();
  await expect(page.getByRole('heading', { name: 'A Calm Night' })).toBeVisible();
  await expect(page.getByText('Chapter 1 of 8')).toBeVisible();
  await axe(page, 'story cover');
  await page.getByRole('button', { name: 'Start chapter 1' }).click();
  await expect(page.getByText('You and Rook walk up Bellbird Hill.')).toBeVisible(); // his own guide is in the story
  await expect(page.locator('svg.story-scene')).toBeVisible();
  await axe(page, 'story page');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText('Chapter 1 · page 2 of 3')).toBeVisible();
  await page.getByRole('button', { name: /Back$/ }).click(); // he can turn back a page
  await expect(page.getByText('Chapter 1 · page 1 of 3')).toBeVisible();
  for (let k = 0; k < 3; k++) await page.getByRole('button', { name: NEXT }).click();
  // A key detail: a miss opens the lines that hold it, for one more try.
  await expect(page.getByRole('heading', { name: 'Which detail shows that something strange is going on?' })).toBeVisible();
  const answers = page.getByRole('group', { name: 'Answers' });
  await answers.getByRole('button', { name: 'Tilly waved from the deck.' }).click();
  await expect(page.locator('.feedback.hint')).toContainText('Read this part again. Try once more.');
  await expect(page.locator('.feedback.hint .sentence.hl')).toHaveText('The air is still.');
  await expect(answers.getByRole('button', { name: 'Tilly waved from the deck.' })).toBeDisabled();
  await axe(page, 'story clue');
  await answers.getByRole('button', { name: 'The air was still when the screen said WIND: STRONG.' }).click();
  await expect(page.getByText('You found it with the clue.')).toBeVisible();
  await page.getByRole('button', { name: NEXT }).click();
  // The main idea, right first time.
  await expect(page.getByRole('heading', { name: 'What was this chapter mostly about?' })).toBeVisible();
  await answers.getByRole('button', { name: 'The dome closed for strong wind, but there was no wind outside.' }).click();
  await expect(page.locator('.feedback.good')).toContainText('Right.');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.locator('.story-clues li.new')).toHaveText('The screen said the wind was strong, but the air was still.');
  await axe(page, 'story notebook');
  await page.getByRole('button', { name: 'Finish chapter 1' }).click();
  // It finishes like any session: something for his island, and the journey moves.
  await expect(page.getByRole('heading', { name: 'Pick one new thing for your island' })).toBeVisible();
  await page.locator('.piece').first().click();
  await page.getByRole('button', { name: 'Choose a spot for me' }).click();
  await expect(page.getByText('What was strange about the dome closing?')).toBeVisible(); // the question for a grown-up to ask
  await page.getByRole('button', { name: /Back to my island/ }).click();
  await expect(page.getByText('4 more sessions to Gull Island.')).toBeVisible();
  await expect(paths(page).getByRole('img', { name: '1 of 8 chapters read' })).toBeVisible();
  await expect(paths(page)).toContainText('Next: Chapter 2: The Weather Mast');
  const s = await saved(page);
  expect(s.own?.chapter).toBe(1);
  expect(s.answers).toEqual([
    { item: 'story-c1-detail', correct: false, hint: 1, tries: 2, points: 2 },
    { item: 'story-c1-main', correct: true, hint: 0, tries: 1, points: 4 },
  ]);
  // The grown-ups' Story tab, read from the log.
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Story', exact: true }).click();
  const row = page.getByRole('row', { name: /A Calm Night/ });
  await expect(row).toContainText('Found with the clue');
  await expect(row).toContainText('Right first time');
  await axe(page, 'story tab');
  // And the whole book for a grown-up to read first.
  await page.getByRole('button', { name: 'Content library' }).click();
  const book = page.getByRole('region', { name: /^Story: / });
  await expect(book.locator('details')).toHaveCount(8);
  await book.getByText('Chapter 3: Fog').click();
  await expect(book).toContainText('(recorder) Dr. Vega gets the recorder from the shed.');
  await axe(page, 'story preview');
});

test('story: a plan falls through, his choice changes the words and is kept, reading a chapter again logs nothing, and a break or a closed app brings him back where he stopped (LTF-65)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put({ key: 'settings:story', value: { enabled: true, chapter: 2 } });
    await new Promise((r) => { tx.oncomplete = r; });
    db.close();
  });
  await page.reload();
  await picker(page).getByRole('button', { name: /Story/ }).click();
  await expect(page.getByRole('heading', { name: 'Fog' })).toBeVisible();
  await expect(page.getByText('Last time:')).toBeVisible();
  await expect(page.locator('.story-clues li')).toHaveCount(2); // one clue from each chapter he has read
  // Reading a finished chapter again: its pages only.
  await page.getByRole('button', { name: '1. A Calm Night' }).click();
  await expect(page.getByText('Chapter 1 · page 1 of 3')).toBeVisible();
  await expect(page.getByRole('button', { name: /I need a break/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close the chapter' }).click();
  await page.getByRole('button', { name: 'Start chapter 3' }).click();
  await expect(page.getByText('Soon you cannot see the mast at all.')).toBeVisible();
  await page.getByRole('button', { name: NEXT }).click();
  // The plan falls through, and he picks what to do next.
  await expect(page.getByText('The plan was to watch the mast. Now fog hides it.')).toBeVisible();
  await expect(page.getByRole('button', { name: NEXT })).toBeDisabled();
  const choice = page.getByRole('group', { name: 'Your choice' });
  await choice.getByRole('button', { name: /A camera/ }).click();
  await choice.getByRole('button', { name: /A recorder/ }).click(); // he can change his mind until he moves on
  await expect(choice.getByRole('button', { name: /A recorder/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(choice.getByRole('button', { name: /A camera/ })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.feedback.good')).toContainText('Sound can travel through fog.');
  await axe(page, 'story choice');
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText('Dr. Vega gets the recorder from the shed.')).toBeVisible();
  await expect(page.getByText(/camera/)).toHaveCount(0);
  await axe(page, 'story page in fog');
  // A break is honoured at once. The lounge says his place is saved and has the way back to it.
  await page.getByRole('button', { name: /I need a break/ }).click();
  await expect(page.getByText('Good idea to take a break. Your place in chapter 3 is saved.', { exact: false })).toBeVisible();
  await axe(page, 'lounge with a chapter waiting');
  expect((await saved(page)).answers).toEqual([]);
  await page.getByRole('button', { name: 'Carry on chapter 3' }).click();
  await expect(page.getByRole('heading', { name: 'Fog' })).toBeVisible(); // the chapter's cover
  await axe(page, 'story cover, carrying on');
  await page.getByRole('button', { name: 'Carry on chapter 3' }).click();
  await expect(page.getByText('Chapter 3 · page 2 of 3')).toBeVisible(); // the page he stopped on, not page 1
  await expect(page.getByText('Dr. Vega gets the recorder from the shed.')).toBeVisible();
  await page.getByRole('button', { name: /Back$/ }).click(); // his choice is kept, and shown as his
  await expect(choice.getByRole('button', { name: /A recorder/ })).toHaveAttribute('aria-pressed', 'true');
  for (let k = 0; k < 2; k++) await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText('Chapter 3 · page 3 of 3')).toBeVisible();
  await expect.poll(async () => (await saved(page)).own?.place).toEqual({ chapter: 2, stage: 'read', step: 3 });
  // The app closes in the middle of the chapter: the same page is there when he opens the story again.
  await page.reload();
  await picker(page).getByRole('button', { name: /Story/ }).click();
  await page.getByRole('button', { name: 'Carry on chapter 3' }).click();
  await expect(page.getByText('Chapter 3 · page 3 of 3')).toBeVisible();
  await page.getByRole('button', { name: NEXT }).click();
  // A break after the first question: he comes back to the second one, and the first is not asked again.
  const answers = page.getByRole('group', { name: 'Answers' });
  await answers.getByRole('button', { name: 'Fog hid the mast, so you could not watch it.' }).click();
  await page.getByRole('button', { name: NEXT }).click();
  await expect(page.getByText('Chapter 3 · question 2 of 2')).toBeVisible();
  await page.getByRole('button', { name: /I need a break/ }).click();
  await page.getByRole('button', { name: 'Back to my island' }).click();
  await picker(page).getByRole('button', { name: /Story/ }).click();
  await page.getByRole('button', { name: 'Carry on chapter 3' }).click();
  await expect(page.getByText('Chapter 3 · question 2 of 2')).toBeVisible();
  await answers.getByRole('button', { name: 'Fog hid the mast, so you set up a recorder to listen for you.' }).click();
  await page.getByRole('button', { name: NEXT }).click();
  await page.getByRole('button', { name: 'Finish chapter 3' }).click();
  await expect(page.getByRole('heading', { name: 'Pick one new thing for your island' })).toBeVisible();
  // Four sittings (two breaks and one closed app), one finished chapter, and each question answered once.
  await expect.poll(async () => (await saved(page)).sessions).toEqual(['start', 'stop', 'start', 'start', 'stop', 'start', 'finish']);
  const s = await saved(page);
  expect(s.own).toMatchObject({ chapter: 3, picks: { tool: 'recorder' }, place: null });
  expect(s.answers).toEqual([
    { item: 'story-c3-detail', correct: true, hint: 0, tries: 1, points: 4 },
    { item: 'story-c3-main', correct: true, hint: 0, tries: 1, points: 4 },
  ]);
});

test('story: answers tapped faster than reading are set aside, two in a row end the chapter kindly once and he comes back to the questions, and an answer he took time over counts (LTF-65)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put({ key: 'settings:story', value: { enabled: true } });
    await new Promise((r) => { tx.oncomplete = r; });
    db.close();
  });
  await setSettings(page, { guessCheck: true }); // the tests turn it off; he has it on
  await page.reload();
  const answers = page.getByRole('group', { name: 'Answers' });
  const Q1 = 'Which detail shows that something strange is going on?';
  const toQuestions = async (n: number, heading: string) => {
    await picker(page).getByRole('button', { name: /Story/ }).click();
    await page.getByRole('button', { name: `Start chapter ${n}` }).click();
    for (let k = 0; k < 3; k++) await page.getByRole('button', { name: NEXT }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  };
  const finish = async (n: number) => {
    await page.getByRole('button', { name: `Finish chapter ${n}` }).click();
    await page.locator('.piece').first().click();
    await page.getByRole('button', { name: 'Choose a spot for me' }).click();
    await page.getByRole('button', { name: /Back to my island/ }).click();
  };
  const fastWrong = async (a: string, b: string) => { for (const o of [a, b]) await answers.getByRole('button', { name: o }).click(); await page.getByRole('button', { name: NEXT }).click(); };
  const guessBoth = async () => {
    await fastWrong('Tilly waved from the deck.', 'Saturn looked like a small gold ball with a ring.');
    await fastWrong('Saturn has a ring around it.', "Tilly's dad built a new telescope.");
  };
  // Both questions, wrong, faster than they can be read: the chapter stops kindly and keeps his place.
  await toQuestions(1, Q1);
  await guessBoth();
  await expect(page.getByText('Good place to stop. Your place in chapter 1 is saved.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my island' }).click();
  await expect(paths(page)).toContainText('Next: Chapter 1: A Calm Night');
  expect((await saved(page)).own?.place).toEqual({ chapter: 0, stage: 'detail', step: 0, guessed: true });
  // He comes back to the questions, not to page 1. A guess was set aside, so both are asked again.
  await picker(page).getByRole('button', { name: /Story/ }).click();
  await page.getByRole('button', { name: 'Carry on chapter 1' }).click();
  await expect(page.getByRole('heading', { name: Q1 })).toBeVisible();
  // Guessing again does not stop the same chapter a second time: the guesses are set aside, and he can finish it.
  await guessBoth();
  await expect(page.locator('.story-clues li.new')).toBeVisible();
  await finish(1);
  // The next chapter, with time to read the first question: that answer counts, and one guess after it is set aside with no stop.
  await toQuestions(2, 'Which detail in the wind log is the big clue?');
  await page.waitForTimeout(3500); // longer than the 2.7 seconds this question takes to read
  await answers.getByRole('button', { name: 'Every gust came just after 9 PM.' }).click();
  await page.getByRole('button', { name: NEXT }).click();
  await fastWrong('Tilly has a tablet.', 'A big storm closed the hill.');
  await expect(page.locator('.story-clues li.new')).toBeVisible();
  const s = await saved(page);
  expect(s.own?.chapter).toBe(1);
  const guess = { correct: false, hint: 1, tries: 2, points: 0, shown: true, rapid: true };
  expect(s.answers).toEqual([
    { item: 'story-c1-detail', ...guess },
    { item: 'story-c1-main', ...guess },
    { item: 'story-c1-detail', ...guess },
    { item: 'story-c1-main', ...guess },
    { item: 'story-c2-detail', correct: true, hint: 0, tries: 1, points: 4 },
    { item: 'story-c2-main', ...guess },
  ]);
  // The grown-ups see the guesses for what they were.
  await finish(2);
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Story', exact: true }).click();
  await expect(page.getByRole('row', { name: /A Calm Night/ }).getByText('A fast guess, set aside')).toHaveCount(2);
  const row = page.getByRole('row', { name: /The Weather Mast/ });
  await expect(row).toContainText('Right first time');
  await expect(row).toContainText('A fast guess, set aside');
});
