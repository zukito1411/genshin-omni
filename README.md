# Teyvat Atlas

Teyvat Atlas is a player-first Genshin Impact companion built as a **React + TypeScript + Vite static app**.

## Player data sources

- **GenshinDB API** — live character roster and structured game data.
- **genshin.dev** — public entity data and image endpoints used as a fallback.
- **Enka.Network / Hakush / Project Amber** — public game UI asset CDNs used when exact image filenames are available.
- **PathOfGenshin resources** — optional GitHub fallback for older game UI artwork; game assets belong to HoYoverse.
- **Genshin.gg** — current public player build reference.
- **Genshin Builds** — secondary public player build reference.
- **Genshin Build** — additional public build reference used when primary build sources do not provide enough data.
- **KeqingMains** — theorycrafting reference and fallback guide source.
- **Community marker dataset** — live marker data rendered in the in-app searchable map, with MapGenie linked for its full external map experience.
- **Enka.Network** — optional UID build lookup.

Build pages are fetched on demand through the public Jina Reader service so the application can remain frontend-only. Successful results are cached locally in the browser.

## Development

```bash
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally:

```text
http://localhost:5173
```

There is **no `server.mjs`, Express server, or `npm start` requirement**.

## Production build

```bash
npm run build
npm run preview
```

## Installed app artwork

The manifest supplies 192px/512px Android icons, a separate mask-safe icon, and
a 180px iPhone touch icon. They are generated from the existing 500px logo;
the 512px standard icon keeps the source at native resolution on a padded
canvas rather than inventing extra detail. Header artwork uses small lossless
32px–128px WebP/PNG variants selected for the screen's pixel density. Regenerate
these checked-in assets after updating the source logo with `npm run assets:icons`.

News banners prefer declared originals of the same cover and honor supplied
responsive image sets. Public HoYoLAB uploads use bounded 320px–2048px WebP
variants matching the existing centered crop and measured display width. Failed
processed images fall back to originals; signed URLs and intentional image
transformations are left untouched. If every image fails, the article stays
readable without endlessly retrying the same URLs. Low-resolution source artwork
cannot gain new detail from resizing. The layout and decorative background are
unchanged.

After deployment, a phone may retain its previously saved home-screen icon;
re-add the home-screen shortcut if necessary. Do not clear website data just
to refresh an icon, since that can erase local rosters, plans, and Paimon notes.
This adds install metadata, not offline support. The optional resin notification
worker handles notifications only; it never intercepts requests or caches private
account responses.

## Render

Deploy as a **Render Static Site**:

```text
Build command: npm install && npm run build
Publish directory: dist
```

The included `render.yaml` also contains the SPA rewrite so direct routes such as `/characters/albedo` continue to work.

## AI Paimon on Netlify

The optional AI reply runs through the Netlify Function at `/api/paimon-chat`.
It keeps the xAI key on the server: never add the key to a Vite variable, `.env`
file committed to Git, or frontend source code.

In **Netlify → Site configuration → Environment variables**, add:

```text
XAI_API_KEY = <a newly generated xAI API key>
XAI_MODEL = grok-4.7
```

`XAI_MODEL` is optional and can be changed to another xAI model available to
the account. Redeploy after setting the variables. When the AI endpoint is
missing, unavailable, or returns an error, Paimon automatically uses the
built-in browser guide instead.

Render is configured as a static site, so it does not host this function.

## Connected My Profile on Netlify

`My Profile` is the second navigation item. `/me` is separate from public UID
Search and device-local My Roster. It supports opt-in global HoYoLAB session
connection, owned-character builds, achievement/active-day totals, Abyss/Theater
summaries when supplied, exploration, and Real-Time Notes (resin, commissions,
realm currency, expeditions). Character details load only when opened; a bounded,
per-session server-memory cache shares recent reads for 30 seconds. Missing
information is marked unavailable, never fabricated.

Connected profiles automatically resolve the owned UID's public avatar and
namecard through Enka, without requiring another search. Only artwork filenames
are returned; HoYoLAB credentials never go to Enka, and public profile/build
payloads are not stored as part of this lookup. Public in-game changes may take
a few minutes to appear. Character details parse HoYoLAB's nested `base` and
property map; exploration uses alternate supplied icons/covers when necessary.

The main connection flow is now **email/username and HoYoverse password**, followed
by HoYoLAB's CAPTCHA when required. Credentials are RSA-encrypted in the browser
for HoYoLAB's public key before being sent to `/api/hoyolab-login`; this backend
does not have the private key and never stores passwords or their ciphertexts.
After successful authentication, only the account-reading session cookies are
kept in the encrypted profile record. The RSA library loads only on sign-in.

This remains **an unofficial integration, not official HoYoLAB OAuth**. It uses
the community-documented global web-login protocol from genshin.py. Google,
Apple, and other social logins are not implemented. Unexpected security checks
fail closed instead of bypassing verification. There is no QR-login promise:
the maintained library's QR flow is for mainland Miyoushe, not global HoYoLAB.
The original `ltuid_v2` / `ltoken_v2` (or legacy) import remains available only
inside the collapsed **Advanced session connection (optional)** section.
No privacy settings are automatically changed and no rewards are claimed.
Neither connection method automatically signs into the external official map.

The backend is in the same repository, deployed as Netlify Functions. Netlify
Blobs supplies private persistence; no separate Render server/database is needed.
Render **Static Sites** and plain `vite dev`/`vite preview` cannot host these
functions: My Profile shows an unavailable state and never requests credentials
when the backend is absent or disabled. Public player tools remain usable.

Before enabling this publicly, set these **server-only production Function
environment variables** in Netlify and redeploy:

```text
HOYOLAB_ENABLED = true
HOYOLAB_APP_ORIGIN = https://your-exact-production-domain.example
HOYOLAB_ENCRYPTION_KEY = <64 hexadecimal characters from 32 random bytes>
```

Generate the encryption key locally, then paste it into Netlify's protected
environment settings (never Git, a `VITE_` variable, chat, or frontend source):

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Use the exact HTTPS origin, with no path/query. The current SDK requires Node
22.12+; Netlify is configured for Node 22. Blobs is automatically available in
Netlify Functions; no personal Netlify access token belongs in the frontend.
Production-only checks disable linking on Deploy Previews/branch deploys.
Changing the encryption key invalidates previous connections. Disabling
`HOYOLAB_ENABLED` stops account access immediately. Netlify usage quotas apply.
Direct sign-in uses these same three settings; no additional API key is needed.
Optionally set `HOYOLAB_DIRECT_LOGIN=false` to disable password sign-in while
keeping existing connected sessions and advanced session import available.

Security boundaries:

- HoYoLAB credentials and connection records are AES-256-GCM encrypted, bound
  to the exact origin and an unguessable session key. Storage reads use strong
  consistency so disconnects take effect immediately.
- Direct sign-in accepts only bounded 2048-bit RSA ciphertexts, not plaintext
  emails/passwords. Provider destinations are fixed, redirects are rejected,
  and password attempts are never automatically retried. HoYoLAB's extra
  cookies (such as cookie tokens and stokens) are discarded, not persisted.
- CAPTCHA continuation tickets are authenticated-encrypted, bound to the
  originating browser and encrypted credentials, and expire after five minutes.
  Atomic, short-lived used-ticket records prevent replay across function
  instances. HoYoLAB verifies the user's CAPTCHA proof before a profile session
  can be created. Cancel/tab-hide clears pending browser credentials; failures
  clear the password field. No login data is stored in local/session storage.
- The browser receives only a random `__Host-` cookie (`HttpOnly`, `Secure`,
  `SameSite=Strict`) and a CSRF token held in memory. Connections expire after
  24 hours. Disconnect deletes the server record and clears this cookie.
- Account ownership comes from HoYoLAB's authenticated game-role list, not
  user-submitted UID claims. Private character requests are checked against
  that connected account's owned roster.
- Private responses forbid browser/CDN caching; they bypass the public HTTP
  and local-storage caches and are never automatically sent to AI Paimon.
- Writes require the exact origin, the application header, and (after linking)
  the connection's CSRF token. Body sizes, credentials, image hosts, and provider
  destinations are bounded/allowlisted. Redirects and arbitrary proxy URLs are
  rejected. Raw provider errors/credentials are not logged or exposed.
- Netlify platform rate limiting plus a bounded warm-instance throttle protect
  this endpoint. CSP restricts scripts to the site's own assets; inline styles
  remain allowed for the existing animated UI. CAPTCHA scripts execute only in
  an opaque-origin sandbox with a separate nonce-based CSP and allowlisted
  CAPTCHA domains. They cannot access the app document, credentials, cookies,
  or storage. Other pages retain frame blocking and MIME-sniffing protection.
- The hourly scheduled cleanup removes expired encrypted records on a
  best-effort bounded pass. Expired sessions are denied immediately regardless
  of cleanup; retention is not an exact deletion-time guarantee at large scale.
  Cleanup continues when linking is disabled or the encryption key is rotated.

Provider routes/field definitions are cross-checked against the maintained
[genshin.py implementation](https://github.com/seriaati/genshin.py). This is an
unofficial HoYoLAB integration; upstream changes, session expiry, and verification
challenges can prevent live access. Tests use fake credentials and mocked provider
responses, not a real HoYoLAB login. Direct login/CAPTCHA must be verified on a
restricted production deployment before accepting public connections. No test
uses a real account or an automated CAPTCHA solver. Security testing reduces risk;
it is not an independent audit or a guarantee against breaches.

Resin is a timestamped HoYoLAB reading, not an invented live counter.

### Paimon resin notifications

When Real-Time Notes supplies resin, **Paimon’s resin alarm** appears below its
count. Set a whole-number target and Paimon shows a one-time **in-site alert**
with her face when a fresh HoYoLAB reading reaches that target or higher.
**No new environment variables, email address, or manual push-key setup is
needed.** The existing My Profile connection supplies the authenticated resin
reading. On supported browsers, selecting **Also notify on this device** and
allowing notifications saves a device alarm that can notify with the app closed.

Optionally select **Also notify on this device** before setting the alarm.
Permission is requested only from that button gesture, never on page load.
Netlify automatically generates one persistent Web Push key pair on first setup,
stores it authenticated-encrypted in Blobs using the existing account encryption
key, and supplies only the public key to the browser. Conditional writes prevent
racing cold starts from generating incompatible keys. The configured HTTPS app
origin is the VAPID subject: no email service/contact address is required. Keys
survive deploys; changing the account encryption key also resets push setup.

The UI explicitly confirms **Device alarm saved. You can close the app.** only
after the server accepts the alarm. Device alarms are restored after reloading
and can be cancelled under Original Resin. Their encrypted records contain an
owned UID, target, browser subscription, and reference to the existing session,
never a duplicate HoYoLAB login token. Disconnect/session expiry stops delivery;
the existing connected session still expires after 24 hours. Targets predicted
after expiry must be lowered or set after reconnecting. Notifications contain
resin only, not a nickname, UID or login information (resin may appear on the
lock screen). Browser push services receive the encrypted notification, not the
private profile or HoYoLAB credentials. Nothing is automatically sent to AI.

The production Netlify scheduled function `resin-notifications` checks due alarms
every five minutes (288 invocations/day; hosting/Blobs quotas apply). It re-reads
actual HoYoLAB resin: spending resin reschedules the check, instead of sending
an invented timer-based count. Strong reads, conditional alarm leases, idempotent
save IDs, and a final cancellation/session check prevent duplicate or revoked
sends. Already accepted OS messages cannot be recalled. Short-lived deliveries
use a five-minute TTL; outages back off, expired subscriptions stop, and hourly
cleanup removes expired alarm records. Passes are bounded to 1,000 records, 30
due alarms and approximately 20 seconds of work; larger deployments require a
queue/partitioning. This is not an exact-time or guaranteed-delivery alarm.

Denied permission or unavailable Web Push leaves the open-app in-site alarm
available, with clear guidance that closing/reloading cancels that fallback.
Push-mode clients do not run a second local resin notifier; incoming worker
messages update the in-site alert without sending duplicate OS notifications.
No private profile/UID/CSRF/target is persisted in localStorage/IndexedDB. The
notification worker never fetches private notes, caches responses, or runs timers.

On iPhone/iPad, use the installed Home Screen app on iOS 16.4+; Android/desktop
need a browser supporting Web Push and notification permission. Delivery depends
on connectivity, OS/browser/Focus settings and upstream service availability.
Redeploy on Netlify to enable the included scheduled function. Render Static
Sites alone cannot run this backend. Automated tests use fake accounts and mocked
push delivery; test a real closed-app notification on your own installed app
after deployment before advertising guaranteed delivery. See [WebKit’s Home
Screen notification guidance](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
and [Netlify scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/).

## Local Paimon notebook and tools

The fallback is a lightweight, on-demand browser assistant, not a self-training
neural model. Paimon keeps her personality, asks clarifying questions, and can
recall user-taught notes and recent exchanges after a reload. Try:

- `my name is Alex`, `I main Ayaka`, or `remember my goal is build Furina`.
- `teach my rotation => skill, burst, then normal attacks`.
- `what is my goal?`, `what do you remember?`, or `show our chat history`.
- `(12 + 8) * 3`, then `multiply that by 2` or `show steps`.
- `solve 2x + 3 = 7`, `solve x^2 - 5x + 6 = 0`, or `solve x+y=5; x-y=1`.
- `differentiate x^3 + 2x`, `integrate x^2 from 0 to 3`, or `convert 2 km to m`.
- `analyze: 1,2,3,4` or `regression: 1,2,3; 2,4,6`.
- `memory help`, `forget goal`, or `forget everything` followed by
  `confirm forget everything`.

Math uses a bounded parser, not executable user text. Supported tools include
scientific functions, percentages, combinatorics, linear/quadratic equations,
two-variable linear systems, polynomial power rules (input degree up to 8),
compatible length/mass/time and temperature conversions, descriptive statistics,
and paired-data regression/correlation. Ordinary trigonometric functions use
radians; `sind`, `cosd`, and `tand` use degrees. Decimal displays round to 12
significant digits. Arbitrary word problems, proofs, symbolic calculus, exact
large-integer arithmetic, and predictions are not guaranteed; unsupported
questions may use the configured cloud AI, otherwise Paimon states her limits.

The notebook retains at most 80 notes and 30 recent exchanges in IndexedDB, with
localStorage or session-only fallback if browser storage is blocked. Memory is
device/browser-local, unencrypted, and disappears when that site's browser data
is cleared. Teaching updates saved notes, not model weights; notes are clearly
marked as user-provided rather than independently verified knowledge. Forgetting
one note also clears the journal to prevent old exchanges resurfacing that note;
forgetting everything does not change roster, teams, or farming preferences.

Local commands and supported math do not call the AI endpoint. General questions
still try cloud AI first, with native fallback, an 18-second whole-request
deadline, and a short cooldown after provider failure. Only the current question,
page/character context, and device time go to the provider: the notebook and
conversation journal are never automatically uploaded. Cloud requests therefore
do not receive past conversations for context. Recognizable credentials are
blocked from storage and requests, but do not put sensitive information in chat.
No local model download, new service, or paid dependency is required.

## Player profiles and builds

Public pages show readable game information, not raw showcase JSON, API links,
query strings, or network/parser error details. References remain available as
source credits, while technical implementation notes belong in this README.

`/profile` is the UID search page. Open a public profile at `/profile/<uid>`,
then select a showcase character to see combat attributes, equipment,
artifact main/substats, talents, and constellations. Character build links
can be bookmarked and refreshed. Enka exposes only the player's public
showcase, and the details reflect the last available snapshot.

Profiles also show the public avatar, equipped namecard background, featured
namecards, achievement total, and Abyss floor/chamber record when supplied.
Public UID data does not reveal individual achievement unlocks, a complete
owned roster, or detailed Abyss/Theater histories; missing fields remain unavailable.
Artwork uses exact filenames from provider metadata with independent image
fallbacks and decorative placeholders when no image can be downloaded.

Images are loaded and decoded before being displayed, with near-viewport lazy
loading and a separate remembered source for each artwork variant. Failed
sources stay offscreen. Character kits merge complementary provider fields
without duplicating talents or losing icons; missing combat/constellation icons
can use Enka's game-ID-matched catalog. Unavailable optional sources settle into
an unavailable state instead of retrying indefinitely. Shared HTTP requests have
bounded retries/timeouts and can retain cached data during a provider outage.

UID builds support both current and legacy equipment fields. Missing resolved
weapon stats are calculated from the official catalog's level/ascension curves;
artifact main stats and substats use level tables and the snapshot's individual
roll IDs. Supplied values always take precedence, and unknown rolls are not
presented as partial totals. Searching the same UID refreshes its data and definitions.

Individual artifact-piece names resolve by exact game icon identifiers through
GenshinDB. A compact bundled catalog preserves known piece/set names during
provider outages, even when public snapshots omit their name hashes.

On touch devices and screens up to 700px wide, hold the Paimon bubble briefly and drag it.
Releasing docks it halfway against the nearest edge and remembers the position
on this device. A tap opens the helper.

## Performance behavior

Routes load on demand. Paimon moves with compositor-friendly transforms; sprite
ticks update only her sprite node and pause in hidden tabs. Local artwork has
lossless WebP variants with PNG fallbacks, and the floating badge uses a small
frame instead of the entire atlas. To regenerate these assets using the installed
Playwright codecs, run `node scripts/optimize-assets.mjs`.

Image downloads share decoded results, use one near-viewport observer, prioritize
eager artwork, and run four at a time. Cancelled screens release queued work.
Only repeated provider timeouts trigger a brief provider cooldown; individual
missing images do not disable an otherwise healthy provider.

Character details, comparisons, and UID metadata publish useful records before
optional sources finish. Farming plans fetch only their two cost sources, with
two characters and three material enrichments in flight at a time. Large HTTP
responses persist asynchronously in IndexedDB; small/legacy caches remain
compatible. Refresh latest data clears response caches without deleting roster,
team, widget, or checklist preferences. Storage failures retain a fallback path.

## Browser checks

```bash
npm run test:e2e
```

The Playwright checks use installed Google Chrome and mocked public-provider
responses, so the checks do not require an AI key or consume provider credits.

On PowerShell, the UI checks can also use the built production bundle:

```powershell
npm run build
$env:PLAYWRIGHT_PRODUCTION = '1'
npm run test:e2e -- --grep-invert 'HTTP retries|image scheduler|large response caches'
Remove-Item Env:PLAYWRIGHT_PRODUCTION
```

The three excluded checks import internal source modules through Vite and remain
covered by the normal development-server suite.
