/**
 * E2E-test för landningssidan på seb.se med self-healing locators.
 *
 * Demonstrerar:
 *   1. En vanlig "lycklig väg" mot https://seb.se
 *   2. Self-healing — vi använder med flit en avsiktligt brittlig
 *      primärselektor för cookie-knappen. När den misslyckas frågar
 *      SelfHealingLocator den lokala LLM:en (Llama 3.1 via Ollama) om
 *      en ny selektor utifrån sidans aktuella DOM.
 *
 * Förutsättningar:
 *   - Internetåtkomst till seb.se (testet hoppas över annars)
 *   - Ollama körs lokalt och llama3.1:8b är hämtad:
 *       ollama pull llama3.1:8b
 *     (testet som demonstrerar self-healing hoppas över om Ollama saknas)
 */

const { test, expect } = require('@playwright/test');
const { SelfHealingLocator } = require('../agent/self-healing-locator');
const { OllamaClient } = require('../agent/ollama-client');

const SEB_URL = 'https://seb.se/';

/**
 * Hjälpfunktion: kolla om vi når seb.se från test-miljön. Använd kort timeout
 * så CI utan internet inte hänger.
 */
async function sebReachable() {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(SEB_URL, { method: 'HEAD', signal: ctrl.signal });
    clearTimeout(t);
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

test.describe('SEB landningssida', () => {
  test.beforeEach(async () => {
    if (!(await sebReachable())) {
      test.skip(true, 'seb.se är inte nåbart från denna miljö — hoppar över');
    }
  });

  test('landningssidan laddar och visar SEB-varumärket', async ({ page }) => {
    await page.goto(SEB_URL, { waitUntil: 'domcontentloaded' });

    // SEB använder olika titlar regionalt; alla innehåller "SEB".
    await expect(page).toHaveTitle(/SEB/i);

    // Brand/logotyp ska finnas (länk eller bild med "SEB" i namnet).
    const brand = page.getByRole('link', { name: /seb/i }).first();
    await expect(brand).toBeVisible({ timeout: 10_000 });
  });

  test('self-healing återhämtar sig när cookie-knappens selektor är fel', async ({ page }) => {
    // Hoppa över om den lokala LLM:en inte är tillgänglig — då finns inget
    // att läka med.
    const ollama = new OllamaClient();
    if (!(await ollama.isAvailable())) {
      test.skip(true, 'Ollama körs inte lokalt — hoppar över self-healing-demon');
    }

    await page.goto(SEB_URL, { waitUntil: 'domcontentloaded' });

    const healer = new SelfHealingLocator(page, { client: ollama });

    // Avsiktligt fel primärselektor — denna klass kommer aldrig att finnas på
    // SEB:s sida. Self-healingen ska upptäcka miss, fråga LLM om en ny
    // selektor och returnera en fungerande locator.
    const cookieButton = await healer.find({
      primary: '#nonexistent-cookie-banner-accept-2099',
      description:
        'Knappen i cookie-/samtyckesbannern som accepterar alla cookies. ' +
        'Texten är ofta "Acceptera alla", "Godkänn alla" eller liknande.',
      timeout: 4000,
    });

    await cookieButton.click();

    // Efter klicket ska bannern ha försvunnit. Vi verifierar genom att den
    // nyss klickade knappen inte längre är synlig.
    await expect(cookieButton).toBeHidden({ timeout: 5000 });

    // Och huvudinnehållet ska finnas kvar.
    await expect(page.locator('main, [role="main"], header').first()).toBeVisible();
  });

  test('navigationsmenyn innehåller väntade huvudområden', async ({ page }) => {
    await page.goto(SEB_URL, { waitUntil: 'domcontentloaded' });

    // SEB:s landningssida brukar exponera privat/företag/private banking-länkar
    // i headern. Vi accepterar minst en av dem som tecken på att navigationen
    // renderats.
    const nav = page.locator('header, nav').first();
    await expect(nav).toBeVisible({ timeout: 10_000 });

    const navText = (await nav.innerText()).toLowerCase();
    expect(navText).toMatch(/privat|företag|private banking|logga in/);
  });
});
