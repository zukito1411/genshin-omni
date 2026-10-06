import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { NewsImageCandidate } from '../utils/newsImages';

const failures = new Map<string, number>();
const keyOf = (candidate: NewsImageCandidate) => `${candidate.src}|${candidate.srcSet ?? ''}`;

export function NewsBannerImage({ candidates }: { candidates: NewsImageCandidate[] }) {
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(() => new Set());
  const candidate = useMemo(() => candidates.find((entry) => !failed.has(keyOf(entry)) && (failures.get(keyOf(entry)) ?? 0) < Date.now() - 60_000), [candidates, failed]);
  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const next = Math.ceil(element.getBoundingClientRect().width);
      if (next > 0) setWidth((previous) => previous === next ? previous : next);
    };
    measure();
    if (!window.ResizeObserver) return;
    const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  if (!candidates.length) return null;
  return <div ref={container} className="news-banner-image" style={{ width: '100%', aspectRatio: '16 / 7', maxWidth: '100%', overflow: 'hidden', lineHeight: 0, background: 'rgba(0, 0, 0, 0.25)' }}>
    {width > 0 && candidate && <img key={keyOf(candidate)} src={candidate.src} srcSet={candidate.srcSet} sizes={`${width}px`} alt="" aria-hidden="true" decoding="async" referrerPolicy="no-referrer" style={{ display: 'block', width: '100%', height: '100%', maxWidth: '100%', objectFit: 'cover', objectPosition: 'center' }} onError={() => {
      const key = keyOf(candidate); failures.set(key, Date.now());
      if (failures.size > 128) failures.delete(failures.keys().next().value!);
      setFailed((previous) => new Set([...previous, key]));
    }} />}
  </div>;
}
