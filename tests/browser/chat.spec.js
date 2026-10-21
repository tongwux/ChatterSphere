import { test, expect } from '@playwright/test';

async function signup(page, name, username) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByLabel('Full name', { exact: true }).fill(name);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill('a-good-test-password');
  await page.getByLabel('Confirm password', { exact: true }).fill('a-good-test-password');
  await page.getByRole('button', { name: 'Create your account', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conversations.' })).toBeVisible();
}
test('two accounts sign up, exchange real messages, restore history, and sign back in', async ({
  browser,
}) => {
  const suffix = Date.now().toString(36);
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const a = await contextA.newPage();
  const b = await contextB.newPage();
  const errors = [];
  a.on('pageerror', (error) => errors.push(error.message));
  b.on('pageerror', (error) => errors.push(error.message));
  await signup(a, 'Alex Morgan', `alex_${suffix}`);
  await a.screenshot({ path: 'test-results/welcome-desktop.png', fullPage: true });
  await signup(b, 'Jamie Park', `jamie_${suffix}`);
  await a.getByRole('button', { name: 'People', exact: true }).click();
  await a.getByRole('searchbox', { name: 'Search people' }).fill(`jamie_${suffix}`);
  await a.getByRole('button', { name: /Jamie Park/ }).click();
  await expect(a.getByText('Online now', { exact: true })).toBeVisible();
  await a
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Hey Jamie, shall we build something good?');
  await a.getByRole('button', { name: 'Send message', exact: true }).click();
  await b.getByRole('button', { name: /Alex Morgan/ }).click();
  await expect(
    b
      .locator('.message-bubble')
      .getByText('Hey Jamie, shall we build something good?', { exact: true }),
  ).toBeVisible();
  await b
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Absolutely! Real-time looks good ✨');
  await b.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    a.locator('.message-bubble').getByText('Absolutely! Real-time looks good ✨', { exact: true }),
  ).toBeVisible();
  await a.getByRole('button', { name: 'Messages', exact: true }).click();
  await a.screenshot({ path: 'test-results/chat-desktop.png', fullPage: true });
  await b.setViewportSize({ width: 390, height: 844 });
  await b.screenshot({ path: 'test-results/chat-mobile.png', fullPage: true });
  await b.setViewportSize({ width: 1280, height: 720 });
  const xss = '<img src=x onerror=alert(1)>';
  await a.getByRole('textbox', { name: 'Message', exact: true }).fill(xss);
  await a.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(b.locator('.message-bubble').getByText(xss, { exact: true })).toBeVisible();
  await expect(b.locator('.message-bubble img')).toHaveCount(0);
  // Simulate a lost HTTP acknowledgement after the server has saved the message.
  const retryText = 'A safely retried message';
  await a.route(
    '**/api/messages/send/*',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
      await a.unroute('**/api/messages/send/*');
    },
    { times: 1 },
  );
  await a.getByRole('textbox', { name: 'Message', exact: true }).fill(retryText);
  await a.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(a.getByRole('alert')).toContainText('Your draft is saved');
  await a.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(a.getByRole('textbox', { name: 'Message', exact: true })).toHaveValue('');
  await expect(b.locator('.message-bubble').getByText(retryText, { exact: true })).toHaveCount(1);
  await contextB.setOffline(true);
  await expect(b.getByRole('status')).toContainText('disconnected');
  await a
    .getByRole('textbox', { name: 'Message', exact: true })
    .fill('Kept for you while you were away.');
  await a.getByRole('button', { name: 'Send message', exact: true }).click();
  await contextB.setOffline(false);
  await expect(
    b.locator('.message-bubble').getByText('Kept for you while you were away.', { exact: true }),
  ).toBeVisible();
  await a.getByRole('button', { name: 'A little about this space' }).click();
  await expect(a.getByRole('dialog')).toBeVisible();
  await a.keyboard.press('Escape');
  await expect(a.getByRole('dialog')).toHaveCount(0);
  await a.screenshot({ path: 'test-results/chat-recovery.png', fullPage: true });
  await b.reload();
  await b.getByRole('button', { name: /Alex Morgan/ }).click();
  await expect(
    b
      .locator('.message-bubble')
      .getByText('Hey Jamie, shall we build something good?', { exact: true }),
  ).toBeVisible();
  await b.setViewportSize({ width: 390, height: 844 });
  await expect(b.getByRole('textbox', { name: 'Message', exact: true })).toBeVisible();
  await expect(b.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await b.screenshot({ path: 'test-results/chat-mobile-validation.png', fullPage: true });
  await b.getByRole('button', { name: 'Back to conversations' }).click();
  await b.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(b.getByRole('heading', { name: 'Welcome back.' })).toBeVisible();
  await b.getByLabel('Username', { exact: true }).fill(`jamie_${suffix}`);
  await b.getByLabel('Password', { exact: true }).fill('a-good-test-password');
  await b.getByRole('button', { name: 'Step inside' }).click();
  await expect(b.getByRole('heading', { name: 'Conversations.' })).toBeVisible();
  expect(errors).toEqual([]);
  await contextA.close();
  await contextB.close();
});
test('responsive account forms have no horizontal overflow and show server validation', async ({
  page,
}) => {
  await page.goto('/');
  await page.screenshot({ path: 'test-results/auth-desktop.png', fullPage: true });
  await page.getByLabel('Username', { exact: true }).fill('unknown_account');
  await page.getByLabel('Password', { exact: true }).fill('incorrect-password');
  await page.getByRole('button', { name: 'Step inside' }).click();
  await expect(page.getByRole('alert')).toContainText('Username or password is incorrect');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
  await page.screenshot({ path: 'test-results/auth-mobile.png', fullPage: true });
});
