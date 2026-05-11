#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const resultsFile = path.join(__dirname, '..', 'test-results', 'results.json');
if (!fs.existsSync(resultsFile)) {
  console.error('No test results found at', resultsFile);
  process.exit(1);
}

const { stats, suites } = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));

// Flatten all tests, grouped under their top-level suite (file)
function collectTests(suiteList, groupMap, fileTitle) {
  for (const suite of suiteList || []) {
    const topTitle = fileTitle || suite.title;
    if (!groupMap[topTitle]) groupMap[topTitle] = [];
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const r = test.results?.[0];
        groupMap[topTitle].push({
          title: spec.title,
          status: test.status,
          duration: r?.duration ?? 0,
          error: (r?.errors?.[0]?.message ?? r?.error?.message ?? '')
            .split('\n').slice(0, 12).join('\n'),
        });
      }
    }
    collectTests(suite.suites, groupMap, topTitle);
  }
}

const groups = {};
collectTests(suites, groups, null);

const durationSec = (stats.duration / 1000).toFixed(1);
const total = stats.expected + stats.unexpected + stats.flaky + stats.skipped;
const allPassed = stats.unexpected === 0 && stats.flaky === 0;
const generatedAt = new Date().toUTCString();

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function statusIcon(s) {
  return { expected: '✅', unexpected: '❌', flaky: '🔁', skipped: '⏭️' }[s] ?? '❓';
}

function statusClass(s) {
  return { expected: 'pass', unexpected: 'fail', flaky: 'flaky', skipped: 'skip' }[s] ?? '';
}

const suiteBlocks = Object.entries(groups).map(([title, tests]) => {
  const fails = tests.filter(t => t.status === 'unexpected').length;
  const passes = tests.filter(t => t.status === 'expected').length;
  const badge = fails > 0
    ? `<span class="badge fail">${fails} failed</span>`
    : `<span class="badge pass">all passed</span>`;

  const rows = tests.map(t => {
    const ms = t.duration > 0 ? `${(t.duration / 1000).toFixed(2)}s` : '';
    const errorBlock = t.error
      ? `<div class="err-block"><pre>${esc(t.error)}</pre></div>`
      : '';
    return `<div class="test-row ${statusClass(t.status)}">
      <div class="test-line">
        <span class="icon">${statusIcon(t.status)}</span>
        <span class="test-title">${esc(t.title)}</span>
        <span class="test-ms">${ms}</span>
      </div>${errorBlock}
    </div>`;
  }).join('');

  return `<details class="suite-card${fails > 0 ? ' suite-fail' : ''}" ${fails > 0 ? 'open' : ''}>
  <summary>
    <span class="suite-title">${esc(title)}</span>
    <span class="suite-meta">${passes}/${tests.length}&nbsp;${badge}</span>
  </summary>
  <div class="test-list">${rows}</div>
</details>`;
}).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>Test Results</title>
<style>
:root {
  --bg: #f2f2f7;
  --card: #ffffff;
  --border: #e5e5ea;
  --text: #1c1c1e;
  --sub: #6c6c70;
  --pass-color: #34c759;
  --fail-color: #ff3b30;
  --flaky-color: #ff9500;
  --skip-color: #8e8e93;
  --pass-bg: #f0faf0;
  --fail-bg: #fff5f5;
  --flaky-bg: #fff8ee;
  --err-bg: #fff0ef;
  --err-border: #ff3b30;
  --err-text: #6b1a1a;
  --radius: 12px;
  --font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --mono: ui-monospace, "SF Mono", Menlo, "Fira Code", monospace;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #1c1c1e;
    --card: #2c2c2e;
    --border: #3a3a3c;
    --text: #f2f2f7;
    --sub: #8e8e93;
    --pass-bg: #0a2e12;
    --fail-bg: #2e0a0a;
    --flaky-bg: #2e1e00;
    --err-bg: #2e0a0a;
    --err-text: #ffb3ae;
  }
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font);
  background: var(--bg);
  color: var(--text);
  padding: 16px;
  padding-bottom: max(16px, env(safe-area-inset-bottom));
  font-size: 16px;
  line-height: 1.45;
}
h1 {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 4px;
}
.meta { font-size: 0.78rem; color: var(--sub); margin-bottom: 16px; }

/* stats */
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
.stat {
  background: var(--card);
  border-radius: var(--radius);
  padding: 14px 8px 10px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
}
.stat .num {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 4px;
}
.stat .lbl {
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--sub);
}
.stat.s-pass .num { color: var(--pass-color); }
.stat.s-fail .num { color: var(--fail-color); }
.stat.s-flaky .num { color: var(--flaky-color); }
.stat.s-skip .num { color: var(--skip-color); }
.stat.s-total .num { color: var(--text); }
.stat.s-dur .num { font-size: 1.35rem; }

/* suite cards */
.suite-card {
  background: var(--card);
  border-radius: var(--radius);
  margin-bottom: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.07);
  overflow: hidden;
}
.suite-card > summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 16px;
  cursor: pointer;
  list-style: none;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
.suite-card > summary::-webkit-details-marker { display: none; }
.suite-card > summary::after {
  content: "›";
  font-size: 1.3rem;
  color: var(--sub);
  flex-shrink: 0;
  transition: transform 0.2s;
}
.suite-card[open] > summary::after { transform: rotate(90deg); }
.suite-fail > summary { background: var(--fail-bg); }
.suite-title {
  font-weight: 600;
  font-size: 0.88rem;
  flex: 1;
  word-break: break-all;
}
.suite-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.78rem;
  color: var(--sub);
  white-space: nowrap;
}
.badge {
  padding: 2px 8px;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 600;
}
.badge.pass { background: var(--pass-bg); color: var(--pass-color); }
.badge.fail { background: var(--fail-bg); color: var(--fail-color); }

/* test rows */
.test-list { border-top: 1px solid var(--border); }
.test-row {
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
}
.test-row:last-child { border-bottom: none; }
.test-row.pass { background: var(--pass-bg); }
.test-row.fail { background: var(--fail-bg); }
.test-row.flaky { background: var(--flaky-bg); }
.test-line {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.icon { flex-shrink: 0; font-size: 1rem; }
.test-title { flex: 1; font-size: 0.88rem; word-break: break-word; }
.test-ms { font-size: 0.72rem; color: var(--sub); white-space: nowrap; padding-top: 2px; }
.err-block {
  margin-top: 8px;
  border-left: 3px solid var(--err-border);
  border-radius: 6px;
  background: var(--err-bg);
  overflow-x: auto;
}
.err-block pre {
  padding: 8px 10px;
  font-family: var(--mono);
  font-size: 0.7rem;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--err-text);
}
.footer {
  text-align: center;
  font-size: 0.72rem;
  color: var(--sub);
  margin-top: 20px;
  padding-bottom: 8px;
}
@media (max-width: 360px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .stat .num { font-size: 1.6rem; }
}
</style>
</head>
<body>
<h1>${allPassed ? '✅' : '❌'} Test Results</h1>
<p class="meta">Generated ${generatedAt}</p>

<div class="stats">
  <div class="stat s-pass">
    <span class="num">${stats.expected}</span>
    <span class="lbl">Passed</span>
  </div>
  <div class="stat s-fail">
    <span class="num">${stats.unexpected}</span>
    <span class="lbl">Failed</span>
  </div>
  <div class="stat s-flaky">
    <span class="num">${stats.flaky}</span>
    <span class="lbl">Flaky</span>
  </div>
  <div class="stat s-skip">
    <span class="num">${stats.skipped}</span>
    <span class="lbl">Skipped</span>
  </div>
  <div class="stat s-total">
    <span class="num">${total}</span>
    <span class="lbl">Total</span>
  </div>
  <div class="stat s-dur">
    <span class="num">${durationSec}s</span>
    <span class="lbl">Duration</span>
  </div>
</div>

${suiteBlocks}

<p class="footer">Playwright Test Results &mdash; ${generatedAt}</p>
</body>
</html>`;

const outFile = path.join(__dirname, '..', 'mobile-report.html');
fs.writeFileSync(outFile, html, 'utf-8');
console.log(`Mobile report written to ${outFile}`);
