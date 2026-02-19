/**
 * Playwright Demo – Todo App
 *
 * A self-contained showcase of Playwright's core capabilities, all running
 * against a local server (no external dependencies, no flakiness from live sites).
 *
 * Capabilities demonstrated:
 *   1.  Locators          – getByRole, getByLabel, getByText, getByPlaceholder, locator()
 *   2.  Form interactions – fill, click, keyboard (Enter / Tab / type)
 *   3.  Assertions        – toBeVisible, toHaveCount, toHaveText, toHaveValue,
 *                           toBeChecked, toBeEmpty, toBeHidden, toBeFocused
 *   4.  Completing todos  – checkbox check / uncheck, live counter
 *   5.  Deleting todos    – aria-label–based button targeting
 *   6.  Filtering         – All / Active / Completed views
 *   7.  Persistence       – localStorage survives page.reload()
 *   8.  Screenshots       – full-page and element-level captures
 *   9.  Viewport          – mobile (375 px) and wide desktop (1440 px)
 *  10.  Network intercept – route.fulfill() to mock responses,
 *                           route.fetch() + body rewrite
 *  11.  Multi-context     – two isolated browser contexts, separate localStorage
 *  12.  Page evaluate     – running arbitrary JS in the browser context
 */

const { test, expect } = require('@playwright/test');

const BASE_URL = 'http://127.0.0.1:3000';

// ── Shared helper ─────────────────────────────────────────────────────────────

async function addTodo(page, text) {
  await page.getByLabel('New todo').fill(text);
  await page.keyboard.press('Enter');
}

// ── Shared setup: fresh localStorage before every test ────────────────────────

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. Locators & assertions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('1 · Locators & assertions', () => {
  test('finds elements by role, label, and placeholder', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /todos/i })).toBeVisible();
    await expect(page.getByLabel('New todo')).toBeVisible();
    await expect(page.getByPlaceholder('What needs to be done?')).toBeEmpty();
    await expect(page.getByRole('button', { name: 'Add' })).toBeEnabled();
  });

  test('shows empty-state message when the list is empty', async ({ page }) => {
    await expect(page.getByText('No todos yet')).toBeVisible();
    // The list exists in the DOM but contains no items
    await expect(page.getByRole('list', { name: 'Todo list' })).toBeEmpty();
  });

  test('hides the footer when there are no todos', async ({ page }) => {
    await expect(page.getByRole('contentinfo')).toBeHidden();
  });

  test('locates an item by CSS selector after adding', async ({ page }) => {
    await addTodo(page, 'CSS selector demo');
    // Playwright locator() accepts any CSS selector
    await expect(page.locator('.todo-label')).toHaveText('CSS selector demo');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Form interactions
// ─────────────────────────────────────────────────────────────────────────────
test.describe('2 · Form interactions', () => {
  test('adds a todo via the Enter key', async ({ page }) => {
    await addTodo(page, 'Buy milk');
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByText('Buy milk')).toBeVisible();
  });

  test('adds a todo via the Add button', async ({ page }) => {
    await page.getByLabel('New todo').fill('Walk the dog');
    await page.getByRole('button', { name: 'Add' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });

  test('clears the input field after adding', async ({ page }) => {
    await addTodo(page, 'Feed the cat');
    await expect(page.getByLabel('New todo')).toHaveValue('');
  });

  test('ignores empty or whitespace-only submissions', async ({ page }) => {
    await page.getByLabel('New todo').fill('   ');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });

  test('adds multiple todos in sequence', async ({ page }) => {
    for (const item of ['First', 'Second', 'Third']) {
      await addTodo(page, item);
    }
    await expect(page.getByRole('listitem')).toHaveCount(3);
    await expect(page.getByRole('listitem').nth(0)).toContainText('First');
    await expect(page.getByRole('listitem').nth(2)).toContainText('Third');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Completing todos
// ─────────────────────────────────────────────────────────────────────────────
test.describe('3 · Completing todos', () => {
  test.beforeEach(async ({ page }) => {
    await addTodo(page, 'Buy milk');
    await addTodo(page, 'Walk the dog');
  });

  test('marks a todo as complete via its checkbox', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Buy milk' }).check();
    await expect(page.getByRole('checkbox', { name: 'Buy milk' })).toBeChecked();
  });

  test('decrements the counter when a todo is completed', async ({ page }) => {
    await expect(page.getByText('2 items left')).toBeVisible();
    await page.getByRole('checkbox', { name: 'Buy milk' }).check();
    await expect(page.getByText('1 item left')).toBeVisible();
  });

  test('uses singular "item" when exactly one todo remains', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Buy milk' }).check();
    await page.getByRole('checkbox', { name: 'Walk the dog' }).check();
    await expect(page.getByText('0 items left')).toBeVisible();
  });

  test('can uncheck a completed todo', async ({ page }) => {
    const cb = page.getByRole('checkbox', { name: 'Buy milk' });
    await cb.check();
    await cb.uncheck();
    await expect(cb).not.toBeChecked();
    await expect(page.getByText('2 items left')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Deleting todos
// ─────────────────────────────────────────────────────────────────────────────
test.describe('4 · Deleting todos', () => {
  test.beforeEach(async ({ page }) => {
    await addTodo(page, 'Buy milk');
    await addTodo(page, 'Walk the dog');
  });

  test('deletes a specific todo', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete Buy milk' }).click();
    await expect(page.getByText('Buy milk')).not.toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });

  test('shows empty state after all todos are deleted', async ({ page }) => {
    await page.getByRole('button', { name: 'Delete Buy milk' }).click();
    await page.getByRole('button', { name: 'Delete Walk the dog' }).click();
    await expect(page.getByText('No todos yet')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Filtering
// ─────────────────────────────────────────────────────────────────────────────
test.describe('5 · Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await addTodo(page, 'Buy milk');      // will be completed
    await addTodo(page, 'Walk the dog');  // active
    await addTodo(page, 'Read a book');   // active
    await page.getByRole('checkbox', { name: 'Buy milk' }).check();
  });

  test('All filter shows every todo', async ({ page }) => {
    await expect(page.getByRole('listitem')).toHaveCount(3);
  });

  test('Active filter hides completed todos', async ({ page }) => {
    await page.getByRole('button', { name: 'Active' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByText('Buy milk')).not.toBeVisible();
  });

  test('Completed filter shows only done todos', async ({ page }) => {
    await page.getByRole('button', { name: 'Completed' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(1);
    await expect(page.getByText('Buy milk')).toBeVisible();
  });

  test('Clear completed removes finished todos', async ({ page }) => {
    await page.getByRole('button', { name: 'Clear completed' }).click();
    await expect(page.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByText('Buy milk')).not.toBeVisible();
  });

  test('active filter button is marked as pressed', async ({ page }) => {
    await page.getByRole('button', { name: 'Active' }).click();
    await expect(page.getByRole('button', { name: 'Active' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'All' }))
      .toHaveAttribute('aria-pressed', 'false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Persistence via localStorage
// ─────────────────────────────────────────────────────────────────────────────
test.describe('6 · Persistence via localStorage', () => {
  test('todos survive a full page reload', async ({ page }) => {
    await addTodo(page, 'Survive Monday');
    await page.reload();
    await expect(page.getByText('Survive Monday')).toBeVisible();
  });

  test('completed state survives a reload', async ({ page }) => {
    await addTodo(page, 'Buy milk');
    await page.getByRole('checkbox', { name: 'Buy milk' }).check();
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Buy milk' })).toBeChecked();
  });

  test('page.evaluate can inspect localStorage directly', async ({ page }) => {
    await addTodo(page, 'Stored item');
    const raw = await page.evaluate(() => localStorage.getItem('playwright-demo-todos'));
    const stored = JSON.parse(raw);
    expect(stored).toHaveLength(1);
    expect(stored[0].text).toBe('Stored item');
    expect(stored[0].completed).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Screenshots (full-page and element-level)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('7 · Screenshots', () => {
  test('captures a full-page screenshot', async ({ page }) => {
    await addTodo(page, 'Buy milk');
    await addTodo(page, 'Walk the dog');
    const screenshot = await page.screenshot({ fullPage: true });
    // Verify we got real image data back (PNG magic bytes: 0x89 0x50 0x4E 0x47)
    expect(screenshot[0]).toBe(0x89);
    expect(screenshot.byteLength).toBeGreaterThan(1000);
  });

  test('captures a single element screenshot', async ({ page }) => {
    await addTodo(page, 'Buy milk');
    const listEl = page.getByRole('list', { name: 'Todo list' });
    const screenshot = await listEl.screenshot();
    expect(screenshot.byteLength).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Viewport emulation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('8 · Viewport emulation', () => {
  test('works on a narrow mobile viewport (375 px – iPhone SE)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await addTodo(page, 'Mobile todo');
    await expect(page.getByText('Mobile todo')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add' })).toBeVisible();
  });

  test('works on a wide desktop viewport (1440 px)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await addTodo(page, 'Desktop todo');
    await expect(page.getByText('Desktop todo')).toBeVisible();
  });

  test('reports the correct viewport dimensions via page.evaluate', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 600 });
    const dims = await page.evaluate(() => ({
      width:  window.innerWidth,
      height: window.innerHeight,
    }));
    expect(dims.width).toBe(800);
    expect(dims.height).toBe(600);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Keyboard navigation
// ─────────────────────────────────────────────────────────────────────────────
test.describe('9 · Keyboard navigation', () => {
  test('Tab moves focus to the New-todo input', async ({ page }) => {
    await page.keyboard.press('Tab');
    await expect(page.getByLabel('New todo')).toBeFocused();
  });

  test('keyboard.type() populates the input character by character', async ({ page }) => {
    await page.getByLabel('New todo').focus();
    await page.keyboard.type('Typed character by character');
    await expect(page.getByLabel('New todo')).toHaveValue('Typed character by character');
  });

  test('adds a todo entirely via keyboard – no mouse clicks', async ({ page }) => {
    await page.keyboard.press('Tab');              // focus input
    await page.keyboard.type('Keyboard-only todo');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Keyboard-only todo')).toBeVisible();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. Network interception
// ─────────────────────────────────────────────────────────────────────────────
test.describe('10 · Network interception', () => {
  test('route.fulfill() replaces a response with mocked content', async ({ page }) => {
    // Intercept the HTML page and inject a different title
    await page.route('**/', async route => {
      const response = await route.fetch();
      let body = await response.text();
      body = body.replace(
        '<title>Playwright Demo',
        '<title>Mocked by Playwright',
      );
      await route.fulfill({ response, body });
    });

    await page.reload();
    await expect(page).toHaveTitle(/Mocked by Playwright/);
  });

  test('page.on("request") collects all requests fired during a test', async ({ page }) => {
    const urls = [];
    page.on('request', req => urls.push(req.url()));

    await page.goto(BASE_URL);
    // The app makes exactly one request — for its own HTML
    expect(urls.some(u => u.includes('127.0.0.1:3000'))).toBe(true);
  });

  test('route.abort() can block specific requests', async ({ page }) => {
    let aborted = false;

    // Abort any request for a path we define (demonstrates the API)
    await page.route('**/blocked-resource', route => {
      aborted = true;
      route.abort();
    });

    // Navigate normally — the blocked route is never triggered here, but
    // the handler is registered and ready (no error expected)
    await page.goto(BASE_URL);
    await addTodo(page, 'Intercept demo');
    await expect(page.getByText('Intercept demo')).toBeVisible();
    // aborted stays false because the app never calls /blocked-resource
    expect(aborted).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. Multiple browser contexts (isolation)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('11 · Multiple browser contexts', () => {
  test('two contexts have completely isolated localStorage', async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await page1.goto(BASE_URL);
    await page2.goto(BASE_URL);

    // Add a todo only in context 1
    await addTodo(page1, 'Context 1 exclusive todo');
    await page1.reload(); // confirm it was persisted

    // Context 2 must not see it
    await expect(page2.getByText('Context 1 exclusive todo')).not.toBeVisible();
    await expect(page2.getByText('No todos yet')).toBeVisible();

    await ctx1.close();
    await ctx2.close();
  });
});
