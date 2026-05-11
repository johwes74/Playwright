#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const resultsFile = path.join(__dirname, '..', 'test-results', 'results.json');
if (!fs.existsSync(resultsFile)) {
  console.error('No test results found at', resultsFile);
  process.exit(1);
}

const results = JSON.parse(fs.readFileSync(resultsFile, 'utf-8'));
const { stats, suites } = results;

const durationSec = (stats.duration / 1000).toFixed(1);
const total = stats.expected + stats.unexpected + stats.flaky + stats.skipped;
const allPassed = stats.unexpected === 0 && stats.flaky === 0;
const statusIcon = allPassed ? '✅' : '❌';

let md = `## ${statusIcon} Playwright Test Results\n\n`;
md += `| | Count |\n|---|---|\n`;
md += `| ✅ Passed | ${stats.expected} |\n`;
md += `| ❌ Failed | ${stats.unexpected} |\n`;
md += `| 🔁 Flaky  | ${stats.flaky} |\n`;
md += `| ⏭️ Skipped | ${stats.skipped} |\n`;
md += `| 📋 Total  | ${total} |\n`;
md += `| ⏱️ Duration | ${durationSec}s |\n\n`;

// Collect all tests recursively
const failed = [];
const flaky = [];

function walk(suiteList, ancestors) {
  for (const suite of suiteList || []) {
    const breadcrumb = ancestors ? `${ancestors} › ${suite.title}` : suite.title;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const label = `${breadcrumb} › ${spec.title}`;
        const result = test.results?.[0];
        const errorMsg = result?.errors?.[0]?.message ?? result?.error?.message ?? '';
        if (test.status === 'unexpected') {
          failed.push({ label, errorMsg });
        } else if (test.status === 'flaky') {
          flaky.push({ label, errorMsg });
        }
      }
    }
    walk(suite.suites, breadcrumb);
  }
}

walk(suites, '');

if (failed.length > 0) {
  md += `### Failed Tests\n\n`;
  for (const t of failed) {
    md += `<details><summary>❌ ${t.label}</summary>\n\n`;
    if (t.errorMsg) {
      const snippet = t.errorMsg.split('\n').slice(0, 6).join('\n');
      md += `\`\`\`\n${snippet}\n\`\`\`\n`;
    }
    md += `</details>\n\n`;
  }
}

if (flaky.length > 0) {
  md += `### Flaky Tests\n\n`;
  for (const t of flaky) {
    md += `- 🔁 ${t.label}\n`;
  }
  md += '\n';
}

// All test results grouped by top-level suite (file)
const allTests = [];
function walkAll(suiteList, ancestors) {
  for (const suite of suiteList || []) {
    const breadcrumb = ancestors ? `${ancestors} › ${suite.title}` : suite.title;
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        const result = test.results?.[0];
        const duration = result?.duration ?? 0;
        const icon = { expected: '✅', unexpected: '❌', flaky: '🔁', skipped: '⏭️' }[test.status] ?? '❓';
        allTests.push({ file: ancestors || suite.title, label: spec.title, icon, duration });
      }
    }
    walkAll(suite.suites, breadcrumb);
  }
}
walkAll(suites, '');

// Group by file (first path segment)
const byFile = {};
for (const t of allTests) {
  const key = t.file.split(' › ')[0] || t.file;
  if (!byFile[key]) byFile[key] = [];
  byFile[key].push(t);
}

if (Object.keys(byFile).length > 0) {
  md += `### All Tests\n\n`;
  for (const [file, tests] of Object.entries(byFile)) {
    const passCount = tests.filter(t => t.icon === '✅').length;
    const failCount = tests.filter(t => t.icon === '❌').length;
    const summary = failCount > 0
      ? `${passCount}/${tests.length} passed — ${failCount} failed`
      : `${passCount}/${tests.length} passed`;
    md += `<details><summary><strong>${file}</strong> &nbsp; ${summary}</summary>\n\n`;
    for (const t of tests) {
      const ms = t.duration > 0 ? ` _(${(t.duration / 1000).toFixed(2)}s)_` : '';
      md += `- ${t.icon} ${t.label}${ms}\n`;
    }
    md += `\n</details>\n\n`;
  }
}

const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (summaryFile) {
  fs.appendFileSync(summaryFile, md);
  console.log('Summary written to GITHUB_STEP_SUMMARY');
} else {
  // Local preview
  console.log(md);
}
