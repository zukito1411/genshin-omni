import { useEffect, useState } from 'react';

/** Background tabs must not spend battery on decorative animation. */
export function usePageActive() {
  const [active, setActive] = useState(() => document.visibilityState !== 'hidden');
  useEffect(() => {
    const update = () => setActive(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return active;
}
