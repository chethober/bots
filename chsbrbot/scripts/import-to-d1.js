import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { parseCveData } from '../src/index.js';

function escapeSqlString(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}

function escapeSqlNumber(num) {
  if (num === null || num === undefined || isNaN(Number(num))) return 'NULL';
  return Number(num);
}

function loadCveRecords(limit) {
  const dbPath = path.resolve(process.cwd(), 'data', 'cves.db');
  if (fs.existsSync(dbPath)) {
    console.log(`📖 Loading records from SQLite database: ${dbPath}...`);
    const db = new DatabaseSync(dbPath);
    const query = limit && isFinite(limit) 
      ? `SELECT * FROM cves ORDER BY published DESC LIMIT ${limit}`
      : 'SELECT * FROM cves ORDER BY published DESC';
    const rows = db.prepare(query).all();
    db.close();
    return rows.map(r => ({
      id: r.id,
      description: r.description,
      score: r.score,
      severity: r.severity,
      vector: r.vector,
      pocRefs: JSON.parse(r.poc_refs || '[]'),
      categories: JSON.parse(r.categories || '[]'),
      bugTypes: JSON.parse(r.bug_types || '[]'),
      affectedSoftware: JSON.parse(r.affected_software || '[]'),
      published: r.published,
      data: r.data
    }));
  }

  const cvesDir = path.resolve(process.cwd(), 'cves');
  if (fs.existsSync(cvesDir)) {
    console.log(`📖 Loading records from directory: ${cvesDir}...`);
    const files = fs.readdirSync(cvesDir).filter(f => f.endsWith('.json'));
    files.sort((a, b) => b.localeCompare(a));
    const selected = limit && isFinite(limit) ? files.slice(0, limit) : files;
    const records = [];
    for (const file of selected) {
      try {
        const raw = fs.readFileSync(path.join(cvesDir, file), 'utf-8');
        const item = JSON.parse(raw);
        const cve = item.raw ? parseCveData(item.raw) : (item.id && item.categories ? item : parseCveData(item));
        if (cve && cve.id) records.push(cve);
      } catch (e) {}
    }
    return records;
  }

  return [];
}

function main() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const isRemote = args.includes('--remote');
  
  let limit = Infinity;
  const limitIdx = args.indexOf('--limit');
  if (limitIdx !== -1 && args[limitIdx + 1]) {
    limit = parseInt(args[limitIdx + 1], 10);
  }

  const records = loadCveRecords(limit);
  console.log(`📦 Loaded ${records.length} CVE records for Cloudflare D1 import.`);

  if (records.length === 0) {
    console.error('❌ No CVE records found to import.');
    process.exit(1);
  }

  const statements = [];
  statements.push('-- Seed file generated for Cloudflare D1');

  for (const cve of records) {
    const id = escapeSqlString(cve.id);
    const desc = escapeSqlString(cve.description || '');
    const score = escapeSqlNumber(cve.score);
    const severity = escapeSqlString((cve.severity || 'UNKNOWN').toUpperCase());
    const vector = escapeSqlString(cve.vector || '');
    const pocRefs = escapeSqlString(JSON.stringify(cve.pocRefs || []));
    const categories = escapeSqlString(JSON.stringify(cve.categories || []));
    const bugTypes = escapeSqlString(JSON.stringify(cve.bugTypes || []));
    const affectedSoftware = escapeSqlString(JSON.stringify(cve.affectedSoftware || []));
    const published = escapeSqlString(cve.published || null);
    const dataStr = typeof cve.data === 'string' ? cve.data : JSON.stringify(cve);
    const data = escapeSqlString(dataStr);
    const now = Date.now();

    statements.push(`INSERT INTO cves (id, description, score, severity, vector, poc_refs, categories, bug_types, affected_software, published, data, created_at, updated_at) VALUES (${id}, ${desc}, ${score}, ${severity}, ${vector}, ${pocRefs}, ${categories}, ${bugTypes}, ${affectedSoftware}, ${published}, ${data}, ${now}, ${now}) ON CONFLICT(id) DO UPDATE SET description=excluded.description, score=excluded.score, severity=excluded.severity, vector=excluded.vector, poc_refs=excluded.poc_refs, categories=excluded.categories, bug_types=excluded.bug_types, affected_software=excluded.affected_software, published=excluded.published, data=excluded.data, updated_at=excluded.updated_at;`);
  }

  const BATCH_SIZE = 500;
  const totalBatches = Math.ceil(statements.length / BATCH_SIZE);

  console.log(`⚙️ Executing in ${totalBatches} batch(es) of up to ${BATCH_SIZE} records...`);

  const execEnv = {
    ...process.env,
    HTTPS_PROXY: '',
    HTTP_PROXY: '',
    https_proxy: '',
    http_proxy: '',
    ALL_PROXY: '',
    all_proxy: ''
  };

  for (let i = 0; i < totalBatches; i++) {
    const chunk = statements.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
    const batchFileName = `seed_batch_${i + 1}.sql`;
    const batchFilePath = path.resolve(process.cwd(), batchFileName);
    fs.writeFileSync(batchFilePath, chunk.join('\n'), 'utf-8');

    console.log(`\n⏳ Batch ${i + 1}/${totalBatches} (${chunk.length} records):`);

    if (isLocal) {
      console.log(`   Running on local D1 SQLite database...`);
      execSync(`npx wrangler d1 execute cve-db --local -y --file=./${batchFileName}`, { stdio: 'inherit', env: execEnv });
    } else if (isRemote) {
      console.log(`   Uploading and executing on remote Cloudflare D1 database...`);
      execSync(`npx wrangler d1 execute cve-db --remote -y --file=./${batchFileName}`, { stdio: 'inherit', env: execEnv });
    } else {
      console.log(`   Generated file at: ${batchFilePath}`);
    }

    // Clean up temporary batch file if executed
    if (isLocal || isRemote) {
      try { fs.unlinkSync(batchFilePath); } catch (e) {}
    }
  }

  console.log('\n🎉 D1 import completed successfully!');
}

main();
