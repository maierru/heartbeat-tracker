export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'text/html; charset=utf-8',
    };

    // Ping endpoint: /p?a={app}&d={device}&e={env}&v={version}
    if (path === '/p') {
      const app = url.searchParams.get('a');
      const device = url.searchParams.get('d');
      const env_type = url.searchParams.get('e') || 'prod';
      const version = url.searchParams.get('v') || '?';

      if (!app || !device) {
        return new Response('missing params', { status: 400, headers });
      }

      const date = new Date().toISOString().slice(0, 10);

      env.ANALYTICS.writeDataPoint({
        indexes: [date],
        blobs: [device, app, env_type, version],
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
        const [stats, versions] = await Promise.all([
          queryStats(env, bundleId, envFilter),
          queryVersions(env, bundleId, envFilter)
        ]);
        const html = renderStatsPage(bundleId, envFilter, stats, versions);
        return new Response(html, { status: 200, headers });
      } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500, headers });
      }
    }

    // Home page
    if (path === '/') {
      const apps = await queryApps(env);
      return new Response(renderHomePage(apps), { status: 200, headers });
    }

    return new Response('not found', { status: 404, headers });
  },
};

async function queryApps(env) {
  const today = new Date().toISOString().slice(0, 10);
  const query = `
    SELECT
      blob2 as app,
      COUNT(DISTINCT blob1) as devices
    FROM heartbeat
    WHERE toDate(timestamp) = '${today}'
      AND blob3 = 'prod'
    GROUP BY app
    ORDER BY devices DESC
    LIMIT 50
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
  if (!response.ok || result.errors?.length > 0) {
    return [];
  }

  if (result.data && result.data.length > 0) {
    return result.data.map(row => {
      if (Array.isArray(row)) {
        return { app: row[0], devices: row[1] };
      }
      return { app: row.app, devices: parseInt(row.devices || 0, 10) };
    });
  }
  return [];
}

async function queryVersions(env, bundleId, envFilter) {
  const query = `
    SELECT
      blob4 as version,
      COUNT(DISTINCT blob1) as devices
    FROM heartbeat
    WHERE blob2 = '${bundleId}'
      AND blob3 = '${envFilter}'
    GROUP BY version
    ORDER BY devices DESC
    LIMIT 10
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
  if (!response.ok || result.errors?.length > 0) {
    return [];
  }

  if (result.data && result.data.length > 0) {
    return result.data.map(row => {
      if (Array.isArray(row)) {
        return { version: row[0] || '?', devices: row[1] };
      }
      return { version: row.version || '?', devices: parseInt(row.devices || 0, 10) };
    });
  }
  return [];
}

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

  // Transform response - handle both array and object formats
  if (result.data && result.data.length > 0) {
    return result.data.map(row => {
      // Array format: [date, count]
      if (Array.isArray(row)) {
        return { date: row[0], devices: row[1] };
      }
      // Object format: {date: "...", devices: N}
      return {
        date: row.date || row[0],
        devices: parseInt(row.devices || row[1] || 0, 10)
      };
    });
  }

  return [];
}

function renderHomePage(apps) {
  const today = new Date().toISOString().slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];

  const appsList = apps.length > 0
    ? apps.map((a, i) => {
        const rank = i < 3 ? medals[i] : `${i + 1}.`;
        return `<li><span class="rank">${rank}</span> <a href="/${a.app}">${a.app}</a> <span class="device-count">${a.devices}</span></li>`;
      }).join('')
    : '<li class="empty">No activity today yet</li>';

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
    <p><a href="https://github.com/maierru/heartbeat-tracker">GitHub</a></p>

    <h2>Leaderboard <span class="date-badge">${today}</span></h2>
    <ul class="apps-list">
      ${appsList}
    </ul>
  </div>
</body>
</html>`;
}

function renderStatsPage(bundleId, envFilter, stats, versions = []) {
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

  const versionList = versions.length > 0
    ? versions.map(v => `<span class="version-tag">${v.version} <small>(${v.devices})</small></span>`).join(' ')
    : '<span class="empty">No version data</span>';

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
    <div class="versions">
      <span class="label">Versions:</span> ${versionList}
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
    h2 { font-size: 1.1rem; margin-top: 2rem; margin-bottom: 0.5rem; color: #888; display: flex; align-items: center; gap: 0.5rem; }
    .date-badge { font-size: 0.75rem; background: #222; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: normal; }
    .apps-list { list-style: none; }
    .apps-list li { padding: 0.75rem 0; border-bottom: 1px solid #222; display: flex; align-items: center; gap: 0.5rem; }
    .apps-list li a { font-family: 'SF Mono', Menlo, monospace; flex: 1; }
    .rank { width: 2rem; text-align: center; }
    .device-count { color: #3b82f6; font-weight: 600; font-variant-numeric: tabular-nums; }
    .versions { margin-bottom: 1rem; color: #888; }
    .versions .label { margin-right: 0.5rem; }
    .version-tag { background: #1a1a1a; padding: 0.2rem 0.5rem; border-radius: 4px; margin-right: 0.5rem; font-family: 'SF Mono', Menlo, monospace; font-size: 0.85rem; }
    .version-tag small { color: #666; }
  `;
}
