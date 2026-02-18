const { test, expect } = require('@playwright/test');

test.describe('Google Search', () => {
  test('should load Google homepage', async ({ page }) => {
    await page.goto('https://www.google.com');
    await expect(page).toHaveTitle(/Google/);
  });

  test('should perform a search', async ({ page }) => {
    await page.goto('https://www.google.com');
    await page.getByLabel('Sök', { exact: false }).or(page.getByRole('combobox')).first().fill('Playwright testing');
    await page.keyboard.press('Enter');
    await page.waitForURL(/search/);
    await expect(page.locator('#search')).toBeVisible();
  });
});
