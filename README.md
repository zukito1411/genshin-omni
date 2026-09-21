# Teyvat Atlas

Teyvat Atlas is a player-first Genshin Impact companion built as a **React + TypeScript + Vite static app**.

## Player data sources

- **GenshinDB API** — live character roster and structured game data.
- **genshin.dev** — public entity data and image endpoints used as a fallback.
- **Enka.Network / Hakush / Project Amber** — public game UI asset CDNs used when exact image filenames are available.
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
