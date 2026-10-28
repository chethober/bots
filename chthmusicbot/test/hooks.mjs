// Resolves the platform's `sdk` imports to local stubs so pure modules can be
// loaded under Node. Usage: node --import ./test/register.mjs test/<file>.mjs
export async function resolve(specifier, context, next) {
  if (specifier === 'sdk' || specifier.startsWith('sdk/')) {
    return { url: new URL('./sdk-stub.mjs', import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
