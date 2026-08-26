/** Shared stub helper — all reasoning services throw until implemented. */
export function notImplemented(feature: string): never {
  throw new Error(`Not implemented: ${feature}`);
}
