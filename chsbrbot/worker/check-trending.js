import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { detectTrendingVulnerabilities, sendTrendingTelegramNotification } from './src/index.js';

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

// Parse CLI flags
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || args.includes('--no-telegram');
const limitArgIdx = args.indexOf('--limit');
const limit = limitArgIdx !== -1 && args[limitArgIdx + 1] ? parseInt(args[limitArgIdx + 1], 10) : 50;
const epssArgIdx = args.indexOf('--min-epss');
const minEpss = epssArgIdx !== -1 && args[epssArgIdx + 1] ? parseFloat(args[epssArgIdx + 1]) : parseFloat(process.env.MIN_EPSS_SCORE || '0.15');
const daysArgIdx = args.indexOf('--days');
const kevDays = daysArgIdx !== -1 && args[daysArgIdx + 1] ? parseInt(args[daysArgIdx + 1], 10) : 30;

async function runTrendingCheck() {
  console.log('====================================================');
  console.log('🔥 CVE Trending Vulnerabilities Intelligence Scanner');
  console.log('====================================================');
  console.log(`• Mode: ${isDryRun ? 'DRY-RUN (Telegram alerts suppressed)' : 'LIVE (Alerts enabled)'}`);
  console.log(`• CISA KEV Lookback: ${kevDays} days`);
  console.log(`• Minimum EPSS Threshold: ${(minEpss * 100).toFixed(1)}%`);
  console.log(`• Candidate Limit: ${limit}`);
  if (process.env.GITHUB_TOKEN) {
    console.log('• GitHub Auth: Token active (5,000 req/hr quota)');
  } else {
    console.log('• GitHub Auth: Anonymous (Tip: add GITHUB_TOKEN to .env for higher rate limits)');
  }
  console.log('----------------------------------------------------\n');

  const env = {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    NVD_API_KEY: process.env.NVD_API_KEY,
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    MIN_EPSS_SCORE: minEpss
  };

  // Read local notified tracking list from SQLite database
  const notifiedSet = new Set();
  const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
  let localDb = null;

  if (fs.existsSync(dbPath)) {
    try {
      localDb = new DatabaseSync(dbPath);
      const rows = localDb.prepare("SELECT cve_id FROM notified_alerts WHERE alert_type = 'trending'").all();
      for (const r of rows) notifiedSet.add(r.cve_id);
    } catch (e) {}
  }

  // Fallback to legacy state file if any
  const stateFile = path.resolve(process.cwd(), '.notified_trending.json');
  if (fs.existsSync(stateFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
      if (Array.isArray(data)) {
        for (const id of data) notifiedSet.add(id);
      }
    } catch (e) {}
  }
  console.log(`📋 Existing notified trending CVEs in tracker: ${notifiedSet.size}`);

  console.log('\n🔎 Gathering intelligence from CISA KEV, FIRST.org EPSS, and GitHub PoCs...');
  const trendingVulns = await detectTrendingVulnerabilities(env, {
    minEpss,
    kevDays,
    githubLimit: limit
  });

  console.log(`\n✨ Discovered ${trendingVulns.length} trending vulnerabilities matching threat criteria:\n`);

  let notifiedCount = 0;
  let skippedCount = 0;

  for (const [idx, cve] of trendingVulns.entries()) {
    const signals = cve.trendingSignals || {};
    const alreadyNotified = notifiedSet.has(cve.id);

    console.log(`[${idx + 1}/${trendingVulns.length}] ${cve.id} (Severity: ${cve.severity} | Score: ${cve.score})`);
    
    // Display signals
    if (signals.cisaKev) {
      console.log(`   🚨 CISA KEV: Confirmed Exploit (Added: ${signals.cisaKev.dateAdded || 'Recent'})`);
      if (signals.cisaKev.vulnerabilityName) {
        console.log(`      Title: ${signals.cisaKev.vulnerabilityName}`);
      }
    }
    if (signals.epss && signals.epss.score !== null) {
      const pct = (signals.epss.score * 100).toFixed(1);
      const percentile = signals.epss.percentile !== null ? ` (Top ${(100 - signals.epss.percentile * 100).toFixed(1)}% percentile)` : '';
      console.log(`   📈 EPSS Probability: ${pct}%${percentile}`);
    }
    if (signals.githubPocs && signals.githubPocs.length > 0) {
      console.log(`   💻 GitHub PoC Repos (${signals.githubPocs.length} found):`);
      for (const p of signals.githubPocs.slice(0, 3)) {
        console.log(`      - ${p.repo}${p.stars ? ` (⭐ ${p.stars})` : ''} -> ${p.url}`);
      }
    }

    if (alreadyNotified) {
      console.log(`   ⏭️  Status: Already notified previously (Skipping duplicate alert)`);
      skippedCount++;
    } else if (isDryRun) {
      console.log(`   ℹ️  Status: New trending finding (Alert simulated in --dry-run mode)`);
      notifiedCount++;
    } else {
      if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
        console.log(`   ⚠️  Status: Cannot send Telegram alert - TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing in .env`);
      } else {
        try {
          console.log(`   🚀 Dispatching Telegram notification...`);
          await sendTrendingTelegramNotification(cve, env);
          console.log(`   ✅ Notification sent successfully!`);
          notifiedSet.add(cve.id);
          notifiedList.push(cve.id);
          notifiedCount++;
          // Rate-limiting pause
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          console.error(`   ❌ Failed to send Telegram alert: ${err.message}`);
        }
      }
    }
    console.log('');
  }

  // Save updated notified tracking list
  if (!isDryRun && notifiedCount > 0) {
    if (localDb) {
      for (const id of notifiedSet) {
        try {
          localDb.prepare("INSERT OR IGNORE INTO notified_alerts (cve_id, alert_type, notified_at) VALUES (?, 'trending', ?)").run(id, Date.now());
        } catch (e) {}
      }
      console.log(`💾 Saved updated tracking state to SQLite database: ${dbPath}`);
    }
  }
  if (localDb) localDb.close();

  console.log('================ Scan Summary ================');
  console.log(`🎯 Total Trending Vulnerabilities Found: ${trendingVulns.length}`);
  console.log(`📢 Alerts Dispatched (or Simulated): ${notifiedCount}`);
  console.log(`⏭️  Already Notified / Skipped: ${skippedCount}`);
  console.log('==============================================\n');
}

runTrendingCheck().catch(err => {
  console.error('Fatal scanner error:', err);
  process.exit(1);
});
