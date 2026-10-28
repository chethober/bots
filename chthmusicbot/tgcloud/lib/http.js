// JSON over HTTP for the music services. Failures throw ProviderError with the
// HTTP status and, when the service gives one, a machine-readable reason.

import { fetch } from 'sdk';
import { formEncode } from './util.js';

export class ProviderError extends Error {
  constructor(provider, status, message, reason) {
    super(message || `${provider} error ${status}`);
    this.provider = provider;
    this.status = status;
    this.reason = reason;
  }
}

function errorOf(data, fallback) {
  const err = data?.error;
  if (typeof err === 'string') return { message: data.error_description ?? err, reason: err };
  if (err) return { message: err.message ?? fallback, reason: err.reason ?? err.errors?.[0]?.reason };
  const apple = data?.errors?.[0];
  if (apple) return { message: apple.detail ?? apple.title ?? fallback, reason: apple.code };
  return { message: fallback };
}

export async function request(provider, url, { method = 'GET', headers = {}, body, form } = {}) {
  const init = { method, headers: { ...headers } };
  if (form) {
    init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    init.body = formEncode(form);
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) {
    const { message, reason } = errorOf(data, res.statusText);
    throw new ProviderError(provider, res.status, message, reason);
  }
  return data;
}
