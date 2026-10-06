import { getStore } from '@netlify/blobs';
import { STORE } from '../lib/profile-security.mjs';

// Invoked by Netlify's scheduler, not a public route. No credentials are decrypted.
export default async () => {
  // Cleanup must continue after account linking is disabled or keys are rotated.
  if (process.env.CONTEXT !== 'production') return;
  const store = getStore({ name: STORE, consistency: 'strong' });
  const pages = store.list({ paginate: true });
  let checked = 0;
  const deadline = Date.now() + 20_000;
  for await (const page of pages) {
    for (const blob of page.blobs) {
      if (++checked > 1000 || Date.now() >= deadline) return;
      const entry = await store.getMetadata(blob.key);
      if (typeof entry?.metadata?.expiresAt === 'number' && entry.metadata.expiresAt <= Date.now()) await store.delete(blob.key);
    }
  }
};
export const config = { schedule: '17 * * * *' };
