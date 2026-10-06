import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { AssetPlaceholder, assetKind } from './AssetPlaceholder';
import { invalidateImage, loadImage, observeImage } from '../api/imageLoader';

const successfulSources = new Map<string, string>();

function fingerprint(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

interface AsyncImageProps {
  src: string | string[];
  alt: string;
  className?: string;
  fallback?: ReactNode;
  assetKey?: string;
  loading?: 'eager' | 'lazy';
}

export const AsyncImage = memo(function AsyncImage({ src, alt, className, fallback, assetKey, loading = 'lazy' }: AsyncImageProps) {
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
    return observeImage(target, () => setVisible(true));
  }, [loading, visible, sourceKey]);

  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const sources = sourceKey ? sourceKey.split('|') : [];
    let remembered = successfulSources.get(variantKey);
    try { remembered ??= localStorage.getItem(storageKey) ?? undefined; } catch { /* Storage is optional. */ }
    const candidates = [...new Set([...(remembered && sources.includes(remembered) ? [remembered] : []), ...sources])];
    const load = async () => {
      for (const source of candidates) {
        if (controller.signal.aborted) return;
        if (!await loadImage(source, loading === 'eager', controller.signal)) continue;
        if (controller.signal.aborted) return;
        successfulSources.set(variantKey, source);
        try { localStorage.setItem(storageKey, source); } catch { /* Storage is optional. */ }
        setResolved({ identity, source });
        return;
      }
      if (!controller.signal.aborted) setResolved((previous) => previous?.identity === identity && candidates.includes(previous.source) ? previous : null);
    };
    void load();
    return () => controller.abort();
  }, [identity, sourceKey, storageKey, variantKey, visible, retry, loading]);

  if (resolved?.identity === identity && sourceKey.split('|').includes(resolved.source)) {
    return <img src={resolved.source} alt={alt} className={className} loading={loading} decoding="async" onError={() => {
      // Also recover if a CDN revalidation fails after a successful preload.
      invalidateImage(resolved.source);
      successfulSources.delete(variantKey);
      try { localStorage.removeItem(storageKey); } catch { /* Storage is optional. */ }
      setResolved(null);
      setRetry((attempt) => attempt + 1);
    }} />;
  }
  return <div ref={placeholder} className={`${className ?? ''} image-fallback`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>{fallback === undefined ? <AssetPlaceholder kind={assetKind(assetKey)} /> : fallback}</div>;
});
