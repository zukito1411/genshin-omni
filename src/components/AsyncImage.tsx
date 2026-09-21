import { useEffect, useState } from 'react';

interface AsyncImageProps {
  src: string | string[];
  alt: string;
  className?: string;
  fallback?: string;
}

/** Try image sources in order so one broken provider does not blank the UI. */
export function AsyncImage({ src, alt, className, fallback }: AsyncImageProps) {
  const sources = Array.isArray(src) ? src.filter(Boolean) : [src].filter(Boolean);
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [sources.join('|')]);

  if (!sources[index]) {
    return <div className={`${className ?? ''} image-fallback`} aria-label={alt}>{fallback ?? alt}</div>;
  }

  return (
    <img
      src={sources[index]}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setIndex((current) => current + 1)}
    />
  );
}
