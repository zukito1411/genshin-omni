/** Small eager guard: credential safety must not depend on loading a lazy chunk. */
export function containsCredential(value: string): boolean {
  return /(?:password|passcode|api[ _-]?key|access[ _-]?token|client[ _-]?secret|session[ _-]?cookie)\s*(?::|=|\bis\b)\s*\S+|\bbearer\s+\S+|-----BEGIN.*PRIVATE KEY-----|\b(?:xai|sk)[-_][A-Za-z0-9_-]{20,}/i.test(value);
}
