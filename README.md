# Playwright Tests

End-to-end tester med [Playwright](https://playwright.dev).

## Kom igång

Installera beroenden:

```bash
npm install
npx playwright install --with-deps chromium
```

## Kör tester

```bash
# Kör alla tester
npm test

# Kör med synlig webbläsare
npm run test:headed

# Visa rapport
npm run test:report
```

## Struktur

```
playwright-tests/    # Testfiler
playwright.config.js # Konfiguration
.github/workflows/   # GitHub Actions (manuell körning)
```

## GitHub Actions

Workflowen `playwright-manual.yml` körs manuellt via **Actions → Playwright Tests (Manual) → Run workflow**.
