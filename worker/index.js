export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/html; charset=utf-8',
    };

    // Ping endpoint: /p?a={app}&d={device}&e={env}
    if (path === '/p') {
      const app = url.searchParams.get('a');
      const device = url.searchParams.get('d');
      const env_type = url.searchParams.get('e') || 'prod';

      if (!app || !device) {
        return new Response('missing params', { status: 400, headers });
      }

      const date = new Date().toISOString().slice(0, 10);

      env.ANALYTICS.writeDataPoint({
        indexes: [date],
        blobs: [device, app, env_type],
      });

      return new Response('ok', { status: 200, headers });
    }

    // Stats page: /{bundle_id}
    // Exclude only actual static file extensions
    const staticExt = /\.(js|css|html|ico|png|jpg|svg|woff|woff2|ttf|map)$/i;
    if (path.length > 1 && !staticExt.test(path)) {
      const bundleId = path.slice(1);
      const envFilter = url.searchParams.get('env') || 'prod';

      try {
        const stats = await queryStats(env, bundleId, envFilter);
        const html = renderStatsPage(bundleId, envFilter, stats);
        return new Response(html, { status: 200, headers });
      } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500, headers });
      }
    }

    // Home page
    if (path === '/') {
      return new Response(renderHomePage(), { status: 200, headers });
    }

    return new Response('not found', { status: 404, headers });
  },
};

async function queryStats(env, bundleId, envFilter) {
  // Query via Cloudflare Analytics Engine SQL API
  // Use toDate(timestamp) for date grouping since index1 may not be typed yet
  const query = `
    SELECT
      toDate(timestamp) as date,
      COUNT(DISTINCT blob1) as devices
    FROM heartbeat
    WHERE blob2 = '${bundleId}'
      AND blob3 = '${envFilter}'
    GROUP BY date
    ORDER BY date DESC
    LIMIT 90
  `;

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.CF_API_TOKEN}`,
        'Content-Type': 'text/plain',
      },
      body: query,
    }
  );

  const result = await response.json();

  // Handle API errors or empty data gracefully
  if (!response.ok || result.errors?.length > 0) {
    console.log('Analytics query failed:', JSON.stringify(result));
    return []; // Return empty, show "no data yet"
  }

  // Transform response: {data: [[date, count], ...]} → [{date, devices}, ...]
  if (result.data && result.data.length > 0) {
    return result.data.map(row => ({
      date: row[0],
      devices: row[1],
    }));
  }

  return [];
}

function renderHomePage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Heartbeat</title>
  <style>${getStyles()}</style>
</head>
<body>
  <div class="container">
    <h1>Heartbeat</h1>
    <p>Zero-config device tracking for iOS apps.</p>
    <pre><code>import Heartbeat

Heartbeat.ping()</code></pre>
    <p>View stats at: <code>heartbeat.work/{your.bundle.id}</code></p>
    <p><a href="https://github.com/maierru/heartbeat-tracker">GitHub</a></p>
  </div>
</body>
</html>`;
}

function renderStatsPage(bundleId, envFilter, stats) {
  const maxDevices = Math.max(...stats.map(s => s.devices), 1);

  const rows = stats.length > 0 ? stats.map(row => {
    const barWidth = Math.round((row.devices / maxDevices) * 100);
    return `
      <tr>
        <td class="date">${row.date}</td>
        <td class="bar-cell">
          <div class="bar" style="width: ${barWidth}%"></div>
          <span class="count">${row.devices}</span>
        </td>
      </tr>`;
  }).join('') : '<tr><td colspan="2" class="empty">No data yet. Integrate the library and ping will appear here.</td></tr>';

  const total = stats.reduce((sum, r) => sum + r.devices, 0);
  const avg = stats.length ? Math.round(total / stats.length) : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${bundleId} - Heartbeat</title>
  <style>${getStyles()}</style>
</head>
<body>
  <div class="container">
    <h1>${bundleId}</h1>
    <div class="filters">
      <a href="?env=prod" class="${envFilter === 'prod' ? 'active' : ''}">prod</a>
      <a href="?env=dev" class="${envFilter === 'dev' ? 'active' : ''}">dev</a>
    </div>
    <div class="summary">
      <span>Avg: <strong>${avg}</strong>/day</span>
      <span>Days: <strong>${stats.length}</strong></span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Unique Devices</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <p class="footer"><a href="/">heartbeat.work</a></p>
  </div>
</body>
</html>`;
}

function getStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, system-ui, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      padding: 2rem;
      min-height: 100vh;
    }
    .container { max-width: 600px; margin: 0 auto; }
    h1 {
      font-size: 1.5rem;
      margin-bottom: 1rem;
      font-weight: 600;
      word-break: break-all;
    }
    p { margin: 0.5rem 0; color: #888; }
    a { color: #3b82f6; text-decoration: none; }
    a:hover { text-decoration: underline; }
    pre {
      background: #1a1a1a;
      padding: 1rem;
      border-radius: 8px;
      margin: 1rem 0;
      overflow-x: auto;
    }
    code { font-family: 'SF Mono', Menlo, monospace; font-size: 0.9rem; }
    .filters {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .filters a {
      padding: 0.25rem 0.75rem;
      background: #1a1a1a;
      border-radius: 4px;
      color: #888;
    }
    .filters a.active {
      background: #3b82f6;
      color: #fff;
    }
    .summary {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 1rem;
      color: #888;
    }
    .summary strong { color: #e5e5e5; }
    table { width: 100%; border-collapse: collapse; }
    th, td {
      padding: 0.5rem;
      text-align: left;
      border-bottom: 1px solid #222;
    }
    th { color: #888; font-weight: 500; font-size: 0.85rem; }
    .date { width: 120px; font-variant-numeric: tabular-nums; }
    .bar-cell { position: relative; }
    .bar {
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      height: 20px;
      background: #3b82f6;
      opacity: 0.3;
      border-radius: 2px;
    }
    .count {
      position: relative;
      font-variant-numeric: tabular-nums;
    }
    .empty {
      color: #666;
      text-align: center;
      padding: 2rem !important;
    }
    .footer { margin-top: 2rem; font-size: 0.85rem; }
  `;
}
