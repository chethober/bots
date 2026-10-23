import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseCveData } from '../src/index.js';

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'cves.db');
const SCHEMA_PATH = path.resolve(process.cwd(), 'schema.sql');
const CVES_DIR = path.resolve(process.cwd(), 'cves');

function main() {
  console.log('🚀 Starting migration of local CVE JSON files into SQLite database...');

  if (!fs.existsSync(CVES_DIR)) {
    console.log('ℹ️ No cves directory found. Nothing to migrate.');
    return;
  }

  const files = fs.readdirSync(CVES_DIR).filter(f => f.endsWith('.json'));
  console.log(`📂 Found ${files.length} JSON files in ${CVES_DIR}`);

  if (files.length === 0) {
    console.log('ℹ️ cves directory is empty. Nothing to migrate.');
    return;
  }

  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);

  // Apply schema
  const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schemaSql);
  console.log(`✅ SQLite schema verified at ${DB_PATH}`);

  // Performance optimizations for bulk loading
  db.exec('PRAGMA synchronous = OFF;');
  db.exec('PRAGMA journal_mode = MEMORY;');

  const insertStmt = db.prepare(`
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

  console.log('⏳ Importing records into SQLite in a single transaction...');
  const startTime = Date.now();

  db.exec('BEGIN TRANSACTION;');

  let successCount = 0;
  let skippedCount = 0;
  const now = Date.now();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const raw = fs.readFileSync(path.join(CVES_DIR, file), 'utf-8');
      const item = JSON.parse(raw);
      const cve = item.raw ? parseCveData(item.raw) : (item.id && item.categories ? item : parseCveData(item));

      if (!cve || !cve.id) {
        skippedCount++;
        continue;
      }

      const scoreVal = typeof cve.score === 'number' ? cve.score : parseFloat(cve.score);
      const numScore = isNaN(scoreVal) ? null : scoreVal;

      insertStmt.run(
        cve.id,
        cve.description || '',
        numScore,
        (cve.severity || 'UNKNOWN').toUpperCase(),
        cve.vector || '',
        JSON.stringify(cve.pocRefs || []),
        JSON.stringify(cve.categories || []),
        JSON.stringify(cve.bugTypes || []),
        JSON.stringify(cve.affectedSoftware || []),
        cve.published || null,
        JSON.stringify(cve),
        now,
        now
      );
      successCount++;
    } catch (err) {
      skippedCount++;
    }

    if ((i + 1) % 5000 === 0 || i === files.length - 1) {
      process.stdout.write(`\r   Progress: ${i + 1}/${files.length} (${Math.round(((i + 1) / files.length) * 100)}%)`);
    }
  }

  db.exec('COMMIT;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA journal_mode = WAL;');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 Successfully migrated ${successCount} CVEs into SQLite in ${durationSec}s! (Skipped: ${skippedCount})`);

  // Verify count
  const countRow = db.prepare('SELECT COUNT(*) as count FROM cves').get();
  console.log(`📊 Total rows in SQLite cves table: ${countRow.count}`);

  const stat = fs.statSync(DB_PATH);
  const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
  console.log(`💾 SQLite database file size: ${sizeMb} MB (was 291 MB in JSON files)`);

  db.close();
}

main();
