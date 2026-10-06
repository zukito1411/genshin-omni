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
import { useLocation, useNavigate } from 'react-router-dom';
import { PaimonLauncher } from './PaimonLauncher';
import { PaimonSprite, type PaimonAction } from './PaimonSprite';
import { usePageActive } from '../hooks/usePageActive';

export type { PaimonPage } from '../paimon/types';
import type { PaimonPage, PaimonReply as PaimonHelpReply } from '../paimon/types';
import { getPaimonHelpReply } from '../paimon/knowledge';
import type { LocalAssistant, PreparedReply } from '../paimon/localPaimon';
import { containsCredential } from '../paimon/safety';

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
const PAIMON_AFK_BORED_CYCLES = 3;
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
  if (pathname === '/materials') return 'materials';
  if (pathname === '/compare') return 'compare';
  if (pathname === '/account') return 'account';
  if (pathname.startsWith('/profile')) return 'profile';
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

function getInitialGreeting(): string {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return randomItem([
      'Good morning! Ready for adventure?',
      'Morning! What are we doing today?',
    ]);
  }

  if (hour >= 12 && hour < 18) {
    return randomItem([
      'Good afternoon! What should we do?',
      'Afternoon already! Where should we go?',
    ]);
  }

  if (hour >= 18 && hour < 22) {
    return randomItem([
      'Good evening! Still exploring?',
      'Evening already? Time flies!',
    ]);
  }

  return randomItem([
    "It's pretty late... still up for adventure?",
    "Isn't it past Paimon's bedtime?",
  ]);
}

function getElementLabel(element: Element): string | null {
  const htmlElement = element as HTMLElement;
  const raw =
    htmlElement.getAttribute('aria-label') ||
    htmlElement.getAttribute('title') ||
    htmlElement.textContent ||
    '';

  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length < 2 || cleaned.length > 32) return null;
  return cleaned;
}

function buildElementLines(label: string): string[] {
  return [
    `Ooh, "${label}"?`,
    `Are we clicking on ${label}?`,
    `Paimon sees you picked ${label}!`,
    `${label}? Let's see what happens!`,
    `Checking out ${label}, huh?`,
  ];
}


export function PaimonCompanion() {
  const { page, name, shown } = usePaimonContext();
  const navigate = useNavigate();
  const disabled = page === 'map';
  const pageActive = usePageActive();

  const [visible, setVisible] = useState(true);
  const [presence, setPresence] = useState<'visible' | 'entering' | 'exiting'>('visible');
  const [action, setAction] = useState<PaimonAction>('idle');
  const [position, setPosition] = useState({ x: 74, y: 65 });
  const [isAfk, setIsAfk] = useState(false);
  const [afkHidden, setAfkHidden] = useState(false);
  const [speech, setSpeech] = useState<string>(() => getInitialGreeting());
  const [helperOpen, setHelperOpen] = useState(false);
  const [helperQuestion, setHelperQuestion] = useState('');
  const [helperReply, setHelperReply] = useState<PaimonHelpReply | null>(null);
  const [helperStatus, setHelperStatus] = useState<'idle' | 'thinking' | 'ai' | 'native'>('idle');

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
  const lastSpeechRef = useRef<string>(speech);
  const afkBoredCountRef = useRef(0);
  const helperRequestRef = useRef(0);
  const helperAbortRef = useRef<AbortController | null>(null);
  const aiCooldownRef = useRef(0);

  visibleRef.current = visible;
  isAfkRef.current = isAfk;
  presenceRef.current = presence;
  afkHiddenRef.current = afkHidden;


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

  // Picks a line while avoiding an immediate repeat of whatever Paimon just said.
  function pickSpeech(lines: string[], fallback = 'Paimon is here!'): string {
    if (!lines.length) return fallback;
    const pool =
      lines.length > 1
        ? lines.filter((line) => line !== lastSpeechRef.current)
        : lines;
    return randomItem(pool.length ? pool : lines);
  }

  // Single choke point for updating the speech bubble, so anti-repeat tracking
  // stays accurate no matter which code path changes what Paimon is saying.
  function say(text: string) {
    lastSpeechRef.current = text;
    setSpeech(text);
  }

  // Same anti-repeat idea as pickSpeech, but for {text, action} reaction pairs.
  function pickReaction<T extends { text: string }>(items: T[]): T {
    const pool =
      items.length > 1
        ? items.filter((item) => item.text !== lastSpeechRef.current)
        : items;
    return randomItem(pool.length ? pool : items);
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
      case 'materials':
        return [
          'Let’s make a farming plan!',
          'Paimon can help with those materials!',
          'Who are we leveling today?',
        ];
      case 'compare':
        return [
          'Who are we comparing?',
          'Let’s look at both options!',
          'Paimon loves a good side-by-side check!',
        ];
      case 'account':
        return [
          'Paimon wants to see your roster!',
          'Which characters do you have?',
          'A public showcase only shows what its player shares.',
        ];
      case 'profile':
        return ['Let’s see those equipped builds!', 'Choose a showcase character to check their artifacts.', 'Paimon can help you read those stats!'];
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
    return pickSpeech(getContextLines());
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
      materials: [
        'Weapon and talent materials can be available on different days.',
        'A farming checklist is easier than remembering every material.',
      ],
      compare: [
        'A comparison can help separate base stats from build recommendations.',
        'A character’s best build can depend on their team.',
      ],
      account: [
        'A public UID showcase does not reveal a player’s whole roster.',
        'Paimon keeps local roster choices in this browser.',
      ],
      profile: ['A public showcase includes the shared characters’ equipped builds.', 'Artifacts have one main stat and up to four substats.'],
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
    return pickSpeech(entries, 'Paimon is thinking...');
  }

  function getAngryLine(clickCount: number): string {
    if (clickCount === 3) return 'HEY! Stop poking Paimon!';

    if (clickCount <= 5) {
      return pickSpeech(['Paimon said STOP!', 'Quit it!', 'That tickles, but stop!']);
    }

    if (clickCount <= 8) {
      return pickSpeech([
        'Paimon is getting really annoyed now!',
        'Okay, that is enough!',
        'Paimon is warning you!',
      ]);
    }

    return pickSpeech([
      'One more time, Paimon swears...',
      'Paimon is about to lose it!',
    ]);
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
    setAction(nextAction);
    // Show the reaction line right away instead of leaving the old speech
    // bubble up for the whole animation and only revealing it at the end.
    say(nextSpeech ?? getRandomPaimonLine());

    actionTimeoutRef.current = window.setTimeout(() => {
      actionBusyRef.current = false;
      setAction('idle');
      say(getRandomPaimonLine());
      actionTimeoutRef.current = null;
    }, duration);
  }

  function resetAfkTimer() {
    if (disabled || !shown) return;

    setIsAfk(false);
    afkBoredCountRef.current = 0;
    clearAfkTimeout();

    afkTimeoutRef.current = window.setTimeout(() => {
      if (!visibleRef.current || disabled || !shown) return;

      setIsAfk(true);
      clearActionTimeout();
      clearMovementTimeout();
      clearNormalBehaviorTimeout();
      actionBusyRef.current = false;
      afkBoredCountRef.current = 0;
      setAction('waiting');
      say(pickSpeech([
        'Traveler...?',
        'Is there something interesting over there?',
        'Should we go exploring?',
      ]));
      // The bored-check-in loop below picks it up from here and puts
      // Paimon to sleep after a few unanswered check-ins.
    }, PAIMON_AFK_TIME);
  }

  function moveToRandomSpot() {
    if (!pageActive || disabled || !shown || !visibleRef.current || presenceRef.current !== 'visible' || actionBusyRef.current) {
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
      setAction(next.x > current.x ? 'running-right' : 'running-left');

      movementTimeoutRef.current = window.setTimeout(() => {
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
        return true;
      })
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth);
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
    setAction('idle');
    setPosition({
      x: (targetPosition.left / viewportWidth) * 100,
      y: (targetPosition.top / viewportHeight) * 100,
    });
  }

  function runNormalBehavior() {
    if (!pageActive || disabled || !shown || !visibleRef.current || isAfkRef.current || presenceRef.current !== 'visible' || actionBusyRef.current) {
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
      pickSpeech(behavior.lines),
    );
  }

  function scheduleNextNormalBehavior() {
    clearNormalBehaviorTimeout();
    if (!pageActive || disabled || !shown || !visibleRef.current || isAfkRef.current || presenceRef.current !== 'visible') return;

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
    if (!pageActive || disabled || !shown || !visibleRef.current || presenceRef.current !== 'visible') return;

    const interactive = element.closest(
      'button, a, select, input, textarea, [role="button"]',
    );

    if (!interactive) return;

    resetAfkTimer();
    moveNearElement(interactive);

    const label = getElementLabel(interactive);
    let line: string;

    if (label && Math.random() < 0.45) {
      line = pickSpeech(buildElementLines(label));
    } else if (Math.random() < 0.25) {
      line = getRandomTrivia();
    } else {
      const messages = getContextLines();
      line = pickSpeech(messages.length ? messages : ['Paimon wants to see!']);
    }

    playTemporaryAction('waiting', 1400, line);
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
    setAction('jumping');
    say(pickSpeech([
      'Paimon is awake!',
      'Oh! Something happened!',
      'Paimon is back!',
      'You called for Paimon?',
      'Huh? Are we doing something?',
    ]));

    actionTimeoutRef.current = window.setTimeout(() => {
      actionBusyRef.current = false;
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
      say('ENOUGH! Leave Paimon alone!');
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
        setAction('idle');
        say(Math.random() < 0.5 ? 'Paimon is back...' : getRandomPaimonLine());
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
      say(getAngryLine(clickCount));
      setAction('failed');

      actionTimeoutRef.current = window.setTimeout(() => {
        actionBusyRef.current = false;
        setAction('idle');
        say(getRandomPaimonLine());
        actionTimeoutRef.current = null;
        scheduleNextNormalBehavior();
      }, 1800);

      return;
    }

    resetAfkTimer();
    const reaction = pickReaction([
      { text: 'Why are you poking Paimon?', action: 'waving' as PaimonAction },
      { text: 'What?', action: 'jumping' as PaimonAction },
      { text: 'Did you need something?', action: 'waiting' as PaimonAction },
      { text: 'Paimon is watching you...', action: 'review' as PaimonAction },
      { text: 'Hey!', action: 'waving' as PaimonAction },
    ]);

    playTemporaryAction(reaction.action, 1200, reaction.text);
  }

  function showHelperReply(reply: PaimonHelpReply) {
    setHelperReply(reply);
    resetAfkTimer();
    clearActionTimeout();
    clearMovementTimeout();
    actionBusyRef.current = true;
    setAction('waving');
    say(reply.text);
    // Keep a requested answer in Paimon's speech bubble. The helper panel
    // retains it too, so an animation cannot make an answer disappear.
    actionTimeoutRef.current = window.setTimeout(() => {
      actionBusyRef.current = false;
      setAction('idle');
      actionTimeoutRef.current = null;
    }, 6000);
  }

  async function askPaimon(rawQuestion: string) {
    const question = rawQuestion.trim().slice(0, 600);
    const requestId = ++helperRequestRef.current;
    helperAbortRef.current?.abort();
    const controller = new AbortController();
    helperAbortRef.current = controller;
    setHelperQuestion(question);
    if (containsCredential(question)) {
      setHelperStatus('native');
      showHelperReply({ text: 'Please keep passwords, API keys, tokens, and private keys out of chat, Traveler. Paimon will not save this message or send it to the AI provider.', source: 'native' });
      helperAbortRef.current = null;
      return;
    }
    setHelperStatus('thinking');
    showHelperReply({ text: 'Paimon is thinking...', source: 'native' });
    let local: LocalAssistant | undefined;
    let prepared: PreparedReply = { reply: getPaimonHelpReply(question, page, name), handled: false, journal: false };
    let delivered = false;
    const deliver = (reply: PaimonHelpReply) => {
      if (requestId !== helperRequestRef.current || delivered) return;
      delivered = true;
      setHelperStatus(reply.source === 'ai' ? 'ai' : 'native');
      showHelperReply(reply);
      if (prepared.journal) void local?.record(question, reply, reply.source === 'native' ? prepared.mathValue : undefined).catch(() => undefined);
    };
    // Bound the whole request, including lazy-code/storage loading, not just fetch.
    const timeout = window.setTimeout(() => {
      controller.abort();
      if (requestId !== helperRequestRef.current) return;
      aiCooldownRef.current = Date.now() + 60_000;
      deliver({ ...prepared.reply, source: 'native' });
      helperAbortRef.current = null;
    }, 18_000);
    try {
      try {
        const module = await import('../paimon/localPaimon');
        local = await module.getLocalPaimon();
        if (requestId !== helperRequestRef.current || controller.signal.aborted) return;
        prepared = await local.prepare(question, { page, name });
      } catch { /* The original guide remains usable if local code/storage is unavailable. */ }
      if (requestId !== helperRequestRef.current || controller.signal.aborted) return;
      if (prepared.handled || window.navigator.onLine === false || aiCooldownRef.current > Date.now()) {
        deliver({ ...prepared.reply, source: 'native' });
        return;
      }
      const localTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'short' }).format(new Date());
      const response = await fetch('/api/paimon-chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // Notebook/history deliberately stay local; only this message goes upstream.
        body: JSON.stringify({ question, page, name, localTime }), signal: controller.signal,
      });
      if (!response.ok) throw new Error('AI response unavailable');
      const payload = await response.json() as { reply?: unknown };
      const reply = typeof payload.reply === 'string' ? payload.reply.trim() : '';
      if (!reply) throw new Error('AI response unavailable');
      if (helperRequestRef.current !== requestId) return;
      aiCooldownRef.current = 0;
      deliver({ ...prepared.reply, text: reply, source: 'ai' });
    } catch {
      if (controller.signal.aborted || helperRequestRef.current !== requestId) return;
      aiCooldownRef.current = Date.now() + 60_000;
      deliver({ ...prepared.reply, source: 'native' });
    } finally {
      window.clearTimeout(timeout);
      if (helperRequestRef.current === requestId) helperAbortRef.current = null;
    }
  }

  function openHelper() {
    if (afkHiddenRef.current) wakeFromAfk();
    setHelperOpen(true);
    if (!helperReply) {
      setHelperStatus('native');
      setHelperReply({ ...getPaimonHelpReply('help', page, name), source: 'native' });
    }
  }

  function useHelperAction() {
    if (!helperReply?.route) return;
    navigate(helperReply.route);
    setHelperOpen(false);
    say('Right this way, Traveler!');
  }


  useEffect(() => {
    if (!shown || !pageActive) {
      clearActionTimeout();
      clearMovementTimeout();
      clearAfkTimeout();
      clearNormalBehaviorTimeout();
      clearPresenceTimeouts();
      actionBusyRef.current = false;
      setAction('idle');
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
      setAfkHidden(false);
      setIsAfk(false);
      return;
    }

    if (!visible) return;
    resetAfkTimer();

    return () => clearAfkTimeout();
  }, [visible, disabled, shown, pageActive]);

  useEffect(() => {
    if (!pageActive || disabled || !shown || !visible || isAfk || presence !== 'visible') return;
    scheduleNextNormalBehavior();
    return () => clearNormalBehaviorTimeout();
  }, [visible, isAfk, presence, disabled, shown, page, name, pageActive]);

  useEffect(() => {
    if (!pageActive || disabled || !shown || !visible || presence !== 'visible') return;

    const lines = getContextLines();
    if (!lines.length) return;

    clearActionTimeout();
    clearMovementTimeout();
    actionBusyRef.current = true;
    setAction('waving');
    say(pickSpeech(lines));

    actionTimeoutRef.current = window.setTimeout(() => {
      actionBusyRef.current = false;
      setAction('idle');
      actionTimeoutRef.current = null;
    }, 1400);
  }, [page, name, disabled, shown]);

  useEffect(() => {
    if (!pageActive || disabled || !shown || !visible || presence !== 'visible') return;

    const interval = window.setInterval(() => {
      moveToRandomSpot();
    }, 8000);

    return () => window.clearInterval(interval);
  }, [visible, presence, disabled, shown, pageActive]);

  useEffect(() => {
    if (!pageActive || disabled || !shown || !visible || !isAfk || afkHidden || presence !== 'visible') return;

    const interval = window.setInterval(() => {
      if (actionBusyRef.current) return;

      afkBoredCountRef.current += 1;

      // After a few unanswered check-ins, stop nagging and actually nap/hide.
      if (afkBoredCountRef.current > PAIMON_AFK_BORED_CYCLES) {
        clearActionTimeout();
        actionBusyRef.current = true;
        setAction('waiting');
        say(pickSpeech([
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
          actionBusyRef.current = false;
        }, 1800);
        return;
      }

      playTemporaryAction(
        'waiting',
        2200,
        pickSpeech([
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
  }, [isAfk, visible, presence, disabled, shown, afkHidden, pageActive]);

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

      if (target.closest('[data-paimon-help]')) {
        return;
      }

      if (target.closest('[data-paimon-button]')) {
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
      helperAbortRef.current?.abort();
      clearActionTimeout();
      clearMovementTimeout();
      clearAfkTimeout();
      clearNormalBehaviorTimeout();
      clearPresenceTimeouts();
    };
  }, []);

  if (disabled || !shown) return null;


  return (
    <>
      {visible && !afkHidden && <div
      className={`paimon-companion paimon-companion--${presence}`}
      style={{
        transform: `translate(${position.x}vw, ${position.y}vh)`,
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
        aria-label="Interact with Paimon. Open the Paimon helper with the nearby help button."
        data-paimon-button
        onClick={handlePaimonClick}
      >
        <PaimonSprite action={action} active={pageActive} />
      </button>
      </div>}

      <PaimonLauncher onOpen={openHelper} open={helperOpen} />

      {helperOpen && <aside id="paimon-helper" className="paimon-helper" data-paimon-help aria-label="Paimon helper">
        <div className="paimon-helper__heading"><div><div className="eyebrow">PAIMON HELPER</div><strong>What are we doing?</strong></div><button type="button" data-paimon-help onClick={() => setHelperOpen(false)} aria-label="Close Paimon helper">×</button></div>
        <p aria-live="polite" aria-busy={helperStatus === 'thinking'}>{helperReply?.text ?? 'Ask Paimon about materials, teams, comparisons, your roster, builds, or the map.'}</p>
        <div className="paimon-helper__suggestions" data-paimon-help>{[
          ['Plan materials', 'How do I plan materials?'],
          ['Check a team', 'How do reactions work?'],
          ['Compare characters', 'Compare characters'],
          ['My roster', 'How do I use my UID?'],
        ].map(([label, question]) => <button type="button" key={label} data-paimon-help onClick={() => void askPaimon(question)}>{label}</button>)}</div>
        <form data-paimon-help onSubmit={(event) => { event.preventDefault(); void askPaimon(helperQuestion || 'help'); }}>
          <label htmlFor="paimon-helper-question">Ask Paimon</label>
          <div><input id="paimon-helper-question" value={helperQuestion} onChange={(event) => setHelperQuestion(event.target.value)} placeholder="Materials, teams, roster…" maxLength={600} /><button type="submit" disabled={helperStatus === 'thinking'}>{helperStatus === 'thinking' ? 'Thinking…' : 'Ask'}</button></div>
        </form>
        {helperReply?.route && <button type="button" className="button primary paimon-helper__action" data-paimon-help onClick={useHelperAction}>{helperReply.actionLabel ?? 'Open tool'}</button>}
        <small>{helperStatus === 'thinking' ? 'Paimon is thinking…' : helperReply?.source === 'ai' ? 'AI Paimon is answering. This message was sent to the configured AI provider; the local journal is not shared.' : 'Built-in Paimon keeps notes and recent conversations in this browser. Ask “memory help” for saving and deletion commands. Saved notes and history are not sent to the AI provider.'}</small>
      </aside>}
    </>
  );
}
