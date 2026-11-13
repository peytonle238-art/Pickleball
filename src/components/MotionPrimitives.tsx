import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useScroll, useSpring } from 'motion/react';
import {
  Activity,
  ArrowUpRight,
  Award,
  Calendar,
  Command,
  Eye,
  Home,
  Megaphone,
  Moon,
  Play,
  Search,
  ShieldCheck,
  Sun,
  Trophy,
  UserCheck,
  X,
} from 'lucide-react';
import { Member, NavTab } from '../types';

export const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const QUART_IN_OUT: [number, number, number, number] = [0.76, 0, 0.24, 1];

const PRELOADER_SESSION_KEY = 'bnhs_co_preloader_shown_v1';
const PRELOADER_STEPS = [0, 5, 11, 21, 34, 49, 64, 78, 91, 100];

/* ========================================================================= */
/* 1. STEPPED TYPOGRAPHIC PRELOADER CURTAIN (0 -> 5 -> 11 -> ... -> 100)     */
/* ========================================================================= */
export const PreloaderCurtain: React.FC<{
  clubName: string;
  schoolName: string;
}> = ({ clubName, schoolName }) => {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      if (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return false;
      }
      return sessionStorage.getItem(PRELOADER_SESSION_KEY) !== 'true';
    } catch {
      return false;
    }
  });
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      if (idx < PRELOADER_STEPS.length) {
        setStepIdx(idx);
      } else {
        clearInterval(interval);
        try {
          sessionStorage.setItem(PRELOADER_SESSION_KEY, 'true');
        } catch {
          // Ignore storage errors
        }
        setTimeout(() => {
          setVisible(false);
        }, 160);
      }
    }, 68);

    return () => clearInterval(interval);
  }, [visible]);

  const currentVal = PRELOADER_STEPS[stepIdx] ?? 100;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="co-preloader"
          initial={{ y: '0%' }}
          exit={{
            y: '-100%',
            transition: { duration: 0.65, ease: QUART_IN_OUT },
          }}
          className="fixed inset-0 z-[100] bg-slate-950 text-white flex flex-col justify-between p-5 sm:p-10 select-none pointer-events-auto no-print"
        >
          {/* Top Technical Metadata Row */}
          <div className="flex items-center justify-between text-[11px] font-mono-num uppercase tracking-widest text-slate-400">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>BNHS::PORTAL_INIT</span>
            </div>
            <span>{schoolName}</span>
          </div>

          {/* Center Editorial Identity */}
          <div className="my-auto max-w-xl space-y-2">
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 0.55, ease: EXPO_OUT }}
                className="font-mono-num text-xs uppercase tracking-[0.2em] text-amber-400"
              >
                OFFICIAL ATHLETICLADDER & TOURNAMENT SYSTEM
              </motion.div>
            </div>
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: '105%' }}
                animate={{ y: '0%' }}
                transition={{ duration: 0.65, delay: 0.05, ease: EXPO_OUT }}
                className="font-display text-3xl sm:text-5xl font-bold uppercase tracking-tight text-white"
              >
                {clubName}
              </motion.div>
            </div>
          </div>

          {/* Bottom Stepped Counter Strip (0 -> 5 -> 11 -> ... -> 100) */}
          <div className="space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div className="hidden sm:flex items-center gap-2 font-mono-num text-[11px] text-slate-500">
                {PRELOADER_STEPS.map((step, i) => (
                  <span
                    key={step}
                    className={
                      i <= stepIdx
                        ? 'text-slate-200 font-semibold transition-colors'
                        : 'text-slate-700'
                    }
                  >
                    {String(step).padStart(2, '0')}
                  </span>
                ))}
              </div>
              <div className="font-mono-num text-5xl sm:text-7xl font-bold tracking-tight text-white tabular-nums leading-none ml-auto">
                {String(currentVal).padStart(2, '0')}
                <span className="text-xl sm:text-2xl text-amber-400 ml-1">
                  %
                </span>
              </div>
            </div>

            <div className="h-0.5 w-full bg-slate-800 overflow-hidden">
              <motion.div
                className="h-full bg-amber-400"
                initial={{ width: '0%' }}
                animate={{ width: `${currentVal}%` }}
                transition={{ duration: 0.12, ease: 'linear' }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ========================================================================= */
/* 2. TOP VIEWPORT SCROLL PROGRESS BAR                                       */
/* ========================================================================= */
export const ScrollProgressBar: React.FC = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 28,
    restDelta: 0.001,
  });

  return (
    <motion.div
      style={{ scaleX, backgroundColor: 'var(--club-primary)' }}
      className="fixed top-0 left-0 right-0 h-[2px] origin-left z-50 pointer-events-none no-print"
    />
  );
};

/* ========================================================================= */
/* 3. CARTER OGUNSOLA HUD TELEMETRY STATUS STRIP (`::` SYNTAX)               */
/* ========================================================================= */
export const HudStatusBar: React.FC<{
  rosterCount: number;
  matchesCount: number;
  isOfficer?: boolean;
  onOpenCommandPalette?: () => void;
}> = ({
  rosterCount,
  matchesCount,
  isOfficer = false,
  onOpenCommandPalette,
}) => {
  const [timeStr, setTimeStr] = useState<string>('');
  const [fps, setFps] = useState<number>(60);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const formatted = now.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
      setTimeStr(formatted);
    };
    updateClock();
    const timer = setInterval(updateClock, 1000);
    return () => clearInterval(timer);
  }, []);

  // Lightweight FPS sampling inspired by carterogunsola.com HUD
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let rafId: number;

    const tick = (now: number) => {
      frameCount += 1;
      const elapsed = now - lastTime;
      if (elapsed >= 1000) {
        const currentFps = Math.min(
          120,
          Math.max(24, Math.round((frameCount * 1000) / elapsed))
        );
        setFps(currentFps);
        frameCount = 0;
        lastTime = now;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return (
    <div className="w-full bg-slate-950 text-slate-400 border-b border-slate-800/80 px-3.5 sm:px-6 py-1.5 text-[10px] font-mono-num tracking-wider uppercase no-print">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 overflow-x-auto no-scrollbar whitespace-nowrap">
          <span className="inline-flex items-center gap-1.5 text-slate-200 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>BNHS::{isOfficer ? 'CONSOLE' : 'PORTAL'}</span>
          </span>
          <span className="text-slate-700" aria-hidden="true">
            /
          </span>
          <span>ROSTER::{String(rosterCount).padStart(2, '0')}</span>
          <span className="hidden sm:inline text-slate-700" aria-hidden="true">
            /
          </span>
          <span className="hidden sm:inline">
            MATCHES::{String(matchesCount).padStart(2, '0')}
          </span>
          <span className="hidden md:inline text-slate-700" aria-hidden="true">
            /
          </span>
          <span className="hidden md:inline text-emerald-400/90">
            SYNC::LIVE
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {timeStr && (
            <span className="hidden sm:inline tabular-nums text-slate-300">
              CT::{timeStr}
            </span>
          )}
          <span className="hidden lg:inline tabular-nums text-slate-500">
            FPS::{fps}
          </span>
          {onOpenCommandPalette && (
            <button
              type="button"
              onClick={onOpenCommandPalette}
              className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 inline-flex items-center gap-1 cursor-pointer transition-colors"
              title="Open Quick Command & Player Search (⌘K / Ctrl+K)"
            >
              <Command className="w-2.5 h-2.5 text-amber-400" />
              <span>⌘K</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 4. TIME-BASED EXPONENTIAL LERP NUMBER COUNTER (`1 - e^(-λ·dt)`)           */
/* ========================================================================= */
export const AnimatedNumber: React.FC<{
  value: number;
  prefix?: string;
  suffix?: string;
  padStart?: number;
  className?: string;
}> = ({ value, prefix = '', suffix = '', padStart = 0, className = '' }) => {
  const [displayValue, setDisplayValue] = useState<number>(value);
  const currentRef = useRef<number>(value);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      currentRef.current = value;
      setDisplayValue(value);
      return;
    }

    let rafId: number;
    let lastTime = performance.now();
    const lambda = 14; // Exponential decay speed inspired by carterogunsola.com

    const animate = (now: number) => {
      const dt = Math.min(0.064, (now - lastTime) / 1000);
      lastTime = now;
      const factor = 1 - Math.exp(-lambda * dt);
      const next = currentRef.current + (value - currentRef.current) * factor;

      if (Math.abs(value - next) < 0.35) {
        currentRef.current = value;
        setDisplayValue(Math.round(value));
        return;
      }

      currentRef.current = next;
      setDisplayValue(Math.round(next));
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [value]);

  const formatted =
    padStart > 0
      ? String(displayValue).padStart(padStart, '0')
      : String(displayValue);

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
};

/* ========================================================================= */
/* 5. LINE-MASKED HEADLINE REVEAL                                            */
/* ========================================================================= */
export const MaskedTextReveal: React.FC<{
  children: React.ReactNode;
  delay?: number;
  className?: string;
}> = ({ children, delay = 0, className = '' }) => {
  return (
    <span className={`block overflow-hidden ${className}`}>
      <motion.span
        initial={{ y: '105%', opacity: 0 }}
        animate={{ y: '0%', opacity: 1 }}
        transition={{ duration: 0.65, delay, ease: EXPO_OUT }}
        className="block"
      >
        {children}
      </motion.span>
    </span>
  );
};

/* ========================================================================= */
/* 6. COMMAND-K (`⌘K` / `Ctrl+K`) QUICK COMMAND & PLAYER PALETTE             */
/* ========================================================================= */
interface CommandPaletteItem {
  id: string;
  category: 'Navigation' | 'Roster' | 'Actions';
  title: string;
  subtitle: string;
  badge?: string;
  icon: React.ReactNode;
  onSelect: () => void;
}

export const CommandPaletteModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  members: Member[];
  darkMode: boolean;
  isOfficer: boolean;
  onNavigate: (tab: NavTab) => void;
  onToggleDarkMode: () => void;
  onSelectMember: (member: Member) => void;
  onRequestOfficerLogin: () => void;
}> = ({
  isOpen,
  onClose,
  members,
  darkMode,
  isOfficer,
  onNavigate,
  onToggleDarkMode,
  onSelectMember,
  onRequestOfficerLogin,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen]);

  const rankedMembers = useMemo(
    () => [...members].sort((a, b) => b.elo - a.elo),
    [members]
  );

  const items = useMemo<CommandPaletteItem[]>(() => {
    const q = query.trim().toLowerCase();

    const navItems: CommandPaletteItem[] = [
      {
        id: 'nav-home',
        category: 'Navigation',
        title: 'Overview Dashboard',
        subtitle: 'Club hub, next session countdown & top standings',
        badge: '01',
        icon: <Home className="w-4 h-4" />,
        onSelect: () => {
          onNavigate('home');
          onClose();
        },
      },
      {
        id: 'nav-activity',
        category: 'Navigation',
        title: 'My Activity & Badges',
        subtitle: 'Personal match log, attendance record & club milestones',
        badge: '02',
        icon: <Activity className="w-4 h-4" />,
        onSelect: () => {
          onNavigate('activity');
          onClose();
        },
      },
      {
        id: 'nav-ladder',
        category: 'Navigation',
        title: 'Official Elo Standings & Callouts',
        subtitle: 'Full club rankings, H2H calculator & challenge board',
        badge: '03',
        icon: <Award className="w-4 h-4" />,
        onSelect: () => {
          onNavigate('ladder');
          onClose();
        },
      },
      {
        id: 'nav-tournaments',
        category: 'Navigation',
        title: 'In-Club Tournament Brackets',
        subtitle: 'Single elimination & round robin pools',
        badge: '04',
        icon: <Trophy className="w-4 h-4" />,
        onSelect: () => {
          onNavigate('tournaments');
          onClose();
        },
      },
      {
        id: 'nav-calendar',
        category: 'Navigation',
        title: 'Practice & Event Calendar',
        subtitle: 'Upcoming court dates, times & locations',
        badge: '05',
        icon: <Calendar className="w-4 h-4" />,
        onSelect: () => {
          onNavigate('calendar');
          onClose();
        },
      },
      {
        id: 'nav-scorekeeper',
        category: 'Navigation',
        title: 'Live Court Scoreboard',
        subtitle: 'Real-time match scoring & multi-court rotation',
        badge: '06',
        icon: <Play className="w-4 h-4" />,
        onSelect: () => {
          onNavigate('scorekeeper');
          onClose();
        },
      },
      {
        id: 'nav-announcements',
        category: 'Navigation',
        title: 'Club Bulletin & Announcements',
        subtitle: 'Official updates from BNHS Club Officers',
        badge: '07',
        icon: <Megaphone className="w-4 h-4" />,
        onSelect: () => {
          onNavigate('announcements');
          onClose();
        },
      },
    ];

    const actionItems: CommandPaletteItem[] = [
      {
        id: 'action-theme',
        category: 'Actions',
        title: darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: 'Toggle high-contrast display theme',
        badge: 'THEME',
        icon: darkMode ? (
          <Sun className="w-4 h-4 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4" />
        ),
        onSelect: () => {
          onToggleDarkMode();
          onClose();
        },
      },
      ...(!isOfficer
        ? [
            {
              id: 'action-officer',
              category: 'Actions' as const,
              title: 'Officer / President Sign In',
              subtitle: 'Unlock administrative controls with PIN',
              badge: 'PIN',
              icon: <ShieldCheck className="w-4 h-4" />,
              onSelect: () => {
                onClose();
                onRequestOfficerLogin();
              },
            },
          ]
        : []),
    ];

    const memberItems: CommandPaletteItem[] = rankedMembers.map((m, idx) => ({
      id: `member-${m.id}`,
      category: 'Roster',
      title: m.name,
      subtitle: `Rank #${idx + 1} · Grade ${m.grade} · ${m.skillLevel}`,
      badge: `${m.elo} ELO`,
      icon: <UserCheck className="w-4 h-4" />,
      onSelect: () => {
        onSelectMember(m);
        onClose();
      },
    }));

    const combined = [...navItems, ...memberItems.slice(0, 12), ...actionItems];
    if (!q) return combined;

    return [...navItems, ...memberItems, ...actionItems].filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.subtitle.toLowerCase().includes(q) ||
        (item.badge && item.badge.toLowerCase().includes(q))
    );
  }, [
    query,
    rankedMembers,
    darkMode,
    isOfficer,
    onNavigate,
    onToggleDarkMode,
    onSelectMember,
    onRequestOfficerLogin,
    onClose,
  ]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          items.length > 0 ? (prev + 1) % items.length : 0
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) =>
          items.length > 0 ? (prev - 1 + items.length) % items.length : 0
        );
      } else if (e.key === 'Enter' && items[selectedIndex]) {
        e.preventDefault();
        items[selectedIndex].onSelect();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, items, selectedIndex, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-start justify-center pt-14 sm:pt-24 px-3.5 no-print"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: EXPO_OUT }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm shadow-2xl overflow-hidden"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to section, search athlete name, or enter School ID..."
                className="flex-1 bg-transparent text-xs sm:text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                aria-label="Close command palette"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-[60vh] overflow-y-auto touch-scroll p-2 divide-y divide-slate-100 dark:divide-slate-800/60">
              {items.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 font-mono-num">
                  NO MATCHING COMMANDS OR ATHLETES FOR "{query}"
                </div>
              ) : (
                items.map((item, idx) => {
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={item.onSelect}
                      className={`relative w-full px-3 py-2.5 rounded-md text-left flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        active
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {active && (
                        <motion.div
                          layoutId="cmd-palette-highlight"
                          transition={{
                            type: 'spring',
                            stiffness: 420,
                            damping: 34,
                          }}
                          className="absolute inset-0 rounded-md bg-slate-100 dark:bg-slate-800/90 -z-0"
                        />
                      )}
                      <div className="relative z-10 flex items-center gap-3 min-w-0">
                        <span
                          className={`p-1.5 rounded border shrink-0 ${
                            active
                              ? 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-blue-600 dark:text-blue-400'
                              : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-400'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">
                            {item.title}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 flex items-center gap-2 shrink-0">
                        {item.badge && (
                          <span className="font-mono-num text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                            {item.badge}
                          </span>
                        )}
                        <ArrowUpRight
                          className={`w-3.5 h-3.5 transition-transform duration-200 ${
                            active
                              ? 'translate-x-0 translate-y-0 opacity-100 text-blue-600 dark:text-blue-400'
                              : '-translate-x-1 translate-y-1 opacity-30'
                          }`}
                        />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Carter Ogunsola-Style Keyboard Telemetry Footer */}
            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] font-mono-num uppercase tracking-wider text-slate-500">
              <div className="flex items-center gap-3">
                <span>↑↓ NAVIGATE</span>
                <span>·</span>
                <span>↵ SELECT</span>
                <span>·</span>
                <span>ESC CLOSE</span>
              </div>
              <span>BNHS::CMD_INDEX</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
