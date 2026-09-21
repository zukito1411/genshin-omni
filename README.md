# Teyvat Atlas

A React + TypeScript, client-only Genshin Impact reference app for Netlify or Render.

## What it does

- Live playable-character index from GenshinDB.
- Character detail aggregation from GenshinDB + genshin.dev image/entity endpoints.
- Base-stat table from the GenshinDB stats endpoint.
- Talent, constellation and material extraction with schema-tolerant normalization.
- Weapon and artifact live libraries.
- Interactive four-slot team builder with local saves.
- Character material planner with local checklists.
- Public UID/build lookup through Enka.Network.
- Full community map embed plus a local progress tracker.
- FAQ and external community guide hub.
- Local cache, favorites and progress via browser localStorage.
- Netlify SPA rewrite and Render static hosting configuration.

## Data-source boundary

This project does not scrape arbitrary guide sites in the browser. Structured public APIs are used where they are intended for programmatic access; theorycrafting sites are linked as sources. This keeps the app reliable under browser CORS rules and makes source attribution explicit.

Primary structured providers:
- https://genshin-db-api.vercel.app/
- https://genshin.jmp.blue/
- https://enka.network/

Community references:
- https://keqingmains.com/
- https://www.prydwen.gg/genshin/
- https://gensh.honeyhunterworld.com/
- https://genshin-impact.fandom.com/wiki/Genshin_Impact_Wiki
- https://genshinmap.github.io/

## Environment variables

Copy `.env.example` to `.env` only when overriding provider endpoints is necessary:

- `VITE_GENSHIN_DB_API`
- `VITE_GENSHIN_IMAGES_API`
- `VITE_ENKA_API`

## Deploy

### Netlify

Build command: `npm run build`

Publish directory: `dist`

The included `netlify.toml` rewrites all SPA routes to `index.html`.

### Render

Use the included `render.yaml` as a static-site definition.

## Development

```bash
npm install
npm run dev
```

## Important

This is an unofficial fan-made tool. Genshin Impact and its assets remain the property of their respective owners. Provider availability can change independently of this project.
