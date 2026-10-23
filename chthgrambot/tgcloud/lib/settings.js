import { db } from 'sdk';
import { eq } from 'sdk/db';
import { settings } from '../schema.js';
import { ALLOWED_USER_IDS, GLOBAL_CF_ACCOUNT_ID, GLOBAL_CF_API_TOKEN } from './config.js';

// Cloudflare Workers AI text models that work on the free tier (10k neurons/day).
export const MODELS = [
  { id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', name: 'Llama 3.3 70B (smartest)' },
  { id: '@cf/meta/llama-4-scout-17b-16e-instruct', name: 'Llama 4 Scout 17B' },
  { id: '@cf/mistralai/mistral-small-3.1-24b-instruct', name: 'Mistral Small 3.1 24B' },
  { id: '@cf/qwen/qwen3-30b-a3b-fp8', name: 'Qwen3 30B A3B' },
  { id: '@cf/meta/llama-3.1-8b-instruct-fast', name: 'Llama 3.1 8B (fastest, cheapest)' },
];

export const MOODS = {
  friendly:     { label: '😊 Friendly',     prompt: 'warm, kind and approachable' },
  professional: { label: '💼 Professional', prompt: 'polite, precise and businesslike' },
  playful:      { label: '🎈 Playful',      prompt: 'light-hearted, cheerful and fun' },
  witty:        { label: '😏 Witty',        prompt: 'clever, with dry humor and quick wordplay, never rude' },
  calm:         { label: '🧘 Calm',         prompt: 'relaxed, patient and reassuring' },
  enthusiastic: { label: '🔥 Enthusiastic', prompt: 'energetic, upbeat and excited' },
  empathetic:   { label: '🤗 Empathetic',   prompt: 'caring, understanding and emotionally attentive' },
  sarcastic:    { label: '🙃 Sarcastic',    prompt: 'gently sarcastic and teasing, but still helpful and never hurtful' },
  mysterious:   { label: '🌙 Mysterious',   prompt: 'brief, poetic and a little enigmatic' },
  custom:       { label: '✏️ Custom',       prompt: '' },
};

export const EMOJI_STYLES = {
  none:       { label: 'None',        prompt: 'Never use emoji or emoticons.' },
  minimal:    { label: 'Minimal',     prompt: 'Use at most one emoji, and only when it really fits.' },
  balanced:   { label: 'Balanced',    prompt: 'Use one or two fitting emoji per message.' },
  expressive: { label: 'Expressive',  prompt: 'Use emoji generously (3+ per message) to add emotion.' },
  kaomoji:    { label: 'Kaomoji',     prompt: 'Instead of emoji, use Japanese kaomoji such as (＾▽＾) or (・_・;) — one or two per message.' },
  oldschool:  { label: 'Old-school',  prompt: 'Instead of emoji, use classic text emoticons like :) ;) :D — sparingly.' },
  custom:     { label: 'Custom set',  prompt: '' },
};

export const LENGTHS = {
  short:  { label: 'Short',  prompt: 'Keep replies very short: one or two sentences, like a quick chat message.' },
  medium: { label: 'Medium', prompt: 'Keep replies concise: two to four sentences.' },
  long:   { label: 'Long',   prompt: 'Replies may be detailed, up to a few short paragraphs when needed.' },
};

export const FORMALITY = {
  casual:  { label: 'Casual',  prompt: 'Write casually, like texting a friend.' },
  neutral: { label: 'Neutral', prompt: 'Write in a natural, neutral tone.' },
  formal:  { label: 'Formal',  prompt: 'Write formally and respectfully.' },
};

export const VOICES = {
  assistant: { label: '🤖 Assistant', hint: 'Answers as your assistant, on your behalf' },
  me:        { label: '🪞 Speak as me', hint: 'Writes in first person, imitating your style' },
};

export const DEFAULTS = {
  enabled: true,
  voice: 'assistant',
  learnStyle: true,
  styleProfile: '',
  styleExamples: 20,
  dialogExamples: 25,          // past conversation pairs shown per reply
  splitMessages: false,
  nonText: 'relay',            // 'relay' | 'ai' | 'ignore' for photos, voice, files...
  model: MODELS[0].id,
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 300,
  presencePenalty: 0,
  mood: 'friendly',
  customMood: '',
  emojiStyle: 'balanced',
  emojiPalette: '',
  length: 'short',
  formality: 'neutral',
  language: 'auto',
  uiLocale: 'auto',            // bot UI language (/language): 'auto' | en | fa | ar | ru | es
  personaName: '',
  aboutOwner: '',
  instructions: '',
  signature: '',
  aiLabel: true,
  aiLabelText: '🤖 ',
  fallbackText: '',
  historySize: 10,
  replyDelay: 3,
  ownerPauseMinutes: 30,
  quoteReply: false,
  markRead: true,
  scheduleMode: 'always',      // 'always' | 'window'
  scheduleFrom: '18:00',       // replies only inside this window (wraps past midnight)
  scheduleTo: '09:00',
  utcOffsetMinutes: 0,
};

const clamp = (v, min, max, def) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};
const str = (v, max, def = '') => (typeof v === 'string' ? v.slice(0, max) : def);
const pick = (v, allowed, def) => (Object.hasOwn(allowed, v) ? v : def);
const bool = (v, def) => (typeof v === 'boolean' ? v : def);
const hhmm = (v, def) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : def);

// Merge untrusted input over defaults, keeping only known keys with valid values.
export function sanitize(input = {}) {
  const d = DEFAULTS;
  const i = input && typeof input === 'object' ? input : {};
  return {
    enabled: bool(i.enabled, d.enabled),
    voice: pick(i.voice, VOICES, d.voice),
    learnStyle: bool(i.learnStyle, d.learnStyle),
    styleProfile: str(i.styleProfile, 2500),
    styleExamples: Math.round(clamp(i.styleExamples, 0, 40, d.styleExamples)),
    dialogExamples: Math.round(clamp(i.dialogExamples, 0, 60, d.dialogExamples)),
    splitMessages: bool(i.splitMessages, d.splitMessages),
    nonText: ['relay', 'ai', 'ignore'].includes(i.nonText) ? i.nonText : d.nonText,
    model: MODELS.some((m) => m.id === i.model) ? i.model : d.model,
    temperature: clamp(i.temperature, 0, 2, d.temperature),
    topP: clamp(i.topP, 0.05, 1, d.topP),
    maxTokens: Math.round(clamp(i.maxTokens, 32, 1024, d.maxTokens)),
    presencePenalty: clamp(i.presencePenalty, 0, 2, d.presencePenalty),
    mood: pick(i.mood, MOODS, d.mood),
    customMood: str(i.customMood, 200),
    emojiStyle: pick(i.emojiStyle, EMOJI_STYLES, d.emojiStyle),
    emojiPalette: str(i.emojiPalette, 100),
    length: pick(i.length, LENGTHS, d.length),
    formality: pick(i.formality, FORMALITY, d.formality),
    language: str(i.language, 40, d.language).trim() || 'auto',
    uiLocale: ['auto', 'en', 'fa', 'ar', 'ru', 'es'].includes(i.uiLocale) ? i.uiLocale : d.uiLocale,
    personaName: str(i.personaName, 60),
    aboutOwner: str(i.aboutOwner, 3000),
    instructions: str(i.instructions, 2000),
    signature: str(i.signature, 100),
    aiLabel: bool(i.aiLabel, d.aiLabel),
    aiLabelText: str(i.aiLabelText, 30, d.aiLabelText),
    fallbackText: str(i.fallbackText, 500),
    historySize: Math.round(clamp(i.historySize, 0, 30, d.historySize)),
    replyDelay: Math.round(clamp(i.replyDelay, 0, 15, d.replyDelay)),
    ownerPauseMinutes: Math.round(clamp(i.ownerPauseMinutes, 0, 1440, d.ownerPauseMinutes)),
    quoteReply: bool(i.quoteReply, d.quoteReply),
    markRead: bool(i.markRead, d.markRead),
    scheduleMode: i.scheduleMode === 'window' ? 'window' : 'always',
    scheduleFrom: hhmm(i.scheduleFrom, d.scheduleFrom),
    scheduleTo: hhmm(i.scheduleTo, d.scheduleTo),
    utcOffsetMinutes: Math.round(clamp(i.utcOffsetMinutes, -720, 840, d.utcOffsetMinutes)),
  };
}

export async function loadSettingsRow(userId) {
  return db.select().from(settings).where(eq(settings.userId, userId)).get();
}

export async function getSettings(userId) {
  const row = await loadSettingsRow(userId);
  return sanitize(row?.data ?? {});
}

export async function saveSettings(userId, input) {
  const data = sanitize(input);
  await db.insert(settings).values({ userId, data })
    .onConflictDoUpdate({ target: settings.userId, set: { data, updatedAt: now() } }).run();
  return data;
}

export async function patchSettings(userId, patch) {
  return saveSettings(userId, { ...(await getSettings(userId)), ...patch });
}

export async function saveCredentials(userId, accountId, apiToken) {
  const set = { cfAccountId: accountId || null, cfApiToken: apiToken || null, updatedAt: now() };
  await db.insert(settings).values({ userId, data: DEFAULTS, ...set })
    .onConflictDoUpdate({ target: settings.userId, set }).run();
}

// The user's own credentials win; shared ones apply only to explicitly allowed users.
export function resolveCredentials(row, userId) {
  if (row?.cfAccountId && row?.cfApiToken) {
    return { accountId: row.cfAccountId, apiToken: row.cfApiToken, source: 'own' };
  }
  if (GLOBAL_CF_ACCOUNT_ID && GLOBAL_CF_API_TOKEN && ALLOWED_USER_IDS.includes(userId)) {
    return { accountId: GLOBAL_CF_ACCOUNT_ID, apiToken: GLOBAL_CF_API_TOKEN, source: 'shared' };
  }
  return null;
}

export const now = () => Math.floor(Date.now() / 1000);

// True if the owner's local time falls inside the configured reply window.
export function inSchedule(s, date = new Date()) {
  if (s.scheduleMode !== 'window') return true;
  const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));
  const local = (((date.getUTCHours() * 60 + date.getUTCMinutes() + s.utcOffsetMinutes) % 1440) + 1440) % 1440;
  const from = toMin(s.scheduleFrom);
  const to = toMin(s.scheduleTo);
  if (from === to) return true;
  return from < to ? local >= from && local < to : local >= from || local < to;
}
