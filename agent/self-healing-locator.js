// @ts-check
/**
 * Self-healing locator för Playwright.
 *
 * Idé: Tester går sönder när webbutvecklare ändrar klassnamn, struktur eller
 * id:n. En self-healing locator försöker först med den ursprungliga selektorn.
 * Om den inte hittar något element ber vi en lokal LLM (via Ollama) att
 * föreslå en ny selektor utifrån sidans förenklade DOM och en beskrivning av
 * elementet vi letar efter. Den nya selektorn cachas under testkörningen så
 * att efterföljande anrop går snabbt.
 *
 * Allt resonemang sker lokalt — inget sidinnehåll skickas till externa
 * tjänster. Se ollama-client.js för motiveringen.
 */

const { OllamaClient } = require('./ollama-client');

/**
 * Bygg en bantad version av sidans HTML som är lagom stor för en LLM-prompt.
 * Tar bort <script>, <style>, kommentarer och de flesta attribut som inte
 * hjälper till att identifiera element.
 *
 * @param {import('@playwright/test').Page} page
 * @param {number} maxChars
 * @returns {Promise<string>}
 */
async function snapshotDom(page, maxChars = 8000) {
  return await page.evaluate((limit) => {
    const KEEP_ATTRS = new Set([
      'id', 'name', 'class', 'role', 'type', 'href', 'aria-label',
      'aria-labelledby', 'placeholder', 'title', 'alt', 'for',
      'data-testid', 'data-test', 'data-qa', 'data-cy',
    ]);

    /** @param {Element} el */
    function serialize(el) {
      const tag = el.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'svg') {
        return '';
      }

      const attrs = [];
      for (const attr of Array.from(el.attributes)) {
        if (!KEEP_ATTRS.has(attr.name)) continue;
        let val = attr.value;
        if (attr.name === 'class') val = val.split(/\s+/).slice(0, 4).join(' ');
        if (val.length > 80) val = val.slice(0, 80);
        attrs.push(`${attr.name}="${val.replace(/"/g, '&quot;')}"`);
      }

      const open = attrs.length ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;

      const children = [];
      for (const child of Array.from(el.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          children.push(serialize(/** @type {Element} */ (child)));
        } else if (child.nodeType === Node.TEXT_NODE) {
          const text = (child.textContent || '').trim();
          if (text) children.push(text.length > 80 ? text.slice(0, 80) + '…' : text);
        }
      }

      return `${open}${children.join('')}</${tag}>`;
    }

    const html = serialize(document.body);
    return html.length > limit ? html.slice(0, limit) + '…(trunkerad)' : html;
  }, maxChars);
}

/**
 * Be LLM om en ny selektor när den primära misslyckats.
 *
 * @param {OllamaClient} client
 * @param {string} description - Mänsklig beskrivning av elementet
 * @param {string} failedSelector - Selektorn som inte fungerade
 * @param {string} domSnapshot - Förenklad HTML från sidan
 * @returns {Promise<string>}
 */
async function askLlmForSelector(client, description, failedSelector, domSnapshot) {
  const system =
    'Du är en Playwright-expert. Du får en beskrivning av ett HTML-element och en förenklad ' +
    'kopia av sidans DOM. Returnera EXAKT en JSON med formen {"selector":"...","strategy":"css|text|role"} ' +
    'där selector är en CSS-selektor (helst), eller en synlig text (om strategy="text"), eller en ARIA-role ' +
    '(om strategy="role"). Föreslå inget som inte tydligt finns i den givna DOM:en. Inget annat än JSON.';

  const user =
    `Element jag letar efter: ${description}\n` +
    `Selektor som slutade fungera: ${failedSelector}\n\n` +
    `Förenklad DOM:\n${domSnapshot}`;

  const raw = await client.chat({ system, user, format: 'json', temperature: 0 });

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`LLM returnerade ogiltig JSON: ${raw.slice(0, 200)}`);
  }
  if (!parsed?.selector || typeof parsed.selector !== 'string') {
    throw new Error(`LLM-svaret saknar 'selector': ${raw.slice(0, 200)}`);
  }
  return parsed.strategy === 'text'
    ? `text=${parsed.selector}`
    : parsed.strategy === 'role'
      ? `role=${parsed.selector}`
      : parsed.selector;
}

/**
 * Self-healing locator-wrapper. Skapa en instans per testkörning så att
 * cachen lever under testet men inte läcker mellan tester.
 */
class SelfHealingLocator {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {{ client?: OllamaClient, logger?: (msg: string) => void }} [opts]
   */
  constructor(page, opts = {}) {
    this.page = page;
    this.client = opts.client ?? new OllamaClient();
    this.log = opts.logger ?? ((msg) => console.log(`[self-heal] ${msg}`));
    /** @type {Map<string, string>} */
    this.cache = new Map();
  }

  /**
   * Hitta ett element. Försöker primärselektorn först; vid miss frågar vi
   * LLM:en om en ny selektor.
   *
   * @param {{ primary: string, description: string, timeout?: number }} args
   * @returns {Promise<import('@playwright/test').Locator>}
   */
  async find({ primary, description, timeout = 4000 }) {
    const cached = this.cache.get(description);
    if (cached) {
      const loc = this.page.locator(cached).first();
      if ((await loc.count()) > 0) return loc;
      this.cache.delete(description);
    }

    const primaryLoc = this.page.locator(primary).first();
    try {
      await primaryLoc.waitFor({ state: 'attached', timeout });
      this.cache.set(description, primary);
      return primaryLoc;
    } catch {
      this.log(`Primär selektor "${primary}" misslyckades — frågar LLM om "${description}"`);
    }

    if (!(await this.client.isAvailable())) {
      throw new Error(
        'Self-healing aktiverades men Ollama är inte nåbart. ' +
          'Starta Ollama (https://ollama.com) och kör: ollama pull llama3.1:8b',
      );
    }

    const dom = await snapshotDom(this.page);
    const healed = await askLlmForSelector(this.client, description, primary, dom);
    this.log(`LLM föreslog: ${healed}`);

    const healedLoc = this.page.locator(healed).first();
    await healedLoc.waitFor({ state: 'attached', timeout: timeout + 2000 });
    this.cache.set(description, healed);
    return healedLoc;
  }
}

module.exports = { SelfHealingLocator, snapshotDom };
