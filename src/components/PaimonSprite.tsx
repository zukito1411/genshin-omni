import { memo, useEffect, useRef } from 'react';

export type PaimonAction = 'idle' | 'running-right' | 'running-left' | 'waving' | 'jumping' | 'failed' | 'waiting' | 'running' | 'review';
const rows: Record<PaimonAction, number> = { idle: 0, 'running-right': 1, 'running-left': 2, waving: 3, jumping: 4, failed: 5, waiting: 7, running: 1, review: 6 };
const sequences: Record<PaimonAction, number[]> = {
  idle: [0, 1, 2, 4, 2, 3, 6, 7], waving: [5, 1, 2, 3, 4, 5, 6, 5],
  'running-right': [0, 1, 2, 3, 4, 5, 6, 7], 'running-left': [0, 1, 2, 3, 4, 5, 6, 7],
  jumping: [0, 1, 2, 3, 4, 5, 6, 7], failed: [0, 1, 2, 3, 4, 5, 6, 7],
  waiting: [0, 1, 2, 3, 4, 5, 6, 7], running: [0, 1, 2, 3, 4, 5, 6, 7], review: [0, 1, 2, 3, 4, 5, 6, 7],
};

/** Sprite ticks update only this DOM node, not the launcher, chat, or React tree. */
export const PaimonSprite = memo(function PaimonSprite({ action, active }: { action: PaimonAction; active: boolean }) {
  const sprite = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = sprite.current;
    if (!node || !active) return;
    const sequence = sequences[action];
    let index = 0;
    const draw = () => { node.style.backgroundPosition = `-${sequence[index] * 256}px -${rows[action] * 256}px`; };
    draw();
    const delay = action === 'waiting' ? 220 : action === 'review' ? 180 : action === 'idle' ? 170 : action.startsWith('running-') ? 150 : 125;
    const timer = window.setInterval(() => { index = (index + 1) % sequence.length; draw(); }, delay);
    return () => window.clearInterval(timer);
  }, [action, active]);
  return <div ref={sprite} className="paimon-companion__sprite" style={{ pointerEvents: 'none' }} />;
});
