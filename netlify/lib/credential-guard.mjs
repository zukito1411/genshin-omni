// Match explicitly recognizable credentials, never try to infer arbitrary secrets.
export function containsSensitiveCredential(value) {
  return /(?:password|passcode|api[ _-]?key|access[ _-]?token|client[ _-]?secret|session[ _-]?cookie|(?:ltoken|stoken|cookie_token)(?:_v2)?|hoyolab session token)\s*(?::|=|\bis\b)\s*\S+|\bbearer\s+\S+|-----BEGIN.*PRIVATE KEY-----|\b(?:xai|sk)[-_][A-Za-z0-9_-]{20,}/i.test(value);
}
