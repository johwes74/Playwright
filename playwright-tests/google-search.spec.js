/**
 * Google Search tests — retired.
 *
 * These tests depended on Google's live website and were flaky in CI
 * (consent dialogs, selector changes, bot-detection).
 *
 * See todo-app.spec.js for the comprehensive, self-contained demo.
 */

const { test } = require('@playwright/test');

test.describe.skip('Google Search (retired – see todo-app.spec.js)', () => {
  // Tests removed in favour of the local Todo App demo.
});
