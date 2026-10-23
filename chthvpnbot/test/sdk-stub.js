// Stand-in for the platform's `sdk` and `sdk/db`, so node can load every module
// and check that the imports between them line up. Nothing here runs queries.
const chain = () => new Proxy(function () {}, { get: (_, k) => (k === 'then' ? undefined : chain()), apply: () => chain() });
export const db = chain();
export const api = chain();
export const fetch = chain();
export class InputFile { constructor(...a) { this.a = a; } }
export class BotApiError extends Error {}
export class EndpointError extends Error {}
export const table = chain(), integer = chain(), text = chain(), boolean = chain(), json = chain(),
  index = chain(), uniqueIndex = chain(), primaryKey = chain();
export const eq = chain(), and = chain(), desc = chain(), asc = chain(), inArray = chain(), lt = chain(), ne = chain(), sql = chain();
