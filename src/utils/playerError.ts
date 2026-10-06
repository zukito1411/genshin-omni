/** Never display raw network, parsing, or service errors on player-facing pages. */
export function playerErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : '';
  if (/timed?\s*out|too long|timeout/i.test(message)) return 'Loading took too long. Please try again.';
  if (/\(429\)|rate.?limit/i.test(message)) return 'Please wait a moment, then try again.';
  return fallback;
}
