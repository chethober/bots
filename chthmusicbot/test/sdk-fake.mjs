// An in-memory stand-in for the tgcloud SDK, for flow tests: a tiny query
// builder over arrays, a recording Bot API and a routable fetch.
export const state = { tables: new Map(), calls: [], routes: [], msgId: 1000, files: {} };

const colFactory = (type) => (name, opts) => {
  const c = { type, name, opts, mods: {} };
  const chain = new Proxy(c, {
    get(t, k) {
      if (k in t) return t[k];
      return (arg) => { t.mods[k] = arg ?? true; return chain; };
    },
  });
  return chain;
};
export const integer = colFactory('integer'), text = colFactory('text'), json = colFactory('json'), real = colFactory('real'), boolean = colFactory('boolean');
export const index = () => ({ on: () => ({}) }), uniqueIndex = (name) => ({ on: (...cols) => ({ unique: cols }) });

export function table(name, cols, extra) {
  const t = { __name: name, __cols: {} };
  for (const [key, c] of Object.entries(cols)) { c.key = key; c.table = name; t[key] = c; t.__cols[key] = c; }
  t.__uniques = extra ? Object.values(extra(t)).filter((x) => x.unique).map((x) => x.unique.map((c) => c.key)) : [];
  state.tables.set(name, { def: t, rows: [], seq: 0 });
  return t;
}

const pred = (fn) => ({ __pred: fn });
const val = (row, c) => row[c.key];
export const eq = (c, v) => pred((r) => val(r, c) === v);
export const ne = (c, v) => pred((r) => val(r, c) !== v);
export const lt = (c, v) => pred((r) => val(r, c) < v);
export const gt = (c, v) => pred((r) => val(r, c) > v);
export const isNull = (c) => pred((r) => val(r, c) == null);
export const inArray = (c, vs) => pred((r) => vs.includes(val(r, c)));
export const and = (...ps) => pred((r) => ps.filter(Boolean).every((p) => p.__pred(r)));
export const or = (...ps) => pred((r) => ps.some((p) => p.__pred(r)));
export const asc = (c) => ({ c, dir: 1 }), desc = (c) => ({ c, dir: -1 });
export const sql = () => ({});

const T = (def) => state.tables.get(def.__name);
const pkOf = (def) => Object.values(def.__cols).find((c) => c.mods.primaryKey);

function fill(def, values, t) {
  const row = {};
  for (const [k, c] of Object.entries(def.__cols)) {
    row[k] = values[k] !== undefined ? values[k] : (c.mods.default !== undefined ? c.mods.default : null);
  }
  const pk = pkOf(def);
  if (pk?.mods.primaryKey?.autoIncrement && row[pk.key] == null) row[pk.key] = ++t.seq;
  return row;
}

function conflictOf(def, t, row) {
  const pk = pkOf(def);
  const keys = [pk ? [pk.key] : [], ...def.__uniques].filter((k) => k.length);
  return t.rows.find((r) => keys.some((ks) => ks.every((k) => r[k] === row[k])));
}

class Query {
  constructor(kind, def, extra) { Object.assign(this, { kind, def, extra, preds: [], order: null, lim: null }); }
  from(def) { this.def = def; return this; }
  where(...p) { this.preds.push(...p.filter(Boolean)); return this; }
  orderBy(o) { this.order = o; return this; }
  limit(n) { this.lim = n; return this; }
  offset() { return this; }
  values(v) { this.vals = Array.isArray(v) ? v : [v]; return this; }
  set(s) { this.sets = s; return this; }
  onConflictDoNothing() { this.conflict = 'nothing'; return this; }
  onConflictDoUpdate({ set }) { this.conflict = set; return this; }
  returning() { this.ret = true; return this; }
  match(r) { return this.preds.every((p) => p.__pred(r)); }
  exec() {
    const t = T(this.def);
    if (this.kind === 'select') {
      let rows = t.rows.filter((r) => this.match(r)).map((r) => ({ ...r }));
      if (this.order) rows.sort((a, b) => (a[this.order.c.key] - b[this.order.c.key]) * this.order.dir);
      if (this.lim != null) rows = rows.slice(0, this.lim);
      if (this.extra) rows = rows.map((r) => Object.fromEntries(Object.entries(this.extra).map(([k, c]) => [k, r[c.key]])));
      return rows;
    }
    if (this.kind === 'insert') {
      const out = [];
      for (const v of this.vals) {
        const row = fill(this.def, v, t);
        const hit = conflictOf(this.def, t, row);
        if (hit) {
          if (this.conflict === 'nothing') continue;
          if (this.conflict) { Object.assign(hit, this.conflict); out.push({ ...hit }); continue; }
          throw new Error(`UNIQUE constraint failed: ${this.def.__name}`);
        }
        t.rows.push(row); out.push({ ...row });
      }
      return this.ret ? out : { rowsAffected: out.length, rows: [] };
    }
    if (this.kind === 'update') {
      const hits = t.rows.filter((r) => this.match(r));
      for (const r of hits) Object.assign(r, this.sets);
      return { rowsAffected: hits.length };
    }
    if (this.kind === 'delete') {
      const before = t.rows.length;
      t.rows = t.rows.filter((r) => !this.match(r));
      return { rowsAffected: before - t.rows.length };
    }
  }
  async all() { return this.exec(); }
  async get() { return this.exec()[0] ?? null; }
  async run() { return this.exec(); }
  then(res, rej) { return Promise.resolve(this.exec()).then(res, rej); }
}

export const db = {
  select: (proj) => new Query('select', null, proj),
  insert: (def) => new Query('insert', def),
  update: (def) => new Query('update', def),
  delete: (def) => new Query('delete', def),
  $count: async (def, p) => T(def).rows.filter((r) => !p || p.__pred(r)).length,
};

export class BotApiError extends Error {
  constructor(code, description) { super(description); this.code = code; this.description = description; }
}
export class EndpointError extends Error {
  constructor(d, p) { super(d); this.parameters = p; }
}

const apiResults = {
  getMe: () => ({ id: 1, is_bot: true, username: 'chthmusicbot' }),
  getChat: (p) => ({ id: p.chat_id, type: 'supergroup', title: 'Music Club', is_forum: false }),
  getChatMember: () => ({ status: 'administrator' }),
  getFileContent: (id) => new TextEncoder().encode(state.files[id]),
};
export const api = new Proxy({}, {
  get: (_, method) => async (params = {}) => {
    state.calls.push({ method, params });
    if (apiResults[method]) return apiResults[method](params);
    if (method.startsWith('send') || method === 'copyMessage') return { message_id: ++state.msgId, chat: { id: params.chat_id, type: 'supergroup' }, date: 0 };
    return true;
  },
});

export async function fetch(url, init = {}) {
  state.calls.push({ method: 'fetch', url, init });
  for (const [re, handler] of state.routes) {
    if (re.test(url)) {
      const body = await handler(url, init);
      const status = body?.__status ?? (body === null ? 204 : 200);
      const text = body === null ? '' : JSON.stringify(body?.__body ?? body);
      return { status, ok: status < 300, statusText: String(status), text: async () => text, json: async () => JSON.parse(text) };
    }
  }
  throw new Error(`no route for ${url}`);
}
