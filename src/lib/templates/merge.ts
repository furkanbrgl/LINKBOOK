// Deep merge: objects recursively merged, arrays replaced, undefined ignored.
// Never mutates inputs.
export function deepMerge<T>(base: T, override: unknown): T {
  const clone = (x: unknown) =>
    typeof structuredClone === "function"
      ? structuredClone(x)
      : JSON.parse(JSON.stringify(x));

  if (override == null) return clone(base) as T;

  if (Array.isArray(base) || typeof base !== "object" || base === null) {
    return ((override as T) ?? clone(base)) as T;
  }

  if (Array.isArray(override)) {
    return override as T;
  }

  if (typeof override !== "object" || override === null) {
    return ((override as T) ?? clone(base)) as T;
  }

  const out = clone(base) as Record<string, unknown>;

  for (const [k, v] of Object.entries(override as Record<string, unknown>)) {
    if (v === undefined) continue;
    const bv = (base as Record<string, unknown>)[k];

    if (
      bv &&
      typeof bv === "object" &&
      !Array.isArray(bv) &&
      v &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = deepMerge(bv, v);
    } else {
      out[k] = clone(v);
    }
  }

  return out as T;
}
