import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AssetPlaceholder, assetKind } from './AssetPlaceholder';

const successfulSources = new Map<string, string>();

interface AsyncImageProps {
  src: string | string[];
  alt: string;
  className?: string;
  fallback?: ReactNode;
  assetKey?: string;
  loading?: 'eager' | 'lazy';
}

/** Try image sources in order so one broken provider does not blank the UI. */
export function AsyncImage({ src, alt, className, fallback, assetKey, loading = 'lazy' }: AsyncImageProps) {
  const sourceList = Array.isArray(src) ? src.filter(Boolean) : [src].filter(Boolean);
  const sourceKey = sourceList.join('|');
  const storageKey = assetKey ? `teyvat-atlas:asset:v2:${assetKey}` : '';
  // Always retry the caller's current first choice. A guide may initially give
  // us a guessed URL, then later resolve a verified catalog asset for the same
  // item; the older remembered URL must not prevent that upgrade.
  // Freeze the candidate order for this asset. Recording a successful third
  // candidate must not reorder it while the image's index is still 2.
  const sources = useMemo(() => {
    let persisted: string | null = null;
    try { persisted = storageKey ? localStorage.getItem(storageKey) : null; } catch { /* Storage is optional. */ }
    const remembered = (assetKey && successfulSources.get(assetKey)) || persisted || successfulSources.get(sourceKey);
    return [...new Set([sourceList[0], remembered, ...sourceList].filter((value): value is string => Boolean(value)))];
  }, [assetKey, sourceKey, storageKey]);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [assetKey, sourceKey]);

  if (!sources[index]) {
    return <div className={`${className ?? ''} image-fallback`} role={alt ? 'img' : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true}>{fallback === undefined ? <AssetPlaceholder kind={assetKind(assetKey)} /> : fallback}</div>;
  }

  return (
    <img
      src={sources[index]}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onLoad={(event) => {
        const resolved = event.currentTarget.currentSrc || event.currentTarget.src;
        successfulSources.set(assetKey || sourceKey, resolved);
        try { if (storageKey) localStorage.setItem(storageKey, resolved); } catch { /* Storage is optional. */ }
      }}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
