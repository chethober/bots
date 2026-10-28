// Just enough of the tgcloud SDK for the schema and pure modules to load.
const col = () => new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : () => col()), apply: () => col() });
export const db = new Proxy({}, { get: () => () => { throw new Error('db is not available in tests'); } });
export const api = new Proxy({}, { get: () => async () => { throw new Error('api is not available in tests'); } });
export const fetch = async () => { throw new Error('fetch is not available in tests'); };
export class BotApiError extends Error {}
export class EndpointError extends Error {}
export const table = (name, cols) => ({ _name: name, ...cols });
export const integer = col, text = col, real = col, boolean = col, json = col, index = col, uniqueIndex = col;
export const eq = col, and = col, or = col, desc = col, asc = col, inArray = col, lt = col, lte = col, gt = col, isNull = col;
export const sql = Object.assign(() => col(), { raw: () => col() });
