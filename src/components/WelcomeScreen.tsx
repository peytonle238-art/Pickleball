import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  Moon,
  Sun,
} from 'lucide-react';
import {
  ClubDataState,
  GradeLevel,
  Member,
  NavTab,
  SkillLevel,
} from '../types';
import {
  getClubText,
  getNextUpcomingEvent,
  processImageFileToDataUrl,
} from '../utils/clubUtils';
import { AnimatedNumber, EXPO_OUT } from './MotionPrimitives';
import {
  AutoTabItem,
  AutoTabs,
  ENODE_EASE,
  FloatingWidget,
  Marquee,
  Reveal,
  RevealGroup,
  RevealItem,
  RollingNumber,
  TickingValue,
  useScrolled,
} from './EnodePrimitives';

export const BOBCATS_LOGO_URL = '/assets/aistudio/images_25669a2b.png';

interface WelcomeScreenProps {
  data: ClubDataState;
  darkMode: boolean;
  linkedMemberId: string;
  onToggleDarkMode: () => void;
  onEnterAsMember: (targetTab: NavTab) => void;
  onEnterAsOfficer: (pin: string, targetTab: NavTab) => boolean;
  onSignInBySchoolId: (
    schoolId: string
  ) => Promise<Member | null> | Member | null;
  onRegisterMember: (payload: {
    schoolId: string;
    name: string;
    grade: GradeLevel;
    skillLevel: SkillLevel;
    paddleNotes?: string;
    photoUrl?: string;
  }) => Member;
  onSignOutMember: () => void;
}

const MEMBER_DESTINATIONS: {
  id: NavTab;
  label: string;
  description: string;
}[] = [
  {
    id: 'home',
    label: 'Member Overview',
    description: 'Welcome to BNHS Pickleball Club',
  },
  {
    id: 'activity',
    label: 'My Activity',
    description: 'Your personal match history, attendance log & club tasks',
  },
  {
    id: 'ladder',
    label: 'Standings & Stats',
    description: 'Live Elo rankings, win streaks & match history',
  },
  {
    id: 'tournaments',
    label: 'Club Tournaments',
    description: 'In-club brackets, round robins & court schedules',
  },
  {
    id: 'watch',
    label: 'Outside Watch',
    description: 'Regional tournaments, deadlines & club pairs',
  },
  {
    id: 'calendar',
    label: 'Practice Calendar',
    description: 'Monthly practice schedule & club event dates',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  data,
  darkMode,
  linkedMemberId,
  onToggleDarkMode,
  onEnterAsMember,
  onEnterAsOfficer,
  onSignInBySchoolId,
  onRegisterMember,
  onSignOutMember,
}) => {
  const [selectedDestination, setSelectedDestination] =
    useState<NavTab>('home');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<
    'signin' | 'register' | 'officer'
  >('signin');

  // School ID Sign-In state
  const [schoolIdInput, setSchoolIdInput] = useState('');
  const [signInFeedback, setSignInFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Add Yourself to Database state
  const [regSchoolId, setRegSchoolId] = useState('');
  const [regName, setRegName] = useState('');
  const [regGrade, setRegGrade] = useState<GradeLevel>(10);
  const [regSkill, setRegSkill] = useState<SkillLevel>('Intermediate');
  const [regNotes, setRegNotes] = useState('');
  const [regPhoto, setRegPhoto] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [regFeedback, setRegFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Officer PIN unlock state (zero hints)
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Live clock for footer
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeMember =
    data.members.find(
      (m) =>
        m.id === linkedMemberId ||
        (m.schoolId &&
          m.schoolId.trim().toLowerCase() ===
            linkedMemberId.trim().toLowerCase())
    ) || null;

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

  const handleSchoolIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = schoolIdInput.trim();
    if (!cleaned) {
      setSignInFeedback({
        type: 'error',
        text: 'Please enter your School ID to continue.',
      });
      return;
    }
    const found = await onSignInBySchoolId(cleaned);
    if (found) {
      setSignInFeedback({
        type: 'success',
        text: `Signed in as ${found.name} (ID: ${found.schoolId || found.id})`,
      });
      setSchoolIdInput('');
      onEnterAsMember('activity');
    } else {
      setSignInFeedback({
        type: 'error',
        text: 'No member found with that School ID. Switch to "Add Yourself" to register.',
      });
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = regSchoolId.trim();
    const cleanName = regName.trim();
    if (!cleanId || !cleanName) {
      setRegFeedback({
        type: 'error',
        text: 'Please enter both your School ID and full name.',
      });
      return;
    }
    const created = onRegisterMember({
      schoolId: cleanId,
      name: cleanName,
      grade: regGrade,
      skillLevel: regSkill,
      paddleNotes: regNotes.trim(),
      photoUrl: regPhoto,
    });
    setRegFeedback({
      type: 'success',
      text: `Account ready for ${created.name} (ID: ${created.schoolId})!`,
    });
    setRegSchoolId('');
    setRegName('');
    setRegNotes('');
    setRegPhoto('');
    onEnterAsMember('activity');
  };

  const handleOfficerPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onEnterAsOfficer(pinInput, selectedDestination);
    if (!ok) {
      setPinError('Invalid access code.');
      setPinInput('');
    }
  };

  // ---------------------------------------------------------------------------
  // Enode-style landing data
  // ---------------------------------------------------------------------------
  const scrolled = useScrolled(12);

  const memberById = (id: string) => data.members.find((m) => m.id === id);
  const initialsOf = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  const rankedMembers = [...data.members].sort((a, b) => b.elo - a.elo);
  const ladderLeader = rankedMembers[0] || null;

  const recentMatches = [...data.matches]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 5);
  const [matchTicker, setMatchTicker] = useState(0);
  useEffect(() => {
    if (recentMatches.length < 2) return;
    const t = setInterval(
      () => setMatchTicker((i) => (i + 1) % recentMatches.length),
      4200
    );
    return () => clearInterval(t);
  }, [recentMatches.length]);
  const tickerMatch = recentMatches[matchTicker % Math.max(1, recentMatches.length)];
  const teamLabel = (ids: string[]) =>
    ids
      .map((id) => memberById(id)?.name.split(' ')[0] || 'Player')
      .join(' & ');
  const lastGame = tickerMatch?.games[tickerMatch.games.length - 1];

  const latestSession = [...data.attendance].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0
  )[0];

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  const openAccess = (tab: 'signin' | 'register' | 'officer') => {
    setAccountTab(tab);
    setSignInFeedback(null);
    setRegFeedback(null);
    setPinError('');
    scrollToId('access');
  };

  const headlineWords = ['Every', 'rally,', 'ranked', 'and', 'remembered.'];

  const featureTabs: AutoTabItem[] = [
    {
      id: 'scoring',
      label: 'Live scoring',
      title: 'Courtside scorekeeping',
      description:
        'Sideout or rally scoring, best-of-three, and automatic Elo updates the moment a match is final.',
      panel: (
        <LiveScorePanel
          teamA={recentMatches[0] ? teamLabel(recentMatches[0].team1Ids) : 'Home'}
          teamB={recentMatches[0] ? teamLabel(recentMatches[0].team2Ids) : 'Away'}
        />
      ),
    },
    {
      id: 'ladder',
      label: 'Ladder & Elo',
      title: 'A ladder that stays honest',
      description:
        'Every ranked result moves the standings. Challenge players above you and watch your rating climb.',
      panel: (
        <div className="glass-card rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Club ladder</span>
            <span className="inline-flex items-center gap-1.5">
              <span className="live-dot" /> Live
            </span>
          </div>
          {(rankedMembers.length ? rankedMembers.slice(0, 4) : []).map((m, i) => {
            const top = rankedMembers[0]?.elo || 1;
            const pct = Math.max(18, Math.round((m.elo / top) * 100));
            return (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono-num text-xs text-slate-400 w-4">{i + 1}</span>
                    <span className="font-medium text-slate-900 dark:text-white truncate">
                      {m.name}
                    </span>
                  </span>
                  <span className="font-mono-num text-sm text-slate-900 dark:text-white">
                    {m.elo}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-slate-900 dark:bg-court"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.1, delay: 0.1 + i * 0.08, ease: ENODE_EASE }}
                  />
                </div>
              </div>
            );
          })}
          {rankedMembers.length === 0 && (
            <div className="text-sm text-slate-500 py-6 text-center">
              Rankings appear after the first ranked match.
            </div>
          )}
        </div>
      ),
    },
    {
      id: 'tournaments',
      label: 'Tournaments',
      title: 'Brackets in a few taps',
      description:
        'Round robins and single elimination, seeded straight from the ladder, with court assignments built in.',
      panel: (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">
                {data.clubTournaments[0]?.format === 'round_robin'
                  ? 'Round robin'
                  : 'Single elimination'}
              </div>
              <div className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                {data.clubTournaments[0]?.name || 'Club Championship'}
              </div>
            </div>
            <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-court text-slate-900">
              {data.clubTournaments[0]?.status || 'Upcoming'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              [0, 3],
              [1, 2],
            ].map(([a, b], pairIdx) => (
              <div
                key={pairIdx}
                className="rounded-xl border border-[var(--hairline)] bg-white/70 dark:bg-white/[0.03] divide-y divide-[var(--hairline)]"
              >
                {[a, b].map((seed) => (
                  <div key={seed} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-mono-num text-[11px] text-slate-400">{seed + 1}</span>
                    <span className="truncate text-slate-800 dark:text-slate-200">
                      {rankedMembers[seed]?.name.split(' ')[0] || `Seed ${seed + 1}`}
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="text-xs text-slate-500">
            Seeded by live Elo · {data.clubTournaments.length} bracket
            {data.clubTournaments.length === 1 ? '' : 's'} this season
          </div>
        </div>
      ),
    },
    {
      id: 'attendance',
      label: 'Attendance',
      title: 'Check-ins without clipboards',
      description:
        'Officers mark attendance in seconds; members see their streaks and milestones automatically.',
      panel: (
        <div className="glass-card rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">
                {latestSession?.date || 'Next practice'}
              </div>
              <div className="text-base font-semibold tracking-tight text-slate-900 dark:text-white">
                {latestSession?.title || 'Practice session'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white font-mono-num">
                {latestSession?.presentMemberIds.length ?? 0}
                <span className="text-slate-400 text-base">/{data.members.length}</span>
              </div>
              <div className="text-[11px] text-slate-500">checked in</div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-olive dark:bg-court"
              initial={{ width: 0 }}
              animate={{
                width: `${
                  data.members.length
                    ? Math.round(
                        ((latestSession?.presentMemberIds.length ?? 0) /
                          data.members.length) *
                          100
                      )
                    : 0
                }%`,
              }}
              transition={{ duration: 1.2, ease: ENODE_EASE }}
            />
          </div>
          <div className="flex -space-x-2">
            {(latestSession?.presentMemberIds || [])
              .slice(0, 8)
              .map((id) => memberById(id))
              .filter(Boolean)
              .map((m) => (
                <span
                  key={m!.id}
                  title={m!.name}
                  className="w-8 h-8 rounded-full ring-2 ring-white dark:ring-slate-900 bg-slate-200 dark:bg-slate-800 text-[10px] font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center overflow-hidden"
                >
                  {m!.photoUrl ? (
                    <img src={m!.photoUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    initialsOf(m!.name)
                  )}
                </span>
              ))}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-paper dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col transition-colors duration-300">
      {/* ================================================================= */}
      {/* STICKY FROSTED NAV                                                */}
      {/* ================================================================= */}
      <header
        className={`sticky top-0 z-40 w-full transition-all duration-500 ${
          scrolled
            ? 'bg-paper/75 dark:bg-slate-950/70 backdrop-blur-xl border-b border-[var(--hairline)]'
            : 'bg-transparent border-b border-transparent'
        }`}
      >
        <div
          className={`max-w-6xl w-full mx-auto px-4 sm:px-6 flex items-center justify-between transition-all duration-500 ${
            scrolled ? 'h-14' : 'h-16 sm:h-20'
          }`}
        >
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <img
              src={BOBCATS_LOGO_URL}
              alt="Byron Nelson Bobcats"
              className="h-7 w-auto object-contain"
            />
            <span className="text-[15px] font-semibold tracking-tight">
              {data.settings.clubName}
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600 dark:text-slate-400">
            <button type="button" onClick={() => scrollToId('features')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Platform
            </button>
            <button type="button" onClick={() => scrollToId('stats')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Season
            </button>
            <button type="button" onClick={() => onEnterAsMember('ladder')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Standings
            </button>
            <button type="button" onClick={() => onEnterAsMember('calendar')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Calendar
            </button>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={onToggleDarkMode}
              className="w-9 h-9 rounded-full flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => openAccess('signin')}
              className="hidden sm:inline-flex px-3 h-9 items-center text-sm text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => openAccess('register')}
              className="pill-btn !min-h-[36px] !px-4 !text-[13px]"
            >
              Join the club
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* =============================================================== */}
        {/* HERO + FLOATING LIVE WIDGETS                                    */}
        {/* =============================================================== */}
        <section className="relative overflow-hidden">
          <div className="dot-grid absolute inset-0 pointer-events-none" />
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full bg-court/40 dark:bg-court/[0.06] blur-3xl pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-16 pb-16 sm:pb-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-6 space-y-7">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: ENODE_EASE }}
                className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border border-[var(--hairline)] bg-white/70 dark:bg-white/[0.04] text-xs text-slate-600 dark:text-slate-300"
              >
                <span className="px-2 py-0.5 rounded-full bg-court text-slate-900 font-medium">
                  {data.settings.schoolName}
                </span>
                <span>Official club portal</span>
              </motion.div>

              <h1
                className="font-display font-semibold text-slate-900 dark:text-white leading-[1.02]"
                style={{ fontSize: 'clamp(2.75rem, 6.2vw, 4.75rem)' }}
              >
                {headlineWords.map((w, i) => (
                  <motion.span
                    key={w + i}
                    className="inline-block mr-[0.22em]"
                    initial={{ opacity: 0, y: 18, filter: 'blur(10px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    transition={{ duration: 1, delay: 0.08 + i * 0.07, ease: ENODE_EASE }}
                  >
                    {w}
                  </motion.span>
                ))}
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.45, ease: ENODE_EASE }}
                className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg"
              >
                {getClubText(
                  data.settings,
                  'welcomeTagline',
                  'Official high school pickleball club portal. Sign in with your School ID or register on the club roster to track matches, Elo standings, and practice attendance.'
                )}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.55, ease: ENODE_EASE }}
                className="flex flex-wrap items-center gap-3"
              >
                <button
                  type="button"
                  onClick={() =>
                    activeMember ? onEnterAsMember('activity') : openAccess('signin')
                  }
                  className="pill-btn"
                >
                  {activeMember ? `Continue as ${activeMember.name.split(' ')[0]}` : 'Enter the portal'}
                  <ArrowRight className="pill-arrow w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onEnterAsMember('ladder')}
                  className="pill-btn-ghost"
                >
                  See standings
                </button>
              </motion.div>

              {data.settings.customText?.clubRulesOrNotes?.trim() && (
                <div className="p-4 rounded-2xl bg-white/70 dark:bg-white/[0.03] border border-[var(--hairline)] text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line max-w-lg">
                  {data.settings.customText.clubRulesOrNotes}
                </div>
              )}
            </div>

            {/* Floating "living" widgets */}
            <div className="lg:col-span-6 relative h-[420px] sm:h-[460px] hidden sm:block">
              {/* Latest result */}
              <FloatingWidget
                delay={0.25}
                period={7}
                className="absolute left-0 top-4 w-[290px]"
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="live-dot" /> Latest result
                    </span>
                    <span className="font-mono-num">{tickerMatch?.date || '—'}</span>
                  </div>
                  {tickerMatch && lastGame ? (
                    <div className="space-y-1.5">
                      {[1, 2].map((team) => {
                        const ids = team === 1 ? tickerMatch.team1Ids : tickerMatch.team2Ids;
                        const score = team === 1 ? lastGame.team1Score : lastGame.team2Score;
                        const won = tickerMatch.winnerTeam === team;
                        return (
                          <div key={team} className="flex items-center justify-between">
                            <TickingValue
                              valueKey={`${tickerMatch.id}-${team}`}
                              value={teamLabel(ids)}
                              className={`text-sm truncate max-w-[180px] ${won ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500'}`}
                            />
                            <TickingValue
                              valueKey={`${tickerMatch.id}-${team}-s`}
                              value={score}
                              className={`font-mono-num text-xl ${won ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-500">No matches logged yet</div>
                  )}
                </div>
              </FloatingWidget>

              {/* Ladder leader */}
              <FloatingWidget
                delay={0.4}
                period={8}
                amplitude={6}
                className="absolute right-0 top-0 w-[230px]"
              >
                <div className="p-4">
                  <div className="text-xs text-slate-500 mb-2">Ladder leader</div>
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-court text-slate-900 text-xs font-semibold flex items-center justify-center overflow-hidden shrink-0">
                      {ladderLeader?.photoUrl ? (
                        <img src={ladderLeader.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        initialsOf(ladderLeader?.name || 'BN')
                      )}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {ladderLeader?.name || 'Awaiting first match'}
                      </div>
                      <div className="font-mono-num text-xs text-slate-500">
                        {ladderLeader ? (
                          <>
                            <AnimatedNumber value={ladderLeader.elo} /> Elo
                          </>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </FloatingWidget>

              {/* Next session */}
              <FloatingWidget
                delay={0.55}
                period={6.5}
                className="absolute left-10 bottom-10 w-[260px]"
              >
                <div className="p-4">
                  <div className="text-xs text-slate-500 mb-1">Next session</div>
                  <div className="text-sm font-semibold truncate">
                    {hasScheduledEvents ? nextEvent.title : 'Schedule coming soon'}
                  </div>
                  {hasScheduledEvents && (
                    <div className="mt-3 flex items-end gap-3 font-mono-num">
                      {[
                        { v: days, l: 'd' },
                        { v: hours, l: 'h' },
                        { v: minutes, l: 'm' },
                      ].map((u) => (
                        <div key={u.l} className="flex items-baseline gap-0.5">
                          <TickingValue
                            valueKey={u.v}
                            value={String(u.v).padStart(2, '0')}
                            className="text-2xl text-slate-900 dark:text-white"
                          />
                          <span className="text-xs text-slate-400">{u.l}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </FloatingWidget>

              {/* Attendance */}
              <FloatingWidget
                delay={0.7}
                period={7.5}
                amplitude={4}
                className="absolute right-4 bottom-0 w-[220px]"
              >
                <div className="p-4">
                  <div className="text-xs text-slate-500 mb-1">Last practice</div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-semibold tracking-tight font-mono-num">
                      <AnimatedNumber value={latestSession?.presentMemberIds.length ?? 0} />
                    </span>
                    <span className="text-xs text-slate-500">checked in</span>
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-slate-200/70 dark:bg-slate-800 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-olive dark:bg-court"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${
                          data.members.length
                            ? Math.round(
                                ((latestSession?.presentMemberIds.length ?? 0) /
                                  data.members.length) *
                                  100
                              )
                            : 0
                        }%`,
                      }}
                      transition={{ duration: 1.4, delay: 1, ease: ENODE_EASE }}
                    />
                  </div>
                </div>
              </FloatingWidget>
            </div>
          </div>
        </section>

        {/* =============================================================== */}
        {/* ROSTER MARQUEE                                                  */}
        {/* =============================================================== */}
        {data.members.length > 0 && (
          <section className="border-y border-[var(--hairline)] py-6">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-4 text-center text-xs text-slate-500">
              Played by {data.members.length} athletes at {data.settings.schoolName}
            </div>
            <Marquee durationSec={Math.max(30, data.members.length * 3)}>
              {rankedMembers.slice(0, 24).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 mx-6 text-slate-500 dark:text-slate-400 whitespace-nowrap"
                >
                  <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-center overflow-hidden">
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt="" className="w-full h-full object-cover grayscale" />
                    ) : (
                      initialsOf(m.name)
                    )}
                  </span>
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="font-mono-num text-xs text-slate-400">{m.elo}</span>
                </div>
              ))}
            </Marquee>
          </section>
        )}

        {/* =============================================================== */}
        {/* FEATURE SHOWCASE                                                */}
        {/* =============================================================== */}
        <section id="features" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28">
          <Reveal className="max-w-2xl mb-12 space-y-4">
            <div className="eyebrow">
              <span className="w-1.5 h-1.5 rounded-full bg-olive dark:bg-court" /> The club platform
            </div>
            <h2 className="font-display text-3xl sm:text-5xl font-semibold leading-[1.05]">
              One club, every tool.
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
              Scoring, standings, brackets and attendance live in one place, so
              officers spend less time on spreadsheets and more time on court.
            </p>
          </Reveal>
          <Reveal delay={0.1}>
            <AutoTabs items={featureTabs} layoutIdPrefix="welcome-features" />
          </Reveal>
        </section>

        {/* =============================================================== */}
        {/* SEASON STATS                                                    */}
        {/* =============================================================== */}
        <section id="stats" className="scroll-mt-20 border-t border-[var(--hairline)]">
          <RevealGroup className="max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 grid grid-cols-2 lg:grid-cols-4 gap-y-10 gap-x-6">
            {[
              { v: data.members.length, l: 'Athletes on the roster', s: '' },
              { v: data.matches.length, l: 'Matches logged this season', s: '' },
              { v: data.attendance.length, l: 'Practices held', s: '' },
              {
                v: data.clubTournaments.length + data.outsideTournaments.length,
                l: 'Tournaments tracked',
                s: '',
              },
            ].map((stat) => (
              <RevealItem key={stat.l} className="space-y-2">
                <div className="font-display text-4xl sm:text-6xl font-semibold tracking-tight text-slate-900 dark:text-white">
                  <RollingNumber value={stat.v} suffix={stat.s} />
                </div>
                <div className="text-sm text-slate-500 max-w-[12rem]">{stat.l}</div>
              </RevealItem>
            ))}
          </RevealGroup>
        </section>

        {/* =============================================================== */}
        {/* ACCESS                                                          */}
        {/* =============================================================== */}
        <section id="access" className="scroll-mt-20 border-t border-[var(--hairline)] bg-slate-100/50 dark:bg-white/[0.015]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-start">
            <Reveal className="lg:col-span-5 space-y-5 lg:sticky lg:top-24">
              <div className="eyebrow">
                <span className="w-1.5 h-1.5 rounded-full bg-olive dark:bg-court" /> Get started
              </div>
              <h2 className="font-display text-3xl sm:text-4xl font-semibold leading-[1.08]">
                Your profile, your matches, your climb.
              </h2>
              <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                Sign in with your School ID, or add yourself to the roster in under a
                minute. Officers unlock the full console with their access code.
              </p>
              <div className="co-index-list border-t border-[var(--hairline)]">
                {(
                  [
                    { id: 'activity' as NavTab, title: 'My activity & badges' },
                    { id: 'ladder' as NavTab, title: 'Official Elo standings' },
                    { id: 'tournaments' as NavTab, title: 'Tournament brackets' },
                    { id: 'calendar' as NavTab, title: 'Practice schedule' },
                  ] as const
                ).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => onEnterAsMember(row.id)}
                    className="co-index-row w-full py-3.5 flex items-center justify-between gap-3 text-left border-b border-[var(--hairline)] cursor-pointer"
                  >
                    <span className="co-row-shift text-sm font-medium text-slate-900 dark:text-white">
                      {row.title}
                    </span>
                    <ArrowUpRight className="co-row-arrow w-4 h-4 text-slate-500" />
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1} className="lg:col-span-7">
<div className="glass-card rounded-3xl p-5 sm:p-7 text-left space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--hairline)]">
              <div className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                {getClubText(
                  data.settings,
                  'welcomeAccessHeading',
                  'Athlete & Officer Access'
                )}
              </div>
              {activeMember && (
                <span className="font-mono-num text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  ID {activeMember.schoolId || activeMember.id}
                </span>
              )}
            </div>

            {/* 3-Tab Switcher with Shared layoutId Spring Indicator */}
            <div className="grid grid-cols-3 border-b border-[var(--hairline)]">
              {(
                [
                  { id: 'signin', label: 'School ID' },
                  { id: 'register', label: 'Add Yourself' },
                  { id: 'officer', label: 'Officer' },
                ] as const
              ).map((tab) => {
                const isSelected = accountTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setAccountTab(tab.id);
                      if (tab.id === 'signin') setSignInFeedback(null);
                      if (tab.id === 'register') setRegFeedback(null);
                      if (tab.id === 'officer') setPinError('');
                    }}
                    className={`relative py-2.5 px-2 text-xs font-semibold transition-colors cursor-pointer ${
                      isSelected
                        ? tab.id === 'officer'
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {tab.label}
                    {isSelected && (
                      <motion.div
                        layoutId="welcome-auth-tab-indicator"
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 32,
                        }}
                        className={`absolute bottom-0 left-0 right-0 h-0.5 -mb-px ${
                          tab.id === 'officer'
                            ? 'bg-slate-900 dark:bg-court'
                            : 'bg-slate-900 dark:bg-court'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* TAB 1: SCHOOL ID SIGN IN */}
            {accountTab === 'signin' && (
              <div className="space-y-3">
                {activeMember ? (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-[var(--hairline)] space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {activeMember.photoUrl ? (
                          <img
                            src={activeMember.photoUrl}
                            alt={activeMember.name}
                            className="w-10 h-10 rounded-xl object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 text-xs">
                            {activeMember.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {activeMember.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                            ID {activeMember.schoolId || 'Linked'} · Grade {activeMember.grade} · {activeMember.elo} Elo
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onSignOutMember}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                      >
                        Switch
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEnterAsMember('activity')}
                      className="w-full py-2.5 px-3 rounded-full bg-slate-900 hover:bg-black text-white dark:bg-court dark:text-slate-900 dark:hover:bg-court-deep text-xs font-bold cursor-pointer transition-colors"
                    >
                      Continue to My Activity & Stats
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSchoolIdSubmit} className="space-y-2.5">
                    <label className="block text-xs text-slate-600 dark:text-slate-400">
                      {getClubText(
                        data.settings,
                        'welcomeSignInPrompt',
                        'Enter your School ID to load your member profile:'
                      )}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={schoolIdInput}
                        onChange={(e) => {
                          setSignInFeedback(null);
                          setSchoolIdInput(e.target.value);
                        }}
                        placeholder="School ID (e.g. 204819)"
                        className="flex-1 h-10 px-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-300/80 dark:border-slate-700 text-xs font-mono-num text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-court focus:ring-4 focus:ring-court/50 transition-shadow"
                      />
                      <button
                        type="submit"
                        className="h-10 px-4 rounded-full bg-slate-900 hover:bg-black text-white dark:bg-court dark:text-slate-900 dark:hover:bg-court-deep text-xs font-bold cursor-pointer shrink-0 transition-colors"
                      >
                        Sign In
                      </button>
                    </div>
                  </form>
                )}

                {signInFeedback && (
                  <div
                    className={`text-xs font-medium px-3 py-2 rounded-xl border ${
                      signInFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {signInFeedback.text}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ADD YOURSELF TO CLUB DATABASE */}
            {accountTab === 'register' && (
              data.settings.registrationLocked ? (
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Self-Registration Currently Closed
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                    Club Officers have temporarily locked new member self-registration. If you are already on the roster, use the Sign In tab with your School ID, or ask an Officer at practice to add you.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleRegisterSubmit} className="space-y-3">
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Register your School ID on the club roster to track matches and standings across all devices:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <input
                      type="text"
                      required
                      value={regSchoolId}
                      onChange={(e) => {
                        setRegFeedback(null);
                        setRegSchoolId(e.target.value);
                      }}
                      placeholder="School ID (Required)"
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-300/80 dark:border-slate-700 text-xs font-mono-num text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-court focus:ring-4 focus:ring-court/50 transition-shadow"
                    />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => {
                        setRegFeedback(null);
                        setRegName(e.target.value);
                      }}
                      placeholder="Full Name (First & Last)"
                      className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-300/80 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-court focus:ring-4 focus:ring-court/50 transition-shadow"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <select
                      value={regGrade}
                      onChange={(e) =>
                        setRegGrade(Number(e.target.value) as GradeLevel)
                      }
                      className="h-9 px-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300/80 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-court focus:ring-4 focus:ring-court/50 transition-shadow"
                    >
                      <option value={9}>9th Grade</option>
                      <option value={10}>10th Grade</option>
                      <option value={11}>11th Grade</option>
                      <option value={12}>12th Grade</option>
                    </select>
                    <select
                      value={regSkill}
                      onChange={(e) => setRegSkill(e.target.value as SkillLevel)}
                      className="h-9 px-2.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-300/80 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-court focus:ring-4 focus:ring-court/50 transition-shadow"
                    >
                      <option value="Beginner">Beginner</option>
                      <option value="Intermediate">Intermediate</option>
                      <option value="Advanced">Advanced</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    value={regNotes}
                    onChange={(e) => setRegNotes(e.target.value)}
                    placeholder="Paddle / Preferred Partner (Optional)"
                    className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-300/80 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-court focus:ring-4 focus:ring-court/50 transition-shadow"
                  />

                  {/* Profile Photo Upload Option */}
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-[var(--hairline)]">
                    <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 text-[10px] font-bold text-slate-500">
                      {regPhoto ? (
                        <img
                          src={regPhoto}
                          alt="Profile Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span>IMG</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {regPhoto ? 'Photo Added' : 'Athlete Photo'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {photoUploading ? 'Processing image...' : 'Optional roster picture'}
                      </div>
                    </div>
                    <label className="min-h-[32px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center cursor-pointer shrink-0 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                      <span>{regPhoto ? 'Change' : 'Upload'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              setPhotoUploading(true);
                              const dataUrl = await processImageFileToDataUrl(file);
                              setRegPhoto(dataUrl);
                            } catch (err) {
                              console.error('Error processing image:', err);
                            } finally {
                              setPhotoUploading(false);
                            }
                          }
                        }}
                      />
                    </label>
                    {regPhoto && (
                      <button
                        type="button"
                        onClick={() => setRegPhoto('')}
                        className="text-xs text-slate-400 hover:text-red-600 font-semibold cursor-pointer shrink-0"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="w-full h-10 rounded-full bg-slate-900 hover:bg-black text-white dark:bg-court dark:text-slate-900 dark:hover:bg-court-deep text-xs font-bold cursor-pointer transition-colors"
                  >
                    Add Myself & Continue
                  </button>
                  {regFeedback && (
                    <div
                      className={`text-xs font-medium px-3 py-2 rounded-xl border ${
                        regFeedback.type === 'success'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                          : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                      }`}
                    >
                      {regFeedback.text}
                    </div>
                  )}
                </form>
              )
            )}

            {/* TAB 3: OFFICER SIGN IN */}
            {accountTab === 'officer' && (
              <form onSubmit={handleOfficerPinSubmit} className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Enter your Officer PIN or President Passcode:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    maxLength={10}
                    value={pinInput}
                    onChange={(e) => {
                      setPinError('');
                      setPinInput(e.target.value.slice(0, 10));
                    }}
                    placeholder="••••"
                    className="flex-1 h-10 text-center font-mono-num text-lg tracking-[0.25em] rounded-xl bg-white dark:bg-slate-950 border border-slate-300/80 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-court focus:ring-4 focus:ring-court/50 transition-shadow"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-full bg-slate-900 dark:bg-court text-white dark:text-slate-900 text-xs font-bold cursor-pointer shrink-0"
                  >
                    Unlock
                  </button>
                </div>
                {pinError && (
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {pinError}
                  </div>
                )}
              </form>
            )}

            {/* Destination Selector */}
            <div className="pt-3 border-t border-[var(--hairline)] space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Portal Destination
                </span>
                <span className="text-slate-500 font-mono-num">
                  {hasScheduledEvents
                    ? `Next Session: ${days}d ${hours}h ${minutes}m`
                    : `${data.members.length} Members`}
                </span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-[var(--hairline)] flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 text-left">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {activeDestObj.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {activeDestObj.description}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
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
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.2, ease: EXPO_OUT }}
                        className="co-index-list absolute left-0 right-0 mt-1 z-40 rounded-xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800"
                      >
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
                              className={`co-index-row w-full px-3.5 py-2.5 text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                                isSelected
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="co-row-shift text-xs font-bold truncate">
                                  {opt.label}
                                </div>
                                <div
                                  className={`text-[11px] truncate ${
                                    isSelected
                                      ? 'text-slate-300 dark:text-slate-600'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {opt.description}
                                </div>
                              </div>
                              <ArrowRight className="co-row-arrow w-3.5 h-3.5 shrink-0" />
                            </button>
                          );
                        })}
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => onEnterAsMember(selectedDestination)}
                className="pill-btn w-full"
              >
                <span>Enter {activeDestObj.label}</span>
                <ArrowRight className="pill-arrow w-4 h-4" />
              </button>
            </div>
</div>
            </Reveal>
          </div>
        </section>

        {/* =============================================================== */}
        {/* CTA PANEL                                                       */}
        {/* =============================================================== */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-slate-900 dark:bg-slate-900 text-white px-6 sm:px-14 py-14 sm:py-20">
              <div className="dot-grid absolute inset-0 opacity-40 pointer-events-none [filter:invert(1)]" />
              <div className="absolute -right-24 -bottom-24 w-96 h-96 rounded-full bg-court/25 blur-3xl pointer-events-none" />
              <div className="relative max-w-xl space-y-5">
                <h2 className="font-display text-3xl sm:text-5xl font-semibold leading-[1.05]">
                  Ready to play?
                </h2>
                <p className="text-base sm:text-lg text-slate-300 leading-relaxed">
                  {hasScheduledEvents
                    ? `Next up: ${nextEvent.title} on ${nextEvent.date}. Bring a paddle — we'll handle the rest.`
                    : 'Join the roster, show up to practice, and start climbing the ladder.'}
                </p>
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => openAccess('register')}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full bg-court text-slate-900 text-sm font-medium hover:bg-court-deep transition-colors cursor-pointer"
                  >
                    Join the club
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEnterAsMember('calendar')}
                    className="inline-flex items-center gap-2 min-h-[44px] px-5 rounded-full border border-white/15 text-white text-sm font-medium hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    View calendar
                  </button>
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ================================================================= */}
      {/* FOOTER                                                            */}
      {/* ================================================================= */}
      <footer className="border-t border-[var(--hairline)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
              <img src={BOBCATS_LOGO_URL} alt="" className="h-7 w-auto object-contain" />
              <span className="text-[15px] font-semibold tracking-tight">
                {data.settings.clubName}
              </span>
            </div>
            <p className="text-sm text-slate-500 max-w-xs">{data.settings.schoolName}</p>
          </div>
          {[
            {
              h: 'Portal',
              links: [
                { l: 'Overview', go: () => onEnterAsMember('home') },
                { l: 'My activity', go: () => onEnterAsMember('activity') },
                { l: 'Calendar', go: () => onEnterAsMember('calendar') },
              ],
            },
            {
              h: 'Compete',
              links: [
                { l: 'Standings', go: () => onEnterAsMember('ladder') },
                { l: 'Tournaments', go: () => onEnterAsMember('tournaments') },
                { l: 'Regional watch', go: () => onEnterAsMember('watch') },
              ],
            },
            {
              h: 'Club',
              links: [
                { l: 'Sign in', go: () => openAccess('signin') },
                { l: 'Join the roster', go: () => openAccess('register') },
                { l: 'Officer access', go: () => openAccess('officer') },
              ],
            },
          ].map((col) => (
            <div key={col.h} className="space-y-3">
              <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                {col.h}
              </div>
              <ul className="space-y-2">
                {col.links.map((lnk) => (
                  <li key={lnk.l}>
                    <button
                      type="button"
                      onClick={lnk.go}
                      className="text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {lnk.l}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-[var(--hairline)]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              © {now.getFullYear()} {data.settings.clubName}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="live-dot" /> All systems synced
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

/* ------------------------------------------------------------------------- */
/* Interactive mini scoreboard used in the feature showcase                  */
/* ------------------------------------------------------------------------- */
const LiveScorePanel: React.FC<{ teamA: string; teamB: string }> = ({ teamA, teamB }) => {
  const [scores, setScores] = useState<[number, number]>([7, 5]);
  const [serving, setServing] = useState<0 | 1>(0);
  const bump = (i: 0 | 1) => {
    setScores((s) => {
      const next: [number, number] = [...s] as [number, number];
      next[i] = next[i] >= 11 ? 0 : next[i] + 1;
      return next;
    });
    setServing(i);
  };
  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="live-dot" /> Court 1 · Game 1
        </span>
        <span>Rally to 11</span>
      </div>
      {[teamA, teamB].map((name, i) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`w-1.5 h-1.5 rounded-full transition-colors ${
                serving === i ? 'bg-olive dark:bg-court' : 'bg-transparent'
              }`}
            />
            <span className="text-sm font-medium truncate text-slate-900 dark:text-white">
              {name}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <TickingValue
              valueKey={scores[i]}
              value={scores[i]}
              className="font-mono-num text-3xl text-slate-900 dark:text-white w-10 justify-end"
            />
            <button
              type="button"
              onClick={() => bump(i as 0 | 1)}
              className="w-8 h-8 rounded-full border border-[var(--hairline)] bg-white dark:bg-white/5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-court hover:text-slate-900 transition-colors cursor-pointer"
              aria-label={`Add point to ${name}`}
            >
              +1
            </button>
          </div>
        </div>
      ))}
      <div className="text-[11px] text-slate-500">Tap +1 to try it — Elo updates when the match is final.</div>
    </div>
  );
};
