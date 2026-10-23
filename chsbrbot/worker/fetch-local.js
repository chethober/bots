import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fetchCvesPage, parseCveData } from './src/index.js';

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

async function runLocalFetch() {
  console.log('🚀 Starting local CVE fetch run (reverse chronological: newest -> oldest)...');

  const dbDir = path.resolve(process.cwd(), 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'cves.db');
  const db = new DatabaseSync(dbPath);

  const schemaPath = path.resolve(process.cwd(), 'schema.sql');
  if (fs.existsSync(schemaPath)) {
    db.exec(fs.readFileSync(schemaPath, 'utf-8'));
  }
  console.log(`📁 Connected to SQLite database: ${dbPath}`);

  const upsertStmt = db.prepare(`
    INSERT INTO cves (
      id, description, score, severity, vector, poc_refs, categories, bug_types, affected_software, published, data, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      description = excluded.description,
      score = excluded.score,
      severity = excluded.severity,
      vector = excluded.vector,
      poc_refs = excluded.poc_refs,
      categories = excluded.categories,
      bug_types = excluded.bug_types,
      affected_software = excluded.affected_software,
      published = excluded.published,
      data = excluded.data,
      updated_at = excluded.updated_at;
  `);

  const checkStmt = db.prepare('SELECT 1 FROM cves WHERE id = ?');

  const env = {
    NVD_API_KEY: process.env.NVD_API_KEY
  };

  // Rate limiting setup
  // NVD API limit: 5 requests per 30 seconds without key (~6500ms delay), 50 req/30s with API key (~650ms delay)
  const delayMs = env.NVD_API_KEY ? 650 : 6500;
  console.log(`⏱️ Delay between API calls: ${delayMs}ms ${env.NVD_API_KEY ? '(NVD API Key active)' : '(No API Key - rate limited to 5 req / 30s)'}`);

  // Graceful shutdown state & signal handlers
  let stopRequested = false;
  const handleSignal = () => {
    if (stopRequested) {
      console.log('\n⚠️ Force exiting...');
      process.exit(1);
    }
    console.log('\n🛑 Interrupted by user (Ctrl+C). Finishing current batch and saving progress...');
    stopRequested = true;
  };

  process.on('SIGINT', handleSignal);
  process.on('SIGTERM', handleSignal);

  // Set up 120-day date windows going backward from NOW down to 1999
  const windowDays = 120;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const minDate = new Date('1999-01-01T00:00:00.000Z');
  let currentEnd = new Date();

  let totalSavedCount = 0;
  let totalSkippedCount = 0;
  let pageCount = 0;
  let windowCount = 0;

  try {
    while (currentEnd > minDate && !stopRequested) {
      windowCount++;
      let currentStart = new Date(currentEnd.getTime() - windowMs);
      if (currentStart < minDate) {
        currentStart = minDate;
      }

      const pubStartDate = currentStart.toISOString().replace('Z', '');
      const pubEndDate = currentEnd.toISOString().replace('Z', '');

      console.log(`\n📅 Date Window ${windowCount}: ${pubStartDate.substring(0, 10)} to ${pubEndDate.substring(0, 10)} (going backward in time)`);

      let startIndex = 0;
      const resultsPerPage = 2000;
      let windowTotalResults = null;

      while (!stopRequested) {
        pageCount++;
        console.log(`📡 Fetching page ${pageCount} (Window ${windowCount}, startIndex: ${startIndex}, maxResults: ${resultsPerPage})...`);

        let data;
        try {
          data = await fetchCvesPage(env, { pubStartDate, pubEndDate, startIndex, resultsPerPage });
        } catch (err) {
          if (err.status === 403 || err.status === 429) {
            console.error(`\n⚠️ Hit NVD API rate limit (HTTP ${err.status}). Stopping fetch process cleanly.`);
            console.log(`💡 Tip: Add NVD_API_KEY to your .env file to get 10x higher rate limits (50 req/30s vs 5 req/30s).`);
            stopRequested = true;
            break;
          }
          throw err;
        }

        windowTotalResults = data.totalResults ?? windowTotalResults;
        const rawVulnerabilities = data.vulnerabilities || [];
        console.log(`🔎 Received ${rawVulnerabilities.length} CVEs in window (Total in this window: ${windowTotalResults}).`);

        if (rawVulnerabilities.length === 0) {
          break;
        }

        let pageSaved = 0;
        let pageSkipped = 0;

        db.exec('BEGIN TRANSACTION;');
        for (const item of rawVulnerabilities) {
          if (stopRequested) break;

          const parsedCve = parseCveData(item);
          const isNew = !checkStmt.get(parsedCve.id);
          const now = Date.now();
          const scoreVal = typeof parsedCve.score === 'number' ? parsedCve.score : parseFloat(parsedCve.score);
          const numScore = isNaN(scoreVal) ? null : scoreVal;

          upsertStmt.run(
            parsedCve.id,
            parsedCve.description || '',
            numScore,
            (parsedCve.severity || 'UNKNOWN').toUpperCase(),
            parsedCve.vector || '',
            JSON.stringify(parsedCve.pocRefs || []),
            JSON.stringify(parsedCve.categories || []),
            JSON.stringify(parsedCve.bugTypes || []),
            JSON.stringify(parsedCve.affectedSoftware || []),
            parsedCve.published || null,
            JSON.stringify(parsedCve),
            now,
            now
          );

          if (isNew) {
            pageSaved++;
            totalSavedCount++;
          } else {
            pageSkipped++;
            totalSkippedCount++;
          }
        }
        db.exec('COMMIT;');

        console.log(`💾 Window ${windowCount} / Page ${pageCount} done: ${pageSaved} new saved, ${pageSkipped} existing updated.`);
        console.log(`📊 Progress in current window: ${startIndex + rawVulnerabilities.length} / ${windowTotalResults} CVEs.`);

        startIndex += rawVulnerabilities.length;

        if (startIndex >= windowTotalResults) {
          break;
        }

        if (stopRequested) break;

        // Pause to respect NVD API rate limits
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // Step backward to the previous time window
      currentEnd = currentStart;

      if (currentEnd <= minDate) {
        console.log('\n🎉 Reached 1999 - end of all NVD historical records!');
        break;
      }

      if (!stopRequested) {
        // Pause between date windows
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    console.log(`\n================ Summary ================`);
    console.log(`🎉 Local fetch finished/paused.`);
    console.log(`📁 New records inserted: ${totalSavedCount}`);
    console.log(`🔄 Existing records updated: ${totalSkippedCount}`);
    console.log(`📄 Total pages fetched: ${pageCount}`);
    console.log(`📅 Date windows processed: ${windowCount}`);
    console.log(`=========================================\n`);

    db.close();

  } catch (error) {
    console.error('❌ Error during local fetch run:', error);
    process.exit(1);
  }
}

runLocalFetch();
