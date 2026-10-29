import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  Calendar,
  ChevronDown,
  Download,
  Eye,
  Home,
  Moon,
  Package,
  Play,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
  Unlock,
  Upload,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  ClubDataState,
  GradeLevel,
  MatchRecord,
  Member,
  NavTab,
  PendingTournamentScoreContext,
  SeasonArchive,
  SkillLevel,
} from './types';
import {
  INITIAL_CLUB_DATA,
  sanitizeAndStripTemplateData,
} from './data/initialData';
import {
  applyMatchToMembers,
  updateTournamentMatchList,
} from './utils/clubUtils';
import {
  User,
  auth,
  ensureUserProfileInFirestore,
  loadClubWorkspaceFromFirestore,
  onAuthStateChanged,
  saveClubWorkspaceToFirestore,
  updateUserLinkedMember,
} from './firebase';
import { HomeDashboard } from './components/HomeDashboard';
import { LiveScoreKeeper } from './components/LiveScoreKeeper';
import { MembersAttendanceView } from './components/MembersAttendanceView';
import { LadderStatsView } from './components/LadderStatsView';
import { TournamentsView } from './components/TournamentsView';
import { OfficersTasksView } from './components/OfficersTasksView';
import { CalendarEventsView } from './components/CalendarEventsView';
import {
  EquipmentView,
  SettingsView,
  TreasuryView,
} from './components/ManagementViews';
import { BOBCATS_LOGO_URL, WelcomeScreen } from './components/WelcomeScreen';
import { MemberPortalView } from './components/MemberPortalView';

const STORAGE_KEY = 'bnhs_pickleball_hq_fresh_v2';
const LEGACY_STORAGE_KEY = 'bnhs_pickleball_hq_v1';
const THEME_KEY = 'bnhs_pickleball_theme_v1';

const SMOOTH_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LINKED_MEMBER_KEY = 'bnhs_pickleball_linked_member_v1';

// Tabs accessible to Members (Clean, Limited View-Only Portal)
const MEMBER_ALLOWED_TABS: NavTab[] = [
  'home',
  'activity',
  'ladder',
  'tournaments',
  'watch',
  'calendar',
];

export default function App() {
  const [data, setData] = useState<ClubDataState>(() => {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.members && parsed.settings) {
          return sanitizeAndStripTemplateData(parsed);
        }
      }
    } catch {
      // Fallback to initial data
    }
    return INITIAL_CLUB_DATA;
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  // Welcome Screen visibility state
  const [showWelcomeScreen, setShowWelcomeScreen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isOfficer, setIsOfficer] = useState<boolean>(false);

  // Universal Dropdown Menu state ("Everything Menu")
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // Firebase Auth & Firestore state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [linkedMemberId, setLinkedMemberId] = useState<string>(() => {
    try {
      return localStorage.getItem(LINKED_MEMBER_KEY) || '';
    } catch {
      return '';
    }
  });
  const workspaceDocExistsRef = useRef<boolean>(false);
  const initialCloudLoadDoneRef = useRef<boolean>(false);

  // Officer 4-Digit PIN Modal state (no hints)
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [pendingOfficerTab, setPendingOfficerTab] = useState<NavTab | null>(
    null
  );

  // Context when launching Live Score Keeper from a Club Tournament bracket match
  const [pendingTournamentMatch, setPendingTournamentMatch] =
    useState<PendingTournamentScoreContext | null>(null);
  const [scoreModePreference, setScoreModePreference] = useState<
    'single' | 'multicourt'
  >('single');

  // Toast status message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Safe navigation helper that enforces Member vs Officer access
  const handleNavigate = (targetTab: NavTab) => {
    setMenuOpen(false);
    if (!isOfficer && !MEMBER_ALLOWED_TABS.includes(targetTab)) {
      setPendingOfficerTab(targetTab);
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
      return;
    }
    setActiveTab(targetTab);
  };

  // Listen to Firebase Auth state & load user profile + Firestore workspace
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      setAuthReady(true);

      if (!user) {
        workspaceDocExistsRef.current = false;
        initialCloudLoadDoneRef.current = false;
        return;
      }

      try {
        const matchedRosterMember = data.members.find(
          (m) =>
            user.displayName &&
            m.name.toLowerCase() === user.displayName.toLowerCase()
        );
        const defaultMemId = matchedRosterMember?.id || linkedMemberId || '';

        const profile = await ensureUserProfileInFirestore(user, defaultMemId);
        if (profile.linkedMemberId) {
          setLinkedMemberId(profile.linkedMemberId);
        }

        const cloudData = await loadClubWorkspaceFromFirestore(user.uid);
        if (cloudData && cloudData.members && cloudData.settings) {
          const cleaned = sanitizeAndStripTemplateData(cloudData);
          workspaceDocExistsRef.current = true;
          initialCloudLoadDoneRef.current = true;
          setData(cleaned);
          await saveClubWorkspaceToFirestore(user.uid, cleaned, true);
        } else {
          await saveClubWorkspaceToFirestore(user.uid, data, false);
          workspaceDocExistsRef.current = true;
          initialCloudLoadDoneRef.current = true;
        }
      } catch (err) {
        console.error('Error syncing Firebase user workspace:', err);
      }
    });

    return () => {
      unsubscribeAuth();
    };
  }, []);

  // Persist data to localStorage & sync to Firestore when signed in
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }

    if (currentUser && authReady && initialCloudLoadDoneRef.current) {
      const timer = setTimeout(async () => {
        try {
          await saveClubWorkspaceToFirestore(
            currentUser.uid,
            data,
            workspaceDocExistsRef.current
          );
          workspaceDocExistsRef.current = true;
        } catch (err) {
          console.error('Failed to sync club workspace to Firestore:', err);
        }
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [data, currentUser, authReady]);

  // Apply school colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      '--club-primary',
      data.settings.primaryColor || '#1d4ed8'
    );
    root.style.setProperty(
      '--club-secondary',
      data.settings.secondaryColor || '#eab308'
    );
  }, [data.settings.primaryColor, data.settings.secondaryColor]);

  // Apply Dark Mode class
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [darkMode]);

  const handleSelectLinkedMember = async (memberId: string) => {
    setLinkedMemberId(memberId);
    try {
      if (memberId) {
        localStorage.setItem(LINKED_MEMBER_KEY, memberId);
      } else {
        localStorage.removeItem(LINKED_MEMBER_KEY);
      }
    } catch {
      // Ignore storage quota errors
    }
    const member = data.members.find(
      (m) =>
        m.id === memberId ||
        (m.schoolId &&
          m.schoolId.trim().toLowerCase() === memberId.trim().toLowerCase())
    );
    if (currentUser && member) {
      try {
        await updateUserLinkedMember(
          currentUser.uid,
          currentUser.displayName || member.name || 'Club Member',
          member.id
        );
      } catch (err) {
        console.error('Failed to update linked member in Firestore:', err);
      }
    }
    if (member) {
      showToast(`Signed in as ${member.name}`);
    }
  };

  // Sign in an existing member using their School ID
  const handleSignInBySchoolId = (schoolId: string): Member | null => {
    const cleaned = schoolId.trim().toLowerCase();
    if (!cleaned) return null;

    const found =
      data.members.find(
        (m) =>
          (m.schoolId && m.schoolId.trim().toLowerCase() === cleaned) ||
          m.id.toLowerCase() === cleaned
      ) || null;

    if (found) {
      handleSelectLinkedMember(found.id);
    }
    return found;
  };

  // Let a member add themselves directly into the club database with their School ID and photo
  const handleRegisterMember = ({
    schoolId,
    name,
    grade,
    skillLevel,
    paddleNotes,
    photoUrl,
  }: {
    schoolId: string;
    name: string;
    grade: GradeLevel;
    skillLevel: SkillLevel;
    paddleNotes?: string;
    photoUrl?: string;
  }): Member => {
    const cleanSchoolId = schoolId.trim();
    const cleanName = name.trim();

    // Check if a member with this School ID already exists
    const existingById = data.members.find(
      (m) =>
        m.schoolId &&
        m.schoolId.trim().toLowerCase() === cleanSchoolId.toLowerCase()
    );

    if (existingById) {
      const updatedMember: Member = {
        ...existingById,
        schoolId: cleanSchoolId,
        name: cleanName || existingById.name,
        grade,
        skillLevel,
        paddleNotes:
          paddleNotes !== undefined ? paddleNotes : existingById.paddleNotes,
        photoUrl: photoUrl || existingById.photoUrl,
      };
      setData((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === existingById.id ? updatedMember : m
        ),
      }));
      handleSelectLinkedMember(updatedMember.id);
      showToast(`Account updated & signed in as ${updatedMember.name}!`);
      return updatedMember;
    }

    // Or if a member with the exact same name exists without a School ID yet, link their School ID
    const existingByName = data.members.find(
      (m) => !m.schoolId && m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (existingByName) {
      const linkedMember: Member = {
        ...existingByName,
        schoolId: cleanSchoolId,
        grade,
        skillLevel,
        paddleNotes: paddleNotes || existingByName.paddleNotes,
        photoUrl: photoUrl || existingByName.photoUrl,
      };
      setData((prev) => ({
        ...prev,
        members: prev.members.map((m) =>
          m.id === existingByName.id ? linkedMember : m
        ),
      }));
      handleSelectLinkedMember(linkedMember.id);
      showToast(
        `Linked School ID ${cleanSchoolId} to ${linkedMember.name}'s account!`
      );
      return linkedMember;
    }

    // Create a brand-new Member record in the club database
    const newMember: Member = {
      id: `mem-${Date.now()}`,
      schoolId: cleanSchoolId,
      name: cleanName,
      grade,
      skillLevel,
      elo: 1200,
      monthStartElo: 1200,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
      duesPaid: false,
      duesAmount: data.settings.duesAmount,
      paddleNotes: paddleNotes || '',
      photoUrl: photoUrl || '',
      joinDate: new Date().toISOString().slice(0, 10),
    };

    setData((prev) => ({
      ...prev,
      members: [...prev.members, newMember],
    }));

    setLinkedMemberId(newMember.id);
    try {
      localStorage.setItem(LINKED_MEMBER_KEY, newMember.id);
    } catch {
      // Ignore storage quota errors
    }

    showToast(
      `Welcome ${newMember.name}! Added to database (ID: ${cleanSchoolId}).`
    );
    return newMember;
  };

  const handleSignOutMember = () => {
    setLinkedMemberId('');
    try {
      localStorage.removeItem(LINKED_MEMBER_KEY);
    } catch {
      // Ignore storage errors
    }
    showToast('Signed out of member account');
  };

  const handleOfficerSignIn = (pin: string): boolean => {
    if (pin === data.settings.officerPin) {
      setIsOfficer(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      if (activeTab === 'activity') {
        setActiveTab('home');
      }
      showToast('Officer Mode unlocked (Full Edit Access)');
      return true;
    }
    return false;
  };

  // Handle Officer PIN Verification (NO HINTS)
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === data.settings.officerPin) {
      setIsOfficer(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      if (pendingOfficerTab) {
        setActiveTab(pendingOfficerTab);
        setPendingOfficerTab(null);
      } else if (activeTab === 'activity') {
        setActiveTab('home');
      }
      showToast('Officer Mode unlocked (Full Edit Access)');
    } else {
      setPinError('Invalid access code.');
    }
  };

  const handleToggleMode = () => {
    if (isOfficer) {
      setIsOfficer(false);
      if (!MEMBER_ALLOWED_TABS.includes(activeTab)) {
        setActiveTab('home');
      }
      showToast('Switched to Member Mode');
    } else {
      setPendingOfficerTab(null);
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
    }
  };

  const handleSaveCompletedMatch = (newMatch: MatchRecord) => {
    if (!isOfficer) {
      setShowPinModal(true);
      return;
    }
    const updatedMembers = applyMatchToMembers(
      data.members,
      newMatch.team1Ids,
      newMatch.team2Ids,
      newMatch.games,
      newMatch.winnerTeam,
      newMatch.eloDelta
    );

    let updatedClubTournaments = data.clubTournaments;
    if (newMatch.tournamentId && newMatch.tournamentMatchId) {
      const lastGame = newMatch.games[newMatch.games.length - 1] || {
        team1Score: 11,
        team2Score: 0,
      };
      updatedClubTournaments = data.clubTournaments.map((t) => {
        if (t.id !== newMatch.tournamentId) return t;
        const nextMatches = updateTournamentMatchList(
          t.matches,
          newMatch.tournamentMatchId!,
          lastGame.team1Score,
          lastGame.team2Score
        );
        return {
          ...t,
          matches: nextMatches,
          status: nextMatches.every((m) => m.winner !== null)
            ? 'Completed'
            : 'Active',
        };
      });
    }

    setData((prev) => ({
      ...prev,
      members: updatedMembers,
      matches: [newMatch, ...prev.matches],
      clubTournaments: updatedClubTournaments,
    }));
    showToast('Match saved! Club Ladder & Elo ratings updated.');
  };

  const handleDeleteMatch = (matchId: string) => {
    if (!isOfficer) return;
    setData((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.id !== matchId),
    }));
    showToast('Match removed from history.');
  };

  const handleExportJSON = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bnhs-pickleball-hq-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Club JSON backup exported!');
  };

  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || ''));
        if (
          parsed &&
          Array.isArray(parsed.members) &&
          Array.isArray(parsed.officers) &&
          parsed.settings
        ) {
          setData(sanitizeAndStripTemplateData(parsed));
          showToast('Club data successfully restored from JSON backup!');
        } else {
          showToast('Invalid JSON backup file format.');
        }
      } catch {
        showToast('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetAndArchiveSeason = (seasonLabel: string) => {
    const top3 = [...data.members]
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 3)
      .map((m) => ({
        name: m.name,
        elo: m.elo,
        wins: m.wins,
        losses: m.losses,
      }));

    const archiveEntry: SeasonArchive = {
      id: `arch-${Date.now()}`,
      seasonName: seasonLabel.trim() || 'Archived Season',
      startDate: data.settings.seasonStartDate,
      endDate: new Date().toISOString().slice(0, 10),
      totalMatches: data.matches.length,
      topPlayers: top3,
    };

    const resetMembers = data.members.map((m) => ({
      ...m,
      elo: 1200,
      monthStartElo: 1200,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
    }));

    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        seasonStartDate: new Date().toISOString().slice(0, 10),
      },
      members: resetMembers,
      matches: [],
      archives: [archiveEntry, ...prev.archives],
    }));

    showToast(`Season archived as "${archiveEntry.seasonName}" & stats reset!`);
  };

  const allNavItems: {
    id: NavTab;
    label: string;
    access: 'member' | 'officer';
    icon: React.ReactNode;
  }[] = [
    {
      id: 'home',
      label: 'Home Overview',
      access: 'member',
      icon: <Home className="w-4 h-4" />,
    },
    {
      id: 'ladder',
      label: 'Ladder & Stats',
      access: 'member',
      icon: <Award className="w-4 h-4" />,
    },
    {
      id: 'tournaments',
      label: 'Club Tournaments',
      access: 'member',
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: 'watch',
      label: 'Tournament Watch',
      access: 'member',
      icon: <Eye className="w-4 h-4" />,
    },
    {
      id: 'calendar',
      label: 'Calendar & Events',
      access: 'member',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'scorekeeper',
      label: 'Live Score Keeper',
      access: 'member',
      icon: <Play className="w-4 h-4" />,
    },
    {
      id: 'members',
      label: 'Members & Attendance',
      access: 'officer',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'officers',
      label: 'Officers & Tasks',
      access: 'officer',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'treasury',
      label: 'Treasury & Dues',
      access: 'officer',
      icon: <Wallet className="w-4 h-4" />,
    },
    {
      id: 'equipment',
      label: 'Equipment Locker',
      access: 'officer',
      icon: <Package className="w-4 h-4" />,
    },
    {
      id: 'settings',
      label: 'Settings & Backup',
      access: 'officer',
      icon: <Settings className="w-4 h-4" />,
    },
  ];

  const memberNavItems = allNavItems.filter((i) => i.access === 'member');
  const officerNavItems = allNavItems.filter((i) => i.access === 'officer');

  const activeNavItem =
    allNavItems.find((i) => i.id === activeTab) || allNavItems[0];

  // If Welcome Screen is active, render the animated full-screen Welcome Hub
  if (showWelcomeScreen) {
    return (
      <WelcomeScreen
        data={data}
        darkMode={darkMode}
        linkedMemberId={linkedMemberId}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        onEnterAsMember={(targetTab) => {
          setActiveTab(
            MEMBER_ALLOWED_TABS.includes(targetTab) ? targetTab : 'home'
          );
          setShowWelcomeScreen(false);
        }}
        onEnterAsOfficer={(pin, targetTab) => {
          if (pin === data.settings.officerPin) {
            setIsOfficer(true);
            setActiveTab(targetTab);
            setShowWelcomeScreen(false);
            showToast('Officer Mode unlocked (Full Edit Access)');
            return true;
          }
          return false;
        }}
        onSignInBySchoolId={handleSignInBySchoolId}
        onRegisterMember={handleRegisterMember}
        onSignOutMember={handleSignOutMember}
      />
    );
  }

  return (
    <>
      {!isOfficer ? (
        /* =============================================================== */
        /* VIEW 1: DEDICATED CLEAN, LIMITED MEMBER PORTAL                  */
        /* =============================================================== */
        <MemberPortalView
          data={data}
          activeTab={activeTab}
          darkMode={darkMode}
          linkedMemberId={linkedMemberId}
          onSelectLinkedMember={handleSelectLinkedMember}
          onSignInBySchoolId={handleSignInBySchoolId}
          onRegisterMember={handleRegisterMember}
          onSignOutMember={handleSignOutMember}
          onOfficerSignIn={handleOfficerSignIn}
          onNavigate={handleNavigate}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onRequestOfficerLogin={() => {
            setPendingOfficerTab(null);
            setPinInput('');
            setPinError('');
            setShowPinModal(true);
          }}
          onShowWelcomeScreen={() => setShowWelcomeScreen(true)}
        />
      ) : (
        /* =============================================================== */
        /* VIEW 2: FULL-FEATURED OFFICER EXECUTIVE COMMAND CONSOLE         */
        /* =============================================================== */
        <div className="min-h-[100dvh] bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-24 lg:pb-0 overflow-x-hidden touch-scroll transition-colors duration-300">
          {/* Officer Command Header */}
          <header className="sticky top-0 z-30 h-16 bg-slate-900 text-white border-b border-slate-800 px-4 sm:px-6 no-print">
            <div className="max-w-[1440px] w-full h-full mx-auto flex items-center justify-between gap-4">
              {/* Zone 1: Bobcats Emblem + Officer Console Brand */}
              <button
                type="button"
                onClick={() => handleNavigate('home')}
                className="flex items-center gap-3 text-left cursor-pointer shrink-0"
              >
                <div className="bg-white px-2 py-1 rounded-xl border border-white/20 flex items-center justify-center">
                  <img
                    src={BOBCATS_LOGO_URL}
                    alt="Byron Nelson Bobcats"
                    className="h-6 sm:h-7 w-auto object-contain"
                  />
                </div>
                <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0">
                  {data.settings.clubName} · Officer Console
                </span>
              </button>

              {/* Zone 2: Unified "Everything" Dropdown Menu with Bobcats Logo */}
              <div className="relative">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs sm:text-sm font-bold text-white inline-flex items-center gap-2.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <span className="text-amber-400">{activeNavItem.icon}</span>
                  <span>{activeNavItem.label}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
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
                        initial={{ opacity: 0, y: -10, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -8, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: SMOOTH_EASE }}
                        className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-16 sm:top-auto sm:mt-2.5 w-auto sm:w-96 max-w-md z-40 rounded-3xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 shadow-2xl p-3.5 space-y-3 max-h-[82vh] overflow-y-auto touch-scroll"
                      >
                        <div className="p-3 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="bg-white px-2.5 py-1.5 rounded-xl shrink-0">
                              <img
                                src={BOBCATS_LOGO_URL}
                                alt="Byron Nelson Bobcats"
                                className="h-6 w-auto object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-white truncate">
                                {data.settings.clubName}
                              </div>
                              <div className="text-[11px] text-amber-400 truncate">
                                Officer Console · All Modules Unlocked
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <div className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-slate-400">
                            Match & Competition Ops
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {memberNavItems.map((item) => {
                              const isSelected = activeTab === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleNavigate(item.id)}
                                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-blue-600 text-white'
                                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  {item.icon}
                                  <span className="truncate">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-amber-500">
                            Officer Administration
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {officerNavItems.map((item) => {
                              const isSelected = activeTab === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleNavigate(item.id)}
                                  className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  {item.icon}
                                  <span className="truncate">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                          <button
                            type="button"
                            onClick={() => setDarkMode(!darkMode)}
                            className="w-full px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {darkMode ? (
                              <>
                                <Sun className="w-3.5 h-3.5 text-amber-400" />
                                <span>Light Theme</span>
                              </>
                            ) : (
                              <>
                                <Moon className="w-3.5 h-3.5" />
                                <span>Dark Theme</span>
                              </>
                            )}
                          </button>

                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                handleExportJSON();
                              }}
                              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Export JSON</span>
                            </button>

                            <label className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer">
                              <Upload className="w-3.5 h-3.5" />
                              <span>Import JSON</span>
                              <input
                                type="file"
                                accept=".json,application/json"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    setMenuOpen(false);
                                    handleImportJSON(file);
                                  }
                                }}
                                className="hidden"
                              />
                            </label>
                          </div>

                          <div className="flex items-center justify-between pt-1 px-1 text-xs">
                            <button
                              type="button"
                              onClick={() => {
                                setMenuOpen(false);
                                setShowWelcomeScreen(true);
                              }}
                              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Welcome Screen</span>
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Zone 3: Officer Mode Switch */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleToggleMode}
                  className="min-h-[38px] px-3.5 py-1.5 text-xs font-bold rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Unlock className="w-3.5 h-3.5" />
                  <span>Exit Officer Mode</span>
                </button>
              </div>
            </div>
          </header>

          {/* Officer Executive Workspace: Left Command Sidebar + Main Viewport */}
          <div className="flex-1 max-w-[1440px] w-full mx-auto flex">
            {/* Desktop Command Sidebar */}
            <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 no-print">
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-slate-400">
                    Competition & Live Ops
                  </div>
                  {memberNavItems.map((item) => {
                    const isSelected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className={
                              isSelected
                                ? 'text-amber-400 dark:text-blue-600'
                                : 'text-slate-400'
                            }
                          >
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-amber-500">
                    Club Administration
                  </div>
                  {officerNavItems.map((item) => {
                    const isSelected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`w-full px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span className="flex items-center gap-2.5">
                          <span
                            className={
                              isSelected
                                ? 'text-amber-400 dark:text-blue-600'
                                : 'text-amber-500'
                            }
                          >
                            {item.icon}
                          </span>
                          <span>{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1 cursor-pointer hover:bg-slate-200"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Export</span>
                  </button>
                  <label className="py-2 px-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-[11px] font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1 cursor-pointer hover:bg-slate-200">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportJSON(file);
                      }}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </aside>

            {/* Officer Main Content Viewport */}
            <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 sm:py-8 space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: SMOOTH_EASE }}
                >
                  {activeTab === 'home' && (
                    <HomeDashboard
                      data={data}
                      isOfficer={true}
                      onNavigate={handleNavigate}
                    />
                  )}

                  {activeTab === 'scorekeeper' && (
                    <LiveScoreKeeper
                      members={data.members}
                      attendance={data.attendance}
                      initialScoreMode={scoreModePreference}
                      isOfficer={true}
                      pendingTournamentMatch={pendingTournamentMatch}
                      onClearPendingTournamentMatch={() =>
                        setPendingTournamentMatch(null)
                      }
                      onSaveCompletedMatch={handleSaveCompletedMatch}
                      onNavigateToLadder={() => handleNavigate('ladder')}
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                    />
                  )}

                  {activeTab === 'ladder' && (
                    <LadderStatsView
                      members={data.members}
                      matches={data.matches}
                      isOfficer={true}
                      onSaveManualMatch={handleSaveCompletedMatch}
                      onDeleteMatch={handleDeleteMatch}
                      onNavigate={handleNavigate}
                    />
                  )}

                  {(activeTab === 'tournaments' || activeTab === 'watch') && (
                    <TournamentsView
                      activeSubTab={activeTab}
                      onSwitchSubTab={(sub: NavTab) => handleNavigate(sub)}
                      clubTournaments={data.clubTournaments}
                      outsideTournaments={data.outsideTournaments}
                      members={data.members}
                      isOfficer={true}
                      onUpdateClubTournaments={(clubTournaments) =>
                        setData((prev) => ({ ...prev, clubTournaments }))
                      }
                      onUpdateOutsideTournaments={(outsideTournaments) =>
                        setData((prev) => ({ ...prev, outsideTournaments }))
                      }
                      onLaunchScoreKeeperForTournament={(ctx) => {
                        setPendingTournamentMatch(ctx);
                        setActiveTab('scorekeeper');
                      }}
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                    />
                  )}

                  {activeTab === 'calendar' && (
                    <CalendarEventsView
                      events={data.events}
                      settings={data.settings}
                      isOfficer={true}
                      onUpdateEvents={(events) =>
                        setData((prev) => ({ ...prev, events }))
                      }
                      onUpdateSettings={(settings) =>
                        setData((prev) => ({ ...prev, settings }))
                      }
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                    />
                  )}

                  {activeTab === 'members' && (
                    <MembersAttendanceView
                      members={data.members}
                      attendance={data.attendance}
                      isOfficer={true}
                      onUpdateMembers={(members) =>
                        setData((prev) => ({ ...prev, members }))
                      }
                      onUpdateAttendance={(attendance) =>
                        setData((prev) => ({ ...prev, attendance }))
                      }
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                      onNavigateToMultiCourt={() => {
                        setScoreModePreference('multicourt');
                        setActiveTab('scorekeeper');
                      }}
                    />
                  )}

                  {activeTab === 'officers' && (
                    <OfficersTasksView
                      officers={data.officers}
                      tasks={data.tasks}
                      isOfficer={true}
                      onUpdateOfficers={(officers) =>
                        setData((prev) => ({ ...prev, officers }))
                      }
                      onUpdateTasks={(tasks) =>
                        setData((prev) => ({ ...prev, tasks }))
                      }
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                    />
                  )}

                  {activeTab === 'treasury' && (
                    <TreasuryView
                      members={data.members}
                      transactions={data.transactions}
                      defaultDuesAmount={data.settings.duesAmount}
                      isOfficer={true}
                      onUpdateMembers={(members) =>
                        setData((prev) => ({ ...prev, members }))
                      }
                      onUpdateTransactions={(transactions) =>
                        setData((prev) => ({ ...prev, transactions }))
                      }
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                    />
                  )}

                  {activeTab === 'equipment' && (
                    <EquipmentView
                      equipment={data.equipment}
                      members={data.members}
                      isOfficer={true}
                      onUpdateEquipment={(equipment) =>
                        setData((prev) => ({ ...prev, equipment }))
                      }
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                    />
                  )}

                  {activeTab === 'settings' && (
                    <SettingsView
                      settings={data.settings}
                      archives={data.archives}
                      isOfficer={true}
                      onUpdateSettings={(settings) =>
                        setData((prev) => ({ ...prev, settings }))
                      }
                      onResetAndArchiveSeason={handleResetAndArchiveSeason}
                      onExportJSON={handleExportJSON}
                      onImportJSON={handleImportJSON}
                      onResetFactoryData={() => {
                        setData(INITIAL_CLUB_DATA);
                        showToast('Cleared all club data to start fresh!');
                      }}
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>

          {/* Officer Mobile Thumb-Friendly Bottom Navigation Dock */}
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900/95 text-white backdrop-blur-xl border-t border-slate-800 px-1 pt-1.5 pb-safe grid grid-cols-6 gap-0.5 no-print shadow-2xl">
            {[
              { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
              { id: 'scorekeeper', label: 'Live Score', icon: <Play className="w-4 h-4" /> },
              { id: 'ladder', label: 'Stats', icon: <Award className="w-4 h-4" /> },
              { id: 'tournaments', label: 'Tourneys', icon: <Trophy className="w-4 h-4" /> },
              { id: 'members', label: 'Roster', icon: <Users className="w-4 h-4" /> },
              { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNavigate(tab.id as NavTab)}
                  className={`py-1.5 px-0.5 rounded-xl flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer min-h-[44px] ${
                    isActive
                      ? 'text-amber-400 bg-slate-800/90'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.icon}
                  <span className="truncate max-w-full text-[9px] leading-tight">
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ duration: 0.22, ease: SMOOTH_EASE }}
            className="fixed bottom-5 right-5 z-50 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 text-xs font-semibold flex items-center gap-3 shadow-xl border border-slate-800/40"
          >
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ================================================================= */}
      {/* OFFICER 4-DIGIT PIN UNLOCK MODAL (ZERO HINTS)                     */}
      {/* ================================================================= */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ duration: 0.24, ease: SMOOTH_EASE }}
              className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  Officer Sign In
                </h3>
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setPendingOfficerTab(null);
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Enter your 4-digit Officer access code to unlock administrative
                controls.
              </p>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinError('');
                    setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                  }}
                  placeholder="••••"
                  className="w-full h-14 text-center font-mono-num text-3xl tracking-[0.5em] rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />

                {pinError && (
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {pinError}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPinModal(false);
                      setPendingOfficerTab(null);
                    }}
                    className="flex-1 min-h-[44px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[44px] rounded-xl text-xs font-bold text-white cursor-pointer"
                    style={{ backgroundColor: 'var(--club-primary)' }}
                  >
                    Sign In
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
