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

## Player profiles and builds

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

## Browser checks

```bash
npm run test:e2e
```

The Playwright checks use installed Google Chrome and mocked public-provider
responses, so the checks do not require an AI key or consume provider credits.
