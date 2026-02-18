// TODO: Add database query functions
// Reusable select/insert/update helpers

export type QueryResult<T> = { data: T | null; error: Error | null };

export function getShopBySlug(_slug: string): Promise<QueryResult<unknown>> {
  // TODO: implement
  return Promise.resolve({ data: null, error: null });
}
