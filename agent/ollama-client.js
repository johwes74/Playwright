// @ts-check
/**
 * Minimal HTTP-klient för Ollama (https://ollama.com).
 *
 * Varför Ollama? Ollama kör öppen källkods-LLM:er (Llama 3.1, Mistral, Qwen,
 * Gemma m.fl.) lokalt över HTTP. Eftersom modellen körs på din egen maskin
 * skickas inga prompts eller sidinnehåll till någon extern tjänst — det är
 * det säkrare valet för t.ex. inloggade banksessioner.
 *
 * Förvald modell: llama3.1:8b. Hämta den med:
 *   ollama pull llama3.1:8b
 *
 * Installera Ollama: https://ollama.com/download
 */

const DEFAULT_HOST = process.env.OLLAMA_HOST || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

class OllamaClient {
  /**
   * @param {{ host?: string, model?: string }} [opts]
   */
  constructor(opts = {}) {
    this.host = opts.host ?? DEFAULT_HOST;
    this.model = opts.model ?? DEFAULT_MODEL;
  }

  /** Returnerar true om Ollama-servern svarar. */
  async isAvailable() {
    try {
      const res = await fetch(`${this.host}/api/tags`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Skicka ett chat-meddelande och få tillbaka modellens textsvar.
   *
   * @param {{ system?: string, user: string, format?: 'json', temperature?: number }} args
   * @returns {Promise<string>}
   */
  async chat({ system, user, format, temperature = 0 }) {
    const messages = [];
    if (system) messages.push({ role: 'system', content: system });
    messages.push({ role: 'user', content: user });

    const body = {
      model: this.model,
      messages,
      stream: false,
      options: { temperature },
    };
    if (format) body.format = format;

    const res = await fetch(`${this.host}/api/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Ollama HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    return data?.message?.content ?? '';
  }
}

module.exports = { OllamaClient, DEFAULT_HOST, DEFAULT_MODEL };
