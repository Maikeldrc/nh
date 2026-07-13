import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const qaEmail = process.env.QA_EMAIL;
const qaPassword = process.env.QA_PASSWORD;

test.describe('Production smoke QA', () => {
  test('login page renders and rejects invalid credentials without leaking details', async ({ page }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/');
    await expect(page.locator('#login-page')).toBeVisible();
    await page.locator('#login-btn-lang-en').click();
    await page.locator('#email').fill('qa_auto_invalid_user@example.test');
    await page.locator('#password').fill('not-the-password');
    await page.locator('#btn-submit-login').click();
    await expect(page.locator('#login-error-alert')).toBeVisible();
    await expect(page.locator('#login-error-alert')).not.toContainText(/stack|token|apiKey|password/i);
    await page.screenshot({ path: `qa-evidence/screenshots/${testInfo.project.name}-login-invalid.png`, fullPage: true });
    expect(consoleErrors.filter(error => !/Failed to load resource/i.test(error))).toEqual([]);
  });

  test('authenticated dashboard loads for QA user', async ({ page }, testInfo) => {
    test.skip(!qaEmail || !qaPassword, 'QA_EMAIL and QA_PASSWORD are required for authenticated production QA.');

    const failedResponses: string[] = [];
    const consoleErrors: string[] = [];
    page.on('response', response => {
      if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
    });
    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });

    await page.goto('/');
    await page.locator('#login-btn-lang-en').click();
    await page.locator('#email').fill(qaEmail!);
    await page.locator('#password').fill(qaPassword!);
    await page.locator('#btn-submit-login').click();
    await expect(page.locator('#main-application-frame')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('header, #dashboard-admin, #dashboard-nurse').first()).toBeVisible();
    await page.screenshot({ path: `qa-evidence/screenshots/${testInfo.project.name}-dashboard-authenticated.png`, fullPage: true });

    const accessibilityScanResults = await new AxeBuilder({ page })
      .disableRules(['color-contrast'])
      .analyze();
    expect(accessibilityScanResults.violations.filter(v => ['critical', 'serious'].includes(v.impact || ''))).toEqual([]);
    expect(failedResponses.filter(item => !/identitytoolkit|googleapis/.test(item))).toEqual([]);
    expect(consoleErrors.filter(error => !/Failed to load resource/i.test(error))).toEqual([]);
  });
});
