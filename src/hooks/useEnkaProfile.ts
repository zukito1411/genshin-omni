import { useEffect, useState } from 'react';
import { fetchEnkaByUid, fetchEnkaMetadata } from '../api/enka';
import type { EnkaMetadata, EnkaProfile } from '../types/enka';

let metadataRequest: Promise<EnkaMetadata> | null = null;
let storedMetadata: EnkaMetadata | null = null;

export function useEnkaProfile(uid?: string) {
  const [profile, setProfile] = useState<EnkaProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<EnkaMetadata | null>(storedMetadata);
  const [metadataError, setMetadataError] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(Boolean(uid) && !storedMetadata);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!uid) { setProfile(null); setLoading(false); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 25_000);
    let active = true;
    setProfile(null);
    setError(null);
    setLoading(true);
    fetchEnkaByUid(uid, controller.signal, attempt > 0)
      .then((value) => { if (active) setProfile(value); })
      .catch((reason: unknown) => {
        if (active) setError(controller.signal.aborted ? 'Lookup took too long. Please try again.' : reason instanceof Error ? reason.message : 'Lookup failed.');
      })
      .finally(() => { window.clearTimeout(timer); if (active) setLoading(false); });
    return () => { active = false; window.clearTimeout(timer); controller.abort(); };
  }, [uid, attempt]);

  useEffect(() => {
    if (!uid) { setMetadataLoading(false); return; }
    if (storedMetadata && attempt === 0) { setMetadata(storedMetadata); setMetadataLoading(false); return; }
    let active = true;
    setMetadataError(false);
    setMetadataLoading(true);
    metadataRequest ??= fetchEnkaMetadata(undefined, attempt > 0).then((value) => { storedMetadata = value; return value; }).finally(() => { metadataRequest = null; });
    metadataRequest.then((value) => { if (active) setMetadata(value); })
      .catch(() => { if (active) setMetadataError(true); })
      .finally(() => { if (active) setMetadataLoading(false); });
    return () => { active = false; };
  }, [uid, attempt]);

  return { profile, loading, error, metadata, metadataError, metadataLoading, retry: () => setAttempt((value) => value + 1) };
}
