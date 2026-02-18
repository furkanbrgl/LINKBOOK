// TODO: Add RPC/stored procedure wrappers
// Call Supabase .rpc() for complex operations

export async function callRpc<T>(_name: string, _args?: Record<string, unknown>): Promise<{ data: T | null; error: Error | null }> {
  // TODO: implement
  return { data: null, error: null };
}
