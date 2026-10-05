import { useEffect, useRef, useState, type PointerEvent } from 'react';

const POSITION_KEY = 'teyvat-atlas:paimon-widget:v1';
const SIZE = 58;
const HOLD_MS = 300;
const MOBILE_QUERY = '(max-width: 700px), (pointer: coarse)';
type Dock = { side: 'left' | 'right'; y: number };
type Point = { x: number; y: number };
type Gesture = { id: number; start: Point; origin: Point; held: boolean; moved: boolean };

function readDock(): Dock {
  try {
    const stored = JSON.parse(localStorage.getItem(POSITION_KEY) ?? 'null') as Dock | null;
    if (stored && ['left', 'right'].includes(stored.side) && Number.isFinite(stored.y)) {
      return { side: stored.side, y: Math.min(1, Math.max(0, stored.y)) };
    }
  } catch { /* Position persistence is optional. */ }
  return { side: 'right', y: 0.85 };
}

function viewport() {
  return { width: window.innerWidth, height: window.innerHeight };
}

function clampPoint(point: Point, width: number, height: number): Point {
  return { x: Math.max(0, Math.min(width - SIZE, point.x)), y: Math.max(12, Math.min(Math.max(12, height - SIZE - 36), point.y)) };
}

export function PaimonLauncher({ onOpen, open }: { onOpen: () => void; open: boolean }) {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  const [screen, setScreen] = useState(viewport);
  const [dock, setDock] = useState(readDock);
  const [dragPosition, setDragPosition] = useState<Point | null>(null);
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const holdTimer = useRef<number | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const suppressClick = useRef(false);
  const positionRef = useRef<Point | null>(null);
  const dockedPosition = clampPoint({ x: dock.side === 'left' ? 0 : screen.width - SIZE, y: dock.y * (screen.height - SIZE) }, screen.width, screen.height);
  const point = dragPosition ?? { ...dockedPosition, x: dock.side === 'left' ? (expanded ? 12 : -SIZE / 2) : screen.width - (expanded ? SIZE + 12 : SIZE / 2) };

  function clearHold() {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
  }

  function startGesture(event: PointerEvent<HTMLButtonElement>) {
    if (!mobile || !event.isPrimary || event.button !== 0) return;
    clearHold();
    suppressClick.current = false;
    const rect = event.currentTarget.getBoundingClientRect();
    const origin = { x: rect.left, y: rect.top };
    gesture.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin, held: false, moved: false };
    positionRef.current = origin;
    event.currentTarget.setPointerCapture(event.pointerId);
    holdTimer.current = window.setTimeout(() => {
      if (!gesture.current) return;
      gesture.current.held = true;
      suppressClick.current = true;
      setDragging(true);
      setExpanded(true);
      const next = clampPoint(gesture.current.origin, screen.width, screen.height);
      positionRef.current = next;
      setDragPosition(next);
    }, HOLD_MS);
  }

  function moveGesture(event: PointerEvent<HTMLButtonElement>) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    const delta = { x: event.clientX - current.start.x, y: event.clientY - current.start.y };
    if (!current.held) {
      if (Math.hypot(delta.x, delta.y) > 12) { clearHold(); current.moved = true; suppressClick.current = true; }
      return;
    }
    event.preventDefault();
    const next = clampPoint({ x: current.origin.x + delta.x, y: current.origin.y + delta.y }, screen.width, screen.height);
    current.moved = true;
    positionRef.current = next;
    setDragPosition(next);
  }

  function finishGesture(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    clearHold();
    gesture.current = null;
    if (current.held && positionRef.current) {
      const next = positionRef.current;
      const saved: Dock = { side: next.x + SIZE / 2 < screen.width / 2 ? 'left' : 'right', y: next.y / Math.max(1, screen.height - SIZE) };
      setDock(saved);
      try { localStorage.setItem(POSITION_KEY, JSON.stringify(saved)); } catch { /* Optional storage. */ }
    }
    suppressClick.current = cancelled || current.held || current.moved;
    positionRef.current = null;
    setDragPosition(null);
    setDragging(false);
    setExpanded(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => {
      clearHold();
      gesture.current = null;
      suppressClick.current = false;
      setDragging(false);
      setDragPosition(null);
      setMobile(query.matches);
      setScreen(viewport());
    };
    window.addEventListener('resize', update);
    query.addEventListener('change', update);
    return () => { clearHold(); window.removeEventListener('resize', update); query.removeEventListener('change', update); };
  }, []);

  useEffect(() => {
    if (!expanded || dragging || open) return;
    const timer = window.setTimeout(() => setExpanded(false), 4_000);
    return () => window.clearTimeout(timer);
  }, [expanded, dragging, open]);

  return <button
    type="button"
    className={`paimon-launcher${mobile ? ' paimon-launcher--mobile' : ''}${dragging ? ' paimon-launcher--dragging' : ''}`}
    style={mobile ? { left: point.x, top: point.y, right: 'auto', bottom: 'auto' } : undefined}
    data-paimon-help
    onPointerDown={startGesture}
    onPointerMove={moveGesture}
    onPointerUp={(event) => finishGesture(event)}
    onPointerCancel={(event) => finishGesture(event, true)}
    onLostPointerCapture={(event) => finishGesture(event, true)}
    onContextMenu={(event) => { if (mobile) event.preventDefault(); }}
    onClick={(event) => {
      if (event.detail !== 0 && suppressClick.current) { suppressClick.current = false; return; }
      setExpanded(true);
      onOpen();
    }}
    aria-label={mobile ? 'Ask Paimon. Hold and drag to move; release to dock at the nearest edge.' : 'Open Paimon helper'}
    aria-expanded={open}
    aria-controls="paimon-helper"
  >
    <span className="paimon-launcher__face" aria-hidden="true" />
    <span className="paimon-launcher__label">Ask Paimon</span>
  </button>;
}
