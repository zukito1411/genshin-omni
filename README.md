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
