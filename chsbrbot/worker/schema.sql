-- Cloudflare D1 SQLite Schema for CVE Collector & Telegram Notifier

-- 1. Main CVE Storage Table
CREATE TABLE IF NOT EXISTS cves (
  id TEXT PRIMARY KEY,
  description TEXT,
  score REAL,
  severity TEXT,
  vector TEXT,
  poc_refs TEXT,            -- JSON array string of exploit/PoC links
  categories TEXT,          -- JSON array string of CWE IDs & names
  bug_types TEXT,           -- JSON array string of friendly bug types
  affected_software TEXT,   -- JSON array string of affected vendor/products
  published TEXT,           -- ISO 8601 published timestamp (e.g. 2024-03-01T12:00:00.000)
  data TEXT,                -- Full JSON serialized parsed CVE object
  created_at INTEGER,       -- Unix timestamp (ms)
  updated_at INTEGER        -- Unix timestamp (ms)
);

-- Fast query and filtering indexes
CREATE INDEX IF NOT EXISTS idx_cves_published ON cves(published DESC);
CREATE INDEX IF NOT EXISTS idx_cves_severity ON cves(severity);
CREATE INDEX IF NOT EXISTS idx_cves_score ON cves(score DESC);
CREATE INDEX IF NOT EXISTS idx_cves_updated_at ON cves(updated_at DESC);

-- 2. Deduplication & Alert Notification History Table
CREATE TABLE IF NOT EXISTS notified_alerts (
  cve_id TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'standard', -- 'standard' or 'trending'
  notified_at INTEGER NOT NULL,                -- Unix timestamp (ms)
  PRIMARY KEY (cve_id, alert_type)
);

CREATE INDEX IF NOT EXISTS idx_notified_alerts_type ON notified_alerts(alert_type, notified_at DESC);

-- 3. Telegram Bot Subscribers Table
CREATE TABLE IF NOT EXISTS subscribers (
  chat_id TEXT PRIMARY KEY,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  chat_type TEXT DEFAULT 'private', -- 'private', 'group', 'supergroup', 'channel'
  is_active INTEGER DEFAULT 1,      -- 1 = active, 0 = unsubscribed / blocked
  min_score REAL DEFAULT NULL,      -- Optional custom threshold per subscriber
  created_at INTEGER NOT NULL,      -- Unix timestamp (ms)
  updated_at INTEGER NOT NULL       -- Unix timestamp (ms)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(is_active);

-- Seed Administrator Accounts
INSERT OR IGNORE INTO subscribers (chat_id, username, first_name, chat_type, is_active, created_at, updated_at)
VALUES ('8028710032', 'chethober', 'Cheth', 'private', 1, 1710000000000, 1710000000000);
INSERT OR IGNORE INTO subscribers (chat_id, username, first_name, chat_type, is_active, created_at, updated_at)
VALUES ('6330862227', 'chesober', '🐈‍⬛', 'private', 1, 1710000000000, 1710000000000);

