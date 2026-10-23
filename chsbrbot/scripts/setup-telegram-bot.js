#!/usr/bin/env node

/**
 * setup-telegram-bot.js
 * 
 * Synchronizes Telegram Bot Profile Descriptions and Commands with Telegram Bot API:
 * 1. setMyDescription - Explanatory intro shown to new users before clicking Start
 * 2. setMyShortDescription - Profile tagline shown on bot profile & shared links
 * 3. setMyCommands - Autocomplete command menu shown when typing / or tapping Menu button
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// 1. Auto-load .env file if present
if (fs.existsSync('.env')) {
  try {
    const envContent = fs.readFileSync('.env', 'utf-8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...parts] = trimmed.split('=');
        const val = parts.join('=').trim().replace(/^["']|["']$/g, '');
        const k = key.trim();
        if (k && !process.env[k]) {
          process.env[k] = val;
        }
      }
    }
  } catch (e) {}
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN not found in environment or .env file');
  process.exit(1);
}

// 2. Define Descriptions & Commands
export const BOT_DESCRIPTION = [
  '🛡️ Real-time CVE Security Alert & Zero-Day Intelligence Bot (@chsbrbot)',
  '',
  'Automated vulnerability monitoring, threat correlation, and instant security advisories:',
  '• 🚨 High & Critical CVE notifications (NVD API v2.0)',
  '• 🔥 Zero-Day & KEV tracker (CISA Known Exploited Vulnerabilities)',
  '• 📈 EPSS exploit probability forecasting',
  '• 💻 Automated GitHub PoC discovery',
  '• 🔍 Fast interactive CVE lookup & keyword search',
  '• 📱 Collapsible button keyboard & channel broadcast support',
  '',
  'Tap START below to begin monitoring!'
].join('\n');

export const BOT_SHORT_DESCRIPTION =
  'Real-time CVE alerts, CISA KEV zero-day intelligence, EPSS exploit scores & GitHub PoC detection.';

// Slash commands are admin-only; regular users navigate with keyboard buttons
export const BOT_COMMANDS = [
  { command: 'start', description: '🚀 Open main menu' },
  { command: 'admin', description: '👑 Admin dashboard' },
  { command: 'stats', description: '📊 System statistics' },
  { command: 'broadcast', description: '📢 Broadcast to subscribers (/broadcast [channel] <msg>)' },
  { command: 'setup', description: '⚙️ Sync bot profile & commands' }
];

const adminIds = (process.env.TELEGRAM_ADMIN_ID || '').split(',').map(s => s.trim()).filter(Boolean);

// Helper to make Telegram API requests with proxy detection
async function callTelegramApi(endpoint, data = null) {
  const url = `https://api.telegram.org/bot${token}/${endpoint}`;
  const proxy = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.all_proxy || process.env.ALL_PROXY;

  if (proxy) {
    let curlCmd = `curl -s -x ${proxy} -X POST -H "Content-Type: application/json"`;
    if (data) {
      const jsonStr = JSON.stringify(data).replace(/'/g, "'\\''");
      curlCmd += ` -d '${jsonStr}'`;
    }
    curlCmd += ` "${url}"`;
    try {
      const output = execSync(curlCmd, { encoding: 'utf-8', timeout: 15000 });
      return JSON.parse(output);
    } catch (err) {
      throw new Error(`cURL request to ${endpoint} failed: ${err.message}`);
    }
  }

  // Direct fetch fallback
  const options = {
    method: data ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' }
  };
  if (data) options.body = JSON.stringify(data);

  const res = await fetch(url, options);
  return await res.json();
}

async function main() {
  console.log('\n==================================================');
  console.log('  🛡️  CVE Telegram Bot Configuration & Sync Tool');
  console.log('==================================================\n');

  try {
    // 1. Verify Bot Token
    console.log('📡 Verifying Telegram Bot Token...');
    const me = await callTelegramApi('getMe');
    if (!me.ok) {
      console.error('❌ Invalid Telegram Bot Token:', me.description);
      process.exit(1);
    }
    console.log(`✅ Connected to @${me.result.username} (${me.result.first_name}, ID: ${me.result.id})\n`);

    // 2. Set My Description
    console.log('📝 Updating Bot Description (About screen)...');
    const descResult = await callTelegramApi('setMyDescription', { description: BOT_DESCRIPTION });
    if (descResult.ok) {
      console.log('✅ Bot Description successfully updated!');
    } else {
      console.warn('⚠️ Failed to set description:', descResult.description);
    }

    // 3. Set My Short Description
    console.log('\n📌 Updating Bot Short Description (Profile tagline)...');
    const shortDescResult = await callTelegramApi('setMyShortDescription', { short_description: BOT_SHORT_DESCRIPTION });
    if (shortDescResult.ok) {
      console.log('✅ Bot Short Description successfully updated!');
    } else {
      console.warn('⚠️ Failed to set short description:', shortDescResult.description);
    }

    // 4. Clear the default command menu, then register commands for admins only
    console.log('\n⌨️  Updating Bot Commands menu (admins only)...');
    const clearResult = await callTelegramApi('deleteMyCommands', { scope: { type: 'default' } });
    if (clearResult.ok) {
      console.log('✅ Cleared command menu for regular users');
    } else {
      console.warn('⚠️ Failed to clear default commands:', clearResult.description);
    }
    if (adminIds.length === 0) {
      console.warn('⚠️ TELEGRAM_ADMIN_ID is empty — no admin command menu registered');
    }
    for (const adminId of adminIds) {
      const cmdResult = await callTelegramApi('setMyCommands', {
        commands: BOT_COMMANDS,
        scope: { type: 'chat', chat_id: adminId }
      });
      if (cmdResult.ok) {
        console.log(`✅ Registered ${BOT_COMMANDS.length} commands for admin ${adminId}`);
      } else {
        console.warn(`⚠️ Failed to set commands for admin ${adminId}:`, cmdResult.description);
      }
    }
    BOT_COMMANDS.forEach(c => console.log(`   /${c.command.padEnd(12)} - ${c.description}`));

    console.log('\n✨ All Telegram Bot Profile settings have been synchronized successfully!\n');
  } catch (error) {
    console.error('\n❌ Error configuring Telegram bot:', error.message);
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  main();
}
