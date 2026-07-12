import { expect, test } from '@playwright/test';
import { credentialsFromEnv, loginAndCaptureSession } from './helpers';

const roleCases = [
  { prefix: 'ADMIN', label: 'admin', expectedRole: 'ADMIN' as const },
  { prefix: 'NURSE', label: 'nurse', expectedRole: 'NURSE' as const },
  { prefix: 'PHYSICIAN', label: 'physician', expectedRole: 'PHYSICIAN' as const }
];

test.describe('Production role access QA', () => {
  for (const roleCase of roleCases) {
    test(`${roleCase.label} can authenticate and sees role-appropriate dashboard`, async ({ page }, testInfo) => {
      const credentials = credentialsFromEnv(roleCase.prefix, roleCase.label);
      test.skip(!credentials, `QA_${roleCase.prefix}_EMAIL and QA_${roleCase.prefix}_PASSWORD are required.`);

      const failedResponses: string[] = [];
      const consoleErrors: string[] = [];
      page.on('response', response => {
        if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
      });
      page.on('console', message => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });

      const session = await loginAndCaptureSession(page, credentials!);
      expect(session.bootstrap.currentUser.role).toBe(roleCase.expectedRole);

      if (roleCase.expectedRole === 'NURSE') {
        await expect(page.locator('#dashboard-nurse')).toBeVisible();
        await expect(page.locator('#btn-register-patient-nurse')).toBeVisible();
      } else {
        await expect(page.locator('#dashboard-admin')).toBeVisible();
      }

      if (roleCase.expectedRole === 'ADMIN') {
        await expect(page.locator('#tab-users')).toBeVisible();
        await expect(page.locator('#tab-clinical-catalog')).toBeVisible();
        await expect(page.locator('#btn-register-patient-admin')).toBeVisible();
      }

      if (roleCase.expectedRole === 'PHYSICIAN') {
        await expect(page.locator('#tab-users')).toHaveCount(0);
        await expect(page.locator('#tab-clinical-catalog')).toHaveCount(0);
        await expect(page.locator('#btn-register-patient-admin')).toHaveCount(0);
      }

      await page.screenshot({
        path: `qa-evidence/screenshots/${testInfo.project.name}-role-${roleCase.label}.png`,
        fullPage: true
      });

      const unrecoveredFailures = failedResponses.filter(item =>
        !/identitytoolkit|googleapis/.test(item)
        && !/^429 .*\/v1\/bootstrap$/.test(item)
      );
      expect(unrecoveredFailures).toEqual([]);
      expect(consoleErrors.filter(error => !/Failed to load resource/i.test(error))).toEqual([]);
    });
  }
});
