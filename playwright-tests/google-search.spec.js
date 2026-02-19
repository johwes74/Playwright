const { test, expect } = require('@playwright/test');

/**
 * Accept Google's cookie consent dialog if it appears (common in CI environments).
 */
async function acceptConsentIfPresent(page) {
  try {
    const consentButton = page.getByRole('button', { name: /accept all|acceptera alla|godkänn/i });
    await consentButton.click({ timeout: 3000 });
  } catch {
    // No consent dialog present, continue
  }
}

test.describe('Google Search', () => {
  test('should load Google homepage', async ({ page }) => {
    await page.goto('https://www.google.com');
    await acceptConsentIfPresent(page);
    await expect(page).toHaveTitle(/Google/);
  });

  test('should perform a search', async ({ page }) => {
    await page.goto('https://www.google.com');
    await acceptConsentIfPresent(page);
    await page.getByLabel('Sök', { exact: false }).or(page.getByRole('combobox')).first().fill('Playwright testing');
    await page.keyboard.press('Enter');
    await page.waitForURL(/search/);
    // #rso is Google's current organic results container (replaced the old #search id)
    await expect(page.locator('#rso')).toBeVisible();
  });
});
