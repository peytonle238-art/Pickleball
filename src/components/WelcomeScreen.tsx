import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  ChevronDown,
  Clock,
  Eye,
  Home,
  Lock,
  LogIn,
  Moon,
  QrCode,
  ShieldCheck,
  Sun,
  Trophy,
} from 'lucide-react';
import { ClubDataState, NavTab } from '../types';
import { getNextUpcomingEvent } from '../utils/clubUtils';
import { User } from '../firebase';

export const BOBCATS_LOGO_URL = '/assets/aistudio/images_25669a2b.png';

interface WelcomeScreenProps {
  data: ClubDataState;
  darkMode: boolean;
  currentUser: User | null;
  onToggleDarkMode: () => void;
  onEnterAsMember: (targetTab: NavTab) => void;
  onEnterAsOfficer: (pin: string, targetTab: NavTab) => boolean;
  onOpenQrScanner: () => void;
  onGoogleSignIn: () => Promise<void>;
}

const SMOOTH_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const MEMBER_DESTINATIONS: {
  id: NavTab;
  label: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'home',
    label: 'Member Overview',
    description: 'Next practice countdown, digital ID pass & standings lookup',
    icon: <Home className="w-4 h-4" />,
  },
  {
    id: 'activity',
    label: 'My Activity',
    description: 'Your personal match history, attendance log & club tasks',
    icon: <Activity className="w-4 h-4" />,
  },
  {
    id: 'ladder',
    label: 'Standings & Stats',
    description: 'Live Elo rankings, win streaks & match history',
    icon: <Award className="w-4 h-4" />,
  },
  {
    id: 'tournaments',
    label: 'Club Tournaments',
    description: 'In-club brackets, round robins & court schedules',
    icon: <Trophy className="w-4 h-4" />,
  },
  {
    id: 'watch',
    label: 'Outside Watch',
    description: 'Regional tournaments, deadlines & club pairs',
    icon: <Eye className="w-4 h-4" />,
  },
  {
    id: 'calendar',
    label: 'Practice Calendar',
    description: 'Monthly practice schedule & QR attendance check-in',
    icon: <Calendar className="w-4 h-4" />,
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  data,
  darkMode,
  currentUser,
  onToggleDarkMode,
  onEnterAsMember,
  onEnterAsOfficer,
  onOpenQrScanner,
  onGoogleSignIn,
}) => {
  const [selectedDestination, setSelectedDestination] =
    useState<NavTab>('home');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showOfficerPanel, setShowOfficerPanel] = useState(false);

  // Officer PIN unlock state (zero hints)
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Live clock for countdown
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const hasScheduledEvents =
    data.events.length > 0 ||
    (data.settings.recurringPractices.enabled &&
      data.settings.recurringPractices.daysOfWeek.length > 0);

  const { event: nextEvent, targetDate } = getNextUpcomingEvent(
    data.events,
    data.settings,
    now
  );
  const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

  const activeDestObj =
    MEMBER_DESTINATIONS.find((d) => d.id === selectedDestination) ||
    MEMBER_DESTINATIONS[0];

  const handleOfficerPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onEnterAsOfficer(pinInput, selectedDestination);
    if (!ok) {
      setPinError('Invalid access code.');
      setPinInput('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col justify-between relative overflow-hidden transition-colors duration-300">
      {/* Subtle Minimalist Ambient Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10 dark:opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 0%, var(--club-primary) 0%, transparent 55%)`,
        }}
      />

      {/* Minimalist Top Bar */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-20 max-w-5xl w-full mx-auto px-6 py-5 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white px-2.5 py-1 rounded-xl shadow-xs border border-slate-200/80 flex items-center justify-center">
            <img
              src={BOBCATS_LOGO_URL}
              alt="Byron Nelson Bobcats"
              className="h-7 w-auto object-contain"
            />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            {data.settings.clubName}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowOfficerPanel(!showOfficerPanel)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
              showOfficerPanel
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Officer Portal</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="min-h-[38px] w-9 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </motion.header>

      {/* Center Minimalist Hub */}
      <main className="relative z-20 max-w-xl w-full mx-auto px-6 py-8 my-auto flex flex-col items-center text-center space-y-7">
        {/* Official Bobcats Emblem Showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="bg-white px-6 py-4 rounded-3xl shadow-md border border-slate-200/80 flex items-center justify-center"
        >
          <img
            src={BOBCATS_LOGO_URL}
            alt="Byron Nelson Bobcats Northwest ISD"
            className="h-20 sm:h-24 w-auto object-contain"
          />
        </motion.div>

        {/* Minimalist Title & Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: 'easeOut' }}
          className="space-y-2.5"
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            {data.settings.schoolName}
          </div>
          <h1
            className="font-display font-bold tracking-tight text-slate-900 dark:text-white leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)' }}
          >
            {data.settings.clubName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Access player stats, tournament brackets, the event calendar, and
            live match scoring in one place.
          </p>
        </motion.div>

        {/* Unified Dropdown Menu Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }}
          className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 shadow-lg text-left space-y-4"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              Select Destination
            </span>
            <span className="text-slate-400 dark:text-slate-500 font-mono-num">
              {hasScheduledEvents
                ? `Next Event: ${days}d ${hours}h ${minutes}m`
                : `${data.members.length} Members`}
            </span>
          </div>

          {/* Interactive Everything Dropdown with Bobcats Image */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full min-h-[56px] px-4 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  {activeDestObj.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeDestObj.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {activeDestObj.description}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                  dropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-30"
                    onClick={() => setDropdownOpen(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute left-0 right-0 mt-2 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-2 space-y-1.5"
                  >
                    {/* Dropdown Menu Header with Bobcats Image */}
                    <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="bg-white px-2 py-1 rounded-lg border border-slate-200/80">
                          <img
                            src={BOBCATS_LOGO_URL}
                            alt="Bobcats Logo"
                            className="h-5 w-auto object-contain"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            Club Navigation Menu
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Stats, Tournaments, Calendar & Scoring
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1 pt-1">
                      {MEMBER_DESTINATIONS.map((opt) => {
                        const isSelected = opt.id === selectedDestination;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => {
                              setSelectedDestination(opt.id);
                              setDropdownOpen(false);
                            }}
                            className={`w-full px-3 py-2.5 rounded-xl text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={
                                  isSelected
                                    ? 'text-white'
                                    : 'text-blue-600 dark:text-blue-400'
                                }
                              >
                                {opt.icon}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate">
                                  {opt.label}
                                </div>
                                <div
                                  className={`text-[11px] truncate ${
                                    isSelected
                                      ? 'text-blue-100'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {opt.description}
                                </div>
                              </div>
                            </div>
                            <ArrowRight
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-white' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Primary Launch Button + QR Check-in */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
            <motion.button
              whileTap={{ scale: 0.985 }}
              type="button"
              onClick={() => onEnterAsMember(selectedDestination)}
              className="sm:col-span-8 min-h-[48px] px-5 py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-opacity hover:opacity-95"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <span>Open {activeDestObj.label}</span>
              <ArrowRight className="w-4 h-4" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.985 }}
              type="button"
              onClick={onOpenQrScanner}
              className="sm:col-span-4 min-h-[48px] px-4 py-3 rounded-2xl font-semibold text-xs bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
            >
              <QrCode className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>QR Check-In</span>
            </motion.button>
          </div>

          {/* Minimalist 1-Tap Quick Pills for Stats, Tournaments, Calendar */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onEnterAsMember('ladder')}
              className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>Stats</span>
            </button>
            <button
              type="button"
              onClick={() => onEnterAsMember('tournaments')}
              className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-500" />
              <span>Tournaments</span>
            </button>
            <button
              type="button"
              onClick={() => onEnterAsMember('calendar')}
              className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Calendar</span>
            </button>
          </div>
        </motion.div>

        {/* Collapsible Officer Access Card (Zero Hints) */}
        <AnimatePresence>
          {showOfficerPanel && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -8 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -8 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full overflow-hidden"
            >
              <form
                onSubmit={handleOfficerPinSubmit}
                className="w-full rounded-3xl bg-slate-900 text-white p-5 border border-slate-800 shadow-xl text-left space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Officer Full-Access Login</span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    4-Digit Access Code
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      setPinError('');
                      setPinInput(
                        e.target.value.replace(/\D/g, '').slice(0, 4)
                      );
                    }}
                    placeholder="••••"
                    className="flex-1 h-12 text-center font-mono-num text-2xl tracking-[0.5em] rounded-xl bg-slate-950 border border-white/15 text-white focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="h-12 px-5 rounded-xl font-bold text-xs text-slate-950 cursor-pointer shrink-0 transition-opacity hover:opacity-95"
                    style={{ backgroundColor: 'var(--club-secondary)' }}
                  >
                    Unlock
                  </button>
                </div>

                {pinError && (
                  <div className="text-xs font-semibold text-red-400">
                    {pinError}
                  </div>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Minimalist Footer */}
      <footer className="relative z-20 max-w-5xl w-full mx-auto px-6 py-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {hasScheduledEvents
            ? `Next: ${nextEvent.title} (${nextEvent.date})`
            : `${data.settings.schoolName} · ${data.settings.clubName}`}
        </span>
        {!currentUser ? (
          <button
            type="button"
            onClick={onGoogleSignIn}
            className="hover:text-slate-700 dark:hover:text-slate-300 inline-flex items-center gap-1 cursor-pointer transition-colors"
          >
            <LogIn className="w-3.5 h-3.5" /> Sign in with Google
          </button>
        ) : (
          <span>Synced: {currentUser.displayName || currentUser.email}</span>
        )}
      </footer>
    </div>
  );
};
