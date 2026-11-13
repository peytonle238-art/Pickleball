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
import { EXPO_OUT } from './MotionPrimitives';
import {
  AutoTabItem,
  AutoTabs,
  ENODE_EASE,
  Reveal,
} from './EnodePrimitives';

export const BOBCATS_LOGO_URL = '/bobcats-menu-logo.png';

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
  }) => Member | null;
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

  // Live clock for countdown (30s interval — avoids per-second full-tree re-renders)
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const activeMember =
    data.members.find(
      (m) =>
        Boolean(m.schoolId && m.schoolId.trim()) &&
        (m.id === linkedMemberId ||
          m.schoolId!.trim().toLowerCase() ===
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
        text: `Signed in as ${found.name}`,
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
    if (!created) {
      setRegFeedback({
        type: 'error',
        text: 'An account with this School ID or name already exists. Please use the School ID tab to sign in.',
      });
      return;
    }
    setRegFeedback({
      type: 'success',
      text: `Account ready for ${created.name}!`,
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
  const latestMatch = recentMatches[0];
  const teamLabel = (ids: string[]) =>
    ids
      .map((id) => memberById(id)?.name.split(' ')[0] || 'Player')
      .join(' & ');
  const lastGame = latestMatch?.games[latestMatch.games.length - 1];

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

  const requireAuthOrEnter = (targetTab: NavTab) => {
    if (activeMember) {
      onEnterAsMember(targetTab);
    } else {
      setSelectedDestination(targetTab);
      setAccountTab('signin');
      setSignInFeedback({
        type: 'error',
        text: 'Please sign in with your School ID first to access the club console.',
      });
      scrollToId('access');
    }
  };

  const featureTabs: AutoTabItem[] = [
    {
      id: 'scoring',
      label: 'Live scoring',
      title: 'Live scoring',
      description:
        'Sideout or rally scoring, best of 1 or 3. Ranked matches update Elo when final.',
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
      title: 'Ladder & Elo',
      description:
        'Ranked results update the standings. Members can challenge other players.',
      panel: (
        <div className="glass-card rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Club ladder</span>
            <span className="inline-flex items-center gap-1.5">
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
      title: 'Tournaments',
      description:
        'Round robin and single elimination brackets, seeded from the ladder, with court assignments.',
      panel: (
        <div className="glass-card rounded-xl p-5 space-y-4">
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
            Seeded by Elo · {data.clubTournaments.length} bracket
            {data.clubTournaments.length === 1 ? '' : 's'} this season
          </div>
        </div>
      ),
    },
    {
      id: 'attendance',
      label: 'Attendance',
      title: 'Attendance',
      description:
        'Officers record practice attendance. Members can see their own check-ins.',
      panel: (
        <div className="glass-card rounded-xl p-5 space-y-4">
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
      {/* STICKY FROSTED NAV (constant h-16 to prevent scroll-up shake)      */}
      {/* ================================================================= */}
      <header
        className="sticky top-0 z-40 w-full bg-white dark:bg-slate-900 border-b border-[var(--hairline)]"
      >
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <span className="text-[15px] font-semibold tracking-tight">
              {data.settings.clubName}
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600 dark:text-slate-400">
            <button type="button" onClick={() => scrollToId('features')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Features
            </button>
            <button type="button" onClick={() => scrollToId('stats')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Season
            </button>
            <button type="button" onClick={() => requireAuthOrEnter('ladder')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
              Standings
            </button>
            <button type="button" onClick={() => requireAuthOrEnter('calendar')} className="hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer">
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
              Add yourself
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* =============================================================== */}
        {/* HERO                                                            */}
        {/* =============================================================== */}
        <section className="border-b border-[var(--hairline)] bg-white dark:bg-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                {data.settings.schoolName}
              </div>

              <img
                src={BOBCATS_LOGO_URL}
                alt={data.settings.clubName}
                className="w-full max-w-[320px] sm:max-w-[400px] h-auto object-contain"
              />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    activeMember ? onEnterAsMember('activity') : openAccess('signin')
                  }
                  className="pill-btn"
                >
                  {activeMember
                    ? `Continue as ${activeMember.name.split(' ')[0]}`
                    : 'Sign in with School ID'}
                  <ArrowRight className="w-4 h-4" />
                </button>
                {!activeMember && (
                  <button
                    type="button"
                    onClick={() => openAccess('register')}
                    className="pill-btn-ghost"
                  >
                    Add yourself to roster
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => requireAuthOrEnter('ladder')}
                  className="pill-btn-ghost"
                >
                  Standings
                </button>
              </div>

              {data.settings.customText?.clubRulesOrNotes?.trim() && (
                <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-[var(--hairline)] text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line max-w-lg">
                  {data.settings.customText.clubRulesOrNotes}
                </div>
              )}
            </div>

            {/* Club status card */}
            <div className="lg:col-span-6">
              <div className="rounded-xl border border-[var(--hairline)] bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <div className="px-5 py-3 bg-navy text-white text-sm font-semibold">
                  Club status
                </div>
                <div className="divide-y divide-[var(--hairline)]">
                  {/* Next session */}
                  <div className="px-5 py-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-xs text-slate-500">Next session</div>
                      <div className="text-sm font-semibold truncate">
                        {hasScheduledEvents ? nextEvent.title : 'No sessions scheduled'}
                      </div>
                    </div>
                    {hasScheduledEvents && (
                      <div className="font-mono-num text-sm text-slate-700 dark:text-slate-300 shrink-0">
                        {days > 0 && `${days}d `}
                        {hours}h {String(minutes).padStart(2, '0')}m
                      </div>
                    )}
                  </div>

                  {/* Latest result */}
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span>Latest result</span>
                      <span className="font-mono-num">{latestMatch?.date || ''}</span>
                    </div>
                    {latestMatch && lastGame ? (
                      <div className="space-y-1">
                        {[1, 2].map((team) => {
                          const ids = team === 1 ? latestMatch.team1Ids : latestMatch.team2Ids;
                          const score = team === 1 ? lastGame.team1Score : lastGame.team2Score;
                          const won = latestMatch.winnerTeam === team;
                          return (
                            <div key={team} className="flex items-center justify-between">
                              <span
                                className={`text-sm truncate max-w-[220px] ${won ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500'}`}
                              >
                                {teamLabel(ids)}
                              </span>
                              <span
                                className={`font-mono-num text-lg ${won ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}
                              >
                                {score}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500">No matches logged yet</div>
                    )}
                  </div>

                  {/* Ladder leader + attendance */}
                  <div className="grid grid-cols-2 divide-x divide-[var(--hairline)]">
                    <div className="px-5 py-4 min-w-0">
                      <div className="text-xs text-slate-500 mb-1">#1 on the ladder</div>
                      <div className="text-sm font-semibold truncate">
                        {ladderLeader?.name || '—'}
                      </div>
                      {ladderLeader && (
                        <div className="font-mono-num text-xs text-slate-500">
                          {ladderLeader.elo} Elo
                        </div>
                      )}
                    </div>
                    <div className="px-5 py-4">
                      <div className="text-xs text-slate-500 mb-1">Last practice</div>
                      <div className="text-sm font-semibold font-mono-num">
                        {latestSession?.presentMemberIds.length ?? 0}
                        <span className="text-slate-400 font-normal"> / {data.members.length}</span>
                      </div>
                      <div className="text-xs text-slate-500">checked in</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =============================================================== */}
        {/* ROSTER                                                          */}
        {/* =============================================================== */}
        {data.members.length > 0 && (
          <section className="max-w-6xl mx-auto w-full px-4 sm:px-6 pt-12 sm:pt-16">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-lg font-semibold">Roster</h2>
              <span className="text-sm text-slate-500">
                {data.members.length} members
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {rankedMembers.slice(0, 12).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-[var(--hairline)] bg-white dark:bg-slate-900 min-w-0"
                >
                  <span className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-center overflow-hidden shrink-0">
                    {m.photoUrl ? (
                      <img src={m.photoUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      initialsOf(m.name)
                    )}
                  </span>
                  <span className="text-sm font-medium truncate">{m.name}</span>
                  <span className="ml-auto font-mono-num text-xs text-slate-400">{m.elo}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* =============================================================== */}
        {/* =============================================================== */}
        {/* SEASON STATS                                                    */}
        {/* =============================================================== */}
        <section id="stats" className="scroll-mt-20 max-w-6xl mx-auto w-full px-4 sm:px-6 pt-12 sm:pt-16">
          <h2 className="text-lg font-semibold mb-4">This season</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { v: data.members.length, l: 'Members' },
              { v: data.matches.length, l: 'Matches played' },
              { v: data.attendance.length, l: 'Practices' },
              { v: data.clubTournaments.length, l: 'Tournaments' },
            ].map((stat) => (
              <div
                key={stat.l}
                className="rounded-lg border border-[var(--hairline)] bg-white dark:bg-slate-900 px-4 py-4"
              >
                <div className="text-3xl font-semibold tabular-nums text-slate-900 dark:text-white">
                  {stat.v}
                </div>
                <div className="text-sm text-slate-500">{stat.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* =============================================================== */}
        {/* FEATURES                                                        */}
        {/* =============================================================== */}
        <section id="features" className="scroll-mt-20 max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">
          <h2 className="text-lg font-semibold mb-4">Club tools &amp; schedules</h2>
          <AutoTabs items={featureTabs} />
        </section>

        {/* =============================================================== */}
        {/* ACCESS                                                          */}
        {/* =============================================================== */}
        <section id="access" className="scroll-mt-20 border-t border-[var(--hairline)] bg-slate-100 dark:bg-slate-950">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <Reveal className="lg:col-span-5 space-y-4">
              <h2 className="text-lg font-semibold">Athlete &amp; officer access</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Members sign in with their School ID. New members can add
                themselves to the roster. Officers use their access code.
              </p>
              <div className="border-t border-[var(--hairline)]">
                {(
                  [
                    { id: 'activity' as NavTab, title: 'My activity & badges' },
                    { id: 'ladder' as NavTab, title: 'Elo standings' },
                    { id: 'tournaments' as NavTab, title: 'Tournament brackets' },
                    { id: 'calendar' as NavTab, title: 'Practice schedule' },
                  ] as const
                ).map((row) => (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => requireAuthOrEnter(row.id)}
                    className="co-index-row w-full py-3 px-1 flex items-center justify-between gap-3 text-left border-b border-[var(--hairline)] cursor-pointer"
                  >
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {row.title}
                    </span>
                    <ArrowUpRight className="co-row-arrow w-4 h-4 text-slate-500" />
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={0.1} className="lg:col-span-7">
<div className="glass-card rounded-xl p-5 sm:p-7 text-left space-y-5">
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
                  Signed in · Verified ID
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
                            Verified School ID · Grade {activeMember.grade} · {activeMember.elo} Elo
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onSignOutMember}
                        className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                      >
                        Sign out
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

            {/* Destination Selector (Only enters console once signed in) */}
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
                        className="absolute left-0 right-0 mt-1 z-40 rounded-xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800"
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
                onClick={() => requireAuthOrEnter(selectedDestination)}
                className="pill-btn w-full"
              >
                <span>
                  {activeMember
                    ? `Enter ${activeDestObj.label}`
                    : `Sign in with School ID to enter ${activeDestObj.label}`}
                </span>
                <ArrowRight className="pill-arrow w-4 h-4" />
              </button>
            </div>
</div>
            </Reveal>
          </div>
        </section>

      </main>

      {/* ================================================================= */}
      {/* FOOTER                                                            */}
      {/* ================================================================= */}
      <footer className="border-t border-[var(--hairline)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid grid-cols-2 md:grid-cols-5 gap-10">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2.5">
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
                { l: 'Overview', go: () => requireAuthOrEnter('home') },
                { l: 'My activity', go: () => requireAuthOrEnter('activity') },
                { l: 'Calendar', go: () => requireAuthOrEnter('calendar') },
              ],
            },
            {
              h: 'Compete',
              links: [
                { l: 'Standings', go: () => requireAuthOrEnter('ladder') },
                { l: 'Tournaments', go: () => requireAuthOrEnter('tournaments') },
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
    <div className="glass-card rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          Court 1 · Game 1
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
            <span className="font-mono-num text-3xl text-slate-900 dark:text-white w-10 text-right">
              {scores[i]}
            </span>
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
      <div className="text-[11px] text-slate-500">Sample scoreboard. Elo updates when a ranked match is final.</div>
    </div>
  );
};
