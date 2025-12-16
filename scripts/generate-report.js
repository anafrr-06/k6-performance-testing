#!/usr/bin/env node

/**
 * HTML Report Generator for k6 Test Results
 *
 * Reads JSON summary files and generates a visual HTML report.
 *
 * Usage: node scripts/generate-report.js [summary-file.json]
 */

const fs = require('fs');
const path = require('path');

const summaryFile = process.argv[2] || 'reports/baseline-summary.json';

function generateReport(summaryPath) {
  if (!fs.existsSync(summaryPath)) {
    console.error(`Summary file not found: ${summaryPath}`);
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  const testName = path.basename(summaryPath, '-summary.json');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>k6 Performance Report - ${testName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 20px; }
    .summary-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .card h3 { color: #666; font-size: 14px; margin-bottom: 8px; }
    .card .value { font-size: 32px; font-weight: bold; color: #333; }
    .card .value.success { color: #22c55e; }
    .card .value.warning { color: #f59e0b; }
    .card .value.error { color: #ef4444; }
    .metrics-table { background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; color: #666; }
    tr:hover { background: #f8f9fa; }
    .threshold { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
    .threshold.pass { background: #dcfce7; color: #166534; }
    .threshold.fail { background: #fee2e2; color: #991b1b; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #333; margin-bottom: 15px; font-size: 18px; }
    .checks-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; }
    .check-item { background: white; border-radius: 8px; padding: 15px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .check-item .name { font-weight: 600; margin-bottom: 5px; }
    .check-item .stats { color: #666; font-size: 14px; }
    .pass-rate { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 10px; }
    .pass-rate.full { background: #dcfce7; color: #166534; }
    .pass-rate.partial { background: #fef3c7; color: #92400e; }
    .pass-rate.none { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 k6 Performance Report: ${testName}</h1>
    <p style="color: #666; margin-bottom: 30px;">Generated: ${new Date().toLocaleString()}</p>

    <div class="summary-cards">
      ${generateSummaryCards(summary)}
    </div>

    <div class="section">
      <h2>📊 HTTP Metrics</h2>
      <div class="metrics-table">
        <table>
          <thead>
            <tr>
              <th>Metric</th>
              <th>Avg</th>
              <th>Min</th>
              <th>Med</th>
              <th>Max</th>
              <th>P90</th>
              <th>P95</th>
              <th>Thresholds</th>
            </tr>
          </thead>
          <tbody>
            ${generateMetricsRows(summary)}
          </tbody>
        </table>
      </div>
    </div>

    ${generateChecksSection(summary)}
  </div>
</body>
</html>`;

  const outputPath = summaryPath.replace('.json', '.html');
  fs.writeFileSync(outputPath, html);
  console.log(`Report generated: ${outputPath}`);
}

function generateSummaryCards(summary) {
  const metrics = summary.metrics || {};
  const state = summary.state || {};

  const cards = [];

  // Duration
  const duration = state.testRunDurationMs ? (state.testRunDurationMs / 1000).toFixed(1) : 'N/A';
  cards.push(`<div class="card"><h3>Test Duration</h3><div class="value">${duration}s</div></div>`);

  // Total Requests
  const reqs = metrics.http_reqs?.values?.count || 0;
  cards.push(`<div class="card"><h3>Total Requests</h3><div class="value">${reqs}</div></div>`);

  // Request Rate
  const rate = metrics.http_reqs?.values?.rate?.toFixed(2) || '0';
  cards.push(`<div class="card"><h3>Requests/sec</h3><div class="value">${rate}</div></div>`);

  // Avg Response Time
  const avgDuration = metrics.http_req_duration?.values?.avg?.toFixed(2) || '0';
  const durationClass = avgDuration < 200 ? 'success' : avgDuration < 500 ? 'warning' : 'error';
  cards.push(`<div class="card"><h3>Avg Response Time</h3><div class="value ${durationClass}">${avgDuration}ms</div></div>`);

  // P95 Response Time
  const p95 = metrics.http_req_duration?.values?.['p(95)']?.toFixed(2) || '0';
  const p95Class = p95 < 500 ? 'success' : p95 < 1000 ? 'warning' : 'error';
  cards.push(`<div class="card"><h3>P95 Response Time</h3><div class="value ${p95Class}">${p95}ms</div></div>`);

  // Error Rate
  const errorRate = metrics.http_req_failed?.values?.rate || 0;
  const errorPct = (errorRate * 100).toFixed(2);
  const errorClass = errorRate < 0.01 ? 'success' : errorRate < 0.05 ? 'warning' : 'error';
  cards.push(`<div class="card"><h3>Error Rate</h3><div class="value ${errorClass}">${errorPct}%</div></div>`);

  return cards.join('\\n');
}

function generateMetricsRows(summary) {
  const metrics = summary.metrics || {};
  const rows = [];

  const httpMetrics = Object.entries(metrics)
    .filter(([name]) => name.startsWith('http_req_duration'))
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [name, data] of httpMetrics) {
    if (data.type !== 'trend') continue;

    const values = data.values || {};
    const thresholds = data.thresholds || {};

    let thresholdHtml = '';
    for (const [th, result] of Object.entries(thresholds)) {
      const cls = result.ok ? 'pass' : 'fail';
      thresholdHtml += \`<span class="threshold \${cls}">\${th}</span> \`;
    }

    rows.push(\`
      <tr>
        <td>\${name}</td>
        <td>\${values.avg?.toFixed(2) || '-'}ms</td>
        <td>\${values.min?.toFixed(2) || '-'}ms</td>
        <td>\${values.med?.toFixed(2) || '-'}ms</td>
        <td>\${values.max?.toFixed(2) || '-'}ms</td>
        <td>\${values['p(90)']?.toFixed(2) || '-'}ms</td>
        <td>\${values['p(95)']?.toFixed(2) || '-'}ms</td>
        <td>\${thresholdHtml || '-'}</td>
      </tr>
    \`);
  }

  return rows.join('\\n');
}

function generateChecksSection(summary) {
  const rootGroup = summary.root_group;
  if (!rootGroup) return '';

  const allChecks = [];

  function collectChecks(group) {
    if (group.checks) {
      allChecks.push(...group.checks);
    }
    if (group.groups) {
      group.groups.forEach(collectChecks);
    }
  }

  collectChecks(rootGroup);

  if (allChecks.length === 0) return '';

  const checksHtml = allChecks.map(check => {
    const total = check.passes + check.fails;
    const rate = total > 0 ? (check.passes / total * 100) : 0;
    const rateClass = rate === 100 ? 'full' : rate > 0 ? 'partial' : 'none';

    return \`
      <div class="check-item">
        <div class="name">
          \${check.name}
          <span class="pass-rate \${rateClass}">\${rate.toFixed(0)}%</span>
        </div>
        <div class="stats">✅ \${check.passes} passed | ❌ \${check.fails} failed</div>
      </div>
    \`;
  }).join('\\n');

  return \`
    <div class="section">
      <h2>✅ Checks</h2>
      <div class="checks-grid">
        \${checksHtml}
      </div>
    </div>
  \`;
}

generateReport(summaryFile);
