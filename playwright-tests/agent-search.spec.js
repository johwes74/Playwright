/**
 * Agentdriven E2E-test
 *
 * Istället för hårdkodade selektorer och steg delegeras hela uppgiften till
 * PlaywrightAgent. Agenten resonerar om sidan och väljer själv vilka
 * webbläsaråtgärder som behöver utföras.
 *
 * Krav: ANTHROPIC_API_KEY måste vara satt som miljövariabel.
 *
 * Kör: ANTHROPIC_API_KEY=sk-... npx playwright test agent-search
 */

const { test, expect } = require('@playwright/test');
const { PlaywrightAgent } = require('../agent/playwright-agent');

test.describe('AI-agent: Google-sökning', () => {
  test('agenten söker och returnerar det första resultatet', async ({ page }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY saknas — hoppar över agenttest');

    const agent = new PlaywrightAgent(page);

    const result = await agent.run(
      'Gå till https://www.google.com och sök efter "Playwright end-to-end testing". ' +
        'Vänta tills sökresultaten laddats och returnera titeln och URL:en för det första organiska sökresultatet.',
    );

    console.log('\n--- Agentens svar ---\n', result, '\n---');

    // Agenten ska ha hittat ett svar (inte vara tom)
    expect(result.length).toBeGreaterThan(10);
  });

  test('agenten navigerar och verifierar sidtitel', async ({ page }) => {
    test.skip(!process.env.ANTHROPIC_API_KEY, 'ANTHROPIC_API_KEY saknas — hoppar över agenttest');

    const agent = new PlaywrightAgent(page);

    const result = await agent.run(
      'Navigera till https://playwright.dev och berätta vad sidans titel och rubrik (h1) är.',
    );

    console.log('\n--- Agentens svar ---\n', result, '\n---');

    expect(result).toMatch(/playwright/i);
  });
});
