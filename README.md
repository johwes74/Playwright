# Playwright Demo

End-to-end testing showcase built with [Playwright](https://playwright.dev).
Includes a self-contained local demo app and an optional Claude-driven browser agent.

## Getting started

```bash
npm install
npx playwright install --with-deps chromium
```

## Running tests

```bash
# Run all tests (starts the demo app automatically)
npm test

# Run with a visible browser
npm run test:headed

# Run the AI agent tests (requires an Anthropic API key)
ANTHROPIC_API_KEY=sk-... npm run test:agent

# Open the HTML report after a run
npm run test:report
```

## Project structure

```
demo-app/
  index.html               # Self-contained vanilla-JS Todo app
  server.js                # Minimal Node HTTP server (auto-started by Playwright)
agent/
  playwright-agent.js      # Claude-driven browser agent
playwright-tests/
  todo-app.spec.js         # 37 tests — Playwright capabilities demo
  agent-search.spec.js     # AI agent tests (skipped without ANTHROPIC_API_KEY)
  google-search.spec.js    # Retired (replaced by todo-app.spec.js)
playwright.config.js       # Config — includes webServer block
.github/workflows/
  playwright-manual.yml    # Manual GitHub Actions run
```

## Demo app

The tests run against a local Todo app served by Playwright's built-in
`webServer` feature — no external network access required. The app is started
and stopped automatically around each test run.

```bash
# Start the demo app manually (optional — Playwright does this for you)
node demo-app/server.js   # → http://localhost:3000
```

## Playwright capabilities demonstrated

`playwright-tests/todo-app.spec.js` covers 11 feature areas across 37 tests:

| # | Topic | What's shown |
|---|-------|-------------|
| 1 | **Locators** | `getByRole`, `getByLabel`, `getByText`, `getByPlaceholder`, `locator()` |
| 2 | **Form interactions** | `fill`, `click`, Enter key, empty-input guard |
| 3 | **Assertions** | `toBeVisible`, `toHaveCount`, `toHaveText`, `toHaveValue`, `toBeChecked`, `toBeFocused`, `toBeHidden` |
| 4 | **Completing todos** | Checkbox check/uncheck, live counter updates |
| 5 | **Deleting todos** | ARIA-label–targeted delete buttons |
| 6 | **Filtering** | All / Active / Completed views, `aria-pressed` state |
| 7 | **Persistence** | `localStorage` survives `page.reload()`, `page.evaluate()` |
| 8 | **Screenshots** | Full-page and element-level captures |
| 9 | **Viewport emulation** | Mobile 375 px (iPhone SE) and desktop 1440 px |
| 10 | **Network interception** | `route.fulfill()` body rewrite, request spy, `route.abort()` |
| 11 | **Multiple contexts** | Two isolated `browser.newContext()` instances |

## AI agent

`agent/playwright-agent.js` is a Claude-powered browser agent that drives
Playwright via a tool-use loop — Claude picks an action, Playwright executes
it, and the result is fed back until the task is complete.

```
Task (plain text)
     │
     ▼
┌──────────────────────────────────────────┐
│              PlaywrightAgent             │
│                                          │
│  while not done:                         │
│    1. Send conversation → Claude         │
│    2. Claude picks tool + arguments      │
│    3. Run tool in Playwright             │
│    4. Feed result back to Claude         │
│                                          │
│  Available tools:                        │
│   • navigate   – go to URL              │
│   • click      – click an element       │
│   • fill       – type into a field      │
│   • press_key  – press a key (Enter…)   │
│   • get_text   – read page text         │
│   • screenshot – take a screenshot      │
└──────────────────────────────────────────┘
     │
     ▼
Final answer (text)
```

### Usage

```js
const { PlaywrightAgent } = require('./agent/playwright-agent');

const agent = new PlaywrightAgent(page); // Playwright Page object

const result = await agent.run(
  'Go to https://example.com and tell me the page heading.'
);
console.log(result); // "The heading is: Example Domain"
```

## GitHub Actions

The workflow `playwright-manual.yml` is triggered manually via:
**Actions → Playwright Tests (Manual) → Run workflow**

> **Note:** To run the AI agent tests in CI, add `ANTHROPIC_API_KEY` as a
> GitHub Secret and pass it as an environment variable in the workflow file.
