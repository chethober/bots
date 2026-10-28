// Like hooks.mjs, but resolves `sdk` to the in-memory fake (flow tests).
export async function resolve(specifier, context, next) {
  if (specifier === 'sdk' || specifier.startsWith('sdk/')) {
    return { url: new URL('./sdk-fake.mjs', import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
