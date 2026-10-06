import { randomUUID } from 'node:crypto';
import { boundedJson, ConnectionError, parseCredentials } from './hoyolab-provider.mjs';

// Protocol reference (unofficial, global HoYoLAB only):
// https://github.com/seriaati/genshin.py/blob/master/genshin/client/components/auth/subclients/web.py
const LOGIN_URL = 'https://sg-public-api.hoyolab.com/account/ma-passport/api/webLoginByPassword';
const field = (value, limit = 256) => typeof value === 'string' && value.length > 0 && value.length <= limit && /^[A-Za-z0-9_.|+\/=-]+$/.test(value);

export function encryptedCredentials(payload) {
  for (const name of ['account', 'password']) {
    const value = payload?.[name];
    if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{342}==$/.test(value) || Buffer.from(value, 'base64').length !== 256) throw new ConnectionError('invalid_login', 400);
  }
  return { account: payload.account, password: payload.password };
}
export function loginChallenge(raw) {
  if (typeof raw !== 'string' || raw.length > 4096) throw new ConnectionError('login_verification', 409);
  try {
    const wrapper = JSON.parse(raw);
    const data = typeof wrapper.data === 'string' ? JSON.parse(wrapper.data) : wrapper.data ?? wrapper;
    if (!field(wrapper.session_id) || !field(data.gt ?? data.captcha_id, 64)) throw new Error();
    const common = { sessionId: wrapper.session_id, gt: data.gt ?? data.captcha_id };
    if (field(data.challenge)) return { ...common, version: 3, challenge: data.challenge, newCaptcha: data.new_captcha !== 0, offline: data.success === 0 };
    if (field(data.risk_type, 64)) return { ...common, version: 4, riskType: data.risk_type };
    throw new Error();
  } catch { throw new ConnectionError('login_verification', 409); }
}
export function captchaProof(challenge, input) {
  const names = challenge.version === 3 ? ['geetest_challenge', 'geetest_validate', 'geetest_seccode'] : ['captcha_id', 'lot_number', 'pass_token', 'gen_time', 'captcha_output'];
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some((name) => !names.includes(name))) throw new ConnectionError('invalid_login', 400);
  const result = {};
  for (const name of names) {
    if (!field(input[name], name === 'captcha_output' ? 2048 : 256)) throw new ConnectionError('invalid_login', 400);
    result[name] = input[name];
  }
  if (challenge.version === 4 && result.captcha_id !== challenge.gt) throw new ConnectionError('invalid_login', 400);
  return `${challenge.sessionId};${Buffer.from(JSON.stringify(result)).toString('base64')}`;
}
export function createLoginProvider(fetcher = fetch) {
  return {
    deviceId: () => randomUUID(),
    async login(credentials, deviceId, challenge, proof) {
      const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'x-rpc-app_id': 'c9oqaq3s3gu8', 'x-rpc-client_type': '4', 'x-rpc-device_id': deviceId, Origin: 'https://account.hoyolab.com', Referer: 'https://account.hoyolab.com/' };
      if (challenge) headers['x-rpc-aigis'] = captchaProof(challenge, proof);
      // The only credential input is an RSA ciphertext for HoYoLAB's public key.
      // Never follow redirects, retry a password attempt, or persist this payload.
      const response = await fetcher(LOGIN_URL, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12_000), headers, body: JSON.stringify({ ...encryptedCredentials(credentials), token_type: 6 }) });
      if (!response.ok) throw new ConnectionError(response.status === 429 ? 'rate_limited' : 'login_unavailable', response.status === 429 ? 429 : 503);
      const body = await boundedJson(response, 64_000);
      if (body.retcode === -3101) return { challenge: loginChallenge(response.headers.get('x-rpc-aigis')) };
      if ([-3004, -3208, -3203].includes(body.retcode)) throw new ConnectionError('login_failed', 401);
      if (body.retcode === -3202) throw new ConnectionError('login_locked', 429);
      if ([-110, -3006, -3206].includes(body.retcode)) throw new ConnectionError('rate_limited', 429);
      if (body.retcode === -3102) throw new ConnectionError('login_verification', 409);
      if (body.retcode !== 0) throw new ConnectionError('login_unavailable', 503);
      const cookies = new Map();
      for (const cookie of response.headers.getSetCookie()) {
        const match = cookie.match(/^\s*(ltuid_v2|ltoken_v2|ltuid|ltoken)=([^;]*)/);
        if (match) {
          const value = decodeURIComponent(match[2]);
          if (cookies.has(match[1]) && cookies.get(match[1]) !== value) throw new ConnectionError('login_unavailable');
          cookies.set(match[1], value);
        }
      }
      const version = cookies.has('ltoken_v2') ? 'v2' : 'v1';
      const suffix = version === 'v2' ? '_v2' : '';
      try { return { credentials: parseCredentials({ accountId: cookies.get(`ltuid${suffix}`), token: cookies.get(`ltoken${suffix}`), version }) }; }
      catch { throw new ConnectionError('login_unavailable'); }
    },
  };
}
