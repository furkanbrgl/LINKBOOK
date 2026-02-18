// TODO: Rate limiting logic
// Throttle API requests per IP/user

export async function checkRateLimit(
  _key: string,
  _limit: number,
  _windowMs: number
): Promise<{ allowed: boolean; remaining: number }> {
  // TODO: implement
  return { allowed: true, remaining: _limit };
}
