import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Award,
  Calendar,
  ChevronDown,
  Crown,
  Eye,
  Home,
  Megaphone,
  Moon,
  Play,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trophy,
  Users,
  Wallet,
  X,
} from 'lucide-react';
import {
  ClubDataState,
  ClubPoll,
  GradeLevel,
  LadderChallenge,
  MatchRecord,
  Member,
  NavTab,
  PendingTournamentScoreContext,
  ReactionKey,
  SeasonArchive,
  SkillLevel,
} from './types';
import {
  INITIAL_CLUB_DATA,
  sanitizeAndStripTemplateData,
} from './data/initialData';
import {
  applyMatchToMembers,
  calculateEloDelta,
  getClubText,
  getEffectiveMatchMode,
  globalReplaceTextInClubState,
  revertMatchFromMembers,
  updateTournamentMatchList,
} from './utils/clubUtils';
import {
  User,
  auth,
  ensureUserProfileInFirestore,
  loadGlobalClubWorkspaceFromFirestore,
  mergeClubDataStates,
  onAuthStateChanged,
  saveGlobalClubWorkspaceToFirestore,
  subscribeGlobalClubWorkspace,
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
  AnnouncementsView,
  SettingsView,
  TreasuryView,
} from './components/ManagementViews';
import { PresidentAdminView } from './components/PresidentAdminView';
import { WelcomeScreen } from './components/WelcomeScreen';
import { MemberPortalView } from './components/MemberPortalView';
import { getVoterIdentityKey } from './components/ClubInteractivePulse';
import { ScrollProgressBar } from './components/MotionPrimitives';

const STORAGE_KEY = 'bnhs_pickleball_hq_fresh_v2';
const LEGACY_STORAGE_KEY = 'bnhs_pickleball_hq_v1';
const THEME_KEY = 'bnhs_pickleball_theme_v1';
const CLOUD_MIGRATED_KEY = 'bnhs_pickleball_cloud_migrated_v2';

const SMOOTH_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

const LINKED_MEMBER_KEY = 'bnhs_pickleball_linked_member_v1';

// Tabs accessible to Members (Clean, Limited View-Only Portal)
const MEMBER_ALLOWED_TABS: NavTab[] = [
  'home',
  'activity',
  'ladder',
  'tournaments',
  'calendar',
  'scorekeeper',
  'announcements',
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
  const [isPresident, setIsPresident] = useState<boolean>(false);

  // Universal Dropdown Menu state
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  // Firebase Auth & Global Firestore Sync state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [linkedMemberId, setLinkedMemberId] = useState<string>(() => {
    try {
      return localStorage.getItem(LINKED_MEMBER_KEY) || '';
    } catch {
      return '';
    }
  });
  const workspaceDocExistsRef = useRef<boolean>(false);
  const initialCloudLoadDoneRef = useRef<boolean>(false);
  const isApplyingRemoteSnapshotRef = useRef<boolean>(false);
  const lastSavedSerializedRef = useRef<string>('');
  const latestLocalDataRef = useRef<ClubDataState>(data);
  latestLocalDataRef.current = data;

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

  // President Live On-Screen Text Edit Mode
  const [liveTextEditMode, setLiveTextEditMode] = useState<boolean>(false);
  const [liveTextEditModal, setLiveTextEditModal] = useState<{
    originalText: string;
    replacementText: string;
  } | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Safe navigation helper that enforces Member vs Officer access
  const handleNavigate = (targetTab: NavTab) => {
    setMenuOpen(false);
    if (targetTab === 'admin' && !isPresident) {
      setPendingOfficerTab('admin');
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
      return;
    }
    if (!isOfficer && !MEMBER_ALLOWED_TABS.includes(targetTab)) {
      setPendingOfficerTab(targetTab);
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
      return;
    }
    setActiveTab(targetTab);
  };

  // Helper to immediately persist state to the shared cloud database across all devices
  const persistClubDataImmediately = async (nextState: ClubDataState) => {
    try {
      if (!initialCloudLoadDoneRef.current) {
        const { state: cloudState, exists } =
          await loadGlobalClubWorkspaceFromFirestore();
        if (exists && cloudState && cloudState.members && cloudState.settings) {
          const cleanedCloud = sanitizeAndStripTemplateData(cloudState);
          const merged = mergeClubDataStates(cleanedCloud, nextState);
          workspaceDocExistsRef.current = true;
          initialCloudLoadDoneRef.current = true;
          lastSavedSerializedRef.current = JSON.stringify(merged);
          isApplyingRemoteSnapshotRef.current = true;
          setData(merged);
          await saveGlobalClubWorkspaceToFirestore(merged, true);
          return;
        }
      }
      initialCloudLoadDoneRef.current = true;
      lastSavedSerializedRef.current = JSON.stringify(nextState);
      await saveGlobalClubWorkspaceToFirestore(
        nextState,
        workspaceDocExistsRef.current
      );
      workspaceDocExistsRef.current = true;
    } catch (err) {
      console.error('Failed to immediately persist club data to cloud:', err);
    }
  };

  // Authoritative President replacement (never re-merges deleted items back from cloud)
  const handleReplaceFullClubData = (
    nextState: ClubDataState,
    msg?: string
  ) => {
    latestLocalDataRef.current = nextState;
    initialCloudLoadDoneRef.current = true;
    lastSavedSerializedRef.current = JSON.stringify(nextState);
    setData(nextState);
    void (async () => {
      try {
        await saveGlobalClubWorkspaceToFirestore(
          nextState,
          workspaceDocExistsRef.current
        );
        workspaceDocExistsRef.current = true;
      } catch (err) {
        console.error('Failed to save President state update to cloud:', err);
      }
    })();
    if (msg) {
      showToast(msg);
    }
  };

  // Helper to pull fresh global roster/data on sign-in
  const refreshFromGlobalCloud = async () => {
    try {
      const { state: cloudState, exists } =
        await loadGlobalClubWorkspaceFromFirestore();
      if (exists && cloudState && cloudState.members && cloudState.settings) {
        const cleanedCloud = sanitizeAndStripTemplateData(cloudState);
        const nextData = initialCloudLoadDoneRef.current
          ? cleanedCloud
          : mergeClubDataStates(cleanedCloud, latestLocalDataRef.current);
        workspaceDocExistsRef.current = true;
        initialCloudLoadDoneRef.current = true;
        const nextStr = JSON.stringify(nextData);
        if (nextStr !== JSON.stringify(latestLocalDataRef.current)) {
          lastSavedSerializedRef.current = nextStr;
          isApplyingRemoteSnapshotRef.current = true;
          setData(nextData);
        }
      }
    } catch (err) {
      console.error('Failed to refresh global cloud workspace:', err);
    }
  };

  // Real-time Global Cloud Database sync across all devices (no Google Auth required)
  useEffect(() => {
    let isMounted = true;

    const unsubscribeGlobal = subscribeGlobalClubWorkspace(
      async (cloudData, exists) => {
        if (!isMounted) return;

        if (exists && cloudData && cloudData.members && cloudData.settings) {
          workspaceDocExistsRef.current = true;
          const cleanedCloud = sanitizeAndStripTemplateData(cloudData);

          let hasMigratedLocal = false;
          try {
            hasMigratedLocal =
              localStorage.getItem(CLOUD_MIGRATED_KEY) === 'true';
          } catch {
            hasMigratedLocal = false;
          }

          if (!initialCloudLoadDoneRef.current && !hasMigratedLocal) {
            // Merge any pre-existing local members/matches on this browser into the shared cloud DB
            const merged = mergeClubDataStates(
              cleanedCloud,
              latestLocalDataRef.current
            );
            initialCloudLoadDoneRef.current = true;
            try {
              localStorage.setItem(CLOUD_MIGRATED_KEY, 'true');
            } catch {
              // Ignore storage errors
            }
            const mergedStr = JSON.stringify(merged);
            const cloudStr = JSON.stringify(cleanedCloud);
            lastSavedSerializedRef.current = mergedStr;
            isApplyingRemoteSnapshotRef.current = true;
            setData(merged);

            if (mergedStr !== cloudStr) {
              try {
                await saveGlobalClubWorkspaceToFirestore(merged, true);
              } catch (err) {
                console.error('Failed to push merged local data to cloud:', err);
              }
            }
            return;
          }

          initialCloudLoadDoneRef.current = true;
          try {
            localStorage.setItem(CLOUD_MIGRATED_KEY, 'true');
          } catch {
            // Ignore storage errors
          }

          const incomingStr = JSON.stringify(cleanedCloud);
          const currentStr = JSON.stringify(latestLocalDataRef.current);
          lastSavedSerializedRef.current = incomingStr;

          if (incomingStr !== currentStr) {
            isApplyingRemoteSnapshotRef.current = true;
            setData(cleanedCloud);
          }
        } else if (!exists) {
          // Initialize the global cloud database from current local state
          workspaceDocExistsRef.current = false;
          initialCloudLoadDoneRef.current = true;
          try {
            localStorage.setItem(CLOUD_MIGRATED_KEY, 'true');
          } catch {
            // Ignore storage errors
          }
          try {
            const initialPayload = latestLocalDataRef.current;
            lastSavedSerializedRef.current = JSON.stringify(initialPayload);
            await saveGlobalClubWorkspaceToFirestore(initialPayload, false);
            workspaceDocExistsRef.current = true;
          } catch (err) {
            console.error('Failed to initialize global club workspace:', err);
          }
        }
      }
    );

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (!user) return;
      try {
        const profile = await ensureUserProfileInFirestore(
          user,
          linkedMemberId || ''
        );
        if (profile.linkedMemberId) {
          setLinkedMemberId(profile.linkedMemberId);
        }
      } catch (err) {
        console.error('Error syncing Firebase user profile:', err);
      }
    });

    return () => {
      isMounted = false;
      unsubscribeGlobal();
      unsubscribeAuth();
    };
  }, []);

  // Persist data to localStorage & sync to global Firestore database for all devices
  useEffect(() => {
    const serialized = JSON.stringify(data);
    try {
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // Ignore quota errors
    }

    if (isApplyingRemoteSnapshotRef.current) {
      isApplyingRemoteSnapshotRef.current = false;
      return;
    }

    if (!initialCloudLoadDoneRef.current) {
      return;
    }

    if (serialized === lastSavedSerializedRef.current) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        lastSavedSerializedRef.current = serialized;
        await saveGlobalClubWorkspaceToFirestore(
          data,
          workspaceDocExistsRef.current
        );
        workspaceDocExistsRef.current = true;
      } catch (err) {
        console.error('Failed to sync club workspace to Firestore:', err);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [data]);

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

  const linkVerifiedMemberSession = async (member: Member) => {
    setLinkedMemberId(member.id);
    try {
      localStorage.setItem(LINKED_MEMBER_KEY, member.id);
    } catch {
      // Ignore storage quota errors
    }
    if (currentUser) {
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
  };

  // Sign in an existing member strictly using their School ID
  const handleSignInBySchoolId = async (
    schoolId: string
  ): Promise<Member | null> => {
    const cleaned = schoolId.trim().toLowerCase();
    if (!cleaned) return null;

    const findMember = (list: Member[]) =>
      list.find(
        (m) =>
          Boolean(m.schoolId && m.schoolId.trim()) &&
          m.schoolId!.trim().toLowerCase() === cleaned
      ) || null;

    let found = findMember(latestLocalDataRef.current.members);

    if (!found) {
      try {
        const { state: cloudState, exists } =
          await loadGlobalClubWorkspaceFromFirestore();
        if (exists && cloudState && cloudState.members && cloudState.settings) {
          const cleanedCloud = sanitizeAndStripTemplateData(cloudState);
          const merged = mergeClubDataStates(
            cleanedCloud,
            latestLocalDataRef.current
          );
          workspaceDocExistsRef.current = true;
          initialCloudLoadDoneRef.current = true;
          lastSavedSerializedRef.current = JSON.stringify(merged);
          isApplyingRemoteSnapshotRef.current = true;
          setData(merged);
          found = findMember(merged.members);
        }
      } catch (err) {
        console.error('Error checking cloud roster on School ID sign-in:', err);
      }
    }

    if (found) {
      void linkVerifiedMemberSession(found);
      showToast(`Signed in as ${found.name}`);
    }
    return found;
  };

  // Let a new member add themselves directly into the club database with their School ID and photo
  // Never overwrites or hijacks an existing member account by name or duplicate School ID.
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
  }): Member | null => {
    const cleanSchoolId = schoolId.trim();
    const cleanName = name.trim();
    if (!cleanSchoolId || !cleanName) return null;
    const currentSnapshot = latestLocalDataRef.current;

    // Reject if a member with this School ID already exists (must sign in via School ID tab)
    const existingById = currentSnapshot.members.find(
      (m) =>
        m.schoolId &&
        m.schoolId.trim().toLowerCase() === cleanSchoolId.toLowerCase()
    );
    if (existingById) {
      showToast(
        'That School ID is already registered. Please sign in using your School ID.'
      );
      return null;
    }

    // Reject if a member with the exact same name already exists (prevents impersonating an existing player)
    const existingByName = currentSnapshot.members.find(
      (m) => m.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    if (existingByName) {
      showToast(
        `${existingByName.name} is already on the roster. Please sign in using your School ID.`
      );
      return null;
    }

    if (currentSnapshot.settings.registrationLocked && !isOfficer) {
      showToast('New member registration is currently locked by Club Officers.');
      return null;
    }

    // Create a brand-new Member record in the club database
    const newMember: Member = {
      id: `mem-${Date.now()}`,
      schoolId: cleanSchoolId,
      name: cleanName,
      grade,
      skillLevel,
      elo: 0,
      monthStartElo: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
      duesPaid: false,
      duesAmount: currentSnapshot.settings.duesAmount,
      paddleNotes: paddleNotes || '',
      photoUrl: photoUrl || '',
      joinDate: new Date().toISOString().slice(0, 10),
    };

    const nextState: ClubDataState = {
      ...currentSnapshot,
      members: [...currentSnapshot.members, newMember],
    };

    setData(nextState);
    void persistClubDataImmediately(nextState);
    void linkVerifiedMemberSession(newMember);

    showToast(`Welcome ${newMember.name}! Added to club roster.`);
    return newMember;
  };

  const handleSignOutMember = () => {
    setLinkedMemberId('');
    try {
      localStorage.removeItem(LINKED_MEMBER_KEY);
    } catch {
      // Ignore storage errors
    }
    if (!isOfficer) {
      setShowWelcomeScreen(true);
    }
    showToast('Signed out of member account');
  };

  const handleOfficerSignIn = (pin: string): boolean => {
    const entered = pin.trim();
    const presPass = (data.settings.presidentPassword || '8855').trim();
    const isPres = entered === presPass;
    const isOff = entered === data.settings.officerPin || isPres;

    if (isOff) {
      setIsOfficer(true);
      setIsPresident(isPres);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      void refreshFromGlobalCloud();
      if (activeTab === 'activity') {
        setActiveTab(isPres ? 'admin' : 'home');
      }
      showToast(
        isPres
          ? 'President Administration unlocked (Highest Authority)'
          : 'Officer Mode unlocked (Full Edit Access)'
      );
      return true;
    }
    return false;
  };

  // Handle Officer PIN Verification (NO HINTS)
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = pinInput.trim();
    const presPass = (data.settings.presidentPassword || '8855').trim();
    const isPres = entered === presPass;
    const isOff = entered === data.settings.officerPin || isPres;

    if (isOff) {
      setIsOfficer(true);
      setIsPresident(isPres);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      void refreshFromGlobalCloud();
      if (pendingOfficerTab) {
        setActiveTab(pendingOfficerTab);
        setPendingOfficerTab(null);
      } else if (activeTab === 'activity') {
        setActiveTab(isPres ? 'admin' : 'home');
      }
      showToast(
        isPres
          ? 'President Administration unlocked (Highest Authority)'
          : 'Officer Mode unlocked (Full Edit Access)'
      );
    } else {
      setPinError('Invalid access code.');
    }
  };

  const handleToggleMode = () => {
    if (isOfficer) {
      setIsOfficer(false);
      setIsPresident(false);
      setLiveTextEditMode(false);
      const hasValidMember = data.members.some(
        (m) =>
          Boolean(m.schoolId && m.schoolId.trim()) &&
          (m.id === linkedMemberId ||
            m.schoolId!.trim().toLowerCase() ===
              linkedMemberId.trim().toLowerCase())
      );
      if (!hasValidMember) {
        setShowWelcomeScreen(true);
      } else if (!MEMBER_ALLOWED_TABS.includes(activeTab)) {
        setActiveTab('home');
      }
      showToast(
        hasValidMember ? 'Switched to Member Mode' : 'Exited Officer Mode'
      );
    } else {
      setPendingOfficerTab(null);
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
    }
  };

  const removeMatchAndRevertStats = (matchId: string) => {
    const currentSnapshot = latestLocalDataRef.current;
    const match = currentSnapshot.matches.find((m) => m.id === matchId);
    if (!match) return;

    const remainingMatches = currentSnapshot.matches.filter(
      (m) => m.id !== matchId
    );
    const revertedMembers = revertMatchFromMembers(
      currentSnapshot.members,
      match,
      remainingMatches
    );

    const updatedChallenges = (currentSnapshot.challenges || []).map((c) =>
      c.completedMatchId === matchId
        ? {
            ...c,
            status: 'accepted' as const,
            completedMatchId: undefined,
            winnerMemberId: undefined,
            scoreSummary: undefined,
          }
        : c
    );

    const nextState: ClubDataState = {
      ...currentSnapshot,
      members: revertedMembers,
      matches: remainingMatches,
      challenges: updatedChallenges,
    };

    setData(nextState);
    void persistClubDataImmediately(nextState);
    const mode = getEffectiveMatchMode(match);
    showToast(
      mode === 'practice_history'
        ? 'Practice match removed from history.'
        : mode === 'friendly_wl'
        ? 'Friendly match removed & W/L record reverted.'
        : 'Match removed & player Elo, W/L, and points reverted.'
    );
  };

  const handleVoidMatch = (matchId: string) => {
    removeMatchAndRevertStats(matchId);
  };

  const handleResetAllElo = () => {
    const nextState: ClubDataState = {
      ...latestLocalDataRef.current,
      members: latestLocalDataRef.current.members.map((m) => ({
        ...m,
        elo: 0,
        monthStartElo: 0,
      })),
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
    showToast('All member Elo ratings reset to 0.');
  };

  const handleSaveCompletedMatch = (newMatch: MatchRecord) => {
    if (!isOfficer) {
      setShowPinModal(true);
      return;
    }
    const currentSnapshot = latestLocalDataRef.current;
    const mode = getEffectiveMatchMode(newMatch);
    const updatedMembers = applyMatchToMembers(
      currentSnapshot.members,
      newMatch.team1Ids,
      newMatch.team2Ids,
      newMatch.games,
      newMatch.winnerTeam,
      newMatch.eloDelta,
      mode
    );

    let updatedClubTournaments = currentSnapshot.clubTournaments;
    if (newMatch.tournamentId && newMatch.tournamentMatchId) {
      const lastGame = newMatch.games[newMatch.games.length - 1] || {
        team1Score: 11,
        team2Score: 0,
      };
      updatedClubTournaments = currentSnapshot.clubTournaments.map((t) => {
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

    const nextState: ClubDataState = {
      ...currentSnapshot,
      members: updatedMembers,
      matches: [newMatch, ...currentSnapshot.matches],
      clubTournaments: updatedClubTournaments,
    };

    setData(nextState);
    void persistClubDataImmediately(nextState);

    if (mode === 'practice_history') {
      showToast('Practice match logged to Match History (No Elo or W/L change).');
    } else if (mode === 'friendly_wl') {
      showToast('Friendly match saved! W/L & Points updated (0 Elo change).');
    } else {
      showToast('Match saved! Club Ladder & Elo ratings updated.');
    }
  };

  const handleDeleteMatch = (matchId: string) => {
    if (!isOfficer) return;
    removeMatchAndRevertStats(matchId);
  };

  const handleUpdateSingleMember = (updatedMember: Member) => {
    if (!isOfficer) return;
    const currentSnapshot = latestLocalDataRef.current;
    const nextState: ClubDataState = {
      ...currentSnapshot,
      members: currentSnapshot.members.map((m) =>
        m.id === updatedMember.id ? updatedMember : m
      ),
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
    showToast(`Updated stats & badges for ${updatedMember.name}.`);
  };

  const handleCreateChallenge = ({
    challengerId,
    opponentId,
    format,
    targetScore,
    message,
  }: {
    challengerId: string;
    opponentId: string;
    format: 'singles' | 'doubles';
    targetScore: 11 | 15 | 21;
    message: string;
  }) => {
    const newChallenge: LadderChallenge = {
      id: `chal-${Date.now()}`,
      challengerId,
      opponentId,
      format,
      targetScore,
      message,
      createdAt: new Date().toISOString().slice(0, 10),
      status: 'open',
    };
    const nextState: ClubDataState = {
      ...latestLocalDataRef.current,
      challenges: [
        newChallenge,
        ...(latestLocalDataRef.current.challenges || []),
      ],
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
    const oppName =
      latestLocalDataRef.current.members.find((m) => m.id === opponentId)
        ?.name || 'Rival';
    showToast(`Official challenge posted calling out ${oppName}!`);
  };

  const handleUpdateChallengeStatus = (
    challengeId: string,
    status: 'open' | 'accepted' | 'declined',
    remove = false
  ) => {
    const currentChallenges = latestLocalDataRef.current.challenges || [];
    const nextChallenges = remove
      ? currentChallenges.filter((c) => c.id !== challengeId)
      : currentChallenges.map((c) =>
          c.id === challengeId ? { ...c, status } : c
        );

    const nextState: ClubDataState = {
      ...latestLocalDataRef.current,
      challenges: nextChallenges,
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);

    if (remove) {
      showToast('Challenge withdrawn from board.');
    } else if (status === 'accepted') {
      showToast('Challenge accepted! Match is on deck.');
    } else if (status === 'declined') {
      showToast('Challenge declined.');
    }
  };

  const handleResolveChallengeMatch = (
    challengeId: string,
    challengerScore: number,
    opponentScore: number
  ) => {
    if (!isOfficer) return;
    if (challengerScore === opponentScore) {
      showToast('Pickleball matches cannot end in a tie.');
      return;
    }
    const currentSnapshot = latestLocalDataRef.current;
    const challenge = (currentSnapshot.challenges || []).find(
      (c) => c.id === challengeId
    );
    if (!challenge) return;

    const challenger = currentSnapshot.members.find(
      (m) => m.id === challenge.challengerId
    );
    const opponent = currentSnapshot.members.find(
      (m) => m.id === challenge.opponentId
    );
    const winnerTeam: 1 | 2 = challengerScore > opponentScore ? 1 : 2;
    const eloDelta = calculateEloDelta(
      [challenger?.elo ?? 0],
      [opponent?.elo ?? 0],
      winnerTeam
    );

    const matchRecord: MatchRecord = {
      id: `match-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      format: challenge.format,
      scoringType: 'sideout',
      targetScore: challenge.targetScore,
      bestOf: 1,
      team1Ids: [challenge.challengerId],
      team2Ids: [challenge.opponentId],
      games: [{ team1Score: challengerScore, team2Score: opponentScore }],
      winnerTeam,
      eloDelta,
    };

    const updatedMembers = applyMatchToMembers(
      currentSnapshot.members,
      matchRecord.team1Ids,
      matchRecord.team2Ids,
      matchRecord.games,
      matchRecord.winnerTeam,
      matchRecord.eloDelta
    );

    const winnerMember = winnerTeam === 1 ? challenger : opponent;
    const loserMember = winnerTeam === 1 ? opponent : challenger;
    const winningScore = Math.max(challengerScore, opponentScore);
    const losingScore = Math.min(challengerScore, opponentScore);
    const scoreSummary = `${
      winnerMember?.name || 'Winner'
    } def. ${loserMember?.name || 'Opponent'} ${winningScore}–${losingScore} (±${eloDelta} Elo)`;

    const updatedChallenges = (currentSnapshot.challenges || []).map((c) =>
      c.id === challengeId
        ? {
            ...c,
            status: 'completed' as const,
            completedMatchId: matchRecord.id,
            winnerMemberId: winnerMember?.id,
            scoreSummary,
          }
        : c
    );

    const nextState: ClubDataState = {
      ...currentSnapshot,
      members: updatedMembers,
      matches: [matchRecord, ...currentSnapshot.matches],
      challenges: updatedChallenges,
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
    showToast(`Challenge settled! ${scoreSummary}`);
  };

  // =========================================================================
  // INTERACTIVE CLUB PULSE HANDLERS: MVP VOTING, POLLS & ACTIVITY REACTIONS
  // =========================================================================
  const activeMemberObj =
    data.members.find(
      (m) =>
        Boolean(m.schoolId && m.schoolId.trim()) &&
        (m.id === linkedMemberId ||
          (linkedMemberId &&
            m.schoolId!.trim().toLowerCase() ===
              linkedMemberId.trim().toLowerCase()))
    ) || null;
  const voterKey = getVoterIdentityKey(activeMemberObj);

  const handleVoteMvp = (candidateId: string) => {
    const currentSnapshot = latestLocalDataRef.current;
    const currentVotes = { ...(currentSnapshot.mvpVotes || {}) };
    if (currentVotes[voterKey] === candidateId) {
      delete currentVotes[voterKey];
      showToast('Removed your Weekly MVP vote.');
    } else {
      currentVotes[voterKey] = candidateId;
      const candName =
        currentSnapshot.members.find((m) => m.id === candidateId)?.name ||
        'Athlete';
      showToast(`Voted ${candName} for Athlete of the Week!`);
    }
    const nextState: ClubDataState = {
      ...currentSnapshot,
      mvpVotes: currentVotes,
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
  };

  const handleResetMvpVotes = () => {
    if (!isOfficer) return;
    const nextState: ClubDataState = {
      ...latestLocalDataRef.current,
      mvpVotes: {},
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
    showToast('Weekly MVP ballot reset for the new week.');
  };

  const handleVotePoll = (pollId: string, optionId: string) => {
    const currentSnapshot = latestLocalDataRef.current;
    const nextPolls = (currentSnapshot.polls || []).map((poll) => {
      if (poll.id !== pollId) return poll;
      const alreadyVotedThisOption = poll.options.some(
        (opt) => opt.id === optionId && (opt.voterIds || []).includes(voterKey)
      );
      const nextOptions = poll.options.map((opt) => {
        const filtered = (opt.voterIds || []).filter((v) => v !== voterKey);
        if (opt.id === optionId && !alreadyVotedThisOption) {
          return { ...opt, voterIds: [...filtered, voterKey] };
        }
        return { ...opt, voterIds: filtered };
      });
      return { ...poll, options: nextOptions };
    });
    const nextState: ClubDataState = {
      ...currentSnapshot,
      polls: nextPolls,
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
  };

  const handleCreatePoll = (question: string, optionLabels: string[]) => {
    if (!isOfficer) return;
    const newPoll: ClubPoll = {
      id: `poll-${Date.now()}`,
      question,
      options: optionLabels.map((label, idx) => ({
        id: `opt-${Date.now()}-${idx}`,
        label,
        voterIds: [],
      })),
      createdAt: new Date().toISOString().slice(0, 10),
      isActive: true,
    };
    const currentSnapshot = latestLocalDataRef.current;
    const nextState: ClubDataState = {
      ...currentSnapshot,
      polls: [newPoll, ...(currentSnapshot.polls || [])],
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
    showToast('New interactive club poll published!');
  };

  const handleDeletePoll = (pollId: string) => {
    if (!isOfficer) return;
    const currentSnapshot = latestLocalDataRef.current;
    const nextState: ClubDataState = {
      ...currentSnapshot,
      polls: (currentSnapshot.polls || []).filter((p) => p.id !== pollId),
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
    showToast('Poll removed.');
  };

  const handleToggleReaction = (feedItemId: string, reaction: ReactionKey) => {
    const currentSnapshot = latestLocalDataRef.current;
    const currentReactions = { ...(currentSnapshot.activityReactions || {}) };
    const existingEntry = currentReactions[feedItemId] || {
      fire: [],
      clutch: [],
      upset: [],
      goat: [],
    };
    const currentList = [...(existingEntry[reaction] || [])];
    const hasReacted = currentList.includes(voterKey);
    const nextList = hasReacted
      ? currentList.filter((v) => v !== voterKey)
      : [...currentList, voterKey];

    currentReactions[feedItemId] = {
      ...existingEntry,
      [reaction]: nextList,
    };

    const nextState: ClubDataState = {
      ...currentSnapshot,
      activityReactions: currentReactions,
    };
    setData(nextState);
    void persistClubDataImmediately(nextState);
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
      elo: 0,
      monthStartElo: 0,
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
      id: 'calendar',
      label: 'Calendar & Events',
      access: 'member',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'announcements',
      label: 'Announcements',
      access: 'member',
      icon: <Megaphone className="w-4 h-4" />,
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
      id: 'admin',
      label: 'President Admin',
      access: 'officer',
      icon: <Crown className="w-4 h-4 text-amber-500" />,
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

  const isAuthenticated = Boolean(activeMemberObj) || isOfficer;

  // Render the Welcome Hub whenever showWelcomeScreen is active OR no member/officer is signed in
  if (showWelcomeScreen || !isAuthenticated) {
    return (
      <>
        <ScrollProgressBar />
        <WelcomeScreen
          data={data}
          darkMode={darkMode}
          linkedMemberId={linkedMemberId}
          onToggleDarkMode={() => setDarkMode(!darkMode)}
          onEnterAsMember={(targetTab) => {
            void refreshFromGlobalCloud();
            setActiveTab(
              MEMBER_ALLOWED_TABS.includes(targetTab) ? targetTab : 'home'
            );
            setShowWelcomeScreen(false);
          }}
          onEnterAsOfficer={(pin, targetTab) => {
            const entered = pin.trim();
            const presPass = (data.settings.presidentPassword || '8855').trim();
            const isPres = entered === presPass;
            const isOff = entered === data.settings.officerPin || isPres;

            if (isOff) {
              void refreshFromGlobalCloud();
              setIsOfficer(true);
              setIsPresident(isPres);
              setActiveTab(
                isPres && targetTab === 'home' ? 'admin' : targetTab
              );
              setShowWelcomeScreen(false);
              showToast(
                isPres
                  ? 'President Administration unlocked (Highest Authority)'
                  : 'Officer Mode unlocked (Full Edit Access)'
              );
              return true;
            }
            return false;
          }}
          onSignInBySchoolId={handleSignInBySchoolId}
          onRegisterMember={handleRegisterMember}
          onSignOutMember={handleSignOutMember}
        />
      </>
    );
  }

  return (
    <>
      <ScrollProgressBar />
      {!isOfficer ? (
        /* =============================================================== */
        /* VIEW 1: DEDICATED CLEAN, LIMITED MEMBER PORTAL                  */
        /* =============================================================== */
        <MemberPortalView
          data={data}
          activeTab={activeTab}
          darkMode={darkMode}
          linkedMemberId={linkedMemberId}
          onSignInBySchoolId={handleSignInBySchoolId}
          onRegisterMember={handleRegisterMember}
          onCreateChallenge={handleCreateChallenge}
          onUpdateChallengeStatus={handleUpdateChallengeStatus}
          onVoteMvp={handleVoteMvp}
          onVotePoll={handleVotePoll}
          onToggleReaction={handleToggleReaction}
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
        <div className="min-h-screen bg-paper dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col pb-24 lg:pb-12 transition-colors duration-200">
          {/* President Broadcast Notice Alert Banner if active */}
          {data.settings.broadcastNotice?.enabled && data.settings.broadcastNotice.text && (
            <aside
              role="alert"
              className={`sticky top-0 z-40 px-4 py-2 text-xs font-bold border-b ${
                data.settings.broadcastNotice.level === 'urgent'
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-blue-600 text-white border-blue-700'
              }`}
            >
              <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="uppercase tracking-wider text-[10px] px-1.5 py-0.5 rounded bg-black/20 shrink-0">
                    {data.settings.broadcastNotice.level === 'urgent' ? 'URGENT' : 'NOTICE'}
                  </span>
                  <span className="truncate">
                    {data.settings.broadcastNotice.text}
                  </span>
                </div>
                <span className="text-[10px] uppercase tracking-wider opacity-85 shrink-0 font-mono-num">
                  President Broadcast
                </span>
              </div>
            </aside>
          )}

          {/* Officer Command Header (No top-bar logo) */}
          <header className="sticky top-0 z-30 h-16 bg-paper/85 dark:bg-slate-950/80 backdrop-blur-xl text-slate-900 dark:text-white border-b border-[var(--hairline)] px-4 sm:px-6 no-print">
            <div className="max-w-[1440px] w-full h-full mx-auto flex items-center justify-between gap-2 sm:gap-4">
              {/* Zone 1: Officer Console Brand */}
              <button
                type="button"
                onClick={() => handleNavigate('home')}
                className="flex items-center gap-2.5 text-left cursor-pointer min-w-0"
              >
                <div className="min-w-0">
                  <div className="font-display text-sm sm:text-base font-semibold tracking-tight text-slate-900 dark:text-white truncate leading-tight">
                    {data.settings.clubName}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-tight">
                    {getClubText(
                      data.settings,
                      'officerConsoleSubtitle',
                      'Officer Console'
                    )}
                  </div>
                </div>
              </button>

              {/* Zone 2: Unified Dropdown Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-paper-deep/65 hover:bg-paper-deep dark:bg-slate-900 dark:hover:bg-slate-800 border border-[var(--hairline)] text-xs font-medium text-slate-900 dark:text-white inline-flex items-center gap-2 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                >
                  <span className="max-w-[120px] sm:max-w-none truncate">
                    {activeNavItem.label}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${
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
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.15 }}
                        className="fixed sm:absolute inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2 top-16 sm:top-auto sm:mt-2 w-auto sm:w-96 max-w-md z-40 rounded-2xl bg-paper dark:bg-slate-900 text-slate-900 dark:text-white border border-[var(--hairline)] shadow-[0_24px_60px_-20px_rgba(28,27,24,0.18)] p-4 space-y-3 max-h-[82vh] overflow-y-auto touch-scroll"
                      >
                        <div className="p-3.5 rounded-xl bg-paper-subtle dark:bg-slate-950 border border-[var(--hairline)] flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                              {data.settings.clubName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              Officer Console · All modules unlocked
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="px-2 py-0.5 text-[11px] font-mono-num uppercase tracking-wider text-slate-400">
                            Competition & live ops
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {memberNavItems.map((item) => {
                              const isSelected = activeTab === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleNavigate(item.id)}
                                  className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-slate-900 text-white dark:bg-court dark:text-slate-900'
                                      : 'text-slate-700 dark:text-slate-200 hover:bg-paper-deep/60 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <span className="truncate">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-2.5 border-t border-[var(--hairline)]">
                          <div className="px-2 py-0.5 text-[11px] font-mono-num uppercase tracking-wider text-slate-400">
                            Club administration
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {officerNavItems.map((item) => {
                              const isSelected = activeTab === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => handleNavigate(item.id)}
                                  className={`px-3 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-slate-900 text-white dark:bg-court dark:text-slate-900'
                                      : 'text-slate-700 dark:text-slate-300 hover:bg-paper-deep/60 dark:hover:bg-slate-800'
                                  }`}
                                >
                                  <span className="truncate">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="pt-2.5 border-t border-[var(--hairline)] space-y-2">
                          <button
                            type="button"
                            onClick={() => setDarkMode(!darkMode)}
                            className="w-full px-3 py-2 rounded-xl bg-paper-deep/60 hover:bg-paper-deep dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            {darkMode ? (
                              <>
                                <Sun className="w-3.5 h-3.5 text-amber-400" />
                                <span>Light theme</span>
                              </>
                            ) : (
                              <>
                                <Moon className="w-3.5 h-3.5" />
                                <span>Dark theme</span>
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
                              className="px-3 py-1.5 rounded-xl bg-paper-deep/60 hover:bg-paper-deep dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Export JSON</span>
                            </button>

                            <label className="px-3 py-1.5 rounded-xl bg-paper-deep/60 hover:bg-paper-deep dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer">
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
                              className="font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                            >
                              ← Welcome screen
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              {/* Zone 3: Officer Mode Switch & President Status */}
              <div className="flex items-center gap-2 shrink-0">
                {isPresident ? (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-court/60 dark:bg-court/15 text-slate-900 dark:text-court border border-court-deep/25 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    President admin
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPendingOfficerTab('admin');
                      setPinInput('');
                      setPinError('');
                      setShowPinModal(true);
                    }}
                    className="hidden sm:inline-flex items-center px-3.5 py-1.5 rounded-full bg-paper-deep/65 hover:bg-paper-deep dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-medium border border-[var(--hairline)] cursor-pointer transition-colors"
                  >
                    Unlock president
                  </button>
                )}
                <button
                  onClick={handleToggleMode}
                  className="min-h-[36px] px-3.5 py-1.5 text-xs font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 dark:bg-court dark:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Exit</span>
                  <span className="hidden sm:inline"> officer mode</span>
                </button>
              </div>
            </div>
          </header>

          {/* Officer Executive Workspace: Left Command Sidebar + Main Viewport */}
          <div className="flex-1 max-w-[1440px] w-full mx-auto flex">
            {/* Desktop Command Sidebar */}
            <aside className="hidden lg:flex w-60 shrink-0 flex-col justify-between border-r border-[var(--hairline)] bg-paper/60 dark:bg-slate-900/60 p-4 no-print">
              <div className="space-y-6">
                <div className="space-y-1">
                  <div className="px-3 py-1 text-[11px] font-mono-num uppercase tracking-wider text-slate-400">
                    Competition & live ops
                  </div>
                  {memberNavItems.map((item) => {
                    const isSelected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`relative w-full px-3.5 py-2 rounded-full text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-white dark:text-slate-900'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-paper-deep/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="officer-sidebar-active-pill"
                            transition={{
                              type: 'spring',
                              stiffness: 420,
                              damping: 34,
                            }}
                            className="absolute inset-0 rounded-full bg-slate-900 dark:bg-court -z-0"
                          />
                        )}
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1 pt-4 border-t border-[var(--hairline)]">
                  <div className="px-3 py-1 text-[11px] font-mono-num uppercase tracking-wider text-slate-400">
                    Club administration
                  </div>
                  {officerNavItems.map((item) => {
                    const isSelected = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleNavigate(item.id)}
                        className={`relative w-full px-3.5 py-2 rounded-full text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'text-white dark:text-slate-900'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-paper-deep/50 dark:hover:bg-slate-800'
                        }`}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId="officer-sidebar-active-pill"
                            transition={{
                              type: 'spring',
                              stiffness: 420,
                              damping: 34,
                            }}
                            className="absolute inset-0 rounded-full bg-slate-900 dark:bg-court -z-0"
                          />
                        )}
                        <span className="relative z-10">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-[var(--hairline)] space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={handleExportJSON}
                    className="py-2 px-2.5 rounded-full bg-paper-deep/60 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer hover:bg-paper-deep"
                  >
                    Export JSON
                  </button>
                  <label className="py-2 px-2.5 rounded-full bg-paper-deep/60 dark:bg-slate-800 text-[11px] font-medium text-slate-700 dark:text-slate-300 flex items-center justify-center cursor-pointer hover:bg-paper-deep">
                    <span>Import JSON</span>
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
            <main className="flex-1 min-w-0 px-3.5 sm:px-8 py-4 sm:py-8 space-y-4 sm:space-y-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: SMOOTH_EASE }}
                >
                  {activeTab === 'home' && (
                    <HomeDashboard
                      data={data}
                      activeMember={activeMemberObj}
                      isOfficer={true}
                      onVoteMvp={handleVoteMvp}
                      onResetMvpVotes={handleResetMvpVotes}
                      onVotePoll={handleVotePoll}
                      onCreatePoll={handleCreatePoll}
                      onDeletePoll={handleDeletePoll}
                      onToggleReaction={handleToggleReaction}
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
                      attendance={data.attendance}
                      challenges={data.challenges || []}
                      isOfficer={true}
                      onSaveManualMatch={handleSaveCompletedMatch}
                      onDeleteMatch={handleDeleteMatch}
                      onUpdateMember={handleUpdateSingleMember}
                      onCreateChallenge={handleCreateChallenge}
                      onUpdateChallengeStatus={handleUpdateChallengeStatus}
                      onResolveChallengeMatch={handleResolveChallengeMatch}
                      onNavigate={handleNavigate}
                    />
                  )}

                  {activeTab === 'tournaments' && (
                    <TournamentsView
                      clubTournaments={data.clubTournaments}
                      members={data.members}
                      activeMember={activeMemberObj}
                      isOfficer={true}
                      onUpdateClubTournaments={(clubTournaments) =>
                        setData((prev) => ({ ...prev, clubTournaments }))
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

                  {activeTab === 'announcements' && (
                    <AnnouncementsView
                      announcements={data.announcements}
                      officers={data.officers}
                      isOfficer={true}
                      onUpdateAnnouncements={(announcements) =>
                        setData((prev) => ({ ...prev, announcements }))
                      }
                      onRequestOfficerUnlock={() => setShowPinModal(true)}
                    />
                  )}

                  {activeTab === 'members' && (
                    <MembersAttendanceView
                      members={data.members}
                      attendance={data.attendance}
                      matches={data.matches}
                      challenges={data.challenges || []}
                      isOfficer={true}
                      onUpdateMembers={(members) => {
                        const nextState = {
                          ...latestLocalDataRef.current,
                          members,
                        };
                        setData(nextState);
                        void persistClubDataImmediately(nextState);
                        showToast('Member roster & stats saved.');
                      }}
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

                  {activeTab === 'admin' && (
                    <PresidentAdminView
                      data={data}
                      isPresident={isPresident}
                      liveTextEditMode={liveTextEditMode}
                      onToggleLiveTextEditMode={setLiveTextEditMode}
                      onReplaceFullClubData={handleReplaceFullClubData}
                      onUpdateSettings={(settings) =>
                        handleReplaceFullClubData({ ...data, settings })
                      }
                      onUpdateMembers={(members) =>
                        handleReplaceFullClubData({ ...data, members })
                      }
                      onUpdateOfficers={(officers) =>
                        handleReplaceFullClubData({ ...data, officers })
                      }
                      onUpdateMatches={(matches) =>
                        handleReplaceFullClubData({ ...data, matches })
                      }
                      onVoidMatch={handleVoidMatch}
                      onResetAllElo={handleResetAllElo}
                      onResetAllLiveCourts={() => {
                        setPendingTournamentMatch(null);
                        showToast('All court scoreboards reset.');
                      }}
                      onExportJSON={handleExportJSON}
                      onImportJSON={handleImportJSON}
                      onResetFactoryData={() => {
                        handleReplaceFullClubData(
                          INITIAL_CLUB_DATA,
                          'Cleared all club data to factory baseline!'
                        );
                      }}
                      onRequestPresidentUnlock={() => {
                        setPendingOfficerTab('admin');
                        setPinInput('');
                        setPinError('');
                        setShowPinModal(true);
                      }}
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

          {/* Officer Mobile Bottom Navigation Dock */}
          <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-slate-900 text-white border-t border-slate-800 px-1 pt-1.5 pb-safe grid grid-cols-6 gap-0.5 no-print">
            {[
              { id: 'home', label: 'Home', icon: <Home className="w-4 h-4" /> },
              { id: 'scorekeeper', label: 'Live Score', icon: <Play className="w-4 h-4" /> },
              { id: 'ladder', label: 'Stats', icon: <Award className="w-4 h-4" /> },
              { id: 'tournaments', label: 'Tourneys', icon: <Trophy className="w-4 h-4" /> },
              { id: 'members', label: 'Roster', icon: <Users className="w-4 h-4" /> },
              ...(isPresident
                ? [{ id: 'admin', label: 'President', icon: <Crown className="w-4 h-4 text-amber-400" /> }]
                : [{ id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> }]),
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNavigate(tab.id as NavTab)}
                  className={`relative py-1.5 px-0.5 rounded-md flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-colors cursor-pointer min-h-[44px] ${
                    isActive
                      ? 'text-amber-400'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="officer-mobile-nav-pill"
                      transition={{
                        type: 'spring',
                        stiffness: 420,
                        damping: 34,
                      }}
                      className="absolute inset-0 rounded-md bg-slate-800 -z-0"
                    />
                  )}
                  <span className="relative z-10">{tab.icon}</span>
                  <span className="relative z-10 truncate max-w-full text-[9px] leading-tight">
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-5 right-5 z-50 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 text-xs font-semibold flex items-center gap-3 shadow-lg border border-slate-800"
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
      {/* OFFICER & PRESIDENT PIN UNLOCK MODAL                               */}
      {/* ================================================================= */}
      <AnimatePresence>
        {showPinModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-4 shadow-xl"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <h3 className="font-display text-xl font-bold uppercase text-slate-900 dark:text-white">
                  Administration Sign In
                </h3>
                <button
                  onClick={() => {
                    setShowPinModal(false);
                    setPendingOfficerTab(null);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-700 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Enter your Officer PIN or President Password to unlock administrative controls.
              </p>

              <form onSubmit={handlePinSubmit} className="space-y-4">
                <input
                  type="password"
                  inputMode="text"
                  maxLength={10}
                  autoFocus
                  value={pinInput}
                  onChange={(e) => {
                    setPinError('');
                    setPinInput(e.target.value.trim());
                  }}
                  placeholder="••••"
                  className="w-full h-12 text-center font-mono-num text-2xl tracking-[0.4em] rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-amber-400"
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
                    className="flex-1 min-h-[40px] rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 min-h-[40px] rounded-md text-xs font-bold text-white bg-slate-900 hover:bg-black dark:bg-amber-400 dark:hover:bg-amber-300 dark:text-slate-950 cursor-pointer transition-colors"
                  >
                    Unlock
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isPresident && (!isOfficer || activeTab !== 'admin') && (
        <div className="fixed bottom-20 lg:bottom-5 left-4 z-50 flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => {
              setIsOfficer(true);
              setShowWelcomeScreen(false);
              setActiveTab('admin');
            }}
            className="px-3 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700 text-xs font-bold shadow-lg flex items-center gap-1.5 cursor-pointer"
          >
            <Crown className="w-3.5 h-3.5" />
            <span>President Console</span>
          </button>
        </div>
      )}
    </>
  );
}
