import { randomBytes } from 'node:crypto';
import { configuration } from '../lib/profile-security.mjs';
import { CAPTCHA_CLIENT } from '../lib/captcha-client.mjs';

export function captchaPage(origin) {
  const nonce = randomBytes(18).toString('base64');
  const domains = 'https://*.geetest.com https://*.geevisit.com https://*.gsensebot.com https://*.captchami.com';
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>HoYoLAB security check</title><style>body{margin:0;padding:4px;background:#fff;color:#222;font:16px system-ui;text-align:center;overflow-x:hidden}button{font:inherit;min-height:44px}#status{line-height:1.5}</style></head><body><p id="status" role="status">Loading HoYoLAB security check…</p><div id="captcha"></div><script nonce="${nonce}">window.loginParentOrigin=${JSON.stringify(origin)};${CAPTCHA_CLIENT}</script></body></html>`, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'Netlify-CDN-Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'SAMEORIGIN', 'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}' 'unsafe-eval' ${domains}; style-src 'unsafe-inline' ${domains}; img-src data: blob: ${domains}; connect-src ${domains}; font-src ${domains}; frame-src ${domains}; frame-ancestors ${origin}; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-popups` },
  });
}
export default async function handler(request) {
  const config = configuration(process.env);
  if (!config || process.env.HOYOLAB_DIRECT_LOGIN === 'false' || request.method !== 'GET' || new URL(request.url).search) return new Response('Security check unavailable.', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return captchaPage(config.origin);
}
export const config = { path: '/api/hoyolab-captcha' };
