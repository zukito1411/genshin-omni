import { getStore } from '@netlify/blobs';
import { STORE } from '../lib/profile-security.mjs';
import { PUSH_STORE } from '../lib/resin-push.mjs';

// Invoked by Netlify's scheduler, not a public route. No credentials are decrypted.
export default async (_request, context = {}) => {
  // Cleanup must continue after account linking is disabled or keys are rotated.
  if ((context.deploy?.context ?? process.env.CONTEXT) !== 'production' || context.deploy?.published === false) return;
  let checked = 0;
  const deadline = Date.now() + 20_000;
  for (const name of [STORE, PUSH_STORE]) {
    const store = getStore({ name, consistency: 'strong' });
    for await (const page of store.list({ paginate: true })) {
      for (const blob of page.blobs) {
        if (++checked > 1000 || Date.now() >= deadline) return;
        const entry = await store.getMetadata(blob.key);
        if (typeof entry?.metadata?.expiresAt === 'number' && entry.metadata.expiresAt <= Date.now()) await store.delete(blob.key);
      }
    }
  }
};
export const config = { schedule: '17 * * * *' };
