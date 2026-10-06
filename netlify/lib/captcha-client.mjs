// Runs only in an opaque-origin sandbox. No credentials, cookies, app storage,
// or access to the parent document are available here.
export const CAPTCHA_CLIENT = String.raw`(() => {
  let active = false;
  let id;
  let captcha;
  let timer;
  const status = document.getElementById('status');
  const send = (type, proof) => parent.postMessage({ type, id, ...(proof ? { proof } : {}) }, window.loginParentOrigin);
  const fail = () => { clearTimeout(timer); status.textContent = 'The security check could not load. Close this window and try again.'; send('captcha-error'); };
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.origin !== window.loginParentOrigin || active || event.data?.type !== 'captcha-init' || !/^[A-Za-z0-9_-]{43}$/.test(event.data.id)) return;
    const challenge = event.data.challenge;
    if (!challenge || ![3, 4].includes(challenge.version)) return;
    active = true; id = event.data.id;
    timer = setTimeout(fail, 45_000);
    const script = document.createElement('script');
    script.src = challenge.version === 3 ? 'https://static.geetest.com/static/js/gt.0.5.0.js' : 'https://static.geetest.com/v4/gt4.js';
    script.referrerPolicy = 'no-referrer';
    script.onerror = fail;
    script.onload = () => {
      try {
        const init = challenge.version === 3 ? window.initGeetest : window.initGeetest4;
        const options = challenge.version === 3 ? { gt: challenge.gt, challenge: challenge.challenge, new_captcha: challenge.newCaptcha, offline: challenge.offline, api_server: 'api-na.geetest.com', product: 'popup', https: true, lang: 'en', width: '100%' } : { captchaId: challenge.gt, riskType: challenge.riskType, userInfo: JSON.stringify({ mmt_key: challenge.sessionId }), apiServers: ['gcaptcha4.captchami.com'], product: 'popup', language: 'eng', nativeButton: { width: '100%', height: '44px' } };
        init(options, (instance) => {
          captcha = instance;
          captcha.appendTo('#captcha');
          captcha.onReady(() => { clearTimeout(timer); status.textContent = 'Complete the check below to finish signing in.'; });
          captcha.onError(fail);
          captcha.onSuccess(() => {
            const value = captcha.getValidate();
            if (!value) return fail();
            const names = challenge.version === 3 ? ['geetest_challenge', 'geetest_validate', 'geetest_seccode'] : ['captcha_id', 'lot_number', 'pass_token', 'gen_time', 'captcha_output'];
            const proof = Object.fromEntries(names.map((name) => [name, value[name]]));
            status.textContent = 'Check complete. Finishing sign-in…';
            send('captcha-success', proof);
          });
        });
      } catch { fail(); }
    };
    document.head.append(script);
  });
  window.addEventListener('pagehide', () => { clearTimeout(timer); captcha?.destroy?.(); });
  if (parent !== window) send('captcha-ready');
})();`;
