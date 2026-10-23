const stub = new URL('./sdk-stub.js', import.meta.url).href;
export async function resolve(specifier, context, next) {
  if (specifier === 'sdk' || specifier === 'sdk/db') return { url: stub, shortCircuit: true };
  return next(specifier, context);
}
