import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
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
    label: 'Member Overview',
    shortLabel: 'Overview',
    description: 'Next practice, standings & pinned club updates',
    icon: <Home className="w-4 h-4" />,
  },
  {
    id: 'activity',
    label: 'My Activity',
    shortLabel: 'My Activity',
    description: 'Your personal matches, attendance history & assigned tasks',
    icon: <Activity className="w-4 h-4" />,
  },
  {
    id: 'ladder',
    label: 'Standings & Stats',
    shortLabel: 'Stats',
    description: 'Club Elo rankings, leaderboards & match history',
    icon: <Award className="w-4 h-4" />,
  },
  {
    id: 'tournaments',
    label: 'Club Tournaments',
    shortLabel: 'Tournaments',
    description: 'Live brackets, round-robin pools & court assignments',
    icon: <Trophy className="w-4 h-4" />,
  },
  {
    id: 'watch',
    label: 'Outside Watch',
    shortLabel: 'Watch List',
    description: 'Upcoming regional tournaments & registered club pairs',
    icon: <Eye className="w-4 h-4" />,
  },
  {
    id: 'calendar',
    label: 'Practice Calendar',
    shortLabel: 'Calendar',
    description: 'Monthly schedule, practice dates & QR check-in',
    icon: <Calendar className="w-4 h-4" />,
  },
  {
    id: 'announcements',
    label: 'Club Bulletins',
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

  // Also include any in-club tournament bracket matches involving the logged-in member
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
    .slice(0, 6);

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

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-slate-100 flex flex-col transition-colors duration-300">
      {/* ================================================================= */}
      {/* CLEAN EDITORIAL MEMBER HEADER                                     */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-30 h-16 bg-white/85 dark:bg-[#090d16]/85 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/80 px-4 sm:px-8 no-print">
        <div className="max-w-5xl w-full h-full mx-auto flex items-center justify-between gap-6">
          {/* Zone 1: Brand Wordmark + Logo */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-3 text-left cursor-pointer shrink-0 group"
          >
            <div className="bg-white px-2 py-1 rounded-xl border border-slate-200/80 shadow-2xs flex items-center justify-center transition-transform duration-200 group-hover:scale-[1.02]">
              <img
                src={BOBCATS_LOGO_URL}
                alt="Byron Nelson Bobcats"
                className="h-6 w-auto object-contain"
              />
            </div>
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
              {data.settings.clubName}
            </span>
          </button>

          {/* Zone 2: Clean Desktop Tab Links + Unified Dropdown Menu */}
          <div className="flex items-center gap-2">
            <nav className="hidden lg:flex items-center gap-1 mr-2">
              {MEMBER_NAV_TABS.slice(0, 5).map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onNavigate(tab.id)}
                    className={`relative px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isActive
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {tab.shortLabel}
                    {isActive && (
                      <motion.div
                        layoutId="member-nav-underline"
                        transition={{
                          type: 'spring',
                          stiffness: 380,
                          damping: 32,
                        }}
                        className="absolute left-3 right-3 -bottom-[19px] h-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--club-primary)' }}
                      />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Unified Dropdown Menu with Bobcats Logo */}
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100/90 hover:bg-slate-200/70 dark:bg-slate-800/80 dark:hover:bg-slate-800 border border-slate-200/70 dark:border-slate-700/80 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                <span className="text-blue-600 dark:text-blue-400">
                  {currentNav.icon}
                </span>
                <span>{currentNav.shortLabel}</span>
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
                      className="absolute right-0 lg:left-1/2 lg:-translate-x-1/2 mt-2.5 w-80 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2.5 space-y-2"
                    >
                      {/* Bobcats Header inside Dropdown */}
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-3">
                        <div className="bg-white px-2 py-1 rounded-lg border border-slate-200/80 shrink-0">
                          <img
                            src={BOBCATS_LOGO_URL}
                            alt="Byron Nelson Bobcats"
                            className="h-6 w-auto object-contain"
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {data.settings.clubName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            Member Portal · View Only
                          </div>
                        </div>
                      </div>

                      <div className="space-y-0.5">
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
                                  ? 'bg-blue-600 text-white'
                                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span
                                  className={
                                    isSelected
                                      ? 'text-white'
                                      : 'text-blue-600 dark:text-blue-400'
                                  }
                                >
                                  {item.icon}
                                </span>
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold truncate">
                                    {item.label}
                                  </div>
                                  <div
                                    className={`text-[10px] truncate ${
                                      isSelected
                                        ? 'text-blue-100'
                                        : 'text-slate-400 dark:text-slate-500'
                                    }`}
                                  >
                                    {item.description}
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

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onOpenPracticeQr(defaultQrTarget, 'scan');
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          <span>QR Check-In</span>
                        </button>
                        <button
                          type="button"
                          onClick={onToggleDarkMode}
                          className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {darkMode ? (
                            <>
                              <Sun className="w-3.5 h-3.5 text-amber-400" />
                              <span>Light</span>
                            </>
                          ) : (
                            <>
                              <Moon className="w-3.5 h-3.5" />
                              <span>Dark</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between px-1 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            setMenuOpen(false);
                            onShowWelcomeScreen();
                          }}
                          className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>Welcome Screen</span>
                        </button>
                        {!currentUser ? (
                          <button
                            type="button"
                            onClick={() => {
                              setMenuOpen(false);
                              onGoogleSignIn();
                            }}
                            className="font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1 cursor-pointer"
                          >
                            <LogIn className="w-3 h-3" />
                            <span>Sign In</span>
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
          </div>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRequestOfficerLogin}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Officer Login</span>
            </button>
          </div>
        </div>
      </header>

      {/* ================================================================= */}
      {/* MEMBER PORTAL CONTENT VIEWPORT                                    */}
      {/* ================================================================= */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-8 py-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: SMOOTH_EASE }}
          >
            {activeTab === 'home' && (
              <div className="space-y-8">
                {/* Editorial Hero Strip for Members */}
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="space-y-3 max-w-xl">
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                      <span>{data.settings.schoolName}</span>
                      <span aria-hidden="true">·</span>
                      <span>Member Portal</span>
                      {activeMember && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">
                            {activeMember.name}
                          </span>
                        </>
                      )}
                    </div>
                    <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {hasScheduledEvents
                        ? nextEvent.title
                        : `Welcome to ${data.settings.clubName}`}
                    </h1>
                    {hasScheduledEvents ? (
                      <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                        <span className="font-mono-num font-semibold text-blue-600 dark:text-blue-400">
                          {nextEvent.date}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {nextEvent.time}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {nextEvent.location}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                        Check your personal match & attendance activity, live
                        Elo standings, and upcoming tournament brackets.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    {hasScheduledEvents && (
                      <div className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-800">
                        <div className="text-center">
                          <div className="font-mono-num text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                            {String(days).padStart(2, '0')}
                          </div>
                          <div className="text-[10px] text-slate-500">Days</div>
                        </div>
                        <span className="text-slate-300 dark:text-slate-700">
                          :
                        </span>
                        <div className="text-center">
                          <div className="font-mono-num text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                            {String(hours).padStart(2, '0')}
                          </div>
                          <div className="text-[10px] text-slate-500">Hrs</div>
                        </div>
                        <span className="text-slate-300 dark:text-slate-700">
                          :
                        </span>
                        <div className="text-center">
                          <div className="font-mono-num text-xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">
                            {String(minutes).padStart(2, '0')}
                          </div>
                          <div className="text-[10px] text-slate-500">Min</div>
                        </div>
                      </div>
                    )}

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
                      className="min-h-[46px] px-5 py-2.5 rounded-2xl text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs cursor-pointer transition-opacity hover:opacity-95 whitespace-nowrap shrink-0"
                      style={{ backgroundColor: 'var(--club-primary)' }}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Practice QR Check-In</span>
                    </motion.button>
                  </div>
                </div>

                {/* Clean 4-Card Member Navigation Strip (My Activity, Stats, Tournaments, Calendar) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onNavigate('activity')}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 text-left flex items-center justify-between gap-4 cursor-pointer transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Personal Log
                      </div>
                      <div className="font-display text-xl font-bold text-slate-900 dark:text-white truncate">
                        My Activity
                      </div>
                      <div className="text-xs text-slate-500 font-mono-num tabular-nums truncate">
                        {myMatches.length} matches · {attendanceStats.attended}{' '}
                        check-ins
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                      <Activity className="w-5 h-5" />
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onNavigate('ladder')}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-blue-500/50 text-left flex items-center justify-between gap-4 cursor-pointer transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Club Rankings
                      </div>
                      <div className="font-display text-xl font-bold text-slate-900 dark:text-white truncate">
                        Standings & Stats
                      </div>
                      <div className="text-xs text-slate-500 font-mono-num tabular-nums truncate">
                        {data.members.length} players · {data.matches.length}{' '}
                        matches
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      <Award className="w-5 h-5" />
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onNavigate('tournaments')}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-amber-500/50 text-left flex items-center justify-between gap-4 cursor-pointer transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Brackets & Pools
                      </div>
                      <div className="font-display text-xl font-bold text-slate-900 dark:text-white truncate">
                        Club Tournaments
                      </div>
                      <div className="text-xs text-slate-500 font-mono-num tabular-nums truncate">
                        {data.clubTournaments.length} in-club ·{' '}
                        {data.outsideTournaments.length} watch
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5" />
                    </div>
                  </motion.button>

                  <motion.button
                    whileHover={{ y: -2 }}
                    whileTap={{ scale: 0.99 }}
                    type="button"
                    onClick={() => onNavigate('calendar')}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 text-left flex items-center justify-between gap-4 cursor-pointer transition-colors"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Practices & Dates
                      </div>
                      <div className="font-display text-xl font-bold text-slate-900 dark:text-white truncate">
                        Club Calendar
                      </div>
                      <div className="text-xs text-slate-500 font-mono-num tabular-nums truncate">
                        {data.events.length} scheduled events
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                      <Calendar className="w-5 h-5" />
                    </div>
                  </motion.button>
                </div>

                {/* Two-Column Split: Instant Player Standings Lookup + Club Bulletins & Watch */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                  {/* Left 7 Cols: Standings Snapshot with Instant Player Filter */}
                  <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                            Club Ladder Standings
                          </h2>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Ranked by official club Elo rating
                          </p>
                        </div>

                        <div className="relative w-full sm:w-52">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            value={playerQuery}
                            onChange={(e) => setPlayerQuery(e.target.value)}
                            placeholder="Find player..."
                            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {filteredLadderPreview.length > 0 ? (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                          {filteredLadderPreview.map((member) => {
                            const rank =
                              rankedMembers.findIndex(
                                (rm) => rm.id === member.id
                              ) + 1;
                            return (
                              <div
                                key={member.id}
                                className="py-3 flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-3.5 min-w-0">
                                  <span className="w-6 font-mono-num font-bold text-xs text-slate-400 tabular-nums">
                                    #{rank}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                      {member.name}
                                    </div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                      Grade {member.grade} · {member.skillLevel}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-5 shrink-0 text-right font-mono-num tabular-nums">
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
                        <div className="py-12 text-center space-y-1.5">
                          <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                            {data.members.length === 0
                              ? 'No players on the ladder yet'
                              : 'No matching players found'}
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {data.members.length === 0
                              ? 'Standings will appear once officers add club members.'
                              : 'Try searching a different name.'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                      <span className="text-slate-500">
                        Updated automatically after official matches
                      </span>
                      <button
                        type="button"
                        onClick={() => onNavigate('ladder')}
                        className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Full Standings</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Right 5 Cols: Club Bulletins & Upcoming Outside Tournaments */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    {/* Pinned Bulletins */}
                    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                            Club Bulletins
                          </h3>
                          <button
                            type="button"
                            onClick={() => onNavigate('announcements')}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            View All
                          </button>
                        </div>

                        {sortedAnnouncements.length > 0 ? (
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {sortedAnnouncements.slice(0, 2).map((ann) => (
                              <div key={ann.id} className="py-2.5 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                    {ann.pinned && (
                                      <Pin className="w-3 h-3 text-amber-500 shrink-0" />
                                    )}
                                    {ann.title}
                                  </span>
                                  <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                                    {ann.date}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                                  {ann.body}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 py-4">
                            No announcements posted yet.
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Tournament Watch Preview */}
                    <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                            Tournament Watch
                          </h3>
                          <button
                            type="button"
                            onClick={() => onNavigate('watch')}
                            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            All Events
                          </button>
                        </div>

                        {activeOutside.length > 0 ? (
                          <div className="space-y-2.5">
                            {activeOutside.slice(0, 2).map((t) => {
                              const daysLeft = getDaysUntil(
                                t.registrationDeadline,
                                now
                              );
                              return (
                                <div
                                  key={t.id}
                                  className="py-2 border-b border-slate-100 dark:border-slate-800 last:border-none flex items-start justify-between gap-3"
                                >
                                  <div>
                                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                                      {t.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {t.cityVenue} · {t.dates}
                                    </div>
                                  </div>
                                  <span
                                    className={`text-[11px] font-mono-num font-semibold shrink-0 ${
                                      daysLeft <= 7
                                        ? 'text-red-600 dark:text-red-400'
                                        : 'text-slate-500'
                                    }`}
                                  >
                                    {daysLeft}d left
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 py-3">
                            No outside tournaments listed right now.
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                        <span>{data.clubTournaments.length} club brackets</span>
                        <button
                          type="button"
                          onClick={() => onNavigate('tournaments')}
                          className="font-semibold text-slate-800 dark:text-slate-200 hover:underline inline-flex items-center gap-1 cursor-pointer"
                        >
                          <span>View Brackets</span>
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
                {/* Member Identity & Profile Selector Card */}
                <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 space-y-6">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                        <span>
                          {currentUser
                            ? `Signed in as ${currentUser.displayName || currentUser.email}`
                            : 'Personal Member Activity Feed'}
                        </span>
                      </div>
                      <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {activeMember
                          ? `${activeMember.name} · Activity Log`
                          : 'My Club Activity'}
                      </h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Filtered history of your personal matches, practice
                        attendance check-ins, and club tasks
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {data.members.length > 0 && (
                        <div className="flex items-center gap-2">
                          <label
                            htmlFor="member-profile-select"
                            className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap"
                          >
                            Member Profile:
                          </label>
                          <select
                            id="member-profile-select"
                            value={activeMember?.id || ''}
                            onChange={(e) =>
                              onSelectLinkedMember(e.target.value)
                            }
                            className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                          >
                            {data.members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} (Grade {m.grade} · {m.elo} Elo)
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {!currentUser && (
                        <button
                          type="button"
                          onClick={onGoogleSignIn}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                        >
                          <LogIn className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Sync with Google</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Personal 4-Metric Summary Strip */}
                  {activeMember ? (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Ladder Rank & Elo
                        </div>
                        <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {activeMemberRank ? `#${activeMemberRank}` : '—'}{' '}
                          <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                            · {activeMember.elo} Elo
                          </span>
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500">
                          Grade {activeMember.grade} · {activeMember.skillLevel}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Match Record
                        </div>
                        <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {activeMember.wins}–{activeMember.losses}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 font-mono-num tabular-nums">
                          {activeMember.wins + activeMember.losses > 0
                            ? `${Math.round(
                                (activeMember.wins /
                                  (activeMember.wins + activeMember.losses)) *
                                  100
                              )}% win rate`
                            : 'No matches yet'}
                          {activeMember.streak !== 0 &&
                            ` · ${
                              activeMember.streak > 0
                                ? `W${activeMember.streak}`
                                : `L${Math.abs(activeMember.streak)}`
                            } streak`}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Practice Attendance
                        </div>
                        <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {attendanceStats.pct}%
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 font-mono-num tabular-nums">
                          {attendanceStats.attended} of {attendanceStats.total}{' '}
                          sessions attended
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Tasks Involved In
                        </div>
                        <div className="mt-1 font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {myTasks.length}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-500 font-mono-num tabular-nums">
                          {myTasks.filter((t) => t.status === 'Done').length}{' '}
                          completed ·{' '}
                          {myTasks.filter((t) => t.status !== 'Done').length}{' '}
                          active
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center space-y-1.5">
                      <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        No member profiles on the club roster yet
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Once club officers add members to the roster, select your
                        name above to view your personal activity.
                      </p>
                    </div>
                  )}

                  {/* Segmented Filter Control */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
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
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                            activityFilter === tab.id
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        onOpenPracticeQr(defaultQrTarget, 'scan')
                      }
                      className="px-3.5 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>Scan Practice QR</span>
                    </button>
                  </div>
                </div>

                {/* SECTION 1: MY MATCHES HISTORY */}
                {(activityFilter === 'all' || activityFilter === 'matches') && (
                  <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                          My Match History
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Completed ladder and tournament matches involving{' '}
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
                      <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        No recorded matches found for{' '}
                        {activeMember?.name || 'your profile'} yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
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
                              className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm"
                            >
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-xs font-bold ${
                                      won
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-red-500'
                                    }`}
                                  >
                                    {won ? 'WIN' : 'LOSS'}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300">
                                    ·
                                  </span>
                                  <span className="font-semibold text-slate-900 dark:text-white">
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
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {scoreStr}
                                </div>
                                <div
                                  className={`text-xs font-semibold ${
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
                              className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm"
                            >
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span
                                    className={`text-xs font-bold ${
                                      !isDone
                                        ? 'text-amber-600 dark:text-amber-400'
                                        : won
                                        ? 'text-emerald-600 dark:text-emerald-400'
                                        : 'text-red-500'
                                    }`}
                                  >
                                    {!isDone
                                      ? 'UPCOMING'
                                      : won
                                      ? 'TOURNAMENT WIN'
                                      : 'TOURNAMENT LOSS'}
                                  </span>
                                  <span aria-hidden="true" className="text-slate-300">
                                    ·
                                  </span>
                                  <span className="font-semibold text-slate-900 dark:text-white">
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
                  <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                          My Practice Attendance History
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Attendance log & verified QR check-ins for{' '}
                          {activeMember?.name || 'your profile'}
                        </p>
                      </div>
                      <span className="text-xs font-mono-num font-semibold text-slate-600 dark:text-slate-300 tabular-nums">
                        {attendanceStats.attended}/{attendanceStats.total}{' '}
                        Present ({attendanceStats.pct}%)
                      </span>
                    </div>

                    {myAttendanceSessions.length === 0 &&
                    myVerifiedQrCheckins.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        No practice attendance sessions recorded yet. Use the
                        Scan Practice QR button at practice to check in.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {myAttendanceSessions.map((session) => {
                          const qrMatch = myVerifiedQrCheckins.find(
                            (q) => q.practiceDate === session.date
                          );
                          return (
                            <div
                              key={session.id}
                              className="py-3 flex flex-wrap items-center justify-between gap-3 text-sm"
                            >
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {session.title}
                                </div>
                                <div className="text-xs text-slate-500 flex items-center gap-2 font-mono-num tabular-nums">
                                  <span>{session.date}</span>
                                  {qrMatch && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span className="text-emerald-600 dark:text-emerald-400 font-sans font-medium">
                                        QR Verified ({qrMatch.qrCodeToken})
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 text-xs font-semibold">
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
                  <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 space-y-4">
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
                      <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                        No club tasks are currently assigned to{' '}
                        {activeMember?.name || 'your profile'}.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {myTasks.map((task) => (
                          <div
                            key={task.id}
                            className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-sm"
                          >
                            <div className="space-y-0.5">
                              <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
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
                              className={`text-xs font-bold ${
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
    </div>
  );
};
