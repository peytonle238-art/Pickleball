import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Award,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  Eye,
  Flame,
  Home,
  Lock,
  LogIn,
  MapPin,
  Megaphone,
  Moon,
  Pin,
  QrCode,
  Search,
  Sparkles,
  Sun,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';
import { ClubDataState, NavTab } from '../types';
import { getDaysUntil, getNextUpcomingEvent } from '../utils/clubUtils';
import { QrCheckinRecord, User } from '../firebase';
import {
  PracticeQrTarget,
  buildPracticeQrToken,
} from './PracticeQrModal';
import { BOBCATS_LOGO_URL } from './WelcomeScreen';
import { LadderStatsView } from './LadderStatsView';
import { TournamentsView } from './TournamentsView';
import { CalendarEventsView } from './CalendarEventsView';
import { AnnouncementsView } from './ManagementViews';

interface MemberPortalViewProps {
  data: ClubDataState;
  activeTab: NavTab;
  darkMode: boolean;
  currentUser: User | null;
  linkedMemberId: string;
  recentQrCheckins: QrCheckinRecord[];
  cloudSynced: boolean;
  defaultQrTarget: PracticeQrTarget;
  onSelectLinkedMember: (memberId: string) => void;
  onNavigate: (tab: NavTab) => void;
  onToggleDarkMode: () => void;
  onRequestOfficerLogin: () => void;
  onOpenPracticeQr: (
    target: PracticeQrTarget,
    mode: 'display' | 'scan'
  ) => void;
  onShowWelcomeScreen: () => void;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
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
    description: 'Next practice, top rankings & latest updates',
    icon: <Home className="w-4 h-4" />,
  },
  {
    id: 'activity',
    label: 'My Activity',
    shortLabel: 'My Activity',
    description: 'Your personal matches, attendance & tasks',
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
    description: 'Monthly practice schedule & QR check-in',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    id: 'announcements',
    label: 'Bulletins',
    shortLabel: 'Bulletins',
    description: 'Official announcements from club officers',
    icon: <Megaphone className="w-4 h-4" />,
  },
];

export const MemberPortalView: React.FC<MemberPortalViewProps> = ({
  data,
  activeTab,
  darkMode,
  currentUser,
  linkedMemberId,
  recentQrCheckins,
  cloudSynced,
  defaultQrTarget,
  onSelectLinkedMember,
  onNavigate,
  onToggleDarkMode,
  onRequestOfficerLogin,
  onOpenPracticeQr,
  onShowWelcomeScreen,
  onGoogleSignIn,
  onGoogleSignOut,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [playerQuery, setPlayerQuery] = useState('');
  const [activityFilter, setActivityFilter] = useState<
    'all' | 'matches' | 'attendance' | 'tasks'
  >('all');
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const currentNav =
    MEMBER_NAV_TABS.find((t) => t.id === activeTab) || MEMBER_NAV_TABS[0];

  // Resolve the active member profile for the logged-in user
  const activeMember = useMemo(() => {
    const byId = data.members.find((m) => m.id === linkedMemberId);
    if (byId) return byId;
    if (currentUser?.displayName) {
      const byName = data.members.find(
        (m) =>
          m.name.toLowerCase() === currentUser.displayName!.trim().toLowerCase()
      );
      if (byName) return byName;
    }
    return data.members[0] || null;
  }, [data.members, linkedMemberId, currentUser]);

  const getMemberName = (id: string) =>
    data.members.find((m) => m.id === id)?.name || 'Club Player';

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();

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

  const nextPracticeQrTarget: PracticeQrTarget = {
    eventId: nextEvent.id,
    title: nextEvent.title,
    date: nextEvent.date,
    time: nextEvent.time,
    location: nextEvent.location,
    token: buildPracticeQrToken(nextEvent.date, nextEvent.id),
  };

  const rankedMembers = useMemo(
    () => [...data.members].sort((a, b) => b.elo - a.elo),
    [data.members]
  );

  const activeMemberRank = useMemo(() => {
    if (!activeMember) return null;
    const idx = rankedMembers.findIndex((m) => m.id === activeMember.id);
    return idx >= 0 ? idx + 1 : null;
  }, [rankedMembers, activeMember]);

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

  const myVerifiedQrCheckins = useMemo(() => {
    if (!activeMember) return recentQrCheckins;
    return recentQrCheckins.filter(
      (c) =>
        c.memberId === activeMember.id ||
        (currentUser && c.uid === currentUser.uid)
    );
  }, [recentQrCheckins, activeMember, currentUser]);

  const attendanceStats = useMemo(() => {
    const total = myAttendanceSessions.length;
    const attended = myAttendanceSessions.filter((s) => s.present).length;
    const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
    return { total, attended, pct };
  }, [myAttendanceSessions]);

  // 3. Filtered Tasks the logged-in member is involved in
  const myTasks = useMemo(() => {
    const candidateNames = new Set<string>();
    if (activeMember?.name) {
      candidateNames.add(activeMember.name.trim().toLowerCase());
      const firstName = activeMember.name.trim().split(' ')[0]?.toLowerCase();
      if (firstName && firstName.length >= 2) candidateNames.add(firstName);
    }
    if (currentUser?.displayName) {
      candidateNames.add(currentUser.displayName.trim().toLowerCase());
      const first = currentUser.displayName.trim().split(' ')[0]?.toLowerCase();
      if (first && first.length >= 2) candidateNames.add(first);
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
  }, [data.tasks, activeMember, currentUser]);

  const filteredLadderPreview = rankedMembers
    .filter((m) =>
      playerQuery.trim() === ''
        ? true
        : m.name.toLowerCase().includes(playerQuery.trim().toLowerCase())
    )
    .slice(0, 8);

  const sortedAnnouncements = [...data.announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });

  const activeOutside = data.outsideTournaments
    .filter((t) => t.status !== 'Done')
    .sort((a, b) =>
      a.registrationDeadline.localeCompare(b.registrationDeadline)
    );

  // No-op handlers for read-only member subviews
  const noop = () => {};

  const winRatePct =
    activeMember && activeMember.wins + activeMember.losses > 0
      ? Math.round(
          (activeMember.wins / (activeMember.wins + activeMember.losses)) * 100
        )
      : 0;

  return (
    <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#070b14] text-slate-900 dark:text-slate-100 flex flex-col pb-20 md:pb-10 transition-colors duration-300">
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

            {/* Right Controls: Quick QR Scan, Theme Toggle, All-Menu Dropdown, Officer Login */}
            <div className="flex items-center gap-2">
              {/* Quick QR Check-In Button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                type="button"
                onClick={() =>
                  onOpenPracticeQr(
                    hasScheduledEvents ? nextPracticeQrTarget : defaultQrTarget,
                    'scan'
                  )
                }
                className="hidden sm:inline-flex min-h-[38px] px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold items-center gap-1.5 shadow-2xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Check In (QR)</span>
              </motion.button>

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

              {/* Unified Bobcats Quick Menu */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/90 dark:hover:bg-slate-700 border border-slate-200/70 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <span className="text-blue-600 dark:text-blue-400">
                    {currentNav.icon}
                  </span>
                  <span className="hidden xs:inline">Menu</span>
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
                        className="absolute right-0 mt-2.5 w-80 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-3 space-y-2.5"
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
                              Quick Navigation Menu
                            </div>
                          </div>
                        </div>

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

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-1 text-xs">
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
                          {!currentUser ? (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                onGoogleSignIn();
                              }}
                              className="font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                            >
                              <LogIn className="w-3.5 h-3.5" />
                              <span>Google Sign In</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                onGoogleSignOut();
                              }}
                              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              {cloudSynced ? 'Synced · Sign Out' : 'Sign Out'}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Officer Login Button */}
              <button
                type="button"
                onClick={onRequestOfficerLogin}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Officer Login</span>
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

                {data.members.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Viewing as:
                    </span>
                    <select
                      value={activeMember?.id || ''}
                      onChange={(e) => onSelectLinkedMember(e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white cursor-pointer"
                    >
                      {data.members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.elo} Elo)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* ============================================================= */}
            {/* OVERVIEW TAB: VISUAL ATHLETE HUB                              */}
            {/* ============================================================= */}
            {activeTab === 'home' && (
              <div className="space-y-6">
                {/* 1. Vibrant Athletic Hero Banner with Pickleball Court Lines */}
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
                        {activeMember
                          ? `Welcome back, ${activeMember.name.split(' ')[0]}!`
                          : `Welcome to ${data.settings.clubName}`}
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
                          Track your match results, check your live club Elo
                          ranking, view tournament brackets, and check in to
                          practice with one tap.
                        </p>
                      )}
                    </div>

                    {/* Right Side of Hero: Countdown + Primary Actions */}
                    <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-4 shrink-0">
                      {hasScheduledEvents && (
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
                      )}

                      <div className="flex flex-wrap items-center gap-2.5">
                        <motion.button
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() =>
                            onOpenPracticeQr(
                              hasScheduledEvents
                                ? nextPracticeQrTarget
                                : defaultQrTarget,
                              'scan'
                            )
                          }
                          className="min-h-[44px] px-5 py-2.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center justify-center gap-2 shadow-md cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <QrCode className="w-4 h-4" />
                          <span>Scan Practice QR</span>
                        </motion.button>

                        <motion.button
                          whileHover={{ y: -1 }}
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => onNavigate('activity')}
                          className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white/15 hover:bg-white/25 text-white border border-white/20 text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors whitespace-nowrap"
                        >
                          <Activity className="w-4 h-4" />
                          <span>My Activity</span>
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Personal Athlete Pass Strip (Easy Profile Selector + Personal Stats) */}
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 sm:p-6 shadow-2xs">
                  {activeMember ? (
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                      {/* Player Identity & Easy Switcher */}
                      <div className="flex items-center gap-4">
                        <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-display text-xl font-bold flex items-center justify-center shrink-0 shadow-xs">
                          {getInitials(activeMember.name)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              My Player Pass
                            </span>
                            {data.members.length > 1 && (
                              <select
                                aria-label="Switch active member profile"
                                value={activeMember.id}
                                onChange={(e) =>
                                  onSelectLinkedMember(e.target.value)
                                }
                                className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                {data.members.map((m) => (
                                  <option key={m.id} value={m.id}>
                                    Switch: {m.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                          <div className="font-display text-2xl font-bold text-slate-900 dark:text-white leading-none">
                            {activeMember.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Grade {activeMember.grade} · {activeMember.skillLevel}
                          </div>
                        </div>
                      </div>

                      {/* 4 Clear Personal Metrics + Jump to My Activity */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 lg:max-w-2xl">
                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <div className="text-[11px] font-medium text-slate-500">
                            Club Rank
                          </div>
                          <div className="font-mono-num text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                            {activeMemberRank ? `#${activeMemberRank}` : '—'}{' '}
                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              ({activeMember.elo})
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <div className="text-[11px] font-medium text-slate-500">
                            Win–Loss
                          </div>
                          <div className="font-mono-num text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                            {activeMember.wins}–{activeMember.losses}{' '}
                            <span className="text-xs font-normal text-slate-500">
                              ({winRatePct}%)
                            </span>
                          </div>
                        </div>

                        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                          <div className="text-[11px] font-medium text-slate-500">
                            Attendance
                          </div>
                          <div className="font-mono-num text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 tabular-nums">
                            {attendanceStats.pct}%{' '}
                            <span className="text-xs font-normal text-slate-500">
                              ({attendanceStats.attended})
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => onNavigate('activity')}
                          className="p-3 rounded-2xl bg-blue-50/80 hover:bg-blue-100/80 dark:bg-blue-950/40 dark:hover:bg-blue-950/70 border border-blue-200/70 dark:border-blue-800/60 text-left flex flex-col justify-between cursor-pointer transition-colors group"
                        >
                          <div className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 flex items-center justify-between">
                            <span>Full History</span>
                            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                          </div>
                          <div className="font-display text-sm font-bold text-slate-900 dark:text-white mt-1">
                            View My Activity
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-display text-lg font-bold text-slate-900 dark:text-white">
                            Ready for the New Pickleball Season
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Once officers add club members to the roster, your
                            personal ranking, matches, and attendance will show
                            up right here.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onNavigate('activity')}
                        className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0 self-start sm:self-center"
                      >
                        <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>Open My Activity</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* 3. Easy 4-Tile Visual Action Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onNavigate('activity')}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/60 shadow-2xs text-left flex flex-col justify-between gap-4 cursor-pointer transition-all group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>My Activity</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {myMatches.length} matches · {attendanceStats.attended}{' '}
                        check-ins · {myTasks.length} tasks
                      </p>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onNavigate('ladder')}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-500/60 shadow-2xs text-left flex flex-col justify-between gap-4 cursor-pointer transition-all group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Award className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>Club Standings</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {data.members.length} ranked players ·{' '}
                        {data.matches.length} official matches
                      </p>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onNavigate('tournaments')}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/60 shadow-2xs text-left flex flex-col justify-between gap-4 cursor-pointer transition-all group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>Tournaments</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {data.clubTournaments.length} club brackets ·{' '}
                        {data.outsideTournaments.length} watch list
                      </p>
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onNavigate('calendar')}
                    className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/60 shadow-2xs text-left flex flex-col justify-between gap-4 cursor-pointer transition-all group"
                  >
                    <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center justify-between">
                        <span>Practice Calendar</span>
                        <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {data.events.length} scheduled dates & QR check-in
                      </p>
                    </div>
                  </motion.button>
                </div>

                {/* 4. Two-Column Split: Club Standings (with Podium) + Bulletins & Outside Watch */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Left 7 Cols: Standings with Top-3 Podium & Search */}
                  <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs flex flex-col justify-between space-y-5">
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                            Club Ladder Standings
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Live rankings updated after every official match
                          </p>
                        </div>

                        <div className="relative w-full sm:w-56">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={playerQuery}
                            onChange={(e) => setPlayerQuery(e.target.value)}
                            placeholder="Search player name..."
                            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Visual Top 3 Podium when no search filter is active and >= 3 members exist */}
                      {playerQuery.trim() === '' &&
                        rankedMembers.length >= 3 && (
                          <div className="grid grid-cols-3 gap-3 pt-1">
                            {rankedMembers.slice(0, 3).map((leader, idx) => {
                              const medals = [
                                {
                                  rank: '#1',
                                  ring: 'border-amber-300/80 dark:border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20',
                                  accent: 'text-amber-600 dark:text-amber-400',
                                },
                                {
                                  rank: '#2',
                                  ring: 'border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40',
                                  accent: 'text-slate-600 dark:text-slate-300',
                                },
                                {
                                  rank: '#3',
                                  ring: 'border-orange-200/80 dark:border-orange-500/30 bg-orange-50/40 dark:bg-orange-950/20',
                                  accent:
                                    'text-orange-600 dark:text-orange-400',
                                },
                              ][idx];
                              return (
                                <div
                                  key={leader.id}
                                  className={`p-3.5 rounded-2xl border ${medals.ring} flex flex-col justify-between gap-2`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span
                                      className={`font-mono-num text-xs font-extrabold ${medals.accent}`}
                                    >
                                      {medals.rank}
                                    </span>
                                    <span className="font-mono-num text-xs font-bold text-slate-900 dark:text-white tabular-nums">
                                      {leader.elo}
                                    </span>
                                  </div>
                                  <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                      {leader.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono-num tabular-nums">
                                      {leader.wins}W – {leader.losses}L
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                      {/* Player List */}
                      {filteredLadderPreview.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                          {filteredLadderPreview.map((member) => {
                            const rank =
                              rankedMembers.findIndex(
                                (rm) => rm.id === member.id
                              ) + 1;
                            const isMe = activeMember?.id === member.id;
                            return (
                              <div
                                key={member.id}
                                className={`py-3 px-2.5 -mx-2.5 rounded-xl flex items-center justify-between gap-3 transition-colors ${
                                  isMe
                                    ? 'bg-blue-50/70 dark:bg-blue-950/30'
                                    : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/40'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span
                                    className={`w-6 font-mono-num font-bold text-xs tabular-nums ${
                                      rank <= 3
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    #{rank}
                                  </span>
                                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-display text-xs font-bold flex items-center justify-center shrink-0">
                                    {getInitials(member.name)}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate flex items-center gap-2">
                                      <span>{member.name}</span>
                                      {isMe && (
                                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">
                                          (You)
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                      Grade {member.grade} · {member.skillLevel}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0 text-right font-mono-num tabular-nums">
                                  {member.streak >= 3 && (
                                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-500">
                                      <Flame className="w-3.5 h-3.5" />W
                                      {member.streak}
                                    </span>
                                  )}
                                  <span className="text-xs text-slate-500 dark:text-slate-400">
                                    {member.wins}–{member.losses}
                                  </span>
                                  <span className="text-sm font-bold text-slate-900 dark:text-white w-12">
                                    {member.elo}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-12 text-center space-y-2 bg-slate-50/60 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                          <Award className="w-7 h-7 text-slate-400 mx-auto" />
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {data.members.length === 0
                              ? 'Club Ladder is Ready for Players'
                              : 'No matching players found'}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                            {data.members.length === 0
                              ? 'Standings and Elo ratings will appear automatically once club officers add members.'
                              : 'Try searching a different player name.'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        View leaderboards & match history
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('ladder')}
                        className="font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Open Full Standings</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Right 5 Cols: Club Bulletins & Upcoming Tournaments */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    {/* Pinned Bulletins */}
                    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                              <Megaphone className="w-4 h-4" />
                            </div>
                            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                              Club Bulletins
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('announcements')}
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            See All
                          </button>
                        </div>

                        {sortedAnnouncements.length > 0 ? (
                          <div className="space-y-3 pt-1">
                            {sortedAnnouncements.slice(0, 2).map((ann) => (
                              <div
                                key={ann.id}
                                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    {ann.pinned && (
                                      <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    )}
                                    {ann.title}
                                  </span>
                                  <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                                    {ann.date}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                  {ann.body}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="py-6 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-500">
                              No club bulletins posted right now.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Tournament Watch Preview */}
                    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                              <Trophy className="w-4 h-4" />
                            </div>
                            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                              Upcoming Tournaments
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => onNavigate('watch')}
                            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            Watch List
                          </button>
                        </div>

                        {activeOutside.length > 0 ? (
                          <div className="space-y-2.5 pt-1">
                            {activeOutside.slice(0, 2).map((t) => {
                              const daysLeft = getDaysUntil(
                                t.registrationDeadline,
                                now
                              );
                              return (
                                <div
                                  key={t.id}
                                  className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-start justify-between gap-3"
                                >
                                  <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                                      {t.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">
                                      {t.cityVenue} · {t.dates}
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[11px] font-mono-num font-bold shrink-0 ${
                                      daysLeft <= 7
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-blue-600 dark:text-blue-400'
                                    }`}
                                  >
                                    {daysLeft}d left
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="py-6 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800">
                            <p className="text-xs text-slate-500">
                              No upcoming outside tournaments listed yet.
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span>{data.clubTournaments.length} club brackets</span>
                        <button
                          type="button"
                          onClick={() => onNavigate('tournaments')}
                          className="font-bold text-slate-800 dark:text-slate-200 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Club Brackets</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ============================================================= */}
            {/* MY ACTIVITY TAB: LOGGED-IN MEMBER'S MATCHES, ATTENDANCE, TASKS*/}
            {/* ============================================================= */}
            {activeTab === 'activity' && (
              <div className="space-y-6">
                {/* Visual Athlete Profile & Filter Header */}
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-7 shadow-2xs space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white font-display text-2xl font-bold flex items-center justify-center shrink-0 shadow-xs">
                        {activeMember ? (
                          getInitials(activeMember.name)
                        ) : (
                          <UserCheck className="w-6 h-6" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
                          <span>
                            {currentUser
                              ? `Signed in as ${
                                  currentUser.displayName || currentUser.email
                                }`
                              : 'Personal Athlete Activity'}
                          </span>
                        </div>
                        <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                          {activeMember
                            ? activeMember.name
                            : 'My Club Activity'}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Your personal matches, practice attendance history,
                          and assigned club tasks
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {data.members.length > 0 && (
                        <select
                          aria-label="Select your member profile"
                          value={activeMember?.id || ''}
                          onChange={(e) =>
                            onSelectLinkedMember(e.target.value)
                          }
                          className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white cursor-pointer"
                        >
                          {data.members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} (Grade {m.grade} · {m.elo} Elo)
                            </option>
                          ))}
                        </select>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          onOpenPracticeQr(defaultQrTarget, 'scan')
                        }
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Scan Practice QR</span>
                      </button>
                    </div>
                  </div>

                  {/* Personal 4-Metric Summary Cards with Visual Progress Bars */}
                  {activeMember ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Ladder Standing
                        </div>
                        <div className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {activeMemberRank ? `#${activeMemberRank}` : '—'}{' '}
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            · {activeMember.elo} Elo
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Grade {activeMember.grade} · {activeMember.skillLevel}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                          <span>Match Record</span>
                          <span className="font-mono-num font-bold text-slate-700 dark:text-slate-300">
                            {winRatePct}%
                          </span>
                        </div>
                        <div className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {activeMember.wins}W – {activeMember.losses}L
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-500"
                            style={{ width: `${winRatePct}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                          <span>Attendance Rate</span>
                          <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                            {attendanceStats.attended}/{attendanceStats.total}
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

                      <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 space-y-2">
                        <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                          Tasks Involved In
                        </div>
                        <div className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {myTasks.length}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-num tabular-nums">
                          {myTasks.filter((t) => t.status === 'Done').length}{' '}
                          completed ·{' '}
                          {myTasks.filter((t) => t.status !== 'Done').length}{' '}
                          active
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center rounded-2xl bg-slate-50/70 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-800 space-y-1.5">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No member profiles on the club roster yet
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Once club officers add members to the roster, select your
                        name above to view your personal activity.
                      </p>
                    </div>
                  )}

                  {/* Easy Filter Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {(
                      [
                        { id: 'all', label: 'All Activity' },
                        {
                          id: 'matches',
                          label: `My Matches (${
                            myMatches.length + myTournamentBracketMatches.length
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
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
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

                {/* SECTION 1: MY MATCHES HISTORY */}
                {(activityFilter === 'all' || activityFilter === 'matches') && (
                  <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                          My Match History
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Ladder and tournament matches involving{' '}
                          {activeMember?.name || 'you'}
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
                        No recorded matches found for{' '}
                        {activeMember?.name || 'your profile'} yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {myMatches.map((m) => {
                          const inT1 = activeMember
                            ? m.team1Ids.includes(activeMember.id)
                            : false;
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
                                won ? 'border-l-emerald-500' : 'border-l-red-500'
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
                                  <span className="capitalize">{m.format}</span>
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
                                  {won ? `+${m.eloDelta}` : `-${m.eloDelta}`} Elo
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
                          Attendance log & verified QR check-ins for{' '}
                          {activeMember?.name || 'your profile'}
                        </p>
                      </div>
                      <span className="text-xs font-mono-num font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {attendanceStats.attended}/{attendanceStats.total}{' '}
                        Present ({attendanceStats.pct}%)
                      </span>
                    </div>

                    {myAttendanceSessions.length === 0 &&
                    myVerifiedQrCheckins.length === 0 ? (
                      <div className="py-8 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        No practice attendance sessions recorded yet. Use the
                        Scan Practice QR button at practice to check in!
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {myAttendanceSessions.map((session) => {
                          const qrMatch = myVerifiedQrCheckins.find(
                            (q) => q.practiceDate === session.date
                          );
                          return (
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
                                  {qrMatch && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-sans font-semibold">
                                        QR Verified
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                                {session.present ? (
                                  <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle2 className="w-4 h-4" />
                                    Present
                                  </span>
                                ) : (
                                  <span className="text-slate-400">Absent</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* SECTION 3: TASKS INVOLVED IN */}
                {(activityFilter === 'all' || activityFilter === 'tasks') && (
                  <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 shadow-2xs space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                          Club Tasks Involved In
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Club responsibilities and event tasks assigned to{' '}
                          {activeMember?.name || 'you'}
                        </p>
                      </div>
                      <span className="text-xs font-mono-num text-slate-500 tabular-nums">
                        {myTasks.length} tasks
                      </span>
                    </div>

                    {myTasks.length === 0 ? (
                      <div className="py-8 text-center rounded-2xl bg-slate-50/60 dark:bg-slate-800/30 border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                        No club tasks are currently assigned to{' '}
                        {activeMember?.name || 'your profile'}.
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
                onSwitchSubTab={(sub) => onNavigate(sub)}
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
                onOpenPracticeQr={(target, mode) =>
                  onOpenPracticeQr(target, mode === 'display' ? 'scan' : mode)
                }
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
      {/* MOBILE THUMB-FRIENDLY BOTTOM NAVIGATION BAR                       */}
      {/* ================================================================= */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 dark:bg-[#0b1120]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 px-2 py-1.5 grid grid-cols-5 gap-1 no-print">
        {MEMBER_NAV_TABS.slice(0, 5).map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`py-1.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50/80 dark:bg-blue-950/50'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {tab.icon}
              <span className="truncate max-w-full px-1">{tab.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
