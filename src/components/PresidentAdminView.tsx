import React, { useMemo, useState } from 'react';
import {
  Check,
  Code,
  Database,
  Edit3,
  FileText,
  Plus,
  Replace,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import {
  ActivityReactionCounts,
  Announcement,
  AttendanceSession,
  CalendarEvent,
  ClubDataState,
  ClubPoll,
  ClubSettings,
  ClubTournament,
  EquipmentItem,
  GradeLevel,
  LadderChallenge,
  MatchMode,
  MatchRecord,
  Member,
  Officer,
  OfficerRole,
  OfficerTask,
  OutsideTournament,
  ReactionKey,
  SeasonArchive,
  SkillLevel,
  TaskStatus,
  TreasuryCategory,
  TreasuryTransaction,
} from '../types';
import {
  DEFAULT_SITE_TEXT_ENTRIES,
  globalReplaceTextInClubState,
} from '../utils/clubUtils';

interface PresidentAdminViewProps {
  data: ClubDataState;
  isPresident: boolean;
  liveTextEditMode?: boolean;
  onToggleLiveTextEditMode?: (enabled: boolean) => void;
  onReplaceFullClubData?: (
    nextState: ClubDataState,
    toastMessage?: string
  ) => void;
  onUpdateSettings: (settings: ClubSettings) => void;
  onUpdateMembers: (members: Member[]) => void;
  onUpdateOfficers: (officers: Officer[]) => void;
  onUpdateMatches: (matches: MatchRecord[]) => void;
  onVoidMatch: (matchId: string) => void;
  onResetAllElo: () => void;
  onResetAllLiveCourts?: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onResetFactoryData: () => void;
  onRequestPresidentUnlock: () => void;
}

type AdminTabId =
  | 'master_data'
  | 'text_studio'
  | 'broadcast'
  | 'security'
  | 'elo'
  | 'dues'
  | 'matches'
  | 'officers'
  | 'raw_json'
  | 'system';

type CollectionKey =
  | 'members'
  | 'matches'
  | 'attendance'
  | 'challenges'
  | 'polls'
  | 'mvpVotes'
  | 'activityReactions'
  | 'clubTournaments'
  | 'outsideTournaments'
  | 'events'
  | 'announcements'
  | 'officers'
  | 'tasks'
  | 'transactions'
  | 'equipment'
  | 'archives';

export const PresidentAdminView: React.FC<PresidentAdminViewProps> = ({
  data,
  isPresident,
  liveTextEditMode = false,
  onToggleLiveTextEditMode,
  onReplaceFullClubData,
  onUpdateSettings,
  onUpdateMembers,
  onUpdateOfficers,
  onUpdateMatches,
  onVoidMatch,
  onResetAllElo,
  onResetAllLiveCourts,
  onExportJSON,
  onImportJSON,
  onResetFactoryData,
  onRequestPresidentUnlock,
}) => {
  const [activeAdminTab, setActiveAdminTab] =
    useState<AdminTabId>('master_data');

  // Helper to commit full state changes immediately
  const commitFullState = (nextState: ClubDataState, msg?: string) => {
    if (onReplaceFullClubData) {
      onReplaceFullClubData(nextState, msg);
    } else {
      onUpdateSettings(nextState.settings);
      onUpdateMembers(nextState.members);
      onUpdateOfficers(nextState.officers);
      onUpdateMatches(nextState.matches);
    }
    if (msg) {
      triggerToast(msg);
    }
  };

  // Master Data Explorer state
  const [selectedCollection, setSelectedCollection] =
    useState<CollectionKey>('members');
  const [dataSearch, setDataSearch] = useState('');
  const [confirmPurgeCollection, setConfirmPurgeCollection] =
    useState<CollectionKey | null>(null);
  const [confirmWipeEverything, setConfirmWipeEverything] = useState(false);

  // Universal Record Editor Modal / Drawer state
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Record<string, any> | null>(
    null
  );
  const [isCreatingNewRecord, setIsCreatingNewRecord] = useState(false);
  const [jsonFieldError, setJsonFieldError] = useState('');

  // Site Text & Copy Studio state
  const [clubNameInput, setClubNameInput] = useState(data.settings.clubName);
  const [schoolNameInput, setSchoolNameInput] = useState(
    data.settings.schoolName
  );
  const [practiceTimeInput, setPracticeTimeInput] = useState(
    data.settings.recurringPractices?.timeRange || '3:50 PM – 5:30 PM'
  );
  const [practiceLocationInput, setPracticeLocationInput] = useState(
    data.settings.recurringPractices?.location || 'BNHS Club Courts'
  );
  const [customTextDraft, setCustomTextDraft] = useState<
    Record<string, string>
  >(() => ({
    ...(data.settings.customText || {}),
  }));
  const [newCustomKey, setNewCustomKey] = useState('');
  const [newCustomVal, setNewCustomVal] = useState('');

  // Global Find & Replace state
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitiveReplace, setCaseSensitiveReplace] = useState(false);

  // Raw JSON Inspector state
  const [rawJsonSlice, setRawJsonSlice] = useState<'ALL' | CollectionKey | 'settings'>('ALL');
  const [rawJsonText, setRawJsonText] = useState<string>('');
  const [rawJsonDirty, setRawJsonDirty] = useState(false);
  const [rawJsonError, setRawJsonError] = useState('');

  // Broadcast Alert state
  const currentBroadcast = data.settings.broadcastNotice || {
    enabled: false,
    text: '',
    level: 'info',
  };
  const [noticeEnabled, setNoticeEnabled] = useState(currentBroadcast.enabled);
  const [noticeText, setNoticeText] = useState(currentBroadcast.text || '');
  const [noticeLevel, setNoticeLevel] = useState<'info' | 'urgent'>(
    currentBroadcast.level || 'info'
  );

  // Security state
  const [newOfficerPin, setNewOfficerPin] = useState(
    data.settings.officerPin || '9002'
  );
  const [newPresPassword, setNewPresPassword] = useState(
    data.settings.presidentPassword || '8855'
  );
  const [regLocked, setRegLocked] = useState(
    !!data.settings.registrationLocked
  );

  // Elo Calibrator search and adjust state
  const [eloSearch, setEloSearch] = useState('');
  const [calibratingMemberId, setCalibratingMemberId] = useState<string | null>(
    null
  );
  const [calibrationEloInput, setCalibrationEloInput] = useState<number>(0);

  // Dues state
  const [duesAmountInput, setDuesAmountInput] = useState<number>(
    data.settings.duesAmount || 25
  );

  // Modals / Confirmation alerts
  const [confirmResetElo, setConfirmResetElo] = useState(false);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [factoryPasswordInput, setFactoryPasswordInput] = useState('');
  const [factoryResetError, setFactoryResetError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // Collection metadata & counts
  const collectionsMeta: {
    key: CollectionKey;
    label: string;
    count: number;
    description: string;
  }[] = useMemo(
    () => [
      {
        key: 'members',
        label: 'Members & Roster',
        count: data.members.length,
        description:
          'All student athletes, School IDs, Elo ratings, W-L records, streaks, dues, and paddle notes.',
      },
      {
        key: 'matches',
        label: 'Matches & Scores',
        count: data.matches.length,
        description:
          'Official ranked matches, friendly matches, practice logs, scores, and Elo deltas.',
      },
      {
        key: 'attendance',
        label: 'Attendance Sessions',
        count: data.attendance.length,
        description:
          'Practice check-in sessions, dates, titles, and present member lists.',
      },
      {
        key: 'challenges',
        label: 'Ladder Challenges',
        count: (data.challenges || []).length,
        description:
          'Open, accepted, declined, and completed player callouts and rivalry messages.',
      },
      {
        key: 'polls',
        label: 'Interactive Polls',
        count: (data.polls || []).length,
        description:
          'Live club polls, questions, voting options, and voter responses.',
      },
      {
        key: 'mvpVotes',
        label: 'Weekly MVP Votes',
        count: Object.keys(data.mvpVotes || {}).length,
        description:
          'Individual Athlete of the Week fan ballot entries and tallies.',
      },
      {
        key: 'activityReactions',
        label: 'Feed Reactions',
        count: Object.keys(data.activityReactions || {}).length,
        description:
          'Fire, Clutch, Upset, and GOAT reactions on live club activity items.',
      },
      {
        key: 'clubTournaments',
        label: 'Club Tournaments',
        count: data.clubTournaments.length,
        description:
          'In-club Round Robin and Single-Elimination brackets, participants, and court matches.',
      },
      {
        key: 'outsideTournaments',
        label: 'Outside Tournaments',
        count: data.outsideTournaments.length,
        description:
          'Regional tournament watchlist, entry fees, deadlines, venues, and registered club pairs.',
      },
      {
        key: 'events',
        label: 'Calendar Events',
        count: data.events.length,
        description:
          'Scheduled practices, meetings, socials, and tournament dates on the club calendar.',
      },
      {
        key: 'announcements',
        label: 'Announcements',
        count: data.announcements.length,
        description:
          'Club bulletins, pinned news, headlines, authors, and message bodies.',
      },
      {
        key: 'officers',
        label: 'Executive Officers',
        count: data.officers.length,
        description:
          'Club leadership board members, titles, grades, contact info, and bios.',
      },
      {
        key: 'tasks',
        label: 'Officer Tasks',
        count: data.tasks.length,
        description:
          'Action items, due dates, assignees, and task completion statuses.',
      },
      {
        key: 'transactions',
        label: 'Treasury Ledger',
        count: data.transactions.length,
        description:
          'Club income and expense entries, fundraisers, gear purchases, and amounts.',
      },
      {
        key: 'equipment',
        label: 'Gear & Equipment',
        count: data.equipment.length,
        description:
          'Club paddles, balls, nets, inventory codes, condition, and member checkouts.',
      },
      {
        key: 'archives',
        label: 'Season Archives',
        count: data.archives.length,
        description:
          'Historical season standings, top 3 champions, and archived match counts.',
      },
    ],
    [data]
  );

  // Preview count for Global Find & Replace
  const findPreviewCount = useMemo(() => {
    if (!findText.trim()) return 0;
    const { replacementsCount } = globalReplaceTextInClubState(
      data,
      findText,
      replaceText,
      caseSensitiveReplace
    );
    return replacementsCount;
  }, [data, findText, replaceText, caseSensitiveReplace]);

  // If user is not authenticated as President, show lock barrier
  if (!isPresident) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-5">
        <div className="inline-block px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono-num uppercase tracking-wider font-bold text-slate-600 dark:text-slate-300">
          Executive Authorization Required
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            President Administration Console
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
            This executive module is reserved for the {data.settings.clubName}{' '}
            President. Highest administration privileges require the President
            access password.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestPresidentUnlock}
          className="px-5 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white font-semibold text-xs cursor-pointer transition-colors"
        >
          Enter President Password
        </button>
      </div>
    );
  }

  // Delete an entire collection
  const handlePurgeCollection = (col: CollectionKey) => {
    const nextState: ClubDataState = { ...data };
    if (col === 'mvpVotes') {
      nextState.mvpVotes = {};
    } else if (col === 'activityReactions') {
      nextState.activityReactions = {};
    } else {
      (nextState as any)[col] = [];
    }
    setConfirmPurgeCollection(null);
    setEditingRecordId(null);
    setEditingDraft(null);
    commitFullState(
      nextState,
      `Purged all records in ${
        collectionsMeta.find((c) => c.key === col)?.label || col
      }.`
    );
  };

  // Wipe every collection to an empty slate while keeping settings
  const handleWipeAllCollections = () => {
    const nextState: ClubDataState = {
      ...data,
      officers: [],
      tasks: [],
      members: [],
      attendance: [],
      matches: [],
      challenges: [],
      polls: [],
      mvpVotes: {},
      activityReactions: {},
      clubTournaments: [],
      outsideTournaments: [],
      events: [],
      announcements: [],
      transactions: [],
      equipment: [],
      archives: [],
    };
    setConfirmWipeEverything(false);
    commitFullState(
      nextState,
      'Wiped all club collections to a clean empty slate.'
    );
  };

  // Delete a single item from any collection
  const handleDeleteSingleRecord = (col: CollectionKey, recordId: string) => {
    const nextState: ClubDataState = { ...data };
    if (col === 'mvpVotes') {
      const nextVotes = { ...(data.mvpVotes || {}) };
      delete nextVotes[recordId];
      nextState.mvpVotes = nextVotes;
    } else if (col === 'activityReactions') {
      const nextReacts = { ...(data.activityReactions || {}) };
      delete nextReacts[recordId];
      nextState.activityReactions = nextReacts;
    } else if (col === 'members') {
      nextState.members = data.members.filter((m) => m.id !== recordId);
      // Also clean up deleted member from attendance and challenges
      nextState.attendance = data.attendance.map((a) => ({
        ...a,
        presentMemberIds: a.presentMemberIds.filter((id) => id !== recordId),
      }));
      nextState.challenges = (data.challenges || []).filter(
        (c) => c.challengerId !== recordId && c.opponentId !== recordId
      );
    } else {
      const list = ((data as any)[col] || []) as any[];
      (nextState as any)[col] = list.filter((item) => item.id !== recordId);
    }
    if (editingRecordId === recordId) {
      setEditingRecordId(null);
      setEditingDraft(null);
    }
    commitFullState(nextState, `Deleted record (${recordId}) from ${col}.`);
  };

  // Open Editor for an existing record
  const handleStartEditRecord = (col: CollectionKey, record: any, idKey?: string) => {
    setIsCreatingNewRecord(false);
    setJsonFieldError('');
    if (col === 'mvpVotes') {
      const voterKey = idKey || '';
      setEditingRecordId(voterKey);
      setEditingDraft({
        voterKey,
        candidateId: (data.mvpVotes || {})[voterKey] || '',
      });
      return;
    }
    if (col === 'activityReactions') {
      const feedId = idKey || '';
      const current: ActivityReactionCounts = (data.activityReactions || {})[
        feedId
      ] || { fire: [], clutch: [], upset: [], goat: [] };
      setEditingRecordId(feedId);
      setEditingDraft({
        feedId,
        fireCount: (current.fire || []).length,
        clutchCount: (current.clutch || []).length,
        upsetCount: (current.upset || []).length,
        goatCount: (current.goat || []).length,
      });
      return;
    }
    setEditingRecordId(record.id);
    setEditingDraft(JSON.parse(JSON.stringify(record)));
  };

  // Start creating a brand-new record in the currently selected collection
  const handleStartCreateRecord = (col: CollectionKey) => {
    const today = new Date().toISOString().slice(0, 10);
    setIsCreatingNewRecord(true);
    setJsonFieldError('');
    const newId = `${col.slice(0, 3)}-${Date.now()}`;
    setEditingRecordId(newId);

    switch (col) {
      case 'members':
        setEditingDraft({
          id: newId,
          schoolId: '',
          name: 'New Club Member',
          grade: 10,
          skillLevel: 'Intermediate',
          paddleNotes: '',
          joinDate: today,
          elo: 0,
          monthStartElo: 0,
          wins: 0,
          losses: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          streak: 0,
          duesPaid: false,
          duesAmount: data.settings.duesAmount || 25,
        } satisfies Member);
        break;
      case 'matches':
        setEditingDraft({
          id: newId,
          date: today,
          format: 'singles',
          scoringType: 'sideout',
          targetScore: 11,
          bestOf: 1,
          team1Ids: data.members[0] ? [data.members[0].id] : [],
          team2Ids: data.members[1] ? [data.members[1].id] : [],
          games: [{ team1Score: 11, team2Score: 7 }],
          winnerTeam: 1,
          eloDelta: 16,
          matchMode: 'ranked',
        } satisfies MatchRecord);
        break;
      case 'attendance':
        setEditingDraft({
          id: newId,
          date: today,
          title: 'After-School Club Practice',
          presentMemberIds: [],
        } satisfies AttendanceSession);
        break;
      case 'challenges':
        setEditingDraft({
          id: newId,
          challengerId: data.members[0]?.id || '',
          opponentId: data.members[1]?.id || '',
          format: 'singles',
          targetScore: 11,
          message: 'See you on Court 1 after school!',
          createdAt: today,
          status: 'open',
          scoreSummary: '',
        } satisfies LadderChallenge);
        break;
      case 'polls':
        setEditingDraft({
          id: newId,
          question: 'New Club Poll Question?',
          createdAt: today,
          isActive: true,
          options: [
            { id: `opt-${Date.now()}-1`, label: 'Option A', voterIds: [] },
            { id: `opt-${Date.now()}-2`, label: 'Option B', voterIds: [] },
          ],
        } satisfies ClubPoll);
        break;
      case 'mvpVotes':
        setEditingDraft({
          voterKey: `pres-vote-${Date.now()}`,
          candidateId: data.members[0]?.id || '',
        });
        break;
      case 'activityReactions':
        setEditingDraft({
          feedId: data.matches[0] ? `match-${data.matches[0].id}` : `item-${Date.now()}`,
          fireCount: 3,
          clutchCount: 1,
          upsetCount: 0,
          goatCount: 2,
        });
        break;
      case 'clubTournaments':
        setEditingDraft({
          id: newId,
          name: 'New Club Championship',
          date: today,
          format: 'round_robin',
          playStyle: 'doubles',
          status: 'Active',
          participants: [],
          matches: [],
        } satisfies ClubTournament);
        break;
      case 'outsideTournaments':
        setEditingDraft({
          id: newId,
          name: 'DFW Regional Open',
          dates: today,
          startDateISO: today,
          cityVenue: 'Trophy Club Courts, TX',
          divisions: '3.0, 3.5, 4.0+',
          entryFee: '$45',
          prizeMoney: 'Medals & Trophies',
          registrationDeadline: today,
          link: 'https://pickleballbrackets.com',
          status: 'Watching',
          attendees: [],
        } satisfies OutsideTournament);
        break;
      case 'events':
        setEditingDraft({
          id: newId,
          title: 'Club Open Court Session',
          date: today,
          time: '4:00 PM – 5:30 PM',
          location: 'BNHS Club Courts',
          type: 'Practice',
          description: 'Bring paddles, water, and court shoes.',
        } satisfies CalendarEvent);
        break;
      case 'announcements':
        setEditingDraft({
          id: newId,
          title: 'New President Bulletin',
          body: 'Enter announcement details here...',
          author: data.officers[0]?.name || 'Club President',
          authorRole: 'President',
          date: today,
          pinned: true,
        } satisfies Announcement);
        break;
      case 'officers':
        setEditingDraft({
          id: newId,
          name: 'New Officer Name',
          role: 'Vice President',
          grade: 11,
          contact: '',
          bio: '',
        } satisfies Officer);
        break;
      case 'tasks':
        setEditingDraft({
          id: newId,
          title: 'New Officer Action Item',
          status: 'To Do',
          assignee: data.officers[0]?.name || 'President',
          dueDate: today,
          category: 'Operations',
        } satisfies OfficerTask);
        break;
      case 'transactions':
        setEditingDraft({
          id: newId,
          date: today,
          description: 'Club Treasury Entry',
          category: 'Fundraiser',
          type: 'income',
          amount: 50,
        } satisfies TreasuryTransaction);
        break;
      case 'equipment':
        setEditingDraft({
          id: newId,
          name: 'Selkirk Vanguard Loaner Paddle',
          category: 'Paddle',
          code: `BN-${Math.floor(100 + Math.random() * 900)}`,
          condition: 'Mint',
          checkedOutToMemberId: null,
          checkedOutDate: null,
          notes: '',
        } satisfies EquipmentItem);
        break;
      case 'archives':
        setEditingDraft({
          id: newId,
          seasonName: 'Archived Season',
          startDate: data.settings.seasonStartDate || today,
          endDate: today,
          totalMatches: data.matches.length,
          topPlayers: [],
        } satisfies SeasonArchive);
        break;
    }
  };

  // Save edited or newly created record into ClubDataState
  const handleSaveEditedRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDraft || !editingRecordId) return;

    const nextState: ClubDataState = { ...data };

    if (selectedCollection === 'mvpVotes') {
      const voterKey = String(editingDraft.voterKey || editingRecordId).trim();
      const candidateId = String(editingDraft.candidateId || '').trim();
      if (!voterKey || !candidateId) return;
      const nextVotes = { ...(data.mvpVotes || {}) };
      if (!isCreatingNewRecord && editingRecordId !== voterKey) {
        delete nextVotes[editingRecordId];
      }
      nextVotes[voterKey] = candidateId;
      nextState.mvpVotes = nextVotes;
      setEditingRecordId(null);
      setEditingDraft(null);
      commitFullState(nextState, 'MVP ballot entry saved.');
      return;
    }

    if (selectedCollection === 'activityReactions') {
      const feedId = String(editingDraft.feedId || editingRecordId).trim();
      if (!feedId) return;
      const makeVoterArray = (count: number, prefix: string) =>
        Array.from({ length: Math.max(0, Number(count) || 0) }, (_, i) => `${prefix}-${i + 1}`);
      const nextReacts = { ...(data.activityReactions || {}) };
      nextReacts[feedId] = {
        fire: makeVoterArray(editingDraft.fireCount, 'fire-voter'),
        clutch: makeVoterArray(editingDraft.clutchCount, 'clutch-voter'),
        upset: makeVoterArray(editingDraft.upsetCount, 'upset-voter'),
        goat: makeVoterArray(editingDraft.goatCount, 'goat-voter'),
      };
      nextState.activityReactions = nextReacts;
      setEditingRecordId(null);
      setEditingDraft(null);
      commitFullState(nextState, 'Activity reaction counts updated.');
      return;
    }

    const currentList = [...(((data as any)[selectedCollection] || []) as any[])];
    if (isCreatingNewRecord) {
      (nextState as any)[selectedCollection] = [editingDraft, ...currentList];
    } else {
      (nextState as any)[selectedCollection] = currentList.map((item) =>
        item.id === editingRecordId ? editingDraft : item
      );
    }

    setEditingRecordId(null);
    setEditingDraft(null);
    setIsCreatingNewRecord(false);
    commitFullState(
      nextState,
      `${isCreatingNewRecord ? 'Created' : 'Updated'} record in ${selectedCollection}.`
    );
  };

  // Save Site Copy & Identity Text Studio
  const handleSaveTextStudio = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCustom: Record<string, string> = {};
    for (const [k, v] of Object.entries(customTextDraft)) {
      if (typeof v === 'string' && v.trim() !== '') {
        cleanedCustom[k] = v;
      }
    }
    const nextSettings: ClubSettings = {
      ...data.settings,
      clubName: clubNameInput.trim() || 'BNHS Pickleball Club',
      schoolName: schoolNameInput.trim() || 'Byron Nelson High School',
      recurringPractices: {
        ...data.settings.recurringPractices,
        timeRange: practiceTimeInput.trim() || '3:50 PM – 5:30 PM',
        location: practiceLocationInput.trim() || 'BNHS Club Courts',
      },
      customText: cleanedCustom,
    };
    const nextState: ClubDataState = {
      ...data,
      settings: nextSettings,
    };
    commitFullState(
      nextState,
      'All site copy, titles, and custom text overrides saved!'
    );
  };

  // Execute Global Find & Replace across entire database
  const handleExecuteGlobalReplace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!findText.trim()) {
      triggerToast('Enter text to find first.');
      return;
    }
    const { nextState, replacementsCount } = globalReplaceTextInClubState(
      data,
      findText,
      replaceText,
      caseSensitiveReplace
    );
    if (replacementsCount === 0) {
      triggerToast(`No matches found for "${findText}".`);
      return;
    }
    setClubNameInput(nextState.settings.clubName);
    setSchoolNameInput(nextState.settings.schoolName);
    setCustomTextDraft({ ...(nextState.settings.customText || {}) });
    commitFullState(
      nextState,
      `Replaced ${replacementsCount} occurrence${
        replacementsCount === 1 ? '' : 's'
      } of "${findText}" with "${replaceText}" across the entire database!`
    );
    setFindText('');
  };

  // Load Raw JSON into editor when switching slice
  const getRawSliceObject = (slice: 'ALL' | CollectionKey | 'settings') => {
    if (slice === 'ALL') return data;
    if (slice === 'settings') return data.settings;
    return (data as any)[slice];
  };

  const currentRawJsonDisplay = rawJsonDirty
    ? rawJsonText
    : JSON.stringify(getRawSliceObject(rawJsonSlice), null, 2);

  const handleApplyRawJson = () => {
    try {
      const parsed = JSON.parse(currentRawJsonDisplay);
      setRawJsonError('');
      let nextState: ClubDataState;
      if (rawJsonSlice === 'ALL') {
        if (!parsed || typeof parsed !== 'object' || !parsed.settings) {
          setRawJsonError(
            'Full database JSON must contain a valid settings object.'
          );
          return;
        }
        nextState = parsed as ClubDataState;
      } else if (rawJsonSlice === 'settings') {
        nextState = { ...data, settings: parsed };
      } else {
        nextState = { ...data, [rawJsonSlice]: parsed };
      }
      setRawJsonDirty(false);
      commitFullState(
        nextState,
        `Applied raw JSON changes to ${rawJsonSlice}.`
      );
    } catch (err) {
      setRawJsonError(
        err instanceof Error ? err.message : 'Invalid JSON syntax.'
      );
    }
  };

  // Handle saving Broadcast Notice
  const handleSaveBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    const nextSettings: ClubSettings = {
      ...data.settings,
      broadcastNotice: {
        enabled: noticeEnabled,
        text: noticeText.trim(),
        level: noticeLevel,
      },
    };
    commitFullState(
      { ...data, settings: nextSettings },
      noticeEnabled
        ? 'Live Club Broadcast posted successfully.'
        : 'Club Broadcast disabled.'
    );
  };

  // Quick preset notices
  const applyPresetNotice = (text: string, level: 'info' | 'urgent') => {
    setNoticeText(text);
    setNoticeLevel(level);
    setNoticeEnabled(true);
  };

  // Handle saving Security PINs & Lock
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = newOfficerPin.trim();
    const cleanPres = newPresPassword.trim() || '8855';

    if (cleanPin.length < 4) {
      triggerToast('Officer PIN must be at least 4 digits.');
      return;
    }

    commitFullState(
      {
        ...data,
        settings: {
          ...data.settings,
          officerPin: cleanPin,
          presidentPassword: cleanPres,
          registrationLocked: regLocked,
        },
      },
      'Security credentials & registration permissions updated.'
    );
  };

  // Handle individual Elo calibration
  const handleSaveEloCalibration = (memberId: string) => {
    const nextMembers = data.members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            elo: Math.max(0, Math.min(3000, Number(calibrationEloInput))),
          }
        : m
    );
    commitFullState(
      { ...data, members: nextMembers },
      'Player Elo calibrated successfully.'
    );
    setCalibratingMemberId(null);
  };

  // Handle bulk mark dues
  const handleBulkDues = (paid: boolean) => {
    const today = new Date().toISOString().slice(0, 10);
    const nextMembers = data.members.map((m) => ({
      ...m,
      duesPaid: paid,
      duesAmount: duesAmountInput,
      duesPaidDate: paid ? today : undefined,
    }));
    commitFullState(
      { ...data, members: nextMembers },
      paid
        ? `Marked all ${data.members.length} members as DUES PAID ($${duesAmountInput}).`
        : `Reset all member dues to UNPAID for new season.`
    );
  };

  // Handle toggle member dues
  const handleToggleMemberDues = (memberId: string) => {
    const target = data.members.find((m) => m.id === memberId);
    if (!target) return;
    const nowPaid = !target.duesPaid;
    const nextMembers = data.members.map((m) =>
      m.id === memberId
        ? {
            ...m,
            duesPaid: nowPaid,
            duesPaidDate: nowPaid
              ? new Date().toISOString().slice(0, 10)
              : undefined,
          }
        : m
    );
    commitFullState(
      { ...data, members: nextMembers },
      `${target.name} dues marked as ${nowPaid ? 'PAID' : 'UNPAID'}.`
    );
  };

  // Handle execute Elo master reset
  const handleExecuteResetElo = () => {
    onResetAllElo();
    setConfirmResetElo(false);
    triggerToast('All member Elo ratings reset to 0.');
  };

  // Handle factory reset confirmation
  const handleExecuteFactoryReset = () => {
    if (
      factoryPasswordInput !== (data.settings.presidentPassword || '8855')
    ) {
      setFactoryResetError('Incorrect President password. Action blocked.');
      return;
    }
    onResetFactoryData();
    setConfirmFactoryReset(false);
    setFactoryPasswordInput('');
    setFactoryResetError('');
    triggerToast('Club database reset to factory baseline.');
  };

  // Filtered members for Elo calibrator
  const filteredEloMembers = data.members
    .filter(
      (m) =>
        m.name.toLowerCase().includes(eloSearch.toLowerCase()) ||
        (m.schoolId && m.schoolId.includes(eloSearch)) ||
        m.skillLevel.toLowerCase().includes(eloSearch.toLowerCase())
    )
    .sort((a, b) => b.elo - a.elo);

  const duesPaidCount = data.members.filter((m) => m.duesPaid).length;
  const duesTotalCollected = duesPaidCount * (data.settings.duesAmount || 25);
  const duesGoal = data.members.length * (data.settings.duesAmount || 25);

  const activeCollectionMeta =
    collectionsMeta.find((c) => c.key === selectedCollection) ||
    collectionsMeta[0];

  // Helper to get summary title and subtitle for any record in Master Data Explorer
  const getRecordSummary = (
    col: CollectionKey,
    item: any,
    keyId?: string
  ): { id: string; title: string; subtitle: string; badge?: string } => {
    switch (col) {
      case 'members':
        return {
          id: item.id,
          title: item.name || 'Unnamed Member',
          subtitle: `ID: ${item.schoolId || 'None'} · Grade ${item.grade} · ${
            item.elo
          } Elo · ${item.wins}W–${item.losses}L · Streak ${item.streak}`,
          badge: item.skillLevel,
        };
      case 'matches': {
        const t1 = (item.team1Ids || [])
          .map(
            (id: string) =>
              data.members.find((m) => m.id === id)?.name || id
          )
          .join(' & ');
        const t2 = (item.team2Ids || [])
          .map(
            (id: string) =>
              data.members.find((m) => m.id === id)?.name || id
          )
          .join(' & ');
        const sc = (item.games || [])
          .map((g: any) => `${g.team1Score}–${g.team2Score}`)
          .join(', ');
        return {
          id: item.id,
          title: `${t1 || 'Team 1'} vs ${t2 || 'Team 2'} (${sc})`,
          subtitle: `${item.date} · ${item.format} · Mode: ${
            item.matchMode || 'ranked'
          } · ±${item.eloDelta} Elo`,
          badge: `Winner: Team ${item.winnerTeam}`,
        };
      }
      case 'attendance':
        return {
          id: item.id,
          title: item.title || 'Practice Session',
          subtitle: `Date: ${item.date} · ${(item.presentMemberIds || []).length} athletes checked in`,
          badge: item.date,
        };
      case 'challenges': {
        const chal =
          data.members.find((m) => m.id === item.challengerId)?.name ||
          item.challengerId;
        const opp =
          data.members.find((m) => m.id === item.opponentId)?.name ||
          item.opponentId;
        return {
          id: item.id,
          title: `${chal} challenged ${opp}`,
          subtitle: `"${item.message || ''}" · ${item.format} to ${
            item.targetScore
          } pts · ${item.createdAt}`,
          badge: String(item.status || 'open').toUpperCase(),
        };
      }
      case 'polls': {
        const totalVotes = (item.options || []).reduce(
          (s: number, o: any) => s + (o.voterIds?.length || 0),
          0
        );
        return {
          id: item.id,
          title: item.question || 'Poll',
          subtitle: `${(item.options || []).length} options · ${totalVotes} total votes · Created ${item.createdAt}`,
          badge: item.isActive ? 'ACTIVE' : 'CLOSED',
        };
      }
      case 'mvpVotes': {
        const voterKey = keyId || '';
        const candId = item as string;
        const candName =
          data.members.find((m) => m.id === candId)?.name || candId;
        return {
          id: voterKey,
          title: `Vote for ${candName}`,
          subtitle: `Voter Key: ${voterKey}`,
          badge: 'MVP VOTE',
        };
      }
      case 'activityReactions': {
        const feedId = keyId || '';
        const r = item as ActivityReactionCounts;
        return {
          id: feedId,
          title: `Activity Item: ${feedId}`,
          subtitle: `Fire: ${(r.fire || []).length} · Clutch: ${
            (r.clutch || []).length
          } · Upset: ${(r.upset || []).length} · GOAT: ${(r.goat || []).length}`,
          badge: 'REACTIONS',
        };
      }
      case 'clubTournaments':
        return {
          id: item.id,
          title: item.name || 'Tournament',
          subtitle: `${item.date} · ${item.format} (${item.playStyle}) · ${(item.participants || []).length} entries · ${(item.matches || []).length} matches`,
          badge: item.status,
        };
      case 'outsideTournaments':
        return {
          id: item.id,
          title: item.name || 'Outside Tournament',
          subtitle: `${item.dates} · ${item.cityVenue || ''} · Fee: ${item.entryFee} · ${(item.attendees || []).length} club attendees`,
          badge: item.status,
        };
      case 'events':
        return {
          id: item.id,
          title: item.title || 'Calendar Event',
          subtitle: `${item.date} · ${item.time} · ${item.location} · ${item.description || ''}`,
          badge: item.type,
        };
      case 'announcements':
        return {
          id: item.id,
          title: item.title || 'Announcement',
          subtitle: `By ${item.author} (${item.authorRole}) on ${item.date} — ${item.body}`,
          badge: item.pinned ? 'PINNED' : 'POST',
        };
      case 'officers':
        return {
          id: item.id,
          title: item.name || 'Officer',
          subtitle: `${item.role} · Grade ${item.grade} · Contact: ${
            item.contact || 'None'
          }`,
          badge: item.role,
        };
      case 'tasks':
        return {
          id: item.id,
          title: item.title || 'Task',
          subtitle: `Assigned to ${item.assignee} · Due ${item.dueDate} · ${item.category}`,
          badge: item.status,
        };
      case 'transactions':
        return {
          id: item.id,
          title: item.description || 'Transaction',
          subtitle: `${item.date} · ${item.category}`,
          badge: `${item.type === 'income' ? '+' : '-'}$${item.amount}`,
        };
      case 'equipment':
        return {
          id: item.id,
          title: `${item.name} (${item.code})`,
          subtitle: `Category: ${item.category} · Condition: ${item.condition} · ${
            item.notes || 'No notes'
          }`,
          badge: item.checkedOutToMemberId ? 'CHECKED OUT' : 'AVAILABLE',
        };
      case 'archives':
        return {
          id: item.id,
          title: item.seasonName || 'Season Archive',
          subtitle: `${item.startDate} to ${item.endDate} · ${item.totalMatches} matches`,
          badge: 'ARCHIVE',
        };
    }
  };

  // Build list of records for current collection filtered by search
  const activeCollectionRecords = useMemo(() => {
    const q = dataSearch.trim().toLowerCase();
    if (selectedCollection === 'mvpVotes') {
      return Object.entries(data.mvpVotes || {})
        .map(([k, v]) => ({
          raw: v,
          keyId: k,
          summary: getRecordSummary('mvpVotes', v, k),
        }))
        .filter(
          (x) =>
            !q ||
            x.summary.title.toLowerCase().includes(q) ||
            x.summary.subtitle.toLowerCase().includes(q)
        );
    }
    if (selectedCollection === 'activityReactions') {
      return Object.entries(data.activityReactions || {})
        .map(([k, v]) => ({
          raw: v,
          keyId: k,
          summary: getRecordSummary('activityReactions', v, k),
        }))
        .filter(
          (x) =>
            !q ||
            x.summary.title.toLowerCase().includes(q) ||
            x.summary.subtitle.toLowerCase().includes(q)
        );
    }
    const list = (((data as any)[selectedCollection] || []) as any[]);
    return list
      .map((item) => ({
        raw: item,
        keyId: item.id,
        summary: getRecordSummary(selectedCollection, item),
      }))
      .filter(
        (x) =>
          !q ||
          x.summary.title.toLowerCase().includes(q) ||
          x.summary.subtitle.toLowerCase().includes(q) ||
          (x.summary.badge && x.summary.badge.toLowerCase().includes(q))
      );
  }, [data, selectedCollection, dataSearch]);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2.5 rounded-md border border-slate-700 shadow-lg text-xs font-semibold">
          {successToast}
        </div>
      )}

      {/* Presidential Authority Header Banner */}
      <div className="rounded-lg bg-slate-900 text-white p-6 sm:p-8 border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="text-[11px] font-mono-num uppercase tracking-widest text-amber-400 font-semibold">
              President Executive Administration · Unrestricted Omnipotent Access
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              Presidential Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              Total administrative authority over {data.settings.clubName}: delete
              or modify any record across all 16 club databases, customize any text
              or heading on the site, run global find-and-replace, and manage live
              court operations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            {/* Live On-Screen Text Edit Mode Toggle */}
            {onToggleLiveTextEditMode && (
              <button
                type="button"
                onClick={() => {
                  const next = !liveTextEditMode;
                  onToggleLiveTextEditMode(next);
                  triggerToast(
                    next
                      ? 'Live On-Screen Text Edit Mode ON — click any text on any page to edit it!'
                      : 'Live On-Screen Text Edit Mode OFF.'
                  );
                }}
                className={`px-4 py-2.5 rounded-md border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                  liveTextEditMode
                    ? 'bg-amber-400 text-slate-950 border-amber-300'
                    : 'bg-slate-950 hover:bg-slate-800 text-white border-slate-700'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {liveTextEditMode
                    ? 'Live Text Edit Mode: ON'
                    : 'Enable Live Text Edit'}
                </span>
              </button>
            )}

            {/* Quick Metrics */}
            <div className="grid grid-cols-3 gap-2 shrink-0">
              <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase tracking-wider">
                  Members
                </div>
                <div className="text-lg font-bold font-mono-num text-white mt-0.5 tabular-nums">
                  {data.members.length}
                </div>
              </div>
              <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase tracking-wider">
                  Treasury
                </div>
                <div className="text-lg font-bold font-mono-num text-emerald-400 mt-0.5 tabular-nums">
                  ${duesTotalCollected}
                </div>
              </div>
              <div className="p-2.5 rounded-md bg-slate-950 border border-slate-800">
                <div className="text-[10px] font-mono-num text-slate-400 uppercase tracking-wider">
                  Matches
                </div>
                <div className="text-lg font-bold font-mono-num text-amber-400 mt-0.5 tabular-nums">
                  {data.matches.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 touch-scroll no-scrollbar">
        {[
          {
            id: 'master_data',
            label: 'Master Data Editor & Deleter',
            icon: <Database className="w-3.5 h-3.5" />,
          },
          {
            id: 'text_studio',
            label: 'Site Text & Global Replace',
            icon: <FileText className="w-3.5 h-3.5" />,
          },
          { id: 'broadcast', label: 'Broadcast Alert' },
          { id: 'security', label: 'Security & PINs' },
          { id: 'elo', label: 'Elo & Seeding' },
          { id: 'dues', label: 'Dues & Treasury' },
          { id: 'matches', label: 'Match Integrity' },
          { id: 'officers', label: 'Officer Roles' },
          {
            id: 'raw_json',
            label: 'Raw JSON Inspector',
            icon: <Code className="w-3.5 h-3.5" />,
          },
          { id: 'system', label: 'Backup & Factory Reset' },
        ].map((tab) => {
          const isSelected = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAdminTab(tab.id as AdminTabId)}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer shrink-0 inline-flex items-center gap-1.5 ${
                isSelected
                  ? 'border-blue-600 text-blue-600 dark:border-amber-400 dark:text-amber-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* MODULE 0A: MASTER DATA EDITOR & DELETER (ALL 16 COLLECTIONS)      */}
      {/* ================================================================= */}
      {activeAdminTab === 'master_data' && (
        <div className="space-y-6">
          {/* Top Bar: Collection Selector Grid + Wipe All Collections Button */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                  Universal Club Database Explorer — Delete or Change Anything
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Select any data category below to view, edit every field/text, add
                  custom entries, delete individual records, or purge the entire
                  category.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmWipeEverything(true)}
                className="px-3.5 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer shrink-0 inline-flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Wipe All 16 Data Collections</span>
              </button>
            </div>

            {confirmWipeEverything && (
              <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 space-y-3">
                <div className="text-xs font-bold text-red-700 dark:text-red-300">
                  Confirm Total Purge of All 16 Data Collections
                </div>
                <p className="text-xs text-red-600 dark:text-red-300">
                  This will delete all members, matches, attendance logs,
                  challenges, polls, MVP votes, reactions, tournaments, events,
                  announcements, officers, tasks, transactions, equipment, and
                  archives while keeping your club name, colors, and passwords.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleWipeAllCollections}
                    className="px-3.5 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Yes, Delete Everything
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmWipeEverything(false)}
                    className="px-3.5 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* 16-Collection Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
              {collectionsMeta.map((col) => {
                const isSelected = selectedCollection === col.key;
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => {
                      setSelectedCollection(col.key);
                      setEditingRecordId(null);
                      setEditingDraft(null);
                      setConfirmPurgeCollection(null);
                    }}
                    className={`p-2.5 rounded-md border text-left transition-colors cursor-pointer flex flex-col justify-between gap-1 ${
                      isSelected
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                        : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="text-[11px] font-bold leading-tight truncate">
                      {col.label}
                    </div>
                    <div
                      className={`text-sm font-mono-num font-bold tabular-nums ${
                        isSelected
                          ? 'text-amber-300 dark:text-slate-950'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {col.count}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Collection Workspace */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                    {activeCollectionMeta.label}
                  </h3>
                  <span className="font-mono-num text-xs font-bold text-blue-600 dark:text-amber-400">
                    ({activeCollectionMeta.count} records)
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {activeCollectionMeta.description}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleStartCreateRecord(selectedCollection)}
                  className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Record</span>
                </button>

                {activeCollectionMeta.count > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmPurgeCollection(selectedCollection)
                    }
                    className="px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear All {activeCollectionMeta.label}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Confirm Purge Collection Banner */}
            {confirmPurgeCollection === selectedCollection && (
              <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-red-700 dark:text-red-300">
                  <strong>
                    Delete all {activeCollectionMeta.count} records in{' '}
                    {activeCollectionMeta.label}?
                  </strong>{' '}
                  This action will immediately sync across the club database.
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handlePurgeCollection(selectedCollection)}
                    className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirm Delete All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmPurgeCollection(null)}
                    className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Inline Record Editor Panel (when a record is being edited or created) */}
            {editingDraft && editingRecordId && (
              <form
                onSubmit={handleSaveEditedRecord}
                className="p-5 rounded-lg bg-slate-50 dark:bg-slate-950 border-2 border-blue-600 dark:border-amber-400 space-y-4"
              >
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-[10px] font-mono-num uppercase tracking-wider font-bold text-blue-600 dark:text-amber-400">
                      {isCreatingNewRecord
                        ? `Create New ${activeCollectionMeta.label} Record`
                        : `Editing Record ID: ${editingRecordId}`}
                    </div>
                    <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Change Any Field or Text Value
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRecordId(null);
                      setEditingDraft(null);
                      setIsCreatingNewRecord(false);
                    }}
                    className="p-1.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Specialized Form Fields for MVP Votes */}
                {selectedCollection === 'mvpVotes' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Voter Identity Key
                      </label>
                      <input
                        type="text"
                        value={editingDraft.voterKey || ''}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            voterKey: e.target.value,
                          })
                        }
                        className="w-full h-9 px-3 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Voted Athlete
                      </label>
                      <select
                        value={editingDraft.candidateId || ''}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            candidateId: e.target.value,
                          })
                        }
                        className="w-full h-9 px-3 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                      >
                        <option value="">Select Member...</option>
                        {data.members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.elo} Elo)
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : selectedCollection === 'activityReactions' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Activity Feed ID
                      </label>
                      <input
                        type="text"
                        value={editingDraft.feedId || ''}
                        onChange={(e) =>
                          setEditingDraft({
                            ...editingDraft,
                            feedId: e.target.value,
                          })
                        }
                        className="w-full h-9 px-3 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono-num"
                      />
                    </div>
                    {[
                      { k: 'fireCount', label: 'Fire Count' },
                      { k: 'clutchCount', label: 'Clutch Count' },
                      { k: 'upsetCount', label: 'Upset Count' },
                      { k: 'goatCount', label: 'GOAT Count' },
                    ].map((rc) => (
                      <div key={rc.k}>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                          {rc.label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={editingDraft[rc.k] ?? 0}
                          onChange={(e) =>
                            setEditingDraft({
                              ...editingDraft,
                              [rc.k]: Math.max(0, Number(e.target.value)),
                            })
                          }
                          className="w-full h-9 px-3 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono-num"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  /* Dynamic Field Editor for All Other Collections */
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(editingDraft).map(([fieldKey, fieldVal]) => {
                      if (fieldKey === 'id') {
                        return (
                          <div key={fieldKey}>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                              Record ID
                            </label>
                            <input
                              type="text"
                              value={String(fieldVal)}
                              disabled={!isCreatingNewRecord}
                              onChange={(e) =>
                                setEditingDraft({
                                  ...editingDraft,
                                  id: e.target.value,
                                })
                              }
                              className="w-full h-9 px-3 rounded bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono-num opacity-75"
                            />
                          </div>
                        );
                      }

                      if (typeof fieldVal === 'boolean') {
                        return (
                          <div
                            key={fieldKey}
                            className="flex items-center justify-between p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                          >
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              {fieldKey}
                            </span>
                            <input
                              type="checkbox"
                              checked={fieldVal}
                              onChange={(e) =>
                                setEditingDraft({
                                  ...editingDraft,
                                  [fieldKey]: e.target.checked,
                                })
                              }
                              className="w-4 h-4 cursor-pointer"
                            />
                          </div>
                        );
                      }

                      if (typeof fieldVal === 'number') {
                        return (
                          <div key={fieldKey}>
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              {fieldKey}
                            </label>
                            <input
                              type="number"
                              value={fieldVal}
                              onChange={(e) =>
                                setEditingDraft({
                                  ...editingDraft,
                                  [fieldKey]: Number(e.target.value),
                                })
                              }
                              className="w-full h-9 px-3 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono-num"
                            />
                          </div>
                        );
                      }

                      if (typeof fieldVal === 'string') {
                        const isLongText =
                          fieldKey === 'body' ||
                          fieldKey === 'description' ||
                          fieldKey === 'notes' ||
                          fieldKey === 'paddleNotes' ||
                          fieldKey === 'message' ||
                          fieldKey === 'question' ||
                          fieldVal.length > 65;

                        return (
                          <div
                            key={fieldKey}
                            className={
                              isLongText ? 'sm:col-span-2 lg:col-span-3' : ''
                            }
                          >
                            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                              {fieldKey}
                            </label>
                            {isLongText ? (
                              <textarea
                                rows={2}
                                value={fieldVal}
                                onChange={(e) =>
                                  setEditingDraft({
                                    ...editingDraft,
                                    [fieldKey]: e.target.value,
                                  })
                                }
                                className="w-full p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                              />
                            ) : (
                              <input
                                type="text"
                                value={fieldVal}
                                onChange={(e) =>
                                  setEditingDraft({
                                    ...editingDraft,
                                    [fieldKey]: e.target.value,
                                  })
                                }
                                className="w-full h-9 px-3 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs"
                              />
                            )}
                          </div>
                        );
                      }

                      // Special friendly editor for Poll Options
                      if (
                        selectedCollection === 'polls' &&
                        fieldKey === 'options' &&
                        Array.isArray(fieldVal)
                      ) {
                        return (
                          <div
                            key={fieldKey}
                            className="sm:col-span-2 lg:col-span-3 space-y-2 p-3 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                                Poll Options & Vote Counts
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingDraft({
                                    ...editingDraft,
                                    options: [
                                      ...fieldVal,
                                      {
                                        id: `opt-${Date.now()}`,
                                        label: 'New Option',
                                        voterIds: [],
                                      },
                                    ],
                                  })
                                }
                                className="px-2 py-1 rounded bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
                              >
                                + Add Option
                              </button>
                            </div>
                            {fieldVal.map((opt: any, idx: number) => (
                              <div
                                key={opt.id || idx}
                                className="flex items-center gap-2"
                              >
                                <input
                                  type="text"
                                  value={opt.label || ''}
                                  onChange={(e) => {
                                    const nextOpts = [...fieldVal];
                                    nextOpts[idx] = {
                                      ...opt,
                                      label: e.target.value,
                                    };
                                    setEditingDraft({
                                      ...editingDraft,
                                      options: nextOpts,
                                    });
                                  }}
                                  placeholder="Option text"
                                  className="flex-1 h-8 px-2.5 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                                />
                                <span className="text-[11px] text-slate-500 font-mono-num">
                                  Votes:
                                </span>
                                <input
                                  type="number"
                                  min={0}
                                  value={(opt.voterIds || []).length}
                                  onChange={(e) => {
                                    const targetCount = Math.max(
                                      0,
                                      Number(e.target.value)
                                    );
                                    const nextVoters = Array.from(
                                      { length: targetCount },
                                      (_, i) =>
                                        opt.voterIds?.[i] || `voter-${i + 1}`
                                    );
                                    const nextOpts = [...fieldVal];
                                    nextOpts[idx] = {
                                      ...opt,
                                      voterIds: nextVoters,
                                    };
                                    setEditingDraft({
                                      ...editingDraft,
                                      options: nextOpts,
                                    });
                                  }}
                                  className="w-16 h-8 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono-num text-center"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const nextOpts = fieldVal.filter(
                                      (_: any, i: number) => i !== idx
                                    );
                                    setEditingDraft({
                                      ...editingDraft,
                                      options: nextOpts,
                                    });
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-red-600 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        );
                      }

                      // Array or nested object field (editable as JSON)
                      return (
                        <div
                          key={fieldKey}
                          className="sm:col-span-2 lg:col-span-3"
                        >
                          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                            {fieldKey} (Array / Nested Data)
                          </label>
                          <textarea
                            rows={3}
                            defaultValue={JSON.stringify(fieldVal, null, 2)}
                            onBlur={(e) => {
                              try {
                                const parsed = JSON.parse(e.target.value);
                                setJsonFieldError('');
                                setEditingDraft({
                                  ...editingDraft,
                                  [fieldKey]: parsed,
                                });
                              } catch {
                                setJsonFieldError(
                                  `Invalid JSON in field "${fieldKey}". Check syntax before saving.`
                                );
                              }
                            }}
                            className="w-full p-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono-num"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {jsonFieldError && (
                  <div className="text-xs font-bold text-red-600">
                    {jsonFieldError}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRecordId(null);
                      setEditingDraft(null);
                      setIsCreatingNewRecord(false);
                    }}
                    className="px-3.5 py-1.5 rounded-md bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {isCreatingNewRecord ? 'Create Record' : 'Save Changes'}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* Search bar inside collection */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={dataSearch}
                onChange={(e) => setDataSearch(e.target.value)}
                placeholder={`Search ${activeCollectionMeta.label.toLowerCase()}...`}
                className="w-full h-9 pl-9 pr-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Records List */}
            {activeCollectionRecords.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-md">
                No records found in {activeCollectionMeta.label}. Use &ldquo;Add
                New Record&rdquo; above to create one.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md overflow-hidden">
                {activeCollectionRecords.map(({ raw, keyId, summary }) => (
                  <div
                    key={keyId}
                    className="p-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50/80 dark:hover:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {summary.title}
                        </span>
                        {summary.badge && (
                          <span className="text-[10px] font-mono-num uppercase font-bold text-blue-600 dark:text-amber-400">
                            · {summary.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-2xl">
                        {summary.subtitle}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleStartEditRecord(selectedCollection, raw, keyId)
                        }
                        className="px-2.5 py-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Text / Fields</span>
                      </button>

                      {selectedCollection === 'matches' && (
                        <button
                          type="button"
                          onClick={() => {
                            onVoidMatch(keyId);
                            triggerToast(
                              'Match voided & player Elo/stats reverted.'
                            );
                          }}
                          className="px-2.5 py-1.5 rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold cursor-pointer"
                        >
                          Void & Revert Elo
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteSingleRecord(selectedCollection, keyId)
                        }
                        className="px-2.5 py-1.5 rounded bg-red-50 hover:bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 0B: SITE TEXT STUDIO & GLOBAL FIND-AND-REPLACE             */}
      {/* ================================================================= */}
      {activeAdminTab === 'text_studio' && (
        <div className="space-y-6">
          {/* Global Find & Replace Engine */}
          <form
            onSubmit={handleExecuteGlobalReplace}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-4"
          >
            <div className="pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="text-[10px] font-mono-num uppercase tracking-wider font-bold text-blue-600 dark:text-amber-400 flex items-center gap-1.5">
                <Replace className="w-3.5 h-3.5" />
                <span>Database-Wide Text Replacement Engine</span>
              </div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white mt-0.5">
                Global Find & Replace Text Across Everything
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Instantly replace any word, name, phrase, court label, or text
                across all members, matches, tournaments, announcements, events,
                polls, tasks, and settings at once.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Find Text Anywhere
                </label>
                <input
                  type="text"
                  value={findText}
                  onChange={(e) => setFindText(e.target.value)}
                  placeholder="e.g. BNHS Club Courts"
                  className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                  Replace With
                </label>
                <input
                  type="text"
                  value={replaceText}
                  onChange={(e) => setReplaceText(e.target.value)}
                  placeholder="e.g. Bobcat Championship Arena"
                  className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={caseSensitiveReplace}
                    onChange={(e) => setCaseSensitiveReplace(e.target.checked)}
                  />
                  <span>Case-sensitive match</span>
                </label>
                {findText.trim() && (
                  <span className="text-xs font-mono-num font-bold text-blue-600 dark:text-amber-400">
                    {findPreviewCount} match
                    {findPreviewCount === 1 ? '' : 'es'} found across database
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={!findText.trim() || findPreviewCount === 0}
                className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
              >
                Replace All ({findPreviewCount}) Occurrences
              </button>
            </div>
          </form>

          {/* Site Copy & Headings Editor */}
          <form
            onSubmit={handleSaveTextStudio}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                  Site Copy, Headings & Custom Text Studio
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Customize club branding, welcome screen copy, dashboard card
                  titles, custom spotlight banners, and rules text.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCustomTextDraft({});
                    triggerToast(
                      'Reset custom text draft to defaults. Click Save to apply.'
                    );
                  }}
                  className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Defaults</span>
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Save All Text Changes
                </button>
              </div>
            </div>

            {/* Primary Club Identity Text */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Club Name (Header & Welcome Title)
                </label>
                <input
                  type="text"
                  value={clubNameInput}
                  onChange={(e) => setClubNameInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  School / Organization Name
                </label>
                <input
                  type="text"
                  value={schoolNameInput}
                  onChange={(e) => setSchoolNameInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Default Practice Time Range Text
                </label>
                <input
                  type="text"
                  value={practiceTimeInput}
                  onChange={(e) => setPracticeTimeInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                  Default Court / Practice Location Text
                </label>
                <input
                  type="text"
                  value={practiceLocationInput}
                  onChange={(e) => setPracticeLocationInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                />
              </div>
            </div>

            {/* All Configurable Site Text Entries */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              {DEFAULT_SITE_TEXT_ENTRIES.map((entry) => {
                const currentVal =
                  customTextDraft[entry.key] !== undefined
                    ? customTextDraft[entry.key]
                    : entry.defaultValue;
                return (
                  <div
                    key={entry.key}
                    className={entry.multiline ? 'sm:col-span-2' : ''}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                        {entry.section} · {entry.label}
                      </label>
                      {customTextDraft[entry.key] !== undefined &&
                        customTextDraft[entry.key] !== entry.defaultValue && (
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...customTextDraft };
                              delete next[entry.key];
                              setCustomTextDraft(next);
                            }}
                            className="text-[10px] text-blue-600 dark:text-amber-400 hover:underline cursor-pointer"
                          >
                            Revert default
                          </button>
                        )}
                    </div>
                    {entry.multiline ? (
                      <textarea
                        rows={2}
                        value={currentVal}
                        placeholder={
                          entry.defaultValue ||
                          'Leave blank to hide or enter custom text...'
                        }
                        onChange={(e) =>
                          setCustomTextDraft({
                            ...customTextDraft,
                            [entry.key]: e.target.value,
                          })
                        }
                        className="w-full p-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                      />
                    ) : (
                      <input
                        type="text"
                        value={currentVal}
                        placeholder={
                          entry.defaultValue ||
                          'Leave blank to hide or enter custom text...'
                        }
                        onChange={(e) =>
                          setCustomTextDraft({
                            ...customTextDraft,
                            [entry.key]: e.target.value,
                          })
                        }
                        className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Live On-Screen Text Overrides Table (and Add Custom Override) */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Live On-Screen Text Replacements & Custom Keys
                  </h3>
                  <p className="text-xs text-slate-500">
                    Any exact phrase added below (or edited via Live Text Edit
                    Mode) is automatically replaced across every screen in real
                    time.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input
                  type="text"
                  value={newCustomKey}
                  onChange={(e) => setNewCustomKey(e.target.value)}
                  placeholder="Original text on page (e.g. Standings)"
                  className="h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                />
                <input
                  type="text"
                  value={newCustomVal}
                  onChange={(e) => setNewCustomVal(e.target.value)}
                  placeholder="New replacement text (e.g. Bobcat Rankings)"
                  className="h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCustomKey.trim()) return;
                    setCustomTextDraft({
                      ...customTextDraft,
                      [`inline::${newCustomKey.trim()}`]: newCustomVal,
                    });
                    setNewCustomKey('');
                    setNewCustomVal('');
                  }}
                  className="h-9 px-3 rounded-md bg-slate-900 dark:bg-white text-white dark:text-slate-950 text-xs font-semibold cursor-pointer"
                >
                  + Add Phrase Override
                </button>
              </div>

              {/* List existing inline:: overrides */}
              {Object.entries(customTextDraft).filter(([k]) =>
                k.startsWith('inline::')
              ).length > 0 && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-md">
                  {Object.entries(customTextDraft)
                    .filter(([k]) => k.startsWith('inline::'))
                    .map(([k, v]) => {
                      const orig = k.replace(/^inline::/, '');
                      return (
                        <div
                          key={k}
                          className="p-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0 flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="text-slate-500 truncate">
                              Original: <strong>{orig}</strong>
                            </div>
                            <input
                              type="text"
                              value={v}
                              onChange={(e) =>
                                setCustomTextDraft({
                                  ...customTextDraft,
                                  [k]: e.target.value,
                                })
                              }
                              className="h-7 px-2 rounded bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-bold"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = { ...customTextDraft };
                              delete next[k];
                              setCustomTextDraft(next);
                            }}
                            className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Save All Text & Copy Overrides
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 0C: RAW JSON / UNIVERSAL STATE INSPECTOR                   */}
      {/* ================================================================= */}
      {activeAdminTab === 'raw_json' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Raw JSON Database Inspector & Direct State Editor
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect or directly modify the underlying JSON structure of the
                entire club database or any individual collection.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={rawJsonSlice}
                onChange={(e) => {
                  setRawJsonSlice(e.target.value as any);
                  setRawJsonDirty(false);
                  setRawJsonError('');
                }}
                className="h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-semibold"
              >
                <option value="ALL">Entire Club Database (All Data)</option>
                <option value="settings">Settings & Custom Text</option>
                {collectionsMeta.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label} ({c.count})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={handleApplyRawJson}
                className="h-9 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
              >
                Apply Raw JSON
              </button>
            </div>
          </div>

          {rawJsonError && (
            <div className="p-3 rounded-md bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs font-bold text-red-600 dark:text-red-400">
              JSON Parse Error: {rawJsonError}
            </div>
          )}

          <textarea
            rows={22}
            value={currentRawJsonDisplay}
            onChange={(e) => {
              setRawJsonText(e.target.value);
              setRawJsonDirty(true);
              setRawJsonError('');
            }}
            className="w-full p-4 rounded-md bg-slate-950 text-emerald-400 font-mono-num text-xs border border-slate-800 focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 1: LIVE BROADCAST ALERT                                   */}
      {/* ================================================================= */}
      {activeAdminTab === 'broadcast' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Live Club Broadcast Alert
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pin an urgent emergency or important notice banner at the very top
                of the app for all members and officers to see immediately.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Status:
              </span>
              <button
                type="button"
                onClick={() => setNoticeEnabled(!noticeEnabled)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono-num font-bold cursor-pointer transition-colors ${
                  noticeEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {noticeEnabled ? 'ACTIVE / LIVE' : 'DISABLED'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveBroadcast} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Broadcast Message
              </label>
              <textarea
                rows={3}
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                placeholder="e.g. Weather Alert: Practice moved to the BNHS Indoor Gym today at 4:15 PM. Bring clean court shoes!"
                className="w-full p-3 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Severity / Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeLevel('info')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold cursor-pointer border ${
                      noticeLevel === 'info'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Club Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeLevel('urgent')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold cursor-pointer border ${
                      noticeLevel === 'urgent'
                        ? 'bg-red-50 dark:bg-red-950/60 border-red-600 text-red-700 dark:text-red-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Urgent Alert
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      applyPresetNotice(
                        'Weather Notice: Rain predicted. Practice relocated to the indoor auxiliary gym.',
                        'urgent'
                      )
                    }
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Rain/Weather Delay
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyPresetNotice(
                        'Club Tournament Bracket matches begin at 4:00 PM on Courts 1–4. Be checked in on time!',
                        'info'
                      )
                    }
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Tournament Start
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyPresetNotice(
                        'Fall Semester club dues are due this Friday. Please see the club treasurer or pay online.',
                        'info'
                      )
                    }
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Dues Deadline
                  </button>
                </div>
              </div>
            </div>

            {noticeEnabled && noticeText.trim() && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Live Preview of Top Banner:
                </div>
                <div
                  className={`p-3 rounded-md flex items-center justify-between gap-3 text-xs font-semibold ${
                    noticeLevel === 'urgent'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  <span>{noticeText}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-80 shrink-0 font-mono-num">
                    President Notice
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer"
              >
                Save & Publish Broadcast
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 2: SECURITY & PIN GOVERNANCE                               */}
      {/* ================================================================= */}
      {activeAdminTab === 'security' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-6">
          <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Security PINs & Registration Permissions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control access passwords for President and general Officers, and
              manage whether students can self-register into the database.
            </p>
          </div>

          <form onSubmit={handleSaveSecurity} className="space-y-4 max-w-xl">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                President Master Admin Password
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Grants highest presidential authority across all club operations.
              </p>
              <div className="pt-1">
                <input
                  type="text"
                  value={newPresPassword}
                  onChange={(e) => setNewPresPassword(e.target.value)}
                  placeholder="8855"
                  className="w-full sm:w-48 h-9 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-num text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                General Officer PIN (4-Digit)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Used by vice presidents, secretaries, and captains to take
                attendance and record match scores.
              </p>
              <div className="pt-1">
                <input
                  type="text"
                  maxLength={6}
                  value={newOfficerPin}
                  onChange={(e) =>
                    setNewOfficerPin(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="9002"
                  className="w-full sm:w-48 h-9 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-num text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Lock Member Self-Registration
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  When enabled, students cannot register themselves via &ldquo;Add
                  Yourself&rdquo;. Only Officers can add new members.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegLocked(!regLocked)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-mono-num font-bold cursor-pointer transition-colors shrink-0 ${
                  regLocked
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {regLocked ? 'LOCKED' : 'OPEN'}
              </button>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer"
            >
              Save Security Changes
            </button>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 3: ELO CALIBRATION & SEEDING OVERRIDE                      */}
      {/* ================================================================= */}
      {activeAdminTab === 'elo' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Elo Calibration & Seeding Overrides
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Presidential power to adjust player Elo ratings directly for
                tournament seeding or correction.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setConfirmResetElo(true)}
              className="px-3.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
            >
              Reset Entire Club to 0 Elo
            </button>
          </div>

          {confirmResetElo && (
            <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 space-y-3">
              <div className="text-xs font-bold text-red-700 dark:text-red-300">
                Confirm Elo Reset to 0 for ALL Members
              </div>
              <p className="text-xs text-red-600 dark:text-red-300">
                This will reset the Elo ratings of all {data.members.length}{' '}
                members back to the baseline 0.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExecuteResetElo}
                  className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Yes, Reset All to 0
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetElo(false)}
                  className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={eloSearch}
              onChange={(e) => setEloSearch(e.target.value)}
              placeholder="Search member name, ID, or tier..."
              className="w-full h-9 pl-9 pr-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="overflow-x-auto touch-scroll">
            <table className="w-full min-w-[620px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono-num uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-2">Rank</th>
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-3">Skill Tier</th>
                  <th className="py-2.5 px-3">Current Elo</th>
                  <th className="py-2.5 pl-3 text-right">Calibrate / Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredEloMembers.map((member, idx) => {
                  const isEditing = calibratingMemberId === member.id;
                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 pr-2 font-mono-num font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{member.name}</span>
                          {member.schoolId && (
                            <span className="font-mono-num text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                              ({member.schoolId})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-num">
                          {member.wins}W–{member.losses}L · Grade {member.grade}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-600 dark:text-slate-300">
                        {member.skillLevel}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        {member.elo}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={3000}
                              value={calibrationEloInput}
                              onChange={(e) =>
                                setCalibrationEloInput(Number(e.target.value))
                              }
                              className="w-20 h-8 px-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono-num text-xs font-bold text-center"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEloCalibration(member.id)}
                              className="px-2.5 py-1.5 rounded bg-emerald-600 text-white font-semibold text-xs cursor-pointer hover:bg-emerald-500"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setCalibratingMemberId(null)}
                              className="px-2 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setCalibratingMemberId(member.id);
                                setCalibrationEloInput(member.elo);
                              }}
                              className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[11px] cursor-pointer"
                            >
                              Adjust Elo
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleDeleteSingleRecord('members', member.id)
                              }
                              className="p-1.5 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Delete Member"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 4: DUES & TREASURY MASTER CONTROLS                         */}
      {/* ================================================================= */}
      {activeAdminTab === 'dues' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Financial & Dues Master Administration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bulk manage semester dues, adjust club dues requirements, and
                track member payment status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkDues(true)}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
              >
                Mark All as Paid
              </button>
              <button
                type="button"
                onClick={() => handleBulkDues(false)}
                className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Reset All to Unpaid
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Dues Collected
              </div>
              <div className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                ${duesTotalCollected}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono-num">
                {duesPaidCount} of {data.members.length} members paid
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Pending / Outstanding
              </div>
              <div className="text-2xl font-bold font-mono-num text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                ${Math.max(0, duesGoal - duesTotalCollected)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono-num">
                {data.members.length - duesPaidCount} members pending
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Club Semester Dues Amount ($)
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={0}
                  value={duesAmountInput}
                  onChange={(e) => setDuesAmountInput(Number(e.target.value))}
                  className="w-24 h-8 px-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-num text-sm font-bold text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    commitFullState(
                      {
                        ...data,
                        settings: {
                          ...data.settings,
                          duesAmount: duesAmountInput,
                        },
                      },
                      `Club dues amount set to $${duesAmountInput}.`
                    );
                  }}
                  className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <h3 className="text-[11px] font-mono-num font-bold text-slate-500 uppercase tracking-wider">
              Member Dues Roster ({data.members.length})
            </h3>
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full min-w-[560px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono-num uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3">School ID</th>
                    <th className="py-2.5 px-3">Grade</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 pl-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {data.members.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {member.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-slate-500">
                        {member.schoolId || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-slate-600 dark:text-slate-300">
                        {member.grade}th
                      </td>
                      <td className="py-2.5 px-3 font-mono-num font-bold">
                        {member.duesPaid ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            PAID ($
                            {member.duesAmount || data.settings.duesAmount})
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            UNPAID
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleMemberDues(member.id)}
                          className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                            member.duesPaid
                              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {member.duesPaid ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 5: MATCH INTEGRITY & VOIDING                               */}
      {/* ================================================================= */}
      {activeAdminTab === 'matches' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Match Integrity, Editing & Score Voiding
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect official match records. Void matches with Elo revert,
                delete raw records without changing stats, or clear all matches.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onResetAllLiveCourts && (
                <button
                  type="button"
                  onClick={() => {
                    onResetAllLiveCourts();
                    triggerToast('All multi-court live scoreboards cleared.');
                  }}
                  className="px-3.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Reset Live Court Scoreboards
                </button>
              )}
              {data.matches.length > 0 && (
                <button
                  type="button"
                  onClick={() => handlePurgeCollection('matches')}
                  className="px-3.5 py-1.5 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Delete All Matches ({data.matches.length})
                </button>
              )}
            </div>
          </div>

          {data.matches.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No matches recorded right now.
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.matches.map((m) => {
                const team1Names = m.team1Ids
                  .map(
                    (id) =>
                      data.members.find((x) => x.id === id)?.name || 'Player'
                  )
                  .join(' & ');
                const team2Names = m.team2Ids
                  .map(
                    (id) =>
                      data.members.find((x) => x.id === id)?.name || 'Player'
                  )
                  .join(' & ');

                const scoreStr = m.games
                  .map((g) => `${g.team1Score}–${g.team2Score}`)
                  .join(', ');

                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {team1Names} vs {team2Names}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-[11px] font-mono-num uppercase text-slate-500">
                          {m.format} ({m.matchMode || 'ranked'})
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-400 font-mono-num text-[11px]">
                          {m.date}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        Score:{' '}
                        <span className="font-bold font-mono-num">
                          {scoreStr}
                        </span>{' '}
                        · Winner:{' '}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Team {m.winnerTeam}
                        </span>{' '}
                        · Elo Delta:{' '}
                        <span className="font-mono-num">±{m.eloDelta}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCollection('matches');
                          setActiveAdminTab('master_data');
                          handleStartEditRecord('matches', m);
                        }}
                        className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                      >
                        Edit Match
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onVoidMatch(m.id);
                          triggerToast('Match voided & player Elo reverted.');
                        }}
                        className="px-3 py-1.5 rounded-md bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-700 dark:text-amber-300 text-xs font-semibold cursor-pointer"
                      >
                        Void & Revert Elo
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteSingleRecord('matches', m.id)
                        }
                        className="px-2.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
                        title="Delete match record without changing player Elo"
                      >
                        Delete Raw
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 6: OFFICER ROLES & EXECUTIVE BOARD                         */}
      {/* ================================================================= */}
      {activeAdminTab === 'officers' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Officer Board Appointments
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Appoint, manage, or modify {data.settings.clubName} officers and
                leadership positions.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedCollection('officers');
                setActiveAdminTab('master_data');
                handleStartCreateRecord('officers');
              }}
              className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
            >
              + Appoint Officer
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.officers.map((off) => (
              <div
                key={off.id}
                className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {off.name}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs font-mono-num font-bold text-blue-600 dark:text-amber-400">
                      {off.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-mono-num">
                    Grade {off.grade} · Contact: {off.contact || 'None'}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCollection('officers');
                      setActiveAdminTab('master_data');
                      handleStartEditRecord('officers', off);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                    title="Edit officer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleDeleteSingleRecord('officers', off.id)
                    }
                    className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                    title="Remove officer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 7: SYSTEM BACKUP & RECOVERY                                */}
      {/* ================================================================= */}
      {activeAdminTab === 'system' && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 space-y-6">
          <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Club Database Backup & Recovery
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Export full club records to JSON, restore previous club backups,
              or reset to factory initial baseline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                Full Database Export
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download a complete JSON snapshot of all members, ratings,
                attendance logs, and settings.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onExportJSON}
                  className="px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer"
                >
                  Download Backup JSON
                </button>
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                Restore from Backup JSON
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload and restore a previous JSON backup file into the club
                database.
              </p>
              <div className="pt-2">
                <label className="px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold inline-flex items-center cursor-pointer">
                  <span>Select JSON File</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onImportJSON(file);
                        triggerToast('Backup restored successfully.');
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Danger Zone: Factory Reset */}
          <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 space-y-3">
            <div className="text-red-700 dark:text-red-300 font-bold text-sm">
              Danger Zone · Factory Reset Club Database
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 max-w-xl">
              Permanently resets all club data to the initial Byron Nelson High
              School baseline. This action requires the President access
              password.
            </p>

            {confirmFactoryReset ? (
              <div className="space-y-2 pt-1 max-w-md">
                <label className="block text-xs font-bold text-red-700 dark:text-red-300">
                  Enter President Password to Confirm:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={factoryPasswordInput}
                    onChange={(e) => {
                      setFactoryResetError('');
                      setFactoryPasswordInput(e.target.value);
                    }}
                    placeholder="••••"
                    className="flex-1 h-9 px-3 rounded bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 font-mono-num text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleExecuteFactoryReset}
                    className="px-3 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmFactoryReset(false);
                      setFactoryPasswordInput('');
                    }}
                    className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                {factoryResetError && (
                  <div className="text-xs font-bold text-red-600">
                    {factoryResetError}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmFactoryReset(true)}
                className="px-3.5 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
              >
                Reset to Factory Default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
