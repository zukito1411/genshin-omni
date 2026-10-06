import { getStore } from '@netlify/blobs';
import webpush from 'web-push';
import { createHoyolabProvider } from '../lib/hoyolab-provider.mjs';
import { configuration, STORE, unseal } from '../lib/profile-security.mjs';
import { PUSH_STORE, getPushKeys, pushAlarmKey, pushDueAt, pushPrefix, readPushAlarm, validatePushSubscription, writePushAlarm } from '../lib/resin-push.mjs';

export function createResinScheduler({ sessionStoreFactory = () => getStore({ name: STORE, consistency: 'strong' }), pushStoreFactory = () => getStore({ name: PUSH_STORE, consistency: 'strong' }), provider = createHoyolabProvider(), send = webpush.sendNotification, env = process.env, now = Date.now } = {}) {
  return async (_request, context = {}) => {
    const config = configuration(env);
    // CONTEXT is a build variable, not guaranteed at function runtime. Netlify
    // provides trusted deployment metadata to scheduled handlers instead.
    if (!config || (context.deploy?.context ?? env.CONTEXT) !== 'production' || context.deploy?.published === false) return;
    const sessions = sessionStoreFactory(), pushes = pushStoreFactory(), deadline = now() + 20_000;
    let checked = 0, processed = 0, keys;
    async function active(alarm) {
      const encrypted = await sessions.get(alarm.sessionKey, { type: 'json' });
      if (!encrypted) return null;
      const session = unseal(encrypted, config.key, alarm.sessionKey);
      return session.origin === config.origin && session.expiresAt > now() && session.roles.some((role) => role.uid === alarm.uid) ? session : null;
    }
    for await (const page of pushes.list({ prefix: pushPrefix(config), paginate: true })) {
      for (const blob of page.blobs) {
        if (++checked > 1000 || processed >= 30 || now() >= deadline) return;
        const metadata = await pushes.getMetadata(blob.key);
        if (!metadata) continue;
        if (metadata.metadata.expiresAt <= now()) { await pushes.delete(blob.key); continue; }
        if (typeof metadata.metadata.nextCheck !== 'number' || metadata.metadata.nextCheck > now()) continue;
        const stored = await readPushAlarm(pushes, blob.key, config);
        const alarm = stored?.alarm;
        if (!alarm || alarm.state !== 'armed' || alarm.dueAt > now()) continue;
        if (!new RegExp(`^${pushPrefix(config).split('/')[0]}/[a-f\\d]{64}$`).test(alarm.sessionKey) || pushAlarmKey(config, alarm.sessionKey, alarm.uid) !== blob.key) continue;
        processed++;
        const claimed = await writePushAlarm(pushes, blob.key, { ...alarm, dueAt: now() + 90_000 }, config, stored.etag);
        if (!claimed.modified) continue;
        const next = { ...alarm };
        try {
          const session = await active(alarm);
          if (!session) next.state = 'cancelled';
          else {
            keys ??= await getPushKeys(pushes, config); // Scheduler never creates or rotates keys.
            if (keys.publicKey !== alarm.publicKey) next.state = 'unavailable';
            else {
              const notes = await provider.notes(session.credentials, session.roles.find((role) => role.uid === alarm.uid), AbortSignal.timeout(Math.max(1, Math.min(8000, deadline - now()))));
              next.dueAt = pushDueAt(notes, alarm.target, now());
              if (notes.resin >= alarm.target) {
                const latest = await pushes.getMetadata(blob.key);
                if (latest?.etag !== claimed.etag || !(await active(alarm))) continue;
                const body = `Hey Traveler! Your Original Resin is now ${notes.resin} (target ${alarm.target}). Let’s go on an adventure!`;
                await send(validatePushSubscription(alarm.subscription), JSON.stringify({ body, tag: alarm.tag }), { vapidDetails: keys, TTL: 300, topic: alarm.tag, urgency: 'normal', timeout: 8000 });
                next.state = 'delivered';
              }
              next.attempts = 0;
            }
          }
        } catch (error) {
          if ([404, 410].includes(error?.statusCode) || ['reconnect', 'private_notes', 'invalid_push'].includes(error?.code)) next.state = 'unavailable';
          else {
            next.attempts = (alarm.attempts ?? 0) + 1;
            next.dueAt = now() + Math.min(30, 5 * 2 ** Math.min(next.attempts - 1, 3)) * 60_000;
            if (next.attempts >= 6) next.state = 'unavailable';
          }
        }
        await writePushAlarm(pushes, blob.key, next, config, claimed.etag);
      }
    }
  };
}
export default createResinScheduler();
export const config = { schedule: '*/5 * * * *' };
