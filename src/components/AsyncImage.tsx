import { useEffect, useState } from 'react';

const successfulSources = new Map<string, string>();

interface AsyncImageProps {
  src: string | string[];
  alt: string;
  className?: string;
  fallback?: string;
  assetKey?: string;
}

/** Try image sources in order so one broken provider does not blank the UI. */
export function AsyncImage({ src, alt, className, fallback, assetKey }: AsyncImageProps) {
  const sourceList = Array.isArray(src) ? src.filter(Boolean) : [src].filter(Boolean);
  const sourceKey = sourceList.join('|');
  const storageKey = assetKey ? `teyvat-atlas:asset:v2:${assetKey}` : '';
  const persisted = storageKey ? localStorage.getItem(storageKey) : null;
  const remembered = (assetKey && successfulSources.get(assetKey)) || persisted || successfulSources.get(sourceKey);
  // Always retry the caller's current first choice. A guide may initially give
  // us a guessed URL, then later resolve a verified catalog asset for the same
  // item; the older remembered URL must not prevent that upgrade.
  const sources = [...new Set([sourceList[0], remembered, ...sourceList].filter((value): value is string => Boolean(value)))];
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [assetKey, sourceKey]);

  if (!sources[index]) {
    return <div className={`${className ?? ''} image-fallback`} aria-label={alt}>{fallback ?? 'N/A'}</div>;
  }

  return (
    <img
      src={sources[index]}
      alt={alt}
      className={className}
      loading="lazy"
      onLoad={(event) => {
        const resolved = event.currentTarget.currentSrc || event.currentTarget.src;
        successfulSources.set(assetKey || sourceKey, resolved);
        if (storageKey) localStorage.setItem(storageKey, resolved);
      }}
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
