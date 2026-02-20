// Test case for the todo app

import { test, expect } from '@playwright/test';

test('Todo App Tests', async ({ page }) => {
    await page.goto('https://example.com/todo');

    // Add a new todo item
    await page.locator('input[type="text"]').fill('New Todo');
    await page.locator('button[type="submit"]').click();

    // Filter by active
    await page.locator('button[data-filter="active"]').click();
    expect(await page.locator('li.active').count()).toBeGreaterThan(0);

    // Filter by completed
    await page.locator('button[data-filter="completed"]').click();
    expect(await page.locator('li.completed').count()).toBeGreaterThan(0);

    // Other test steps...
});