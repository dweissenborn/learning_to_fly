// Math, end to end: the keypad (LTF-40) and the module plugged into the app (LTF-41).
import { test, expect, type Page } from '@playwright/test';
import { axe, onboard, quiet, setSettings } from '../../../e2e/helpers';

test.beforeEach(quiet);

test('typed math answers on a keypad: tapping only, exact checking, and a named next step for the usual mistake (LTF-40)', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Content library' }).click();
  await page.getByRole('region', { name: 'Math (preview)' }).getByRole('button', { name: 'Dividing fractions' }).click();
  const dlg = page.getByRole('dialog', { name: 'Try a math problem' });
  const [a, b, c, d] = ((await dlg.locator('.math-prompt').textContent()) ?? '').match(/\d+/g)!.map(Number); // a/b ÷ c/d
  const tap = async (box: string, digits: string) => {
    await dlg.getByRole('button', { name: new RegExp(`^${box}:`) }).click();
    for (let k = 0; k < 3; k++) await dlg.getByRole('button', { name: 'Delete' }).click();
    for (const ch of digits) await dlg.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: ch, exact: true }).click();
  };
  await tap('Top number', `${a * c}`); // multiplied without flipping
  await tap('Bottom number', `${b * d}`);
  await dlg.getByRole('button', { name: 'Check' }).click();
  await expect(dlg).toContainText('keep the first fraction, change ÷ to ×, and flip the second fraction');
  await axe(page, 'math keypad');
  await tap('Top number', `${a * d}`); // keep, change, flip
  await tap('Bottom number', `${b * c}`);
  await dlg.getByRole('button', { name: 'Check' }).click();
  await expect(dlg).toContainText('Right.');
  await dlg.getByRole('button', { name: 'Close' }).click();
  // A quotient and a remainder.
  await page.getByRole('region', { name: 'Math (preview)' }).getByRole('button', { name: 'Division with remainders' }).click();
  const [n, m] = ((await dlg.locator('.math-prompt').textContent()) ?? '').match(/\d+/g)!.map(Number);
  await tap('Answer', `${Math.floor(n / m)}`);
  await tap('Remainder', `${n % m}`);
  await dlg.getByRole('button', { name: 'Check' }).click();
  await expect(dlg).toContainText('Right.');
});

async function mathOn(page: Page, known?: string[]) {
  await page.getByRole('button', { name: 'Grown-ups' }).click();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByText('Math: fractions, and the skills under them').click();
  for (const k of known ?? []) await page.getByRole('group', { name: 'What he already knows' }).getByText(k, { exact: true }).click();
  await page.getByRole('button', { name: /Back to/ }).first().click();
}
const gcdOf = (a: number, b: number): number => (b ? gcdOf(b, a % b) : a);
/** On a greatest-common-factor problem: the right answer, and the choice buttons that are not it. */
async function gcfChoices(page: Page) {
  const [x, y] = ((await page.locator('.math-prompt').textContent()) ?? '').match(/\d+/g)!.map(Number);
  const right = String(gcdOf(x, y));
  const buttons = page.getByRole('group', { name: 'Choices' }).getByRole('button');
  const texts = (await buttons.allTextContents()).map((t) => t.trim());
  return { right, rightButton: buttons.nth(texts.indexOf(right)), wrong: texts.flatMap((t, i) => (t === right ? [] : [buttons.nth(i)])) };
}
const wrongChoices = async (page: Page) => (await gcfChoices(page)).wrong;
/** His math answers, newest last. */
const mathAnswers = (page: Page) => page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((res, rej) => { const r = indexedDB.open('wayfinder'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const all = await new Promise<{ type: string; module?: string; phase: string; ts: number; format: string; hint: number; correct: boolean }[]>((res) => { const q = db.transaction('events').objectStore('events').getAll(); q.onsuccess = () => res(q.result); });
  db.close();
  return all.filter((e) => e.type === 'answer' && e.module === 'math' && e.phase !== 'placement').sort((a, b) => a.ts - b.ts).map(({ format, hint, correct }) => ({ format, hint, correct }));
});
/** Types digits into a keypad box. */
async function keyIn(page: Page, box: RegExp, digits: string) {
  await page.getByRole('button', { name: box }).click();
  for (const ch of digits) await page.getByRole('group', { name: 'Keypad' }).getByRole('button', { name: ch, exact: true }).click();
}

test('math: a grown-up turns it on, and the scouting trip ends kindly after two misses in a row (LTF-41)', async ({ page }) => {
  await onboard(page);
  await mathOn(page);
  await expect(page.getByRole('region', { name: 'Your paths' })).toContainText('Next: a math scouting trip');
  await page.getByRole('region', { name: 'What would you like to do?' }).getByRole('button', { name: /Math/ }).click();
  await expect(page.getByRole('heading', { name: 'Math scouting trip' })).toBeVisible();
  await page.getByRole('button', { name: "Let's go" }).click();
  for (let k = 0; k < 2; k++) { // two wrong answers in a row
    await keyIn(page, /^(Top number|Answer|Whole number)/, '1');
    if (await page.getByRole('button', { name: /^Bottom number/ }).count()) await keyIn(page, /^Bottom number/, '1');
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Got it. On to the next one.')).toBeVisible(); // no right or wrong shown
    await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Good place to stop' })).toBeVisible();
  await axe(page, 'math scouting stop');
  await page.getByRole('button', { name: 'Back to my island' }).click();
  await expect(page.getByRole('region', { name: 'Your paths' })).toContainText('Next: a math scouting trip'); // it picks up next time
});

test('math: a start point, a short check-in, then a lesson that finishes like reading and moves the journey (LTF-41)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await mathOn(page, ['Multiplication and division facts']);
  const pick = page.getByRole('region', { name: 'What would you like to do?' });
  await pick.getByRole('button', { name: /Math/ }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  for (let k = 0; k < 2; k++) { // the check-in only confirms the facts: answer them right
    const [x, op, y] = ((await page.locator('.math-prompt').textContent()) ?? '').split(' ');
    await keyIn(page, /^Answer/, `${op === '×' ? Number(x) * Number(y) : Number(x) / Number(y)}`);
    await page.getByRole('button', { name: 'Check' }).click();
    await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Your math path is ready' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to my island' }).click();
  await expect(page.getByRole('region', { name: 'Your paths' })).toContainText('Next: Factors and common factors');
  await pick.getByRole('button', { name: /Math/ }).click();
  await expect(page.getByRole('region', { name: 'Watch a worked example' })).toBeVisible();
  await axe(page, 'math worked example');
  await page.getByRole('button', { name: /Got it/ }).click();
  for (let k = 0; k < 8; k++) { // together, then his turn, from three choices on a new skill (LTF-43): a wrong choice twice shows it
    await expect(page.getByText(/(Together|Your turn) · /)).toBeVisible();
    await expect(page.getByRole('group', { name: 'Keypad' })).toHaveCount(0);
    const wrong = await wrongChoices(page);
    await wrong[0].click();
    await expect(page.locator('.feedback.hint')).toBeVisible(); // the named next step, for one more try
    await wrong[1].click();
    await expect(page.getByText('Now you have seen how.')).toBeVisible();
    await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Pick one new thing for your island' })).toBeVisible();
  await page.locator('.piece').first().click();
  await page.getByRole('button', { name: 'Choose a spot for me' }).click();
  await page.getByRole('button', { name: /Back to my island/ }).click();
  await expect(page.getByText('4 more sessions to Gull Island.')).toBeVisible(); // a math session moves the journey
});

test('math help: one Help button with three steps, choices first on a new skill, and an answer after help counts as helped (LTF-43)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await mathOn(page, ['Multiplication and division facts']);
  const pick = page.getByRole('region', { name: 'What would you like to do?' });
  await pick.getByRole('button', { name: /Math/ }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  for (let k = 0; k < 2; k++) {
    const [x, op, y] = ((await page.locator('.math-prompt').textContent()) ?? '').split(' ');
    await keyIn(page, /^Answer/, `${op === '×' ? Number(x) * Number(y) : Number(x) / Number(y)}`);
    await page.getByRole('button', { name: 'Check' }).click();
    await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await page.getByRole('button', { name: 'Back to my island' }).click();
  // A new skill: three choices, so Help starts at the smaller step.
  await pick.getByRole('button', { name: /Math/ }).click();
  await page.getByRole('button', { name: /Got it/ }).click();
  await expect(page.getByRole('group', { name: 'Choices' }).getByRole('button')).toHaveCount(3);
  await page.getByRole('button', { name: 'Help: a smaller step' }).click();
  await expect(page.getByText('Step 2 of 3: a smaller step.')).toBeVisible();
  await axe(page, 'math choices and help');
  await (await gcfChoices(page)).rightButton.click();
  await expect(page.getByText('You found it with help.')).toBeVisible();
  await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  await expect.poll(() => mathAnswers(page)).toEqual([{ format: 'choices', hint: 2, correct: false }]);
  // Four more right from the choices: 80% with choices, so typed answers take over next time.
  for (let k = 0; k < 7; k++) {
    await (await gcfChoices(page)).rightButton.click();
    await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await page.locator('.piece').first().click();
  await page.getByRole('button', { name: 'Choose a spot for me' }).click();
  await page.getByRole('button', { name: /Back to my island/ }).click();
  // Typed now: Help shows the choices, then a smaller step, then how.
  await pick.getByRole('button', { name: /Math/ }).click();
  await page.getByRole('button', { name: /Got it/ }).click();
  await expect(page.getByRole('group', { name: 'Keypad' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choices' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Help: show three choices' }).click();
  await expect(page.getByText('Step 1 of 3: three choices.', { exact: false })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Choices' }).getByRole('button')).toHaveCount(3);
  await page.getByRole('button', { name: 'Help: a smaller step' }).click();
  await page.getByRole('button', { name: 'Help: show me how' }).click();
  await expect(page.getByText('Step 3 of 3: here is how.', { exact: false })).toBeVisible();
  await expect(page.locator('.math-steps li')).toHaveCount(3);
  await keyIn(page, /^Answer/, (await gcfChoices(page)).right);
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('You found it with help.')).toBeVisible();
  await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  await expect.poll(async () => (await mathAnswers(page)).at(-1)).toEqual({ format: 'keypad', hint: 3, correct: false });
});

test('math: two fast wrong answers in a row end the session kindly, as in reading (LTF-43)', async ({ page }) => {
  await page.addLocatorHandler(page.getByRole('dialog', { name: /New flight gear/ }), async (d) => {
    await d.getByRole('button', { name: /Keep going/ }).click({ timeout: 5000 }).catch(() => {});
  });
  await onboard(page);
  await mathOn(page, ['Multiplication and division facts']);
  const pick = page.getByRole('region', { name: 'What would you like to do?' });
  await pick.getByRole('button', { name: /Math/ }).click();
  await page.getByRole('button', { name: "Let's go" }).click();
  for (let k = 0; k < 2; k++) {
    const [x, op, y] = ((await page.locator('.math-prompt').textContent()) ?? '').split(' ');
    await keyIn(page, /^Answer/, `${op === '×' ? Number(x) * Number(y) : Number(x) / Number(y)}`);
    await page.getByRole('button', { name: 'Check' }).click();
    await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await page.getByRole('button', { name: 'Back to my island' }).click();
  await setSettings(page, { guessCheck: true });
  await page.reload();
  await pick.getByRole('button', { name: /Math/ }).click();
  await page.getByRole('button', { name: /Got it/ }).click();
  for (let k = 0; k < 2; k++) { // a wrong choice twice, faster than the problem can be read
    const wrong = await wrongChoices(page);
    await wrong[0].click();
    await wrong[1].click();
    await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await expect(page.getByText('Good place to stop. Your progress is saved.', { exact: false })).toBeVisible();
});
