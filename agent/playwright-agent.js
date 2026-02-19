// @ts-check
const Anthropic = require('@anthropic-ai/sdk');

/**
 * PlaywrightAgent — en Claude-driven agent som styr webbläsaren.
 *
 * Agenten körs i en loop:
 *   1. Skicka uppgift + konversationshistorik till Claude
 *   2. Claude väljer ett verktyg (navigate, click, fill, get_text, screenshot)
 *   3. Agenten kör verktyget i Playwright och skickar resultatet tillbaka
 *   4. Upprepa tills Claude svarar med end_turn (uppgiften är klar)
 */
class PlaywrightAgent {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {string} [apiKey] - Anthropic API-nyckel (default: process.env.ANTHROPIC_API_KEY)
   */
  constructor(page, apiKey) {
    this.page = page;
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  /** Verktygsdefinitioner som skickas till Claude */
  get tools() {
    return [
      {
        name: 'navigate',
        description: 'Navigera webbläsaren till en URL.',
        input_schema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Fullständig URL att navigera till, t.ex. https://example.com' },
          },
          required: ['url'],
        },
      },
      {
        name: 'click',
        description: 'Klicka på ett element. Försöker först med CSS-selektor, sedan med synlig text.',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS-selektor eller synlig text på elementet' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'fill',
        description: 'Fyll i ett textfält.',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS-selektor för inmatningsfältet' },
            value: { type: 'string', description: 'Texten att skriva in' },
          },
          required: ['selector', 'value'],
        },
      },
      {
        name: 'press_key',
        description: 'Tryck på en tangent, t.ex. Enter, Tab, Escape.',
        input_schema: {
          type: 'object',
          properties: {
            key: { type: 'string', description: 'Tangentnamn enligt Playwright-notation, t.ex. "Enter"' },
          },
          required: ['key'],
        },
      },
      {
        name: 'get_text',
        description: 'Hämta textinnehållet från sidan eller ett specifikt element (max 3000 tecken).',
        input_schema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'Valfri CSS-selektor; utelämna för hela sidans text' },
          },
        },
      },
      {
        name: 'screenshot',
        description: 'Ta en skärmbild av webbläsaren. Returnerar bilden som base64-kodad PNG.',
        input_schema: {
          type: 'object',
          properties: {},
        },
      },
    ];
  }

  /**
   * Kör ett verktyg i Playwright och returnerar resultatet som ett objekt.
   * @param {string} toolName
   * @param {Record<string, any>} input
   */
  async executeTool(toolName, input) {
    const page = this.page;

    switch (toolName) {
      case 'navigate': {
        await page.goto(input.url, { waitUntil: 'domcontentloaded' });
        return { success: true, url: page.url(), title: await page.title() };
      }

      case 'click': {
        // Försök med CSS-selektor först, fall tillbaka på synlig text
        try {
          await page.locator(input.selector).first().click({ timeout: 5000 });
        } catch {
          await page.getByText(input.selector, { exact: false }).first().click({ timeout: 5000 });
        }
        return { success: true };
      }

      case 'fill': {
        await page.locator(input.selector).first().fill(input.value);
        return { success: true };
      }

      case 'press_key': {
        await page.keyboard.press(input.key);
        return { success: true };
      }

      case 'get_text': {
        if (input.selector) {
          const text = await page.locator(input.selector).first().innerText();
          return { text: text.slice(0, 3000) };
        }
        const body = await page.locator('body').innerText();
        return { text: body.slice(0, 3000) };
      }

      case 'screenshot': {
        const buffer = await page.screenshot({ type: 'png', fullPage: false });
        return { image_base64: buffer.toString('base64'), format: 'png' };
      }

      default:
        throw new Error(`Okänt verktyg: ${toolName}`);
    }
  }

  /**
   * Kör agenten med en given uppgift.
   * Loopar tills Claude svarar med end_turn (uppgiften är klar).
   *
   * @param {string} task - Uppgiften i klartext, t.ex. "Sök efter X på google.com"
   * @param {{ maxIterations?: number, model?: string }} [options]
   * @returns {Promise<string>} Agentens slutsvar
   */
  async run(task, options = {}) {
    const { maxIterations = 20, model = 'claude-opus-4-6' } = options;

    /** @type {import('@anthropic-ai/sdk').MessageParam[]} */
    const messages = [{ role: 'user', content: task }];

    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;

      const response = await this.client.messages.create({
        model,
        max_tokens: 4096,
        system:
          'Du är en webbläsaragent. Använd verktygen för att utföra uppgiften. ' +
          'Ta en screenshot när du är osäker på sidans tillstånd. ' +
          'Svara på svenska när uppgiften är klar.',
        tools: this.tools,
        messages,
      });

      // Lägg till agentens svar i historiken
      messages.push({ role: 'assistant', content: response.content });

      // Uppgiften klar — returnera texten
      if (response.stop_reason === 'end_turn') {
        const textBlock = response.content.find((b) => b.type === 'text');
        return textBlock?.text ?? 'Uppgiften slutförd (inget textsvar).';
      }

      // Kör verktygen och skicka resultaten tillbaka
      if (response.stop_reason === 'tool_use') {
        /** @type {import('@anthropic-ai/sdk').ToolResultBlockParam[]} */
        const toolResults = [];

        for (const block of response.content) {
          if (block.type !== 'tool_use') continue;

          let content;
          try {
            const result = await this.executeTool(block.name, block.input);
            content = JSON.stringify(result);
          } catch (err) {
            content = JSON.stringify({ error: String(err) });
          }

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content,
          });
        }

        messages.push({ role: 'user', content: toolResults });
        continue;
      }

      // Oväntat stop_reason
      break;
    }

    throw new Error(`Agenten nådde max antal iterationer (${maxIterations}) utan att slutföra uppgiften.`);
  }
}

module.exports = { PlaywrightAgent };
