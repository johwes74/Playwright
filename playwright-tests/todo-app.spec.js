// Import necessary testing libraries
const { test, expect } = require('@playwright/test');

// This is a test suite for the Todo app

test.describe('Todo App', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://localhost:3000');
    });

    test('add todo', async ({ page }) => {
        await page.fill('input[data-testid="new-todo"]', 'New Todo');
        await page.click('button[data-testid="add-todo"]');
        const todos = await page.locator('li[data-testid="todo-item"]').count();
        expect(todos).toBe(1);
    });

    test('complete todo', async ({ page }) => {
        await page.fill('input[data-testid="new-todo"]', 'New Todo');
        await page.click('button[data-testid="add-todo"]');

        await page.locator('button[data-filter="completed"]').click(); // Updated line

        const completedTodos = await page.locator('li[data-testid="completed-todo-item"]').count();
        expect(completedTodos).toBe(1);
    });

    test('clear completed todos', async ({ page }) => {
        await page.fill('input[data-testid="new-todo"]', 'New Todo');
        await page.click('button[data-testid="add-todo"]');

        await page.locator('button[data-filter="completed"]').click();
        await page.click('button[data-testid="clear-completed"]');

        const todos = await page.locator('li[data-testid="todo-item"]').count();
        expect(todos).toBe(0);
    });
});
