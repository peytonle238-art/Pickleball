import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  Award,
  Calendar,
  Camera,
  ChevronDown,
  Eye,
  Flame,
  Home,
  Moon,
  ShieldCheck,
  Sun,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  ClubDataState,
  GradeLevel,
  Member,
  NavTab,
  ReactionKey,
  SkillLevel,
} from '../types';
import {
  MemberAchievement,
  computeMemberAchievements,
  getNextUpcomingEvent,
  processImageFileToDataUrl,
} from '../utils/clubUtils';
import { LadderStatsView } from './LadderStatsView';
import { TournamentsView } from './TournamentsView';
import { CalendarEventsView } from './CalendarEventsView';
import { VarsityPlayerCard } from './VarsityPlayerCard';
import { ClubInteractivePulse } from './ClubInteractivePulse';
import { LiveScoreKeeper } from './LiveScoreKeeper';
import { AnnouncementsView } from './ManagementViews';
import {
  AnimatedNumber,
  MaskedTextReveal,
} from './MotionPrimitives';

interface MemberPortalViewProps {
  data: ClubDataState;
  activeTab: NavTab;
  darkMode: boolean;
  linkedMemberId: string;
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
  onCreateChallenge: (payload: {
    challengerId: string;
    opponentId: string;
    format: 'singles' | 'doubles';
    targetScore: 11 | 15 | 21;
    message: string;
  }) => void;
  onUpdateChallengeStatus: (
    challengeId: string,
    status: 'open' | 'accepted' | 'declined',
    remove?: boolean
  ) => void;
  onVoteMvp: (candidateId: string) => void;
  onVotePoll: (pollId: string, optionId: string) => void;
  onToggleReaction: (feedItemId: string, reaction: ReactionKey) => void;
  onSignOutMember: () => void;
  onOfficerSignIn: (pin: string) => boolean;
  onNavigate: (tab: NavTab) => void;
  onToggleDarkMode: () => void;
  onRequestOfficerLogin: () => void;
  onShowWelcomeScreen: () => void;
}

const SMOOTH_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const MEMBER_NAV_TABS: {
  id: NavTab;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    id: 'home',
    label: 'Overview',
    shortLabel: 'Overview',
    description: 'Welcome to BNHS Pickleball Club',
    icon: <Home className="w-4 h-4" />,
  },
  {
    id: 'activity',
    label: 'My Activity & Badges',
    shortLabel: 'My Activity',
    description: 'Your personal account, matches, attendance & tasks',
    icon: <Activity className="w-4 h-4" />,
  },
  {
    id: 'ladder',
    label: 'Standings',
    shortLabel: 'Standings',
    description: 'Club Elo rankings, leaderboards & match log',
    icon: <Award className="w-4 h-4" />,
  },
  {
    id: 'tournaments',
    label: 'Tournaments',
    shortLabel: 'Tournaments',
    description: 'Live brackets, pools & court assignments',
    icon: <Trophy className="w-4 h-4" />,
  },
  {
    id: 'calendar',
    label: 'Calendar',
    shortLabel: 'Calendar',
    description: 'Monthly practice schedule & club events',
    icon: <Calendar className="w-4 h-4" />,
  },
];

function renderAchievementIcon(ach: MemberAchievement) {
  switch (ach.category) {
    case 'Streak':
      return <Flame className="w-4 h-4" />;
    case 'Attendance':
      return <ShieldCheck className="w-4 h-4" />;
    case 'Rating':
      return <Zap className="w-4 h-4" />;
    case 'Rivalry':
      return <Swords className="w-4 h-4" />;
    default:
      return <Trophy className="w-4 h-4" />;
  }
}

export const MemberPortalView: React.FC<MemberPortalViewProps> = ({
  data,
  activeTab,
  darkMode,
  linkedMemberId,
  onSignInBySchoolId,
  onRegisterMember,
  onCreateChallenge,
  onUpdateChallengeStatus,
  onVoteMvp,
  onVotePoll,
  onToggleReaction,
  onSignOutMember,
  onOfficerSignIn,
  onNavigate,
  onToggleDarkMode,
  onRequestOfficerLogin,
  onShowWelcomeScreen,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuAccountTab, setMenuAccountTab] = useState<
    'signin' | 'register' | 'officer'
  >('signin');

  // School ID Sign-In state
  const [schoolIdInput, setSchoolIdInput] = useState('');
  const [schoolIdError, setSchoolIdError] = useState('');

  // Self-Registration ("Add Yourself to Database") state
  const [regSchoolId, setRegSchoolId] = useState('');
  const [regName, setRegName] = useState('');
  const [regGrade, setRegGrade] = useState<GradeLevel>(10);
  const [regSkill, setRegSkill] = useState<SkillLevel>('Intermediate');
  const [regPaddle, setRegPaddle] = useState('');
  const [regPhoto, setRegPhoto] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [regError, setRegError] = useState('');

  // Officer Sign-In inside Menu state
  const [officerPinInput, setOfficerPinInput] = useState('');
  const [officerPinError, setOfficerPinError] = useState('');

  const [activityFilter, setActivityFilter] = useState<
    'all' | 'achievements' | 'matches' | 'attendance' | 'tasks'
  >('all');
  const [mobileAuthMode, setMobileAuthMode] = useState<'signin' | 'register'>(
    'signin'
  );
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Resolve the active member profile strictly from the signed-in member with a valid School ID
  const activeMember = useMemo(() => {
    if (!linkedMemberId) return null;
    const byId = data.members.find(
      (m) =>
        Boolean(m.schoolId && m.schoolId.trim()) &&
        (m.id === linkedMemberId ||
          m.schoolId!.trim().toLowerCase() ===
            linkedMemberId.trim().toLowerCase())
    );
    return byId || null;
  }, [data.members, linkedMemberId]);

  const getMemberName = (id: string) =>
    data.members.find((m) => m.id === id)?.name || 'Club Player';

  const activeMemberRank = useMemo(() => {
    if (!activeMember) return 1;
    const sorted = [...data.members].sort((a, b) => b.elo - a.elo);
    const idx = sorted.findIndex((m) => m.id === activeMember.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [data.members, activeMember]);

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

  // 1. Filtered Matches for the logged-in member
  const myMatches = useMemo(() => {
    if (!activeMember) return [];
    return data.matches.filter(
      (m) =>
        m.team1Ids.includes(activeMember.id) ||
        m.team2Ids.includes(activeMember.id)
    );
  }, [data.matches, activeMember]);

  // In-club tournament bracket matches involving the logged-in member
  const myTournamentBracketMatches = useMemo(() => {
    if (!activeMember) return [];
    const results: {
      tournamentName: string;
      roundLabel: string;
      court: string;
      team1Name: string;
      team2Name: string;
      score1: number | null;
      score2: number | null;
      winner: 1 | 2 | null;
      isTeam1: boolean;
      id: string;
    }[] = [];

    for (const t of data.clubTournaments) {
      for (const m of t.matches) {
        const inT1 = m.team1PlayerIds.includes(activeMember.id);
        const inT2 = m.team2PlayerIds.includes(activeMember.id);
        if (inT1 || inT2) {
          results.push({
            id: `${t.id}-${m.id}`,
            tournamentName: t.name,
            roundLabel: m.roundLabel,
            court: m.court,
            team1Name: m.team1Name,
            team2Name: m.team2Name,
            score1: m.score1,
            score2: m.score2,
            winner: m.winner,
            isTeam1: inT1,
          });
        }
      }
    }
    return results;
  }, [data.clubTournaments, activeMember]);

  // 2. Filtered Attendance History for the logged-in member
  const myAttendanceSessions = useMemo(() => {
    if (!activeMember) return [];
    return [...data.attendance]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((session) => ({
        ...session,
        present: session.presentMemberIds.includes(activeMember.id),
      }));
  }, [data.attendance, activeMember]);

  const attendanceStats = useMemo(() => {
    const total = myAttendanceSessions.length;
    const attended = myAttendanceSessions.filter((s) => s.present).length;
    const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { total, attended, pct };
  }, [myAttendanceSessions]);

  // 3. Filtered Tasks the logged-in member is involved in
  const myTasks = useMemo(() => {
    if (!activeMember) return [];
    const candidateNames = new Set<string>();
    if (activeMember.name) {
      candidateNames.add(activeMember.name.trim().toLowerCase());
      const firstName = activeMember.name.trim().split(' ')[0]?.toLowerCase();
      if (firstName && firstName.length >= 2) candidateNames.add(firstName);
    }

    if (candidateNames.size === 0) return [];

    return data.tasks.filter((task) => {
      const assigneeLower = (task.assignee || '').trim().toLowerCase();
      if (!assigneeLower) return false;
      for (const name of candidateNames) {
        if (
          assigneeLower === name ||
          assigneeLower.includes(name) ||
          name.includes(assigneeLower)
        ) {
          return true;
        }
      }
      return false;
    });
  }, [data.tasks, activeMember]);

  // 4. Computed Member Achievements (10 Varsity Milestones)
  const myAchievements = useMemo(
    () =>
      computeMemberAchievements(
        activeMember,
        data.matches,
        data.attendance,
        data.challenges || []
      ),
    [activeMember, data.matches, data.attendance, data.challenges]
  );

  const unlockedAchievementsCount = useMemo(
    () => myAchievements.filter((a) => a.unlocked).length,
    [myAchievements]
  );

  const myActiveChallenges = useMemo(() => {
    if (!activeMember) return [];
    return (data.challenges || []).filter(
      (c) =>
        (c.challengerId === activeMember.id ||
          c.opponentId === activeMember.id) &&
        (c.status === 'open' || c.status === 'accepted')
    );
  }, [data.challenges, activeMember]);

  // Handle continuing with School ID
  const handleSchoolIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = schoolIdInput.trim();
    if (!trimmed) {
      setSchoolIdError('Please enter your School ID.');
      return;
    }
    const found = await onSignInBySchoolId(trimmed);
    if (found) {
      setSchoolIdInput('');
      setSchoolIdError('');
      setMenuOpen(false);
      onNavigate('activity');
    } else {
      setSchoolIdError(
        `No account found for School ID "${trimmed}". Add yourself below!`
      );
      setRegSchoolId(trimmed);
    }
  };

  // Handle self-registration into the club database
  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = regSchoolId.trim();
    const cleanName = regName.trim();
    if (!cleanId) {
      setRegError('Please enter your School ID.');
      return;
    }
    if (!cleanName) {
      setRegError('Please enter your full name.');
      return;
    }

    const created = onRegisterMember({
      schoolId: cleanId,
      name: cleanName,
      grade: regGrade,
      skillLevel: regSkill,
      paddleNotes: regPaddle.trim() || 'Personal Paddle',
      photoUrl: regPhoto,
    });

    if (!created) {
      setRegError(
        'An account with this School ID or name already exists. Please sign in with your School ID.'
      );
      return;
    }

    setRegSchoolId('');
    setRegName('');
    setRegPaddle('');
    setRegPhoto('');
    setRegError('');
    setMenuAccountTab('signin');
    setMenuOpen(false);
    onNavigate('activity');
  };

  // Handle Officer Sign-In inside the Menu
  const handleMenuOfficerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onOfficerSignIn(officerPinInput);
    if (ok) {
      setOfficerPinInput('');
      setOfficerPinError('');
      setMenuOpen(false);
    } else {
      setOfficerPinError('Invalid 4-digit Officer access code.');
      setOfficerPinInput('');
    }
  };

  const noop = () => {};

  const winRatePct =
    activeMember && activeMember.wins + activeMember.losses > 0
      ? Math.round(
          (activeMember.wins / (activeMember.wins + activeMember.losses)) * 100
        )
      : 0;

  return (
    <div className="min-h-screen bg-paper dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-28 md:pb-16 transition-colors duration-200">
      {/* Broadcast Alert Banner if active */}
      {data.settings.broadcastNotice?.enabled &&
        data.settings.broadcastNotice.text && (
          <aside
            role="alert"
            className={`sticky top-0 z-40 px-4 py-2 text-xs font-semibold border-b ${
              data.settings.broadcastNotice.level === 'urgent'
                ? 'bg-red-600 text-white border-red-700'
                : 'bg-blue-600 text-white border-blue-700'
            }`}
          >
            <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono-num uppercase tracking-wider text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/20 shrink-0">
                  {data.settings.broadcastNotice.level === 'urgent'
                    ? 'URGENT'
                    : 'NOTICE'}
                </span>
                <span className="truncate">
                  {data.settings.broadcastNotice.text}
                </span>
              </div>
              <span className="text-[10px] uppercase tracking-wider opacity-85 shrink-0 font-mono-num">
                Club Broadcast
              </span>
            </div>
          </aside>
        )}

      {/* ================================================================= */}
      {/* SINGLE-ROW ENODE FROSTED HEADER + CENTERED PILL NAVIGATION        */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-30 bg-paper/80 dark:bg-slate-950/75 backdrop-blur-xl border-b border-[var(--hairline)] no-print">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6">
          <div className="h-16 flex items-center justify-between gap-3">
            {/* Brand Identity (No top-bar logo) */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate('home')}
                className="flex items-center gap-2.5 text-left cursor-pointer"
              >
                <span className="text-[15px] font-semibold tracking-tight text-slate-900 dark:text-white">
                  {data.settings.clubName}
                </span>
              </button>
              <button
                type="button"
                onClick={onShowWelcomeScreen}
                className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white border border-[var(--hairline)] bg-white/60 dark:bg-white/[0.03] transition-colors cursor-pointer"
              >
                Welcome page
              </button>
            </div>

            {/* Center: Desktop Pill Navigation */}
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-slate-100/80 dark:bg-slate-900/80 border border-[var(--hairline)]">
              {MEMBER_NAV_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onNavigate(tab.id)}
                    className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'text-white dark:text-slate-900'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="member-desktop-nav-underline"
                        transition={{
                          type: 'spring',
                          stiffness: 420,
                          damping: 34,
                        }}
                        className="absolute inset-0 rounded-full bg-slate-900 dark:bg-court"
                      />
                    )}
                    <span className="relative z-10">{tab.shortLabel}</span>
                  </button>
                );
              })}
            </nav>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Dark/Light Mode Button */}
              <button
                type="button"
                onClick={onToggleDarkMode}
                aria-label="Toggle color theme"
                className="w-9 h-9 rounded-full hover:bg-slate-900/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </button>

              {/* Unified Menu with Member Database Registration, School ID Sign-In & Officer Sign-In */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="pill-btn !min-h-[36px] !px-3.5 !text-xs"
                >
                  <span>
                    {activeMember
                      ? activeMember.name.split(' ')[0]
                      : 'Sign in'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 opacity-75 transition-transform duration-200 ${
                      menuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.16, ease: SMOOTH_EASE }}
                        className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 max-w-md z-40 rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] shadow-lg p-3.5 space-y-3 max-h-[82vh] overflow-y-auto touch-scroll"
                      >
                        {/* Header inside Dropdown */}
                        <div className="p-3 rounded-xl bg-paper-subtle dark:bg-slate-950 border border-[var(--hairline)] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {data.settings.clubName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              Member Account & Navigation
                            </div>
                          </div>
                        </div>

                        {/* MEMBER & OFFICER ACCOUNT HUB IN MENU */}
                        <div className="rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 space-y-3">
                          {/* 3-Tab Switcher */}
                          <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuAccountTab('signin');
                                setSchoolIdError('');
                              }}
                              className={`py-2 px-2 text-[11px] font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
                                menuAccountTab === 'signin'
                                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              School ID
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuAccountTab('register');
                                setRegError('');
                              }}
                              className={`py-2 px-2 text-[11px] font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
                                menuAccountTab === 'register'
                                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              Add Yourself
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuAccountTab('officer');
                                setOfficerPinError('');
                              }}
                              className={`py-2 px-2 text-[11px] font-bold border-b-2 -mb-px transition-colors cursor-pointer ${
                                menuAccountTab === 'officer'
                                  ? 'border-slate-900 text-slate-900 dark:border-amber-400 dark:text-amber-400'
                                  : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              Officer Sign In
                            </button>
                          </div>

                          {/* TAB 1: CONTINUE WITH SCHOOL ID / ACTIVE MEMBER ACCOUNT */}
                          {menuAccountTab === 'signin' && (
                            <div className="space-y-2.5">
                              {activeMember ? (
                                <div className="space-y-2.5">
                                  <div className="p-2.5 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {activeMember.photoUrl ? (
                                        <img
                                          src={activeMember.photoUrl}
                                          alt={activeMember.name}
                                          className="w-10 h-10 rounded-md object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 rounded-md bg-slate-900 text-white dark:bg-slate-800 font-bold flex items-center justify-center shrink-0 text-xs">
                                          {activeMember.name
                                            .split(' ')
                                            .map((n) => n[0])
                                            .join('')
                                            .slice(0, 2)}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 font-mono-num">
                                          Verified School ID
                                        </div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                          {activeMember.name}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                                          Gr. {activeMember.grade} ·{' '}
                                          {activeMember.skillLevel} ·{' '}
                                          {activeMember.elo} Elo
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        onSignOutMember();
                                        setSchoolIdInput('');
                                      }}
                                      className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                                      title="Sign out"
                                    >
                                      Sign out
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMenuOpen(false);
                                        onNavigate('activity');
                                      }}
                                      className="w-full py-2 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                                    >
                                      My Activity
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMenuAccountTab('register')
                                      }
                                      className="w-full py-2 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                      Add Member
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <form
                                  onSubmit={handleSchoolIdSubmit}
                                  className="space-y-2"
                                >
                                  <div className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                                    Enter your School ID to continue to your
                                    account & activity:
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <input
                                      type="text"
                                      value={schoolIdInput}
                                      onChange={(e) => {
                                        setSchoolIdError('');
                                        setSchoolIdInput(e.target.value);
                                      }}
                                      placeholder="School ID (e.g. 204819)"
                                      className="flex-1 min-h-[36px] px-3 py-1.5 rounded-md text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                                    />
                                    <button
                                      type="submit"
                                      className="min-h-[36px] px-3.5 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer shrink-0"
                                    >
                                      Continue
                                    </button>
                                  </div>

                                  {schoolIdError && (
                                    <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center justify-between gap-2 pt-0.5">
                                      <span>{schoolIdError}</span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setMenuAccountTab('register')
                                        }
                                        className="underline font-bold text-blue-600 dark:text-blue-400 shrink-0 cursor-pointer"
                                      >
                                        Add Yourself →
                                      </button>
                                    </div>
                                  )}

                                  <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500">
                                    <span>Not in the club database yet?</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMenuAccountTab('register')
                                      }
                                      className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                    >
                                      + Add Yourself Here
                                    </button>
                                  </div>
                                </form>
                              )}
                            </div>
                          )}

                          {/* TAB 2: ADD YOURSELF TO THE DATABASE */}
                          {menuAccountTab === 'register' && (
                            <form
                              onSubmit={handleRegisterSubmit}
                              className="space-y-2.5"
                            >
                              <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                                Add yourself to the BNHS Pickleball database:
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                                    School ID *
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={regSchoolId}
                                    onChange={(e) => {
                                      setRegError('');
                                      setRegSchoolId(e.target.value);
                                    }}
                                    placeholder="e.g. 204819"
                                    className="w-full min-h-[34px] px-2.5 py-1 rounded-md text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                                    Full Name *
                                  </label>
                                  <input
                                    type="text"
                                    required
                                    value={regName}
                                    onChange={(e) => {
                                      setRegError('');
                                      setRegName(e.target.value);
                                    }}
                                    placeholder="Jordan Alvarez"
                                    className="w-full min-h-[34px] px-2.5 py-1 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                                    Grade
                                  </label>
                                  <select
                                    value={regGrade}
                                    onChange={(e) =>
                                      setRegGrade(
                                        Number(e.target.value) as GradeLevel
                                      )
                                    }
                                    className="w-full min-h-[34px] px-2 py-1 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                                  >
                                    <option value={9}>9th Grade</option>
                                    <option value={10}>10th Grade</option>
                                    <option value={11}>11th Grade</option>
                                    <option value={12}>12th Grade</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                                    Skill Level
                                  </label>
                                  <select
                                    value={regSkill}
                                    onChange={(e) =>
                                      setRegSkill(e.target.value as SkillLevel)
                                    }
                                    className="w-full min-h-[34px] px-2 py-1 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                                  >
                                    <option value="Beginner">Beginner</option>
                                    <option value="Intermediate">
                                      Intermediate
                                    </option>
                                    <option value="Advanced">Advanced</option>
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                                  Paddle / Notes (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={regPaddle}
                                  onChange={(e) => setRegPaddle(e.target.value)}
                                  placeholder="e.g. Personal Paddle or Loaner"
                                  className="w-full min-h-[34px] px-2.5 py-1 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </div>

                              {/* Profile Photo Upload in Menu Form */}
                              <div className="flex items-center gap-2.5 p-2 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                <div className="relative w-9 h-9 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
                                  {regPhoto ? (
                                    <img
                                      src={regPhoto}
                                      alt="Preview"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <Camera className="w-4 h-4 text-slate-400" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                                    {regPhoto
                                      ? 'Photo Attached'
                                      : 'Profile Picture'}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {photoUploading
                                      ? 'Optimizing image...'
                                      : 'Optional member photo'}
                                  </div>
                                </div>
                                <label className="min-h-[30px] px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-[10px] font-semibold flex items-center cursor-pointer shrink-0 transition-colors hover:bg-slate-200">
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
                                          const dataUrl =
                                            await processImageFileToDataUrl(
                                              file
                                            );
                                          setRegPhoto(dataUrl);
                                        } catch (err) {
                                          console.error(
                                            'Error processing image:',
                                            err
                                          );
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
                                    className="text-[10px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer shrink-0"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>

                              {regError && (
                                <div className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                                  {regError}
                                </div>
                              )}

                              <button
                                type="submit"
                                className="w-full min-h-[36px] px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                              >
                                Add to Database & Continue
                              </button>
                            </form>
                          )}

                          {/* TAB 3: OFFICER SIGN IN */}
                          {menuAccountTab === 'officer' && (
                            <form
                              onSubmit={handleMenuOfficerSubmit}
                              className="space-y-2.5"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  Officer Console Sign In
                                </span>
                                <span className="text-slate-400 font-mono-num">
                                  4-Digit PIN
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                <input
                                  type="password"
                                  inputMode="numeric"
                                  maxLength={4}
                                  value={officerPinInput}
                                  onChange={(e) => {
                                    setOfficerPinError('');
                                    setOfficerPinInput(
                                      e.target.value
                                        .replace(/\D/g, '')
                                        .slice(0, 4)
                                    );
                                  }}
                                  placeholder="••••"
                                  className="flex-1 h-9 text-center font-mono-num text-base tracking-[0.4em] rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                                />
                                <button
                                  type="submit"
                                  className="h-9 px-4 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold cursor-pointer shrink-0"
                                >
                                  Sign In
                                </button>
                              </div>

                              {officerPinError && (
                                <div className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                                  {officerPinError}
                                </div>
                              )}
                            </form>
                          )}
                        </div>

                        {/* Navigation Links (Desktop / Quick Jump) */}
                        <div className="hidden sm:block space-y-0.5">
                          {MEMBER_NAV_TABS.map((item) => {
                            const isSelected = activeTab === item.id;
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setMenuOpen(false);
                                  onNavigate(item.id);
                                }}
                                className={`w-full px-3 py-2 rounded-md text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400 font-semibold'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate">
                                    {item.label}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {item.description}
                                  </div>
                                </div>
                                <span className="text-xs text-slate-400">
                                  →
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-1 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              onShowWelcomeScreen();
                            }}
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            Welcome Screen
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              onRequestOfficerLogin();
                            }}
                            className="font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          >
                            Officer Sign In
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MEMBER PORTAL CONTENT VIEWPORT                                    */}
      {/* ================================================================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.28, ease: SMOOTH_EASE }}
          >
            {/* ============================================================= */}
            {/* OVERVIEW TAB: COZY ENODE HERO + QUICK MODULE CARDS            */}
            {/* ============================================================= */}
            {activeTab === 'home' && (
              <div className="enode-stagger space-y-6 sm:space-y-8">
                <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 sm:p-10">
                  <div className="dot-grid absolute inset-0 pointer-events-none" />
                  <div className="absolute -right-24 -top-24 w-96 h-96 rounded-full bg-court/45 dark:bg-court/10 blur-3xl pointer-events-none" />

                  <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                    <div className="space-y-4 max-w-xl">
                      <div className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full border border-[var(--hairline)] bg-paper/80 dark:bg-white/[0.04] text-xs text-slate-600 dark:text-slate-300">
                        <span className="px-2 py-0.5 rounded-full bg-court text-slate-900 font-medium">
                          {data.settings.schoolName}
                        </span>
                        <span>Member portal</span>
                      </div>

                      <h1 className="font-display text-3xl sm:text-5xl font-semibold tracking-tight leading-[1.05] text-slate-900 dark:text-white">
                        <MaskedTextReveal>
                          {activeMember
                            ? `Welcome back, ${activeMember.name.split(' ')[0]}.`
                            : `Welcome to ${data.settings.clubName}.`}
                        </MaskedTextReveal>
                      </h1>

                      {hasScheduledEvents ? (
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
                          Next session:{' '}
                          <span className="font-medium text-slate-900 dark:text-white">
                            {nextEvent.title}
                          </span>{' '}
                          on {nextEvent.date} · {nextEvent.time} ({nextEvent.location}).
                        </p>
                      ) : (
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed max-w-lg">
                          Sign in with your School ID or add yourself to the
                          roster to track your matches, attendance, and
                          achievement badges.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2.5 pt-1">
                        <button
                          type="button"
                          onClick={() => onNavigate('activity')}
                          className="pill-btn !min-h-[40px] !px-4 !text-xs"
                        >
                          <span>
                            {activeMember
                              ? 'View my activity'
                              : 'Sign in with School ID'}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigate('ladder')}
                          className="pill-btn-ghost !min-h-[40px] !px-4 !text-xs"
                        >
                          <span>Explore standings</span>
                        </button>
                      </div>
                    </div>

                    {hasScheduledEvents && (
                      <div className="glass-card rounded-2xl p-5 sm:p-6 shrink-0 min-w-[240px] space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="live-dot" /> Next session in
                          </span>
                          <span className="font-mono-num">{nextEvent.date}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2.5 text-center">
                          <div className="p-2.5 rounded-xl bg-paper dark:bg-slate-950 border border-[var(--hairline)]">
                            <div className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white tabular-nums leading-none">
                              <AnimatedNumber value={days} padStart={2} />
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              Days
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-paper dark:bg-slate-950 border border-[var(--hairline)]">
                            <div className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-white tabular-nums leading-none">
                              <AnimatedNumber value={hours} padStart={2} />
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1">
                              Hours
                            </div>
                          </div>
                          <div className="p-2.5 rounded-xl bg-court/60 dark:bg-court/15 border border-[var(--hairline)]">
                            <div className="font-mono-num text-2xl font-semibold text-slate-900 dark:text-court tabular-nums leading-none">
                              <AnimatedNumber value={minutes} padStart={2} />
                            </div>
                            <div className="text-[11px] text-slate-700 dark:text-slate-300 mt-1">
                              Min
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cozy 4-Card Section Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <button
                    type="button"
                    onClick={() => onNavigate('activity')}
                    className="co-interactive-btn p-5 rounded-3xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] text-left space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium text-olive dark:text-court">
                      Athlete profile
                    </div>
                    <div className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                      My activity & badges
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {activeMember
                        ? `${unlockedAchievementsCount} of 10 badges unlocked`
                        : 'Sign in with School ID'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('ladder')}
                    className="co-interactive-btn p-5 rounded-3xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] text-left space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium text-olive dark:text-court">
                      Live Elo ladder
                    </div>
                    <div className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                      Standings & callouts
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num truncate">
                      <AnimatedNumber value={data.members.length} /> ranked ·{' '}
                      <AnimatedNumber
                        value={
                          (data.challenges || []).filter(
                            (c) =>
                              c.status === 'open' || c.status === 'accepted'
                          ).length
                        }
                      />{' '}
                      active callouts
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('tournaments')}
                    className="co-interactive-btn p-5 rounded-3xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] text-left space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium text-olive dark:text-court">
                      In-club & regional
                    </div>
                    <div className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                      Tournament brackets
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      <AnimatedNumber value={data.clubTournaments.length} />{' '}
                      brackets & pools
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigate('calendar')}
                    className="co-interactive-btn p-5 rounded-3xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] text-left space-y-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                  >
                    <div className="text-xs font-medium text-olive dark:text-court">
                      Court schedule
                    </div>
                    <div className="font-display text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
                      Practice calendar
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      Dates, times & locations
                    </div>
                  </button>
                </div>

                {/* Club Pulse: Recent Activity & Polls */}
                <ClubInteractivePulse
                  data={data}
                  activeMember={activeMember}
                  isOfficer={false}
                  onVoteMvp={onVoteMvp}
                  onVotePoll={onVotePoll}
                  onToggleReaction={onToggleReaction}
                  onNavigate={onNavigate}
                />
              </div>
            )}

            {/* ============================================================= */}
            {/* MY ACTIVITY TAB: ACHIEVEMENTS, MATCHES, ATTENDANCE & TASKS    */}
            {/* ============================================================= */}
            {activeTab === 'activity' && (
              <div className="space-y-4 sm:space-y-6">
                {!activeMember ? (
                  /* Prompt to Sign In with School ID or Add Yourself */
                  <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-4 sm:p-8 space-y-4 sm:space-y-6">
                    <div className="max-w-xl space-y-1">
                      <div className="text-[11px] font-mono-num uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
                        Member School ID Account
                      </div>
                      <h2 className="font-display text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                        Sign In with Your School ID or Add Yourself
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enter your BNHS School ID to view your personal match
                        record, attendance log, achievement badges, and club
                        tasks—or add yourself to the database in seconds.
                      </p>
                    </div>

                    {/* Mobile 2-Tab Form Switcher (Prevents stacking 2 long forms on phone screens) */}
                    <div className="lg:hidden grid grid-cols-2 gap-1 p-1 rounded-md bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setMobileAuthMode('signin')}
                        className={`py-2 px-3 rounded text-xs font-bold transition-colors cursor-pointer ${
                          mobileAuthMode === 'signin'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        Sign In with ID
                      </button>
                      <button
                        type="button"
                        onClick={() => setMobileAuthMode('register')}
                        className={`py-2 px-3 rounded text-xs font-bold transition-colors cursor-pointer ${
                          mobileAuthMode === 'register'
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        New Member Registration
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                      {/* Left: Continue with School ID */}
                      <form
                        onSubmit={handleSchoolIdSubmit}
                        className={`${
                          mobileAuthMode === 'signin'
                            ? 'flex'
                            : 'hidden lg:flex'
                        } p-4 sm:p-5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4 flex-col justify-between`}
                      >
                        <div className="space-y-3">
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            Continue with School ID
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Already added yourself? Enter your School ID to load
                            your personal account.
                          </p>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                              Your School ID
                            </label>
                            <input
                              type="text"
                              value={schoolIdInput}
                              onChange={(e) => {
                                setSchoolIdError('');
                                setSchoolIdInput(e.target.value);
                              }}
                              placeholder="e.g. 204819"
                              className="w-full min-h-[40px] px-3.5 py-2 rounded-md text-sm font-mono-num bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                            />
                          </div>
                          {schoolIdError && (
                            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between gap-2">
                              <span>{schoolIdError}</span>
                              <button
                                type="button"
                                onClick={() => setMobileAuthMode('register')}
                                className="lg:hidden underline font-bold text-blue-600 dark:text-blue-400 shrink-0"
                              >
                                Register →
                              </button>
                            </div>
                          )}
                        </div>

                        <button
                          type="submit"
                          className="w-full min-h-[40px] px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          Continue with School ID
                        </button>
                      </form>

                      {/* Right: Add Yourself to the Database */}
                      <form
                        onSubmit={handleRegisterSubmit}
                        className={`${
                          mobileAuthMode === 'register'
                            ? 'block'
                            : 'hidden lg:block'
                        } p-4 sm:p-5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3`}
                      >
                        <div className="text-sm font-bold text-slate-900 dark:text-white">
                          New Member? Add Yourself to Database
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                              School ID *
                            </label>
                            <input
                              type="text"
                              required
                              value={regSchoolId}
                              onChange={(e) => {
                                setRegError('');
                                setRegSchoolId(e.target.value);
                              }}
                              placeholder="e.g. 204819"
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                              Full Name *
                            </label>
                            <input
                              type="text"
                              required
                              value={regName}
                              onChange={(e) => {
                                setRegError('');
                                setRegName(e.target.value);
                              }}
                              placeholder="e.g. Jordan Alvarez"
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                              Grade
                            </label>
                            <select
                              value={regGrade}
                              onChange={(e) =>
                                setRegGrade(
                                  Number(e.target.value) as GradeLevel
                                )
                              }
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                            >
                              <option value={9}>Grade 9</option>
                              <option value={10}>Grade 10</option>
                              <option value={11}>Grade 11</option>
                              <option value={12}>Grade 12</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                              Skill Level
                            </label>
                            <select
                              value={regSkill}
                              onChange={(e) =>
                                setRegSkill(e.target.value as SkillLevel)
                              }
                              className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                            >
                              <option value="Beginner">Beginner</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Advanced">Advanced</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                            Paddle / Gear Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={regPaddle}
                            onChange={(e) => setRegPaddle(e.target.value)}
                            placeholder="e.g. Selkirk Vanguard or club loaner"
                            className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* Profile Photo Upload Option */}
                        <div className="flex items-center gap-3 p-2.5 sm:p-3 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                          <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
                            {regPhoto ? (
                              <img
                                src={regPhoto}
                                alt="Profile Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Camera className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                              {regPhoto ? 'Photo Added' : 'Member Profile Photo'}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {photoUploading
                                ? 'Processing image...'
                                : 'Upload a profile photo (Optional)'}
                            </div>
                          </div>
                          <label className="min-h-[34px] px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center cursor-pointer shrink-0 transition-colors hover:bg-slate-200">
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
                                    const dataUrl =
                                      await processImageFileToDataUrl(file);
                                    setRegPhoto(dataUrl);
                                  } catch (err) {
                                    console.error(
                                      'Error processing image:',
                                      err
                                    );
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
                              className="text-xs text-slate-400 hover:text-red-500 font-semibold cursor-pointer shrink-0"
                            >
                              Remove
                            </button>
                          )}
                        </div>

                        {regError && (
                          <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                            {regError}
                          </div>
                        )}

                        <button
                          type="submit"
                          className="w-full min-h-[40px] px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white text-xs font-semibold cursor-pointer"
                        >
                          Add Yourself to Database & Continue
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Interactive 3D-Tilt Varsity Athlete Card with Elo Sparkline */}
                    <VarsityPlayerCard
                      member={activeMember}
                      allMembers={data.members}
                      matches={data.matches}
                      attendance={data.attendance}
                      challenges={data.challenges || []}
                    />

                    {/* Personal Metrics & Season Performance Card */}
                    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-4 sm:p-6 flex flex-col justify-between gap-4 sm:gap-5">
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 sm:pb-4 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          {activeMember.photoUrl ? (
                            <img
                              src={activeMember.photoUrl}
                              alt={activeMember.name}
                              className="w-12 h-12 sm:w-14 sm:h-14 rounded-md object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md bg-slate-900 dark:bg-slate-800 text-white font-display text-lg sm:text-xl font-bold flex items-center justify-center shrink-0">
                              {activeMember.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[10px] sm:text-[11px] font-mono-num uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
                              Verified Member
                            </div>
                            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                              {activeMember.name}
                            </h2>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                              Gr. {activeMember.grade} ·{' '}
                              {activeMember.skillLevel} · {activeMember.elo} Elo
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={onSignOutMember}
                            className="min-h-[32px] px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                          >
                            Switch ID
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                        <div className="p-3 sm:p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Badges
                          </div>
                          <div className="font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                            {unlockedAchievementsCount}/{myAchievements.length}
                          </div>
                          <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 transition-all duration-500"
                              style={{
                                width: `${Math.round(
                                  (unlockedAchievementsCount /
                                    Math.max(1, myAchievements.length)) *
                                    100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>

                        <div className="p-3 sm:p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            <span>Record</span>
                            <span className="font-mono-num font-bold text-slate-700 dark:text-slate-300">
                              {winRatePct}%
                            </span>
                          </div>
                          <div className="font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                            {activeMember.wins}W–{activeMember.losses}L
                          </div>
                          <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-blue-600 transition-all duration-500"
                              style={{ width: `${winRatePct}%` }}
                            />
                          </div>
                        </div>

                        <div className="p-3 sm:p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            <span>Attendance</span>
                            <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                              {attendanceStats.attended}/{attendanceStats.total}
                            </span>
                          </div>
                          <div className="font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                            {attendanceStats.pct}%
                          </div>
                          <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-600 transition-all duration-500"
                              style={{ width: `${attendanceStats.pct}%` }}
                            />
                          </div>
                        </div>

                        <div className="p-3 sm:p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1">
                          <div className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                            Club Tasks
                          </div>
                          <div className="font-mono-num text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                            {myTasks.length}
                          </div>
                          <div className="text-[10px] sm:text-[11px] text-slate-500 font-mono-num tabular-nums">
                            {
                              myTasks.filter((t) => t.status === 'Done').length
                            }{' '}
                            done ·{' '}
                            {
                              myTasks.filter((t) => t.status !== 'Done').length
                            }{' '}
                            open
                          </div>
                        </div>
                      </div>

                      {/* Segmented Activity Filter */}
                      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar touch-scroll pt-3 border-t border-[var(--hairline)]">
                        {(
                          [
                            { id: 'all', label: 'All activity' },
                            {
                              id: 'achievements',
                              label: `Badges (${unlockedAchievementsCount}/${myAchievements.length})`,
                            },
                            {
                              id: 'matches',
                              label: `Matches (${
                                myMatches.length +
                                myTournamentBracketMatches.length
                              })`,
                            },
                            {
                              id: 'attendance',
                              label: `Attendance (${myAttendanceSessions.length})`,
                            },
                            {
                              id: 'tasks',
                              label: `Tasks (${myTasks.length})`,
                            },
                          ] as const
                        ).map((tab) => {
                          const isSelected = activityFilter === tab.id;
                          return (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActivityFilter(tab.id)}
                              className={`relative px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                                isSelected
                                  ? 'text-white dark:text-slate-900'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                              }`}
                            >
                              {isSelected && (
                                <motion.div
                                  layoutId="member-activity-filter-pill"
                                  transition={{
                                    type: 'spring',
                                    stiffness: 420,
                                    damping: 34,
                                  }}
                                  className="absolute inset-0 rounded-full bg-slate-900 dark:bg-court"
                                />
                              )}
                              <span className="relative z-10">{tab.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ACTIVE RIVALRY CALLOUTS FOR SIGNED-IN MEMBER */}
                    {myActiveChallenges.length > 0 && (
                      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-4 sm:p-6 space-y-3.5 sm:space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <div className="text-[11px] font-mono-num uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400">
                              Live Ladder Rivalry Callouts
                            </div>
                            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                              Your Active Challenges ({myActiveChallenges.length})
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('ladder')}
                            className="px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white text-xs font-semibold cursor-pointer"
                          >
                            Challenge Board →
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {myActiveChallenges.map((c) => {
                            const isIncoming = c.opponentId === activeMember.id;
                            const rivalName = getMemberName(
                              isIncoming ? c.challengerId : c.opponentId
                            );
                            return (
                              <div
                                key={c.id}
                                className="p-3.5 sm:p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3 text-xs"
                              >
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-mono-num text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                                      {isIncoming
                                        ? 'INCOMING CALLOUT'
                                        : 'OUTGOING CALLOUT'}
                                    </span>
                                    <span
                                      className={`px-2 py-0.5 rounded font-mono-num text-[10px] font-bold uppercase ${
                                        c.status === 'accepted'
                                          ? 'bg-emerald-600 text-white'
                                          : 'bg-amber-500 text-slate-950'
                                      }`}
                                    >
                                      {c.status === 'accepted'
                                        ? 'ACCEPTED · ON DECK'
                                        : 'OPEN'}
                                    </span>
                                  </div>
                                  <div className="text-sm font-bold text-slate-900 dark:text-white">
                                    {activeMember.name} vs. {rivalName}
                                  </div>
                                  {c.message && (
                                    <div className="text-slate-600 dark:text-slate-300">
                                      “{c.message}”
                                    </div>
                                  )}
                                  <div className="text-[11px] font-mono-num text-slate-500">
                                    <span className="capitalize">{c.format}</span>{' '}
                                    · Game to {c.targetScore} · {c.createdAt}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 pt-1">
                                  {isIncoming && c.status === 'open' && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateChallengeStatus(
                                            c.id,
                                            'accepted'
                                          )
                                        }
                                        className="px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                                      >
                                        Accept Callout
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateChallengeStatus(
                                            c.id,
                                            'declined'
                                          )
                                        }
                                        className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                                      >
                                        Decline
                                      </button>
                                    </>
                                  )}
                                  {!isIncoming && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onUpdateChallengeStatus(
                                          c.id,
                                          'open',
                                          true
                                        )
                                      }
                                      className="px-2.5 py-1 rounded text-slate-500 hover:text-red-600 font-semibold cursor-pointer"
                                    >
                                      Withdraw Challenge
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SECTION 0: ACHIEVEMENT BADGES & MILESTONES */}
                    {(activityFilter === 'all' ||
                      activityFilter === 'achievements') && (
                      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-4 sm:p-6 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                              Achievement Badges & Club Milestones
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Automatically unlocked from your official match
                              streaks, wins, and practice attendance
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono-num font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                              {unlockedAchievementsCount} of{' '}
                              {myAchievements.length} Unlocked
                            </span>
                            {activityFilter === 'all' && (
                              <button
                                type="button"
                                onClick={() =>
                                  setActivityFilter('achievements')
                                }
                                className="sm:hidden px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold text-blue-600 dark:text-blue-400 cursor-pointer"
                              >
                                View All 10 →
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
                          {myAchievements.map((ach, idx) => {
                            const iconColors = ach.unlocked
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-200 dark:bg-slate-800 text-slate-500';
                            // On mobile when viewing "All Activity", show unlocked badges or top 4 so 10 cards don't push Matches down
                            const hideOnMobileOverview =
                              activityFilter === 'all' &&
                              !ach.unlocked &&
                              idx >= 4;
                            return (
                              <div
                                key={ach.id}
                                className={`${
                                  hideOnMobileOverview
                                    ? 'hidden sm:flex'
                                    : 'flex'
                                } p-3.5 sm:p-4 rounded-md border flex-col justify-between gap-2.5 sm:gap-3 ${
                                  ach.unlocked
                                    ? 'bg-emerald-50/30 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800'
                                }`}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <div
                                      className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${iconColors}`}
                                    >
                                      {renderAchievementIcon(ach)}
                                    </div>
                                    <span
                                      className={`text-[10px] font-mono-num font-bold uppercase tracking-wider ${
                                        ach.unlocked
                                          ? 'text-emerald-700 dark:text-emerald-400'
                                          : 'text-slate-400'
                                      }`}
                                    >
                                      {ach.unlocked
                                        ? 'UNLOCKED'
                                        : ach.category}
                                    </span>
                                  </div>

                                  <div>
                                    <div className="font-display text-base font-bold text-slate-900 dark:text-white leading-tight">
                                      {ach.title}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                                      {ach.description}
                                    </p>
                                  </div>
                                </div>

                                <div className="space-y-1.5 pt-1">
                                  <div className="flex items-center justify-between text-[11px] font-mono-num">
                                    <span className="text-slate-600 dark:text-slate-300 font-semibold">
                                      {ach.progressLabel}
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                      {ach.pct}%
                                    </span>
                                  </div>
                                  <div className="h-1 w-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                                    <div
                                      className={`h-full transition-all duration-500 ${
                                        ach.unlocked
                                          ? 'bg-emerald-600'
                                          : 'bg-blue-600'
                                      }`}
                                      style={{ width: `${ach.pct}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SECTION 1: MY MATCHES HISTORY */}
                    {(activityFilter === 'all' ||
                      activityFilter === 'matches') && (
                      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-4 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                              My Match History
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Ladder and tournament matches involving{' '}
                              {activeMember.name}
                            </p>
                          </div>
                          <span className="text-xs font-mono-num text-slate-500 tabular-nums">
                            {myMatches.length} ladder ·{' '}
                            {myTournamentBracketMatches.length} bracket
                          </span>
                        </div>

                        {myMatches.length === 0 &&
                        myTournamentBracketMatches.length === 0 ? (
                          <div className="py-8 text-center rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                            No recorded matches found for {activeMember.name}{' '}
                            yet.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {myMatches.map((m) => {
                              const inT1 = m.team1Ids.includes(activeMember.id);
                              const won =
                                (inT1 && m.winnerTeam === 1) ||
                                (!inT1 && m.winnerTeam === 2);
                              const t1Names = m.team1Ids
                                .map(getMemberName)
                                .join(' / ');
                              const t2Names = m.team2Ids
                                .map(getMemberName)
                                .join(' / ');
                              const scoreStr = m.games
                                .map((g) => `${g.team1Score}–${g.team2Score}`)
                                .join(', ');

                              return (
                                <div
                                  key={m.id}
                                  className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-sm"
                                >
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`text-xs font-mono-num font-bold ${
                                          won
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-500'
                                        }`}
                                      >
                                        {won ? 'WIN' : 'LOSS'}
                                      </span>
                                      <span
                                        aria-hidden="true"
                                        className="text-slate-300"
                                      >
                                        ·
                                      </span>
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {t1Names} vs. {t2Names}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                      <span className="capitalize">
                                        {m.format}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span className="capitalize">
                                        {m.scoringType}
                                      </span>
                                      <span aria-hidden="true">·</span>
                                      <span className="font-mono-num tabular-nums">
                                        {m.date}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="text-right font-mono-num tabular-nums">
                                    <div className="text-base font-bold text-slate-900 dark:text-white">
                                      {scoreStr}
                                    </div>
                                    {m.matchMode === 'practice_history' ? (
                                      <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        Practice Log · 0 Elo
                                      </div>
                                    ) : m.isFriendly ||
                                      m.matchMode === 'friendly_wl' ||
                                      m.eloDelta === 0 ? (
                                      <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                                        Friendly W/L · 0 Elo
                                      </div>
                                    ) : (
                                      <div
                                        className={`text-xs font-bold ${
                                          won
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-500'
                                        }`}
                                      >
                                        {won
                                          ? `+${m.eloDelta}`
                                          : `-${m.eloDelta}`}{' '}
                                        Elo
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {myTournamentBracketMatches.map((tm) => {
                              const isDone = tm.winner !== null;
                              const won =
                                (tm.isTeam1 && tm.winner === 1) ||
                                (!tm.isTeam1 && tm.winner === 2);
                              return (
                                <div
                                  key={tm.id}
                                  className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-sm"
                                >
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`text-xs font-mono-num font-bold ${
                                          !isDone
                                            ? 'text-amber-600 dark:text-amber-400'
                                            : won
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-500'
                                        }`}
                                      >
                                        {!isDone
                                          ? 'UPCOMING BRACKET'
                                          : won
                                          ? 'TOURNAMENT WIN'
                                          : 'TOURNAMENT LOSS'}
                                      </span>
                                      <span
                                        aria-hidden="true"
                                        className="text-slate-300"
                                      >
                                        ·
                                      </span>
                                      <span className="font-bold text-slate-900 dark:text-white">
                                        {tm.team1Name} vs. {tm.team2Name}
                                      </span>
                                    </div>
                                    <div className="text-xs text-slate-500 flex items-center gap-2">
                                      <span>{tm.tournamentName}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{tm.roundLabel}</span>
                                      <span aria-hidden="true">·</span>
                                      <span>{tm.court}</span>
                                    </div>
                                  </div>

                                  <div className="text-right font-mono-num tabular-nums">
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {tm.score1 !== null && tm.score2 !== null
                                        ? `${tm.score1}–${tm.score2}`
                                        : 'Scheduled'}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SECTION 2: MY ATTENDANCE HISTORY */}
                    {(activityFilter === 'all' ||
                      activityFilter === 'attendance') && (
                      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-4 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                              My Practice Attendance
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Attendance history for {activeMember.name}
                            </p>
                          </div>
                          <span className="text-xs font-mono-num font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {attendanceStats.attended}/{attendanceStats.total}{' '}
                            Present ({attendanceStats.pct}%)
                          </span>
                        </div>

                        {myAttendanceSessions.length === 0 ? (
                          <div className="py-8 text-center rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                            No practice attendance sessions recorded yet.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {myAttendanceSessions.map((session) => (
                              <div
                                key={session.id}
                                className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 text-sm"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white truncate">
                                    {session.title}
                                  </div>
                                  <div className="text-xs text-slate-500 font-mono-num tabular-nums">
                                    {session.date}
                                  </div>
                                </div>

                                <div className="text-xs font-mono-num font-bold shrink-0">
                                  {session.present ? (
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      PRESENT
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">
                                      ABSENT
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* SECTION 3: TASKS INVOLVED IN */}
                    {(activityFilter === 'all' ||
                      activityFilter === 'tasks') && (
                      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-4 sm:p-6 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                              Club Tasks Involved In
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Club responsibilities and event tasks assigned to{' '}
                              {activeMember.name}
                            </p>
                          </div>
                          <span className="text-xs font-mono-num text-slate-500 tabular-nums">
                            {myTasks.length} tasks
                          </span>
                        </div>

                        {myTasks.length === 0 ? (
                          <div className="py-8 text-center rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                            No club tasks are currently assigned to{' '}
                            {activeMember.name}.
                          </div>
                        ) : (
                          <div className="space-y-2.5">
                            {myTasks.map((task) => (
                              <div
                                key={task.id}
                                className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-sm"
                              >
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-900 dark:text-white">
                                    {task.title}
                                  </div>
                                  <div className="text-xs text-slate-500 flex items-center gap-2">
                                    <span>{task.category}</span>
                                    <span aria-hidden="true">·</span>
                                    <span>Assigned: {task.assignee}</span>
                                    <span aria-hidden="true">·</span>
                                    <span className="font-mono-num tabular-nums">
                                      Due {task.dueDate}
                                    </span>
                                  </div>
                                </div>

                                <span
                                  className={`text-xs font-mono-num font-bold uppercase ${
                                    task.status === 'Done'
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : task.status === 'In Progress'
                                      ? 'text-amber-600 dark:text-amber-400'
                                      : 'text-slate-500'
                                  }`}
                                >
                                  {task.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'ladder' && (
              <LadderStatsView
                members={data.members}
                matches={data.matches}
                attendance={data.attendance}
                challenges={data.challenges || []}
                activeMember={activeMember}
                isOfficer={false}
                onSaveManualMatch={noop}
                onDeleteMatch={noop}
                onCreateChallenge={onCreateChallenge}
                onUpdateChallengeStatus={onUpdateChallengeStatus}
                onNavigate={onNavigate}
              />
            )}

            {activeTab === 'tournaments' && (
              <TournamentsView
                members={data.members}
                clubTournaments={data.clubTournaments}
                isOfficer={false}
                activeMember={activeMember}
                onUpdateClubTournaments={noop}
                onLaunchScoreKeeperForTournament={noop}
                onRequestOfficerUnlock={onRequestOfficerLogin}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarEventsView
                events={data.events}
                settings={data.settings}
                isOfficer={false}
                onUpdateEvents={noop}
                onUpdateSettings={noop}
                onRequestOfficerUnlock={onRequestOfficerLogin}
              />
            )}

            {activeTab === 'scorekeeper' && (
              <LiveScoreKeeper
                members={data.members}
                attendance={data.attendance}
                isOfficer={false}
                pendingTournamentMatch={null}
                onClearPendingTournamentMatch={noop}
                onSaveCompletedMatch={noop}
                onNavigateToLadder={() => onNavigate('ladder')}
                onRequestOfficerUnlock={onRequestOfficerLogin}
              />
            )}

            {activeTab === 'announcements' && (
              <AnnouncementsView
                announcements={data.announcements}
                officers={data.officers}
                isOfficer={false}
                onUpdateAnnouncements={noop}
                onRequestOfficerUnlock={onRequestOfficerLogin}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ================================================================= */}
      {/* MOBILE BOTTOM NAVIGATION BAR (ALL 6 TABS)                         */}
      {/* ================================================================= */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-paper/85 dark:bg-slate-950/80 backdrop-blur-xl border-t border-[var(--hairline)] px-1 pt-1 pb-safe grid grid-cols-6 gap-0.5 no-print">
        {MEMBER_NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`relative py-1.5 px-0.5 rounded-md flex flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors cursor-pointer min-h-[44px] ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="member-mobile-nav-pill"
                  transition={{
                    type: 'spring',
                    stiffness: 420,
                    damping: 34,
                  }}
                  className="absolute inset-0 rounded-md bg-slate-100 dark:bg-slate-800/80 -z-0"
                />
              )}
              <span className="relative z-10">{tab.icon}</span>
              <span className="relative z-10 truncate max-w-full text-[9px] leading-tight">
                {tab.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
