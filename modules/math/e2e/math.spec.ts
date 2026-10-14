// Math, end to end: the keypad (LTF-40) and the module plugged into the app (LTF-41).
import { test, expect, type Page } from '@playwright/test';
import { axe, onboard, quiet } from '../../../e2e/helpers';

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
  for (let k = 0; k < 8; k++) { // together, then his turn: a wrong answer twice shows it
    await expect(page.getByText(/(Together|Your turn) · /)).toBeVisible();
    for (let t = 0; t < 2; t++) {
      if (await page.getByRole('button', { name: /^Next( →)?$/ }).isVisible()) break;
      await keyIn(page, /^Answer/, '1');
      await page.getByRole('button', { name: 'Check' }).click();
      if (t === 0) await expect(page.locator('.feedback.hint')).toBeVisible(); // the named next step, for one more try
    }
    await expect(page.getByText('Now you have seen how.')).toBeVisible();
    await page.getByRole('button', { name: /^Next( →)?$/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'Pick one new thing for your island' })).toBeVisible();
  await page.locator('.piece').first().click();
  await page.getByRole('button', { name: 'Choose a spot for me' }).click();
  await page.getByRole('button', { name: /Back to my island/ }).click();
  await expect(page.getByText('4 more sessions to Gull Island.')).toBeVisible(); // a math session moves the journey
});
