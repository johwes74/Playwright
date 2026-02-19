# Playwright Tests

End-to-end tester med [Playwright](https://playwright.dev), inklusive en Claude-driven webbläsaragent.

## Kom igång

```bash
npm install
npx playwright install --with-deps chromium
```

## Kör tester

```bash
# Vanliga tester
npm test

# Agentdrivna tester (kräver API-nyckel)
ANTHROPIC_API_KEY=sk-... npm run test:agent

# Kör med synlig webbläsare
npm run test:headed

# Visa HTML-rapport
npm run test:report
```

## Struktur

```
agent/
  playwright-agent.js      # Claude-driven webbläsaragent
playwright-tests/
  google-search.spec.js    # Vanliga Playwright-tester
  agent-search.spec.js     # Agentdrivna tester
playwright.config.js       # Konfiguration
.github/workflows/
  playwright-manual.yml    # Manuell GitHub Actions-körning
```

## Hur agenten fungerar

```
Uppgift (text)
     │
     ▼
┌──────────────────────────────────────────┐
│              PlaywrightAgent             │
│                                          │
│  while not done:                         │
│    1. Skicka konversation → Claude       │
│    2. Claude väljer verktyg + argument   │
│    3. Kör verktyg i Playwright           │
│    4. Skicka tillbaka resultatet         │
│                                          │
│  Tillgängliga verktyg:                   │
│   • navigate  – gå till URL             │
│   • click     – klicka på element       │
│   • fill      – fyll i textfält         │
│   • press_key – tryck tangent (Enter…)  │
│   • get_text  – läs sidans text         │
│   • screenshot – ta skärmbild           │
└──────────────────────────────────────────┘
     │
     ▼
Slutsvar (text)
```

### Exempel

```js
const { PlaywrightAgent } = require('./agent/playwright-agent');

const agent = new PlaywrightAgent(page); // Playwright Page-objekt

const result = await agent.run(
  'Gå till https://example.com och berätta vad rubriken på sidan är.'
);
console.log(result); // "Rubriken på sidan är: Example Domain"
```

Agenten avslutar automatiskt när Claude bedömer att uppgiften är klar (`stop_reason: end_turn`).

## GitHub Actions

Workflowen `playwright-manual.yml` körs manuellt via:
**Actions → Playwright Tests (Manual) → Run workflow**

> **OBS:** För agenttest i CI, lägg till `ANTHROPIC_API_KEY` som GitHub Secret och skicka med den som miljövariabel i workflow-filen.
