import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseCveData, processCveAlerts, detectTrendingVulnerabilities, processTrendingAlerts, syncBotProfileAndCommands } from './src/index.js';

// Auto-load .env file if present
if (fs.existsSync('.env')) {
  try {
    if (typeof process.loadEnvFile === 'function') {
      process.loadEnvFile('.env');
    } else {
      const envConfig = fs.readFileSync('.env', 'utf-8');
      for (const line of envConfig.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const [key, ...valueParts] = trimmed.split('=');
          const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
          const k = key.trim();
          if (k && !process.env[k]) {
            process.env[k] = val;
          }
        }
      }
    }
  } catch (err) {
    // Ignore .env parse errors
  }
}

const PORT = process.env.PORT || 8787;

/**
 * High-performance SQLite query engine:
 * Queries data/cves.db directly using parameterized SQL with index acceleration.
 */
function queryLocalCvesOnDemand(filters = {}) {
  const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
  if (fs.existsSync(dbPath)) {
    try {
      const db = new DatabaseSync(dbPath);
      let querySql = 'SELECT data FROM cves WHERE 1=1';
      const params = [];

      if (filters.severity && filters.severity !== 'ALL') {
        querySql += ' AND severity = ?';
        params.push(filters.severity.toUpperCase());
      }

      if (filters.days && filters.days !== 'all') {
        const daysNum = parseInt(filters.days, 10);
        if (!isNaN(daysNum)) {
          const cutoffDate = new Date(Date.now() - daysNum * 86400000).toISOString();
          querySql += ' AND published >= ?';
          params.push(cutoffDate);
        }
      }

      if (filters.weakness && filters.weakness !== 'all') {
        querySql += ' AND (categories LIKE ? OR bug_types LIKE ?)';
        params.push(`%${filters.weakness}%`, `%${filters.weakness}%`);
      }

      if (filters.q) {
        const searchPattern = `%${filters.q}%`;
        querySql += ' AND (id LIKE ? OR description LIKE ? OR affected_software LIKE ? OR categories LIKE ?)';
        params.push(searchPattern, searchPattern, searchPattern, searchPattern);
      }

      querySql += ' ORDER BY published DESC, id DESC LIMIT ?';
      params.push(Math.min(parseInt(filters.limit || '50', 10), 100));

      const rows = db.prepare(querySql).all(...params);
      db.close();

      const results = rows.map(r => {
        try {
          return typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        } catch (e) {
          return null;
        }
      }).filter(Boolean);

      return {
        count: results.length,
        vulnerabilities: results
      };
    } catch (err) {
      console.error('Failed to query local SQLite database:', err);
    }
  }

  return {
    count: 0,
    vulnerabilities: []
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const reqPath = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Service status (GET /)
  if (reqPath === '/' && req.method === 'GET' && !url.searchParams.has('trigger')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ok: true,
      service: 'cve-telegram-notifier',
      interface: 'telegram',
      bot: '@chsbrbot',
      status: 'operational',
      time: new Date().toISOString()
    }));
    return;
  }

  // 1.1 Bot Profile & Commands Synchronization (GET or POST /api/setup-bot)
  if (reqPath === '/api/setup-bot' || reqPath === '/setup-bot') {
    try {
      const env = {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN
      };
      const result = await syncBotProfileAndCommands(env);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, result }));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
      return;
    }
  }

  // 2. Single CVE direct lookup (GET /api/cves/:id)
  if (reqPath.startsWith('/api/cves/') && reqPath.length > 10 && req.method === 'GET') {
    const cveId = reqPath.split('/')[3];
    const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
    if (cveId && fs.existsSync(dbPath)) {
      try {
        const db = new DatabaseSync(dbPath);
        const row = db.prepare('SELECT data FROM cves WHERE id = ?').get(cveId);
        db.close();
        if (row && row.data) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(row.data);
          return;
        }
      } catch (e) {}
    }
  }

  // 3. Serve Vulnerabilities API (GET /api/cves)
  if (reqPath === '/api/cves' && req.method === 'GET') {
    try {
      const filters = {
        q: url.searchParams.get('q'),
        weakness: url.searchParams.get('weakness') || url.searchParams.get('cwe'),
        severity: url.searchParams.get('severity'),
        days: url.searchParams.get('days'),
        limit: url.searchParams.get('limit') || '50'
      };

      const data = queryLocalCvesOnDemand(filters);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        source: 'local_sqlite_db',
        count: data.count,
        vulnerabilities: data.vulnerabilities
      }));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // 3. Serve Trending Vulnerabilities API (GET /api/trending)
  if (reqPath === '/api/trending' && req.method === 'GET') {
    try {
      const env = {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
        NVD_API_KEY: process.env.NVD_API_KEY,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        MIN_EPSS_SCORE: process.env.MIN_EPSS_SCORE || 0.15
      };
      const minEpss = url.searchParams.get('min_epss') ? parseFloat(url.searchParams.get('min_epss')) : undefined;
      const kevDays = url.searchParams.get('days') ? parseInt(url.searchParams.get('days'), 10) : undefined;
      const trending = await detectTrendingVulnerabilities(env, { minEpss, kevDays });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        count: trending.length,
        vulnerabilities: trending
      }));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // 4. Manual Telegram Alert Trigger (POST or GET /api/trigger)
  if (reqPath === '/trigger' || reqPath === '/api/trigger' || url.searchParams.has('trigger')) {
    try {
      const env = {
        TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
        TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
        NVD_API_KEY: process.env.NVD_API_KEY,
        GITHUB_TOKEN: process.env.GITHUB_TOKEN,
        MIN_CVSS_SCORE: process.env.MIN_CVSS_SCORE || 6.5,
        MIN_EPSS_SCORE: process.env.MIN_EPSS_SCORE || 0.15
      };
      const type = (url.searchParams.get('type') || '').toLowerCase();
      let result;
      if (type === 'trending') {
        result = await processTrendingAlerts(env);
      } else if (type === 'new') {
        result = await processCveAlerts(env);
      } else {
        const [newResult, trendingResult] = await Promise.all([
          processCveAlerts(env),
          processTrendingAlerts(env)
        ]);
        result = { newCves: newResult, trendingCves: trendingResult };
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
      return;
    }
  }

  // Fallback: JSON status
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ok: true,
    service: 'cve-telegram-notifier',
    interface: 'telegram',
    bot: '@chsbrbot',
    status: 'operational'
  }));
});

server.listen(PORT, () => {
  console.log(`\n🚀 CVE Telegram Bot Service running on port ${PORT}`);
  console.log(`⚡ Telegram interface active (@chsbrbot)`);
});
