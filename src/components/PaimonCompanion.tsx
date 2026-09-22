import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';

type PaimonAction =
  | 'idle'
  | 'running-right'
  | 'running-left'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'waiting'
  | 'running'
  | 'review'
  ;

export type PaimonPage =
  | 'dashboard'
  | 'characters'
  | 'character'
  | 'weapons'
  | 'weapon'
  | 'artifacts'
  | 'artifact'
  | 'teams'
  | 'map'
  | 'guides'
  | 'sources';

type PaimonContextState = {
  page: PaimonPage;
  name?: string;
};

type PaimonContextValue = PaimonContextState & {
  shown: boolean;
  setShown: (shown: boolean) => void;
  setContext: (context: PaimonContextState) => void;
};

const PaimonContext = createContext<PaimonContextValue | null>(null);

const PAIMON_AFK_TIME = 2 * 60 * 1000;
const PAIMON_ANGER_HIDE_TIME = 10 * 1000;
const PAIMON_MOVE_DURATION = 3200;
const PAIMON_WIDTH = 190;
const PAIMON_HEIGHT = 190;
const PAIMON_SCREEN_GAP = 12;
const PAIMON_TOP_SAFE = 84;
const PAIMON_TARGET_GAP = 24;

function getPageFromPath(pathname: string): PaimonPage {
  if (pathname === '/') return 'dashboard';
  if (pathname === '/characters') return 'characters';
  if (pathname.startsWith('/characters/')) return 'character';
  if (pathname === '/weapons') return 'weapons';
  if (pathname === '/artifacts') return 'artifacts';
  if (pathname === '/teams') return 'teams';
  if (pathname === '/map') return 'map';
  if (pathname === '/guides') return 'guides';
  if (pathname === '/sources') return 'sources';
  return 'dashboard';
}

export function PaimonProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const routePage = useMemo(
    () => getPageFromPath(location.pathname),
    [location.pathname],
  );
  const [context, setContextState] = useState<PaimonContextState>({
    page: routePage,
  });
  const [shown, setShown] = useState(true);

  useEffect(() => {
    setContextState({ page: routePage });
  }, [routePage]);

  const setContext = useCallback((next: PaimonContextState) => {
    setContextState(next);
  }, []);

  const value = useMemo(
    () => ({ ...context, shown, setShown, setContext }),
    [context, shown, setContext],
  );

  return (
    <PaimonContext.Provider value={value}>
      {children}
    </PaimonContext.Provider>
  );
}

export function usePaimonContext(): PaimonContextValue {
  const context = useContext(PaimonContext);
  const location = useLocation();
  const routePage = useMemo(
    () => getPageFromPath(location.pathname),
    [location.pathname],
  );

  if (context) return context;

  return {
    page: routePage,
    shown: true,
    setShown: () => undefined,
    setContext: () => undefined,
  };
}

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}


export function PaimonCompanion() {
  const { page, name, shown } = usePaimonContext();
  const disabled = page === 'map';

  const [visible, setVisible] = useState(true);
  const [presence, setPresence] = useState<'visible' | 'entering' | 'exiting'>('visible');
  const [action, setAction] = useState<PaimonAction>('idle');
  const [frame, setFrame] = useState(0);
  const [position, setPosition] = useState({ x: 74, y: 65 });
  const [isAfk, setIsAfk] = useState(false);
  const [afkHidden, setAfkHidden] = useState(false);
  const [speech, setSpeech] = useState('How are you doing?');

  const actionTimeoutRef = useRef<number | null>(null);
  const movementTimeoutRef = useRef<number | null>(null);
  const afkTimeoutRef = useRef<number | null>(null);
  const normalBehaviorTimeoutRef = useRef<number | null>(null);
  const popOutTimeoutRef = useRef<number | null>(null);
  const popInTimeoutRef = useRef<number | null>(null);
  const clickTimesRef = useRef<number[]>([]);
  const actionBusyRef = useRef(false);
  const visibleRef = useRef(visible);
  const isAfkRef = useRef(isAfk);
  const presenceRef = useRef(presence);
  const afkHiddenRef = useRef(afkHidden);

  visibleRef.current = visible;
  isAfkRef.current = isAfk;
  presenceRef.current = presence;
  afkHiddenRef.current = afkHidden;

  const spriteRows: Record<PaimonAction, number> = {
    idle: 0,
    'running-right': 1,
    'running-left': 2,
    waving: 3,
    jumping: 4,
    failed: 5,
    waiting: 6,
    running: 1,
    review: 7,
  };

  function clearActionTimeout() {
    if (actionTimeoutRef.current !== null) {
      window.clearTimeout(actionTimeoutRef.current);
      actionTimeoutRef.current = null;
    }
  }

  function clearMovementTimeout() {
    if (movementTimeoutRef.current !== null) {
      window.clearTimeout(movementTimeoutRef.current);
      movementTimeoutRef.current = null;
    }
  }

  function clearAfkTimeout() {
    if (afkTimeoutRef.current !== null) {
      window.clearTimeout(afkTimeoutRef.current);
      afkTimeoutRef.current = null;
    }
  }

  function clearNormalBehaviorTimeout() {
    if (normalBehaviorTimeoutRef.current !== null) {
      window.clearTimeout(normalBehaviorTimeoutRef.current);
      normalBehaviorTimeoutRef.current = null;
    }
  }

  function clearPresenceTimeouts() {
    if (popOutTimeoutRef.current !== null) {
      window.clearTimeout(popOutTimeoutRef.current);
      popOutTimeoutRef.current = null;
    }
    if (popInTimeoutRef.current !== null) {
      window.clearTimeout(popInTimeoutRef.current);
      popInTimeoutRef.current = null;
    }
  }

  function getContextLines(): string[] {
    if (page === 'character' && name) {
      return [
        `Ooh, ${name}! Are we building them today?`,
        `Should we check ${name}'s build?`,
        `Paimon is keeping an eye on ${name}!`,
        `Hmm... what should we improve on ${name}?`,
        `Are we getting ${name} ready for battle?`,
        `${name} looks interesting... Paimon wants to see!`,
      ];
    }

    if (page === 'weapon' && name) {
      return [
        `Ooh, ${name}! Are we leveling it?`,
        `Paimon wonders who should use ${name}.`,
        `Checking out ${name}?`,
        `That weapon looks fancy!`,
        `Are we upgrading ${name} today?`,
        `Paimon wants to see the build for ${name}!`,
      ];
    }

    if (page === 'artifact' && name) {
      return [
        `We're looking at ${name}!`,
        'Artifact farming again?',
        'Paimon hopes we get good pieces.',
        `Let's see what ${name} can do!`,
        `Are we building a set with ${name}?`,
        'Paimon wants to see those artifact stats!',
      ];
    }

    switch (page) {
      case 'characters':
        return [
          'So many of our friends here!',
          'Who are we building today?',
          'Paimon wants to see our friends builds!',
          'Hmm... which of our friends should we check?',
        ];
      case 'weapons':
        return [
          'So many weapons!',
          'Which weapon are we checking?',
          'Paimon wants to see those weapon stats!',
          'Hmm... what should we level next?',
        ];
      case 'artifacts':
        return [
          'Artifact time!',
          'Paimon hopes we get good rolls!',
          'Looking for the perfect artifact set?',
          'Which set are we checking?',
        ];
      case 'teams':
        return [
          'Who are we putting on the team?',
          'Paimon wants to see the team!',
          'What kind of team are we building?',
          'Hmm... who works well together?',
        ];
      case 'guides':
        return [
          'Paimon hopes this guide helps!',
          'What are we learning today?',
          'Paimon is reading too!',
          'Hmm... this looks useful!',
        ];
      case 'sources':
        return [
          'Checking the sources?',
          'Paimon likes knowing where the data comes from!',
          'Let’s make sure everything checks out.',
          'Good research needs good sources!',
        ];
      case 'map':
        return [];
      case 'dashboard':
      default:
        return [
          'How are you doing?',
          'What are we gonna do today?',
          'Where should we go first?',
          'Paimon thinks we should explore!',
          'Hmm... what should we do next?',
          'Paimon is ready!',
          'Treasure hunting?',
          'Paimon wants to go too!',
          'Where do you think we should go?',
          'Paimon wonders what is nearby...',
          'There is still so much to explore!',
          'Paimon could really use a snack...',
          'Hmmmm... what should we do?',
          'Paimon has a good feeling about today!',
          'Should we check the map?',
          'Paimon is thinking...',
          'Did you bring snacks?',
          'Paimon is not emergency food!',
          'What are we building today?',
          'Paimon wants to see!',
        ];
    }
  }

  function getRandomPaimonLine() {
    const lines = getContextLines();
    return lines.length ? randomItem(lines) : 'Paimon is here!';
  }

  function getRandomTrivia() {
    const trivia: Record<PaimonPage, string[]> = {
      dashboard: [
        'Teyvat has seven elements.',
        'There are seven nations across Teyvat.',
        'The Traveler can use different elements.',
        'Paimon can float instead of walking.',
        'Paimon loves treasure chests!',
      ],
      characters: [
        'The Traveler can use different elements.',
        'There are seven nations across Teyvat.',
        'Teyvat has seven elements.',
      ],
      character: [
        'The Traveler can use different elements.',
        'Teyvat has seven elements.',
      ],
      weapons: [
        'Different weapon types suit different characters.',
        'Weapons have their own ascension materials.',
      ],
      weapon: [
        'Weapons have their own ascension materials.',
        'Refinement can improve a weapon effect.',
      ],
      artifacts: [
        'Artifacts can belong to different sets.',
        'Artifact pieces have different main stats.',
        'Artifact sets can provide set bonuses.',
      ],
      artifact: [
        'Artifact pieces can have different main stats.',
        'Artifact sets can provide set bonuses.',
        'Artifact pieces can have substats.',
      ],
      teams: [
        'Elemental reactions are important when building teams.',
        'Different roles can fit together in one team.',
      ],
      map: [],
      guides: [
        'Character builds can depend on more than one stat.',
        'Different characters can want very different builds.',
      ],
      sources: [
        'Checking multiple references can help verify data.',
        'Game data can change as the game gets updated.',
      ],
    };

    const entries = trivia[page];
    return entries.length ? randomItem(entries) : 'Paimon is thinking...';
  }

  function playTemporaryAction(
    nextAction: PaimonAction,
    duration = 1200,
    nextSpeech?: string,
  ) {
    if (disabled || !shown) return;

    clearActionTimeout();
    clearMovementTimeout();
    actionBusyRef.current = true;
    setFrame(0);
    setAction(nextAction);

    actionTimeoutRef.current = window.setTimeout(() => {
      actionBusyRef.current = false;
      setFrame(0);
      setAction('idle');
      setSpeech(nextSpeech ?? getRandomPaimonLine());
      actionTimeoutRef.current = null;
    }, duration);
  }

  function resetAfkTimer() {
    if (disabled || !shown) return;

    setIsAfk(false);
    clearAfkTimeout();

    afkTimeoutRef.current = window.setTimeout(() => {
      if (!visibleRef.current || disabled || !shown) return;

      setIsAfk(true);
      clearActionTimeout();
      clearMovementTimeout();
      clearNormalBehaviorTimeout();
      actionBusyRef.current = true;

      setFrame(0);
      setAction('waiting');
      setSpeech(randomItem([
        'Paimon is getting sleepy... see you in a bit.',
        'Mmm... Paimon needs a little rest...',
        'Zzz... Paimon is getting sleepy...',
        'Traveler... Paimon is gonna take a quick nap...',
      ]));

      window.setTimeout(() => {
        if (!shown || disabled) {
          actionBusyRef.current = false;
          return;
        }

        setAfkHidden(true);
        setVisible(false);
        setPresence('visible');
        setAction('idle');
        setFrame(0);
        actionBusyRef.current = false;
      }, 1800);
    }, PAIMON_AFK_TIME);
  }

  function moveToRandomSpot() {
    if (disabled || !shown || !visibleRef.current || presenceRef.current !== 'visible' || actionBusyRef.current) {
      return;
    }

    const spots = [
      { x: 3, y: 70 },
      { x: 76, y: 68 },
      { x: 78, y: 20 },
      { x: 8, y: 20 },
      { x: 46, y: 70 },
    ];

    setPosition((current) => {
      const candidates = spots.filter(
        (spot) => Math.abs(spot.x - current.x) > 15 || Math.abs(spot.y - current.y) > 15,
      );
      const next = randomItem(candidates.length ? candidates : spots);

      clearMovementTimeout();
      setFrame(next.x > current.x ? 0 : 6);
      setAction(next.x > current.x ? 'running-right' : 'running-left');

      movementTimeoutRef.current = window.setTimeout(() => {
        setFrame(0);
        setAction((currentAction) =>
          currentAction === 'running-right' || currentAction === 'running-left'
            ? 'idle'
            : currentAction,
        );
        movementTimeoutRef.current = null;
      }, PAIMON_MOVE_DURATION);

      return next;
    });
  }

  function clampPosition(left: number, top: number) {
    const maxLeft = Math.max(
      PAIMON_SCREEN_GAP,
      window.innerWidth - PAIMON_WIDTH - PAIMON_SCREEN_GAP,
    );
    const maxTop = Math.max(
      PAIMON_TOP_SAFE,
      window.innerHeight - PAIMON_HEIGHT - PAIMON_SCREEN_GAP,
    );

    return {
      left: Math.min(maxLeft, Math.max(PAIMON_SCREEN_GAP, left)),
      top: Math.min(maxTop, Math.max(PAIMON_TOP_SAFE, top)),
    };
  }

  function rectanglesOverlap(
    a: { left: number; top: number; right: number; bottom: number },
    b: { left: number; top: number; right: number; bottom: number },
  ) {
    return !(
      a.right <= b.left ||
      a.left >= b.right ||
      a.bottom <= b.top ||
      a.top >= b.bottom
    );
  }

  function getInteractiveRects() {
    return Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a, select, input, textarea, [role="button"]',
      ),
    )
      .filter((element) => {
        if (element.closest('[data-paimon-companion]')) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0;
      })
      .map((element) => element.getBoundingClientRect());
  }

  function moveNearElement(element: Element) {
    if (disabled || !shown) return;

    const target = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const interactiveRects = getInteractiveRects();

    const candidatePositions = [
      {
        left: target.right + PAIMON_TARGET_GAP,
        top: target.top,
      },
      {
        left: target.left - PAIMON_WIDTH - PAIMON_TARGET_GAP,
        top: target.top,
      },
      {
        left: target.left,
        top: target.bottom + PAIMON_TARGET_GAP,
      },
      {
        left: target.left,
        top: target.top - PAIMON_HEIGHT - PAIMON_TARGET_GAP,
      },
      {
        left: 16,
        top: viewportHeight - PAIMON_HEIGHT - 24,
      },
      {
        left: viewportWidth - PAIMON_WIDTH - 16,
        top: viewportHeight - PAIMON_HEIGHT - 24,
      },
      {
        left: viewportWidth - PAIMON_WIDTH - 16,
        top: PAIMON_TOP_SAFE,
      },
      {
        left: 16,
        top: PAIMON_TOP_SAFE,
      },
    ].map((candidate) => clampPosition(candidate.left, candidate.top));

    const targetRect = {
      left: target.left - PAIMON_TARGET_GAP,
      top: target.top - PAIMON_TARGET_GAP,
      right: target.right + PAIMON_TARGET_GAP,
      bottom: target.bottom + PAIMON_TARGET_GAP,
    };

    const ranked = candidatePositions
      .map((candidate) => {
        const paimonRect = {
          left: candidate.left,
          top: candidate.top,
          right: candidate.left + PAIMON_WIDTH,
          bottom: candidate.top + PAIMON_HEIGHT,
        };

        const interactiveOverlapCount = interactiveRects.reduce(
          (count, rect) =>
            count +
            (rectanglesOverlap(paimonRect, rect) ? 1 : 0),
          0,
        );

        const targetOverlap = rectanglesOverlap(paimonRect, targetRect) ? 1 : 0;
        const distance = Math.hypot(
          candidate.left - (position.x / 100) * viewportWidth,
          candidate.top - (position.y / 100) * viewportHeight,
        );

        return {
          candidate,
          interactiveOverlapCount,
          targetOverlap,
          distance,
        };
      })
      .sort((a, b) => {
        if (a.targetOverlap !== b.targetOverlap) {
          return a.targetOverlap - b.targetOverlap;
        }
        if (a.interactiveOverlapCount !== b.interactiveOverlapCount) {
          return a.interactiveOverlapCount - b.interactiveOverlapCount;
        }
        return a.distance - b.distance;
      });

    const targetPosition = ranked[0]?.candidate ?? clampPosition(16, PAIMON_TOP_SAFE);

    // Important: do not animate into the clicked control.
    // Paimon snaps to the safe location instead of flying through the button.
    clearMovementTimeout();
    setFrame(0);
    setAction('idle');
    setPosition({
      x: (targetPosition.left / viewportWidth) * 100,
      y: (targetPosition.top / viewportHeight) * 100,
    });
  }

  function runNormalBehavior() {
    if (disabled || !shown || !visibleRef.current || isAfkRef.current || presenceRef.current !== 'visible' || actionBusyRef.current) {
      return;
    }

    if (Math.random() < 0.35) {
      playTemporaryAction('review', 3200, getRandomTrivia());
      return;
    }

    const behaviors: Array<{
      action: PaimonAction;
      lines: string[];
      duration: number;
    }> = [
        {
          action: 'idle',
          lines: [
            'Hmmmm...',
            'What should we do next?',
            'Paimon is thinking...',
            'There is still so much to explore!',
          ],
          duration: 1800,
        },
        {
          action: 'waiting',
          lines: [
            'Paimon is getting a little hungry...',
            'Do you have any snacks?',
            'Paimon could really use a meal...',
            'Hmm... Paimon wants something to eat.',
          ],
          duration: 2200,
        },
        {
          action: 'waving',
          lines: [
            'Hey, Traveler!',
            'Paimon is still here!',
            'What are we doing today?',
            'Paimon is ready!',
          ],
          duration: 1700,
        },
        {
          action: 'jumping',
          lines: [
            'Ooh! That looks interesting!',
            'Treasure!',
            'Let’s go!',
            'Adventure time!',
          ],
          duration: 1400,
        },
      ];

    const behavior = randomItem(behaviors);
    playTemporaryAction(
      behavior.action,
      behavior.duration,
      randomItem(behavior.lines),
    );
  }

  function scheduleNextNormalBehavior() {
    clearNormalBehaviorTimeout();
    if (disabled || !shown || !visibleRef.current || isAfkRef.current || presenceRef.current !== 'visible') return;

    normalBehaviorTimeoutRef.current = window.setTimeout(() => {
      runNormalBehavior();
      scheduleNextNormalBehavior();
    }, 7000 + Math.floor(Math.random() * 9000));
  }

  function isInteractiveElement(element: Element | null) {
    if (!element) return false;
    const tag = element.closest('button, a, select, input, textarea, [role="button"]');
    return Boolean(tag);
  }

  function isClickInsidePaimon(clientX: number, clientY: number) {
    const companion = document.querySelector<HTMLElement>('[data-paimon-companion]');
    if (!companion) return false;

    const rect = companion.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  function reactToSiteInteraction(element: Element) {
    if (disabled || !shown || !visibleRef.current || presenceRef.current !== 'visible') return;

    const interactive = element.closest(
      'button, a, select, input, textarea, [role="button"]',
    );

    if (!interactive) return;

    resetAfkTimer();
    moveNearElement(interactive);

    const messages = getContextLines();
    const line =
      Math.random() < 0.25
        ? getRandomTrivia()
        : randomItem(messages.length ? messages : ['Paimon wants to see!']);

    playTemporaryAction('waving', 1400, line);
  }

  function wakeFromAfk() {
    if (!afkHiddenRef.current) return;
    if (disabled || !shown) return;

    setAfkHidden(false);
    setVisible(true);
    setIsAfk(false);
    clearActionTimeout();
    clearMovementTimeout();
    actionBusyRef.current = true;
    setFrame(0);
    setAction('jumping');
    setSpeech(randomItem([
      'Paimon is awake!',
      'Oh! Something happened!',
      'Paimon is back!',
      'You called for Paimon?',
      'Huh? Are we doing something?',
    ]));

    actionTimeoutRef.current = window.setTimeout(() => {
      actionBusyRef.current = false;
      setFrame(0);
      setAction('idle');
      actionTimeoutRef.current = null;
      resetAfkTimer();
    }, 1400);
  }

  function handlePaimonClick() {
    if (disabled || !shown || presence === 'exiting') return;

    if (afkHiddenRef.current) {
      wakeFromAfk();
      return;
    }

    if (!visible) return;

    const now = Date.now();
    clickTimesRef.current = clickTimesRef.current.filter((time) => now - time < 3000);
    clickTimesRef.current.push(now);

    const clickCount = clickTimesRef.current.length;

    if (clickCount >= 10) {
      clickTimesRef.current = [];
      clearActionTimeout();
      clearMovementTimeout();
      clearAfkTimeout();
      clearNormalBehaviorTimeout();
      clearPresenceTimeouts();
      actionBusyRef.current = true;
      setIsAfk(false);
      setFrame(0);
      setSpeech('ENOUGH! Leave Paimon alone!');
      setAction('failed');
      setPresence('exiting');

      popOutTimeoutRef.current = window.setTimeout(() => {
        setVisible(false);
        setPresence('visible');
        popOutTimeoutRef.current = null;
      }, 700);

      popInTimeoutRef.current = window.setTimeout(() => {
        if (disabled) return;
        setVisible(true);
        setFrame(0);
        setAction('idle');
        setSpeech(Math.random() < 0.5 ? 'Paimon is back...' : getRandomPaimonLine());
        setPresence('entering');

        window.setTimeout(() => {
          actionBusyRef.current = false;
          setPresence('visible');
          resetAfkTimer();
          scheduleNextNormalBehavior();
        }, 700);
      }, PAIMON_ANGER_HIDE_TIME + 700);

      return;
    }

    if (clickCount >= 3) {
      clearActionTimeout();
      clearMovementTimeout();
      resetAfkTimer();
      actionBusyRef.current = true;
      setIsAfk(false);
      setFrame(0);
      setSpeech(clickCount === 3 ? 'HEY! Stop poking Paimon!' : 'Paimon said STOP!');
      setAction('failed');

      actionTimeoutRef.current = window.setTimeout(() => {
        actionBusyRef.current = false;
        setFrame(0);
        setAction('idle');
        setSpeech(getRandomPaimonLine());
        actionTimeoutRef.current = null;
        scheduleNextNormalBehavior();
      }, 1800);

      return;
    }

    resetAfkTimer();
    const reaction = randomItem([
      { text: 'Why are you poking Paimon?', action: 'waving' as PaimonAction },
      { text: 'What?', action: 'jumping' as PaimonAction },
      { text: 'Did you need something?', action: 'waiting' as PaimonAction },
      { text: 'Paimon is watching you...', action: 'review' as PaimonAction },
      { text: 'Hey!', action: 'waving' as PaimonAction },
    ]);

    playTemporaryAction(reaction.action, 1200, reaction.text);
  }

  useEffect(() => {
    if (!visible || disabled || !shown) return;

    const frameSequences: Record<PaimonAction, number[]> = {
      idle: [0, 1, 2, 3, 5, 6, 7],
      'running-right': [0, 1],
      'running-left': [6, 7],
      waving: [0, 1, 2, 3, 4, 5, 6, 7],
      jumping: [0, 1, 2, 3, 4, 5, 6, 7],
      failed: [0, 1, 2, 3, 4, 5, 6, 7],
      waiting: [0, 1, 2, 3, 4, 5, 6, 7],
      running: [0, 1, 2, 3, 4, 5, 6, 7],
      review: [0, 1, 2, 3, 4, 5, 6, 7],
    };

    const sequence = frameSequences[action];
    let sequenceIndex = 0;
    setFrame(sequence[0]);

    const frameInterval =
      action === 'waiting'
        ? 220
        : action === 'review'
          ? 180
          : action === 'idle'
            ? 170
            : action === 'running-right' || action === 'running-left'
              ? 150
              : 125;

    const interval = window.setInterval(() => {
      sequenceIndex = (sequenceIndex + 1) % sequence.length;
      setFrame(sequence[sequenceIndex]);
    }, frameInterval);

    return () => window.clearInterval(interval);
  }, [action, visible, disabled, shown]);

  useEffect(() => {
    if (!shown) {
      clearActionTimeout();
      clearMovementTimeout();
      clearAfkTimeout();
      clearNormalBehaviorTimeout();
      clearPresenceTimeouts();
      actionBusyRef.current = false;
      setAction('idle');
      setFrame(0);
      setAfkHidden(false);
      setIsAfk(false);
      return;
    }

    if (disabled) {
      clearActionTimeout();
      clearMovementTimeout();
      clearAfkTimeout();
      clearNormalBehaviorTimeout();
      clearPresenceTimeouts();
      actionBusyRef.current = false;
      setAction('idle');
      setFrame(0);
      setAfkHidden(false);
      setIsAfk(false);
      return;
    }

    if (!visible) return;
    resetAfkTimer();

    return () => clearAfkTimeout();
  }, [visible, disabled, shown]);

  useEffect(() => {
    if (disabled || !shown || !visible || isAfk || presence !== 'visible') return;
    scheduleNextNormalBehavior();
    return () => clearNormalBehaviorTimeout();
  }, [visible, isAfk, presence, disabled, shown, page, name]);

  useEffect(() => {
    if (disabled || !shown || !visible || presence !== 'visible') return;

    const lines = getContextLines();
    if (!lines.length) return;

    clearActionTimeout();
    clearMovementTimeout();
    actionBusyRef.current = true;
    setFrame(0);
    setAction('waving');
    setSpeech(randomItem(lines));

    actionTimeoutRef.current = window.setTimeout(() => {
      actionBusyRef.current = false;
      setFrame(0);
      setAction('idle');
      actionTimeoutRef.current = null;
    }, 1400);
  }, [page, name, disabled, shown]);

  useEffect(() => {
    if (disabled || !shown || !visible || presence !== 'visible') return;

    const interval = window.setInterval(() => {
      moveToRandomSpot();
    }, 8000);

    return () => window.clearInterval(interval);
  }, [visible, presence, disabled, shown]);

  useEffect(() => {
    if (disabled || !shown || !visible || !isAfk || afkHidden || presence !== 'visible') return;

    const interval = window.setInterval(() => {
      if (actionBusyRef.current) return;

      playTemporaryAction(
        'waiting',
        2200,
        randomItem([
          'Traveler...?',
          'Paimon is getting hungry...',
          'Is there something interesting over there?',
          'Paimon is still waiting.',
          'Should we go exploring?',
          'Hmmmmmm...',
          'Did you fall asleep?',
          'Paimon is getting bored...',
        ]),
      );
    }, 7000);

    return () => window.clearInterval(interval);
  }, [isAfk, visible, presence, disabled, shown, afkHidden]);

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (disabled || !shown) return;

      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      if (afkHiddenRef.current) {
        wakeFromAfk();

        // Let the original page click continue normally.
        reactToSiteInteraction(target);
        return;
      }

      if (!visibleRef.current) {
        return;
      }

      if (target.closest('[data-paimon-companion]')) {
        event.preventDefault();
        event.stopPropagation();
        handlePaimonClick();
        return;
      }

      // Interactive page controls always win over Paimon's visual layer.
      // Even if Paimon is visually above a button, that button remains clickable.
      const clickedInteractive = isInteractiveElement(target);

      if (!clickedInteractive && isClickInsidePaimon(event.clientX, event.clientY)) {
        event.preventDefault();
        event.stopPropagation();
        handlePaimonClick();
        return;
      }

      reactToSiteInteraction(target);
    };

    const handleSiteScroll = () => {
      if (!disabled && shown && visibleRef.current) resetAfkTimer();
    };

    const handleSiteInput = () => {
      if (!disabled && shown && visibleRef.current) resetAfkTimer();
    };

    document.addEventListener('click', handleDocumentClick, true);
    document.addEventListener('scroll', handleSiteScroll, true);
    document.addEventListener('input', handleSiteInput, true);
    document.addEventListener('change', handleSiteInput, true);

    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
      document.removeEventListener('scroll', handleSiteScroll, true);
      document.removeEventListener('input', handleSiteInput, true);
      document.removeEventListener('change', handleSiteInput, true);
    };
  }, [disabled, shown]);

  useEffect(() => {
    return () => {
      clearActionTimeout();
      clearMovementTimeout();
      clearAfkTimeout();
      clearNormalBehaviorTimeout();
      clearPresenceTimeouts();
    };
  }, []);

  if (disabled || !shown || !visible || afkHidden) return null;

  const row = spriteRows[action];
  const backgroundX = frame * 256;
  const backgroundY = row * 256;

  return (
    <div
      className={`paimon-companion paimon-companion--${presence}`}
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        pointerEvents: 'none',
      }}
      data-paimon-companion
    >
      {(action === 'running-right' || action === 'running-left') && (
        <div
          className={`paimon-companion__sparkle-trail paimon-companion__sparkle-trail--${action === 'running-right' ? 'right' : 'left'}`}
          aria-hidden="true"
        >
          {Array.from({ length: 7 }, (_, index) => (
            <span
              key={index}
              className="paimon-companion__sparkle"
              style={{
                animationDelay: `${index * 90}ms`,
              }}
            />
          ))}
        </div>
      )}

      <div
        className="paimon-companion__speech"
        style={{ pointerEvents: 'none' }}
      >
        {speech}
      </div>

      <button
        type="button"
        className="paimon-companion__button"
        aria-label="Interact with Paimon"
        tabIndex={-1}
        style={{ pointerEvents: 'none' }}
      >
        <div
          className="paimon-companion__sprite"
          style={{
            pointerEvents: 'none',
            backgroundPosition: `-${backgroundX}px -${backgroundY}px`,
          }}
        />
      </button>
    </div>
  );
}
