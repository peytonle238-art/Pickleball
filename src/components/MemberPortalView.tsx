import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  Flame,
  Home,
  IdCard,
  Lock,
  LogIn,
  LogOut,
  MapPin,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
  UserPlus,
  Zap,
} from 'lucide-react';
import {
  ClubDataState,
  GradeLevel,
  Member,
  NavTab,
  SkillLevel,
} from '../types';
import {
  MemberAchievement,
  computeMemberAchievements,
  getNextUpcomingEvent,
  processImageFileToDataUrl,
} from '../utils/clubUtils';
import { BOBCATS_LOGO_URL } from './WelcomeScreen';
import { LadderStatsView } from './LadderStatsView';
import { TournamentsView } from './TournamentsView';
import { CalendarEventsView } from './CalendarEventsView';

interface MemberPortalViewProps {
  data: ClubDataState;
  activeTab: NavTab;
  darkMode: boolean;
  linkedMemberId: string;
  onSelectLinkedMember: (memberId: string) => void;
  onSignInBySchoolId: (schoolId: string) => Member | null;
  onRegisterMember: (payload: {
    schoolId: string;
    name: string;
    grade: GradeLevel;
    skillLevel: SkillLevel;
    paddleNotes?: string;
    photoUrl?: string;
  }) => Member;
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
    id: 'watch',
    label: 'Outside Watch',
    shortLabel: 'Watch List',
    description: 'Regional tournaments & registered club pairs',
    icon: <Eye className="w-4 h-4" />,
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
      return <Flame className="w-5 h-5" />;
    case 'Attendance':
      return <ShieldCheck className="w-5 h-5" />;
    case 'Rating':
      return <Zap className="w-5 h-5" />;
    default:
      return <Trophy className="w-5 h-5" />;
  }
}

export const MemberPortalView: React.FC<MemberPortalViewProps> = ({
  data,
  activeTab,
  darkMode,
  linkedMemberId,
  onSignInBySchoolId,
  onRegisterMember,
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
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentNav =
    MEMBER_NAV_TABS.find((t) => t.id === activeTab) || MEMBER_NAV_TABS[0];

  // Resolve the active member profile strictly from the signed-in member ID / School ID
  const activeMember = useMemo(() => {
    if (!linkedMemberId) return null;
    const byId = data.members.find(
      (m) =>
        m.id === linkedMemberId ||
        (m.schoolId &&
          m.schoolId.trim().toLowerCase() ===
            linkedMemberId.trim().toLowerCase())
    );
    return byId || null;
  }, [data.members, linkedMemberId]);

  const getMemberName = (id: string) =>
    data.members.find((m) => m.id === id)?.name || 'Club Player';

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

  // 4. Computed Member Achievements
  const myAchievements = useMemo(
    () =>
      computeMemberAchievements(activeMember, data.matches, data.attendance),
    [activeMember, data.matches, data.attendance]
  );

  const unlockedAchievementsCount = useMemo(
    () => myAchievements.filter((a) => a.unlocked).length,
    [myAchievements]
  );

  // Handle continuing with School ID
  const handleSchoolIdSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = schoolIdInput.trim();
    if (!trimmed) {
      setSchoolIdError('Please enter your School ID.');
      return;
    }
    const found = onSignInBySchoolId(trimmed);
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

    onRegisterMember({
      schoolId: cleanId,
      name: cleanName,
      grade: regGrade,
      skillLevel: regSkill,
      paddleNotes: regPaddle.trim() || 'Personal Paddle',
      photoUrl: regPhoto,
    });

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

  // No-op handlers for read-only member subviews
  const noop = () => {};

  const winRatePct =
    activeMember && activeMember.wins + activeMember.losses > 0
      ? Math.round(
          (activeMember.wins / (activeMember.wins + activeMember.losses)) * 100
        )
      : 0;

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col pb-32 md:pb-16 overflow-y-auto overflow-x-hidden transition-colors duration-300">
      {/* Broadcast Alert Banner if active */}
      {data.settings.broadcastNotice?.enabled && data.settings.broadcastNotice.text && (
        <aside
          role="alert"
          className={`sticky top-0 z-40 px-4 py-2 text-xs font-bold shadow-md ${
            data.settings.broadcastNotice.level === 'urgent'
              ? 'bg-red-600 text-white'
              : 'bg-blue-600 text-white'
          }`}
        >
          <div className="max-w-6xl mx-auto w-full flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="shrink-0">
                {data.settings.broadcastNotice.level === 'urgent' ? '⚠️' : '📢'}
              </span>
              <span className="truncate">
                {data.settings.broadcastNotice.text}
              </span>
            </div>
            <span className="text-[10px] uppercase tracking-wider opacity-85 shrink-0">
              Club Broadcast
            </span>
          </div>
        </aside>
      )}

      {/* ================================================================= */}
      {/* STICKY TOP BAR + EFFORTLESS 1-TAP NAVIGATION DOCK                 */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#0b1120]/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 no-print">
        <div className="max-w-6xl w-full mx-auto px-4 sm:px-6">
          {/* Upper Row: Brand + Quick Actions */}
          <div className="h-16 flex items-center justify-between gap-3">
            {/* Brand Identity */}
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex items-center gap-3 text-left cursor-pointer shrink-0 group"
            >
              <div className="bg-white px-2.5 py-1 rounded-xl border border-slate-200/90 shadow-2xs flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.03]">
                <img
                  src={BOBCATS_LOGO_URL}
                  alt="Byron Nelson Bobcats"
                  className="h-6 sm:h-7 w-auto object-contain"
                />
              </div>
              <div>
                <div className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                  {data.settings.clubName}
                </div>
                <div className="text-[11px] font-medium text-blue-600 dark:text-blue-400 mt-0.5">
                  Member Athlete Portal
                </div>
              </div>
            </button>

            {/* Right Controls: Theme Toggle, Menu (with Member & Officer Sign-In), Officer Sign In */}
            <div className="flex items-center gap-2">
              {/* Active School ID Badge or Quick Sign-In Trigger */}
              <button
                type="button"
                onClick={() => {
                  setMenuAccountTab('signin');
                  setMenuOpen(true);
                }}
                className="hidden sm:inline-flex min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100/80 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 border border-blue-200/80 dark:border-blue-800/60 text-xs font-semibold text-blue-700 dark:text-blue-300 items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <IdCard className="w-3.5 h-3.5" />
                {activeMember ? (
                  <span>
                    {activeMember.name.split(' ')[0]} · ID:{' '}
                    {activeMember.schoolId || activeMember.id}
                  </span>
                ) : (
                  <span>School ID Sign In / Join</span>
                )}
              </button>

              {/* Dark/Light Mode Button */}
              <button
                type="button"
                onClick={onToggleDarkMode}
                aria-label="Toggle color theme"
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                {darkMode ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-slate-600" />
                )}
              </button>

              {/* Unified Bobcats Quick Menu with Member Database Registration, School ID Sign-In & Officer Sign-In */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <span className="text-blue-600 dark:text-blue-400">
                    {currentNav.icon}
                  </span>
                  <span>Menu</span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                      menuOpen ? 'rotate-180' : ''
                    }`}
                  />
                </motion.button>

                <AnimatePresence>
                  {menuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setMenuOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -8, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: SMOOTH_EASE }}
                        className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:right-0 top-16 sm:top-auto sm:mt-2.5 w-auto sm:w-96 max-w-md z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3.5 space-y-3 max-h-[82vh] overflow-y-auto touch-scroll"
                      >
                        {/* Bobcats Header inside Dropdown */}
                        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center gap-3">
                          <div className="bg-white px-2 py-1 rounded-lg shrink-0 shadow-xs">
                            <img
                              src={BOBCATS_LOGO_URL}
                              alt="Byron Nelson Bobcats"
                              className="h-6 w-auto object-contain"
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold truncate">
                              {data.settings.clubName}
                            </div>
                            <div className="text-[11px] text-blue-100 truncate">
                              Member Account, Database & Navigation
                            </div>
                          </div>
                        </div>

                        {/* ================================================= */}
                        {/* MEMBER & OFFICER ACCOUNT HUB IN MENU              */}
                        {/* ================================================= */}
                        <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 p-3 space-y-3">
                          {/* 3-Tab Switcher: School ID Sign In | Add Yourself | Officer Sign In */}
                          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-900">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuAccountTab('signin');
                                setSchoolIdError('');
                              }}
                              className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                                menuAccountTab === 'signin'
                                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                              className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                                menuAccountTab === 'register'
                                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                              className={`py-1.5 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                                menuAccountTab === 'officer'
                                  ? 'bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-2xs'
                                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
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
                                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 flex items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      {activeMember.photoUrl ? (
                                        <img
                                          src={activeMember.photoUrl}
                                          alt={activeMember.name}
                                          className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-2xs shrink-0"
                                        />
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-700 text-xs">
                                          {activeMember.name
                                            .split(' ')
                                            .map((n) => n[0])
                                            .join('')
                                            .slice(0, 2)}
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                          Signed In · School ID:{' '}
                                          {activeMember.schoolId ||
                                            activeMember.id}
                                        </div>
                                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                                          {activeMember.name}
                                        </div>
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                          Grade {activeMember.grade} ·{' '}
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
                                      className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer shrink-0"
                                      title="Sign out or switch School ID"
                                    >
                                      <LogOut className="w-3 h-3" />
                                      <span>Switch ID</span>
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMenuOpen(false);
                                        onNavigate('activity');
                                      }}
                                      className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                                    >
                                      <Activity className="w-3.5 h-3.5" />
                                      <span>My Activity</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setMenuAccountTab('register')
                                      }
                                      className="w-full py-2 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                      <UserPlus className="w-3.5 h-3.5" />
                                      <span>Add Member</span>
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
                                      className="flex-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                                    />
                                    <button
                                      type="submit"
                                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                                    >
                                      <LogIn className="w-3.5 h-3.5" />
                                      <span>Continue</span>
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
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
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
                                    className="w-full min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  />
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
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
                                    className="w-full min-h-[36px] px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  />
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                    Grade
                                  </label>
                                  <select
                                    value={regGrade}
                                    onChange={(e) =>
                                      setRegGrade(
                                        Number(e.target.value) as GradeLevel
                                      )
                                    }
                                    className="w-full min-h-[36px] px-2 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                  >
                                    <option value={9}>9th Grade</option>
                                    <option value={10}>10th Grade</option>
                                    <option value={11}>11th Grade</option>
                                    <option value={12}>12th Grade</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                    Skill Level
                                  </label>
                                  <select
                                    value={regSkill}
                                    onChange={(e) =>
                                      setRegSkill(e.target.value as SkillLevel)
                                    }
                                    className="w-full min-h-[36px] px-2 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
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
                                <label className="block text-[10px] font-bold text-slate-500 mb-0.5">
                                  Paddle / Notes (Optional)
                                </label>
                                <input
                                  type="text"
                                  value={regPaddle}
                                  onChange={(e) => setRegPaddle(e.target.value)}
                                  placeholder="e.g. Personal Paddle or Loaner"
                                  className="w-full min-h-[36px] px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                                />
                              </div>

                              {/* Profile Photo Upload in Menu Form */}
                              <div className="flex items-center gap-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700">
                                <div className="relative w-10 h-10 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-600">
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
                                    {regPhoto ? 'Photo Attached' : 'Profile Picture'}
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                    {photoUploading ? 'Optimizing image...' : 'Optional member photo'}
                                  </div>
                                </div>
                                <label className="min-h-[32px] px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0 transition-colors hover:bg-blue-100">
                                  <Camera className="w-3 h-3" />
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
                                className="w-full min-h-[38px] px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>Add to Database & Continue</span>
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
                                <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                                  <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                                  Officer Console Sign In
                                </span>
                                <span className="text-slate-400">
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
                                  className="flex-1 h-10 text-center font-mono-num text-lg tracking-[0.4em] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                                />
                                <button
                                  type="submit"
                                  className="h-10 px-4 rounded-xl bg-slate-900 text-white dark:bg-amber-400 dark:text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  <span>Sign In</span>
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

                        {/* Navigation Links */}
                        <div className="space-y-1">
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
                                className={`w-full px-3 py-2 rounded-xl text-left transition-colors flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold'
                                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <span
                                    className={
                                      isSelected
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-slate-400'
                                    }
                                  >
                                    {item.icon}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold truncate">
                                      {item.label}
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                      {item.description}
                                    </div>
                                  </div>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                              </button>
                            );
                          })}
                        </div>

                        <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-1 text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              onShowWelcomeScreen();
                            }}
                            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Welcome Screen</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              onRequestOfficerLogin();
                            }}
                            className="font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Lock className="w-3 h-3" />
                            <span>Officer Sign In</span>
                          </button>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Officer Sign In Button */}
              <button
                type="button"
                onClick={onRequestOfficerLogin}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Officer Sign In</span>
              </button>
            </div>
          </div>

          {/* Lower Row: Easy 1-Tap Horizontal Section Bar */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-2 border-t border-slate-100 dark:border-slate-800/70">
            {MEMBER_NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onNavigate(tab.id)}
                  className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-blue-700 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="member-easy-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 32,
                      }}
                      className="absolute inset-0 rounded-xl bg-blue-50 dark:bg-blue-600/25 border border-blue-200/80 dark:border-blue-500/40"
                    />
                  )}
                  <span
                    className={`relative z-10 ${
                      isActive
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {tab.icon}
                  </span>
                  <span className="relative z-10">{tab.shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MEMBER PORTAL CONTENT VIEWPORT                                    */}
      {/* ================================================================= */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.24, ease: SMOOTH_EASE }}
          >
            {/* Contextual Back Bar on Sub-Views for Easy Navigation */}
            {activeTab !== 'home' && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-3 shadow-2xs">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onNavigate('home')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Overview</span>
                  </button>
                  <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
                  <div>
                    <h1 className="font-display text-lg font-bold text-slate-900 dark:text-white leading-none">
                      {currentNav.label}
                    </h1>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {currentNav.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeMember ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        {activeMember.name}{' '}
                        <span className="font-mono-num text-blue-600 dark:text-blue-400">
                          (ID: {activeMember.schoolId || activeMember.id})
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuAccountTab('signin');
                          setMenuOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        Switch ID
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuAccountTab('signin');
                        setMenuOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <IdCard className="w-3.5 h-3.5" />
                      <span>Sign In with School ID / Join</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* OVERVIEW TAB: ONLY WELCOME TO BNHS PICKLEBALL CLUB            */}
            {/* ============================================================= */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1e3a8a] via-[#1d4ed8] to-[#0f172a] text-white p-6 sm:p-8 shadow-lg">
                  {/* Decorative Pickleball Court Geometry Overlay */}
                  <svg
                    className="absolute right-0 top-0 h-full w-1/2 opacity-10 pointer-events-none"
                    viewBox="0 0 400 240"
                    fill="none"
                  >
                    <rect
                      x="20"
                      y="20"
                      width="360"
                      height="200"
                      rx="8"
                      stroke="white"
                      strokeWidth="4"
                    />
                    <line
                      x1="140"
                      y1="20"
                      x2="140"
                      y2="220"
                      stroke="white"
                      strokeWidth="4"
                    />
                    <line
                      x1="260"
                      y1="20"
                      x2="260"
                      y2="220"
                      stroke="white"
                      strokeWidth="4"
                    />
                    <line
                      x1="200"
                      y1="20"
                      x2="200"
                      y2="220"
                      stroke="white"
                      strokeWidth="3"
                      strokeDasharray="8 8"
                    />
                    <line
                      x1="20"
                      y1="120"
                      x2="140"
                      y2="120"
                      stroke="white"
                      strokeWidth="3"
                    />
                    <line
                      x1="260"
                      y1="120"
                      x2="380"
                      y2="120"
                      stroke="white"
                      strokeWidth="3"
                    />
                  </svg>

                  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-3 max-w-xl">
                      <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-100 bg-white/10 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
                        <span>{data.settings.schoolName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-300">
                          Official Member Hub
                        </span>
                      </div>

                      <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight leading-none">
                        Welcome to {data.settings.clubName}
                      </h1>

                      {hasScheduledEvents ? (
                        <div className="space-y-1 pt-1">
                          <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                            Next Club Session: {nextEvent.title}
                          </div>
                          <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs sm:text-sm text-blue-100">
                            <span className="font-mono-num font-bold text-white">
                              {nextEvent.date}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-blue-200" />
                              {nextEvent.time}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-blue-200" />
                              {nextEvent.location}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-blue-100/90 leading-relaxed max-w-lg">
                          Use the Menu above to sign in with your School ID or
                          add yourself to the club database to track your
                          matches, attendance, and badges.
                        </p>
                      )}
                    </div>

                    {hasScheduledEvents && (
                      <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-4 shrink-0">
                        <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-2xl bg-slate-950/35 backdrop-blur-md border border-white/15">
                          <div className="text-center min-w-[42px]">
                            <div className="font-mono-num text-2xl font-bold text-white tabular-nums leading-none">
                              {String(days).padStart(2, '0')}
                            </div>
                            <div className="text-[10px] font-medium text-blue-200 mt-1">
                              DAYS
                            </div>
                          </div>
                          <span className="text-white/40 font-bold">:</span>
                          <div className="text-center min-w-[42px]">
                            <div className="font-mono-num text-2xl font-bold text-white tabular-nums leading-none">
                              {String(hours).padStart(2, '0')}
                            </div>
                            <div className="text-[10px] font-medium text-blue-200 mt-1">
                              HRS
                            </div>
                          </div>
                          <span className="text-white/40 font-bold">:</span>
                          <div className="text-center min-w-[42px]">
                            <div className="font-mono-num text-2xl font-bold text-amber-300 tabular-nums leading-none">
                              {String(minutes).padStart(2, '0')}
                            </div>
                            <div className="text-[10px] font-medium text-blue-200 mt-1">
                              MIN
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* MY ACTIVITY TAB: ACHIEVEMENTS, MATCHES, ATTENDANCE & TASKS    */}
            {/* ============================================================= */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                {!activeMember ? (
                  /* Prompt to Sign In with School ID or Add Yourself in Menu */
                  <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 shadow-2xs space-y-6">
                    <div className="max-w-xl space-y-2">
                      <div className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                        <IdCard className="w-4 h-4" />
                        <span>Member School ID Account</span>
                      </div>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                        Sign In with Your School ID or Add Yourself
                      </h2>
                      <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                        Enter your BNHS School ID to view your personal match
                        record, attendance log, achievement badges, and club
                        tasks—or add yourself to the database in seconds.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                      {/* Left: Continue with School ID */}
                      <form
                        onSubmit={handleSchoolIdSubmit}
                        className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-4 flex flex-col justify-between"
                      >
                        <div className="space-y-3">
                          <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <LogIn className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            <span>Continue with School ID</span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Already added yourself? Enter your School ID to load
                            your personal account.
                          </p>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
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
                              className="w-full min-h-[42px] px-3.5 py-2 rounded-xl text-sm font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          {schoolIdError && (
                            <div className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                              {schoolIdError}
                            </div>
                          )}
                        </div>

                        <button
                          type="submit"
                          className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <LogIn className="w-4 h-4" />
                          <span>Continue with School ID</span>
                        </button>
                      </form>

                      {/* Right: Add Yourself to the Database */}
                      <form
                        onSubmit={handleRegisterSubmit}
                        className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 space-y-3"
                      >
                        <div className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>New Member? Add Yourself to Database</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
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
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
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
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              Grade
                            </label>
                            <select
                              value={regGrade}
                              onChange={(e) =>
                                setRegGrade(
                                  Number(e.target.value) as GradeLevel
                                )
                              }
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                            >
                              <option value={9}>Grade 9</option>
                              <option value={10}>Grade 10</option>
                              <option value={11}>Grade 11</option>
                              <option value={12}>Grade 12</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              Skill Level
                            </label>
                            <select
                              value={regSkill}
                              onChange={(e) =>
                                setRegSkill(e.target.value as SkillLevel)
                              }
                              className="w-full min-h-[40px] px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                            >
                              <option value="Beginner">Beginner</option>
                              <option value="Intermediate">Intermediate</option>
                              <option value="Advanced">Advanced</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                            Paddle / Gear Notes (Optional)
                          </label>
                          <input
                            type="text"
                            value={regPaddle}
                            onChange={(e) => setRegPaddle(e.target.value)}
                            placeholder="e.g. Selkirk Vanguard or club loaner"
                            className="w-full min-h-[40px] px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          />
                        </div>

                        {/* Profile Photo Upload Option */}
                        <div className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-600">
                            {regPhoto ? (
                              <img
                                src={regPhoto}
                                alt="Profile Preview"
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Camera className="w-5 h-5 text-slate-400" />
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
                          <label className="min-h-[36px] px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors hover:bg-blue-100">
                            <Camera className="w-3.5 h-3.5" />
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
                          className="w-full min-h-[42px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Add Yourself to Database & Continue</span>
                        </button>
                      </form>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Personal Metrics & Season Performance Card */}
                    <div>
                      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs flex flex-col justify-between gap-5">
                        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {activeMember.photoUrl ? (
                              <img
                                src={activeMember.photoUrl}
                                alt={activeMember.name}
                                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border-2 border-blue-500 shadow-md shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-display text-xl sm:text-2xl font-bold flex items-center justify-center shrink-0 shadow-md">
                                {activeMember.name
                                  .split(' ')
                                  .map((n) => n[0])
                                  .join('')
                                  .slice(0, 2)}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                Personal Athlete Account · School ID:{' '}
                                {activeMember.schoolId || activeMember.id}
                              </div>
                              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white truncate">
                                {activeMember.name} — Season Performance &
                                Milestones
                              </h2>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Grade {activeMember.grade} · {activeMember.skillLevel} · {activeMember.elo} Elo
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              Grade {activeMember.grade} ·{' '}
                              {activeMember.skillLevel} · {activeMember.elo} Elo
                            </span>
                            <button
                              type="button"
                              onClick={onSignOutMember}
                              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <LogOut className="w-3.5 h-3.5" />
                              <span>Switch School ID</span>
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
                            <div className="text-xs font-medium text-slate-500">
                              Badges Unlocked
                            </div>
                            <div className="font-mono-num text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                              {unlockedAchievementsCount}/
                              {myAchievements.length}
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full bg-amber-500 rounded-full transition-all duration-500"
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

                          <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                              <span>Match Record</span>
                              <span className="font-mono-num font-bold text-slate-700 dark:text-slate-300">
                                {winRatePct}%
                              </span>
                            </div>
                            <div className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                              {activeMember.wins}W–{activeMember.losses}L
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                style={{ width: `${winRatePct}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                              <span>Attendance</span>
                              <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                                {attendanceStats.attended}/
                                {attendanceStats.total}
                              </span>
                            </div>
                            <div className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                              {attendanceStats.pct}%
                            </div>
                            <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${attendanceStats.pct}%` }}
                              />
                            </div>
                          </div>

                          <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-1.5">
                            <div className="text-xs font-medium text-slate-500">
                              Tasks Involved In
                            </div>
                            <div className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                              {myTasks.length}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono-num tabular-nums">
                              {
                                myTasks.filter((t) => t.status === 'Done')
                                  .length
                              }{' '}
                              done ·{' '}
                              {
                                myTasks.filter((t) => t.status !== 'Done')
                                  .length
                              }{' '}
                              open
                            </div>
                          </div>
                        </div>

                        {/* Segmented Activity Filter */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-scroll py-1 overscroll-x-contain">
                          {(
                            [
                              { id: 'all', label: 'All Activity' },
                              {
                                id: 'achievements',
                                label: `Achievements (${unlockedAchievementsCount}/${myAchievements.length})`,
                              },
                              {
                                id: 'matches',
                                label: `My Matches (${
                                  myMatches.length +
                                  myTournamentBracketMatches.length
                                })`,
                              },
                              {
                                id: 'attendance',
                                label: `My Attendance (${myAttendanceSessions.length})`,
                              },
                              {
                                id: 'tasks',
                                label: `My Tasks (${myTasks.length})`,
                              },
                            ] as const
                          ).map((tab) => (
                            <button
                              key={tab.id}
                              type="button"
                              onClick={() => setActivityFilter(tab.id)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                                activityFilter === tab.id
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-2xs'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* SECTION 0: ACHIEVEMENT BADGES & MILESTONES */}
                    {(activityFilter === 'all' ||
                      activityFilter === 'achievements') && (
                      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                              Achievement Badges & Club Milestones
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Automatically unlocked from your official match
                              streaks, wins, and practice attendance
                            </p>
                          </div>
                          <span className="text-xs font-mono-num font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                            {unlockedAchievementsCount} of{' '}
                            {myAchievements.length} Unlocked
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                          {myAchievements.map((ach) => {
                            const iconColors = ach.unlocked
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-400';
                            return (
                              <div
                                key={ach.id}
                                className={`p-4 rounded-2xl border flex flex-col justify-between gap-3 transition-all ${
                                  ach.unlocked
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200/90 dark:border-emerald-800/60'
                                    : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800'
                                }`}
                              >
                                <div className="space-y-2.5">
                                  <div className="flex items-start justify-between gap-2">
                                    <div
                                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColors}`}
                                    >
                                      {renderAchievementIcon(ach)}
                                    </div>
                                    <span
                                      className={`text-[10px] font-mono-num font-extrabold uppercase tracking-wider ${
                                        ach.unlocked
                                          ? 'text-emerald-600 dark:text-emerald-400'
                                          : 'text-slate-400'
                                      }`}
                                    >
                                      {ach.unlocked
                                        ? 'UNLOCKED ✓'
                                        : ach.category}
                                    </span>
                                  </div>

                                  <div>
                                    <div className="font-display text-lg font-bold text-slate-900 dark:text-white leading-tight">
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
                                  <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-500 ${
                                        ach.unlocked
                                          ? 'bg-emerald-500'
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
                      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
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
                          <div className="py-8 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                            No recorded matches found for {activeMember.name}{' '}
                            yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
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
                                  className={`p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 border-l-4 ${
                                    won
                                      ? 'border-l-emerald-500'
                                      : 'border-l-red-500'
                                  } flex flex-wrap items-center justify-between gap-4 text-sm`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`text-xs font-extrabold ${
                                          won
                                            ? 'text-emerald-600 dark:text-emerald-400'
                                            : 'text-red-500'
                                        }`}
                                      >
                                        {won ? 'VICTORY' : 'DEFEAT'}
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
                                  className={`p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 border-l-4 ${
                                    !isDone
                                      ? 'border-l-amber-500'
                                      : won
                                      ? 'border-l-emerald-500'
                                      : 'border-l-red-500'
                                  } flex flex-wrap items-center justify-between gap-4 text-sm`}
                                >
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span
                                        className={`text-xs font-extrabold ${
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
                      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
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
                          <div className="py-8 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                            No practice attendance sessions recorded yet.
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {myAttendanceSessions.map((session) => (
                              <div
                                key={session.id}
                                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3 text-sm"
                              >
                                <div className="space-y-0.5 min-w-0">
                                  <div className="font-bold text-slate-900 dark:text-white truncate">
                                    {session.title}
                                  </div>
                                  <div className="text-xs text-slate-500 flex items-center gap-2 font-mono-num tabular-nums">
                                    <span>{session.date}</span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                                  {session.present ? (
                                    <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                      <CheckCircle2 className="w-4 h-4" />
                                      Present
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">
                                      Absent
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
                      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
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
                          <div className="py-8 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                            No club tasks are currently assigned to{' '}
                            {activeMember.name}.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {myTasks.map((task) => (
                              <div
                                key={task.id}
                                className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-sm"
                              >
                                <div className="space-y-1">
                                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                                    <span>{task.title}</span>
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
                                  className={`text-xs font-extrabold ${
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
                isOfficer={false}
                onSaveManualMatch={noop}
                onDeleteMatch={noop}
                onNavigate={onNavigate}
              />
            )}

            {(activeTab === 'tournaments' || activeTab === 'watch') && (
              <TournamentsView
                activeSubTab={activeTab}
                onSwitchSubTab={(sub: NavTab) => onNavigate(sub)}
                members={data.members}
                clubTournaments={data.clubTournaments}
                outsideTournaments={data.outsideTournaments}
                isOfficer={false}
                onUpdateClubTournaments={noop}
                onUpdateOutsideTournaments={noop}
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
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ================================================================= */}
      {/* MOBILE THUMB-FRIENDLY BOTTOM NAVIGATION BAR (ALL 6 TABS)          */}
      {/* ================================================================= */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 px-1 pt-1.5 pb-safe grid grid-cols-6 gap-0.5 no-print shadow-lg">
        {MEMBER_NAV_TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer min-h-[44px] ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/90 dark:bg-blue-950/60'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              <span className="truncate max-w-full text-[9px] leading-tight">
                {tab.shortLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
