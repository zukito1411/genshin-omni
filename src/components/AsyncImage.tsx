import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AssetPlaceholder, assetKind } from './AssetPlaceholder';

const successfulSources = new Map<string, string>();
const imageRequests = new Map<string, Promise<boolean>>();
const failedSources = new Map<string, number>();

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

/** Fail over offscreen; broken or undecoded URLs never become visible images. */
function preload(source: string): Promise<boolean> {
  const failedAt = failedSources.get(source);
  if (failedAt && Date.now() - failedAt < 60_000) return Promise.resolve(false);
  const pending = imageRequests.get(source);
  if (pending) return pending;
  const request = new Promise<boolean>((resolve) => {
    const image = new window.Image();
    let finished = false;
    const finish = (success: boolean) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      if (!success) {
        failedSources.set(source, Date.now());
        image.src = '';
        if (failedSources.size > 500) failedSources.delete(failedSources.keys().next().value!);
      }
      else failedSources.delete(source);
      resolve(success);
    };
    const timer = window.setTimeout(() => finish(false), 5_000);
    image.onload = () => {
      if (!image.naturalWidth) { finish(false); return; }
      void (image.decode?.() ?? Promise.resolve()).catch(() => undefined).then(() => finish(true));
    };
    image.onerror = () => finish(false);
    image.src = source;
  }).finally(() => imageRequests.delete(source));
  imageRequests.set(source, request);
  return request;
}

interface AsyncImageProps {
  src: string | string[];
  alt: string;
  className?: string;
  fallback?: ReactNode;
  assetKey?: string;
  loading?: 'eager' | 'lazy';
}

export function AsyncImage({ src, alt, className, fallback, assetKey, loading = 'lazy' }: AsyncImageProps) {
  const sourceKey = [...new Set((Array.isArray(src) ? src : [src]).filter(Boolean))].join('|');
  const identity = assetKey || sourceKey;
  // Card, portrait, skin and icon caches must never overwrite one another.
  const variantKey = `${identity}:${fingerprint(sourceKey)}`;
  const storageKey = `teyvat-atlas:asset:v3:${variantKey}`;
  const placeholder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(loading === 'eager');
  const [resolved, setResolved] = useState<{ identity: string; source: string } | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (visible) return;
    if (loading === 'eager' || !window.IntersectionObserver) { setVisible(true); return; }
    const node = placeholder.current;
    if (!node) return;
    const target = node.getBoundingClientRect().height ? node : node.parentElement ?? node;
    const observer = new window.IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '300px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, visible, sourceKey]);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    const sources = sourceKey ? sourceKey.split('|') : [];
    let remembered = successfulSources.get(variantKey);
    try { remembered ??= localStorage.getItem(storageKey) ?? undefined; } catch { /* Storage is optional. */ }
    const candidates = [...new Set([...(remembered && sources.includes(remembered) ? [remembered] : []), ...sources])];
    const load = async () => {
      for (const source of candidates) {
        if (!active) return;
        if (!await preload(source)) continue;
        if (!active) return;
        successfulSources.set(variantKey, source);
        try { localStorage.setItem(storageKey, source); } catch { /* Storage is optional. */ }
        setResolved({ identity, source });
        return;
      }
      if (active) setResolved((previous) => previous?.identity === identity && candidates.includes(previous.source) ? previous : null);
    };
    void load();
    return () => { active = false; };
  }, [identity, sourceKey, storageKey, variantKey, visible, retry]);

  if (resolved?.identity === identity && sourceKey.split('|').includes(resolved.source)) {
    return <img src={resolved.source} alt={alt} className={className} loading={loading} decoding="async" onError={() => {
      // Also recover if a CDN revalidation fails after a successful preload.
      failedSources.set(resolved.source, Date.now());
      successfulSources.delete(variantKey);
      try { localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      setResolved(null);
      setRetry((attempt) => attempt + 1);
    }} />;
  }
  return <div ref={placeholder} className={`${className ?? ''} image-fallback`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>{fallback === undefined ? <AssetPlaceholder kind={assetKind(assetKey)} /> : fallback}</div>;
}
