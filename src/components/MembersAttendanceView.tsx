import React, { useMemo, useRef, useState } from 'react';
import { Camera, Edit3, Search, Trash2, X } from 'lucide-react';
import {
  AttendanceSession,
  GradeLevel,
  LadderChallenge,
  MatchRecord,
  Member,
  SkillLevel,
} from '../types';
import {
  ALL_ACHIEVEMENT_DEFINITIONS,
  computeMemberAchievements,
  processImageFileToDataUrl,
  recalculateMemberStatsFromHistory,
} from '../utils/clubUtils';

interface MembersAttendanceViewProps {
  members: Member[];
  attendance: AttendanceSession[];
  matches?: MatchRecord[];
  challenges?: LadderChallenge[];
  isOfficer: boolean;
  onUpdateMembers: (members: Member[]) => void;
  onUpdateAttendance: (attendance: AttendanceSession[]) => void;
  onRequestOfficerUnlock: () => void;
  onNavigateToMultiCourt?: () => void;
}

interface ParsedCsvMemberRow {
  name: string;
  grade: GradeLevel;
  skillLevel: SkillLevel;
  duprRating?: string;
  paddleNotes: string;
  isDuplicate: boolean;
}

function normalizeGrade(raw: string): GradeLevel {
  const num = parseInt(raw.replace(/[^0-9]/g, ''), 10);
  if (num === 9 || num === 10 || num === 11 || num === 12) return num;
  return 10;
}

function normalizeSkill(raw: string): SkillLevel {
  const lower = (raw || '').trim().toLowerCase();
  if (lower.startsWith('adv')) return 'Advanced';
  if (lower.startsWith('beg')) return 'Beginner';
  return 'Intermediate';
}

export const MembersAttendanceView: React.FC<MembersAttendanceViewProps> = ({
  members,
  attendance,
  matches = [],
  challenges = [],
  isOfficer,
  onUpdateMembers,
  onUpdateAttendance,
  onRequestOfficerUnlock,
  onNavigateToMultiCourt,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [skillFilter, setSkillFilter] = useState<'all' | SkillLevel>('all');

  const sortedSessions = [...attendance].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sortedSessions[0]?.id || ''
  );

  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newSessionTitle, setNewSessionTitle] = useState(
    'After-School Practice & Ladder'
  );

  // Single Member Add/Edit state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const [formSchoolId, setFormSchoolId] = useState('');
  const [formName, setFormName] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formPhotoUploading, setFormPhotoUploading] = useState(false);
  const [formGrade, setFormGrade] = useState<GradeLevel>(10);
  const [formSkill, setFormSkill] = useState<SkillLevel>('Intermediate');
  const [formDupr, setFormDupr] = useState('');
  const [formPaddle, setFormPaddle] = useState('');
  const [formJoinDate, setFormJoinDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Officer Stat & Achievement Override state when editing a member
  const [formElo, setFormElo] = useState<number>(0);
  const [formMonthStartElo, setFormMonthStartElo] = useState<number>(0);
  const [formWins, setFormWins] = useState<number>(0);
  const [formLosses, setFormLosses] = useState<number>(0);
  const [formPointsFor, setFormPointsFor] = useState<number>(0);
  const [formPointsAgainst, setFormPointsAgainst] = useState<number>(0);
  const [formStreak, setFormStreak] = useState<number>(0);
  const [formUnlockedAchievementIds, setFormUnlockedAchievementIds] = useState<
    string[]
  >([]);
  const [formRevokedAchievementIds, setFormRevokedAchievementIds] = useState<
    string[]
  >([]);

  // Bulk CSV Roster Import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [csvText, setCsvText] = useState('');
  const csvFileInputRef = useRef<HTMLInputElement | null>(null);

  const activeSession =
    attendance.find((s) => s.id === selectedSessionId) || sortedSessions[0];

  const getMemberAttendanceStats = (memberId: string) => {
    const total = attendance.length;
    if (total === 0) return { attended: 0, total: 0, pct: 100 };
    const attended = attendance.filter((s) =>
      s.presentMemberIds.includes(memberId)
    ).length;
    const pct = Math.round((attended / total) * 100);
    return { attended, total, pct };
  };

  const ensureActiveSession = (): AttendanceSession => {
    if (activeSession) return activeSession;
    const todayStr = new Date().toISOString().slice(0, 10);
    const created: AttendanceSession = {
      id: `att-${Date.now()}`,
      date: todayStr,
      title: 'After-School Club Practice',
      presentMemberIds: [],
    };
    onUpdateAttendance([created, ...attendance]);
    setSelectedSessionId(created.id);
    return created;
  };

  const handleToggleAttendance = (memberId: string) => {
    const session = ensureActiveSession();
    const exists = session.presentMemberIds.includes(memberId);
    const updatedPresent = exists
      ? session.presentMemberIds.filter((id) => id !== memberId)
      : [...session.presentMemberIds, memberId];

    const sessionInList = attendance.some((s) => s.id === session.id);
    if (sessionInList) {
      onUpdateAttendance(
        attendance.map((s) =>
          s.id === session.id ? { ...s, presentMemberIds: updatedPresent } : s
        )
      );
    } else {
      onUpdateAttendance([
        { ...session, presentMemberIds: updatedPresent },
        ...attendance,
      ]);
    }
  };

  const handleMarkAllPresent = () => {
    const session = ensureActiveSession();
    const allIds = members.map((m) => m.id);
    const sessionInList = attendance.some((s) => s.id === session.id);
    if (sessionInList) {
      onUpdateAttendance(
        attendance.map((s) =>
          s.id === session.id ? { ...s, presentMemberIds: allIds } : s
        )
      );
    } else {
      onUpdateAttendance([
        { ...session, presentMemberIds: allIds },
        ...attendance,
      ]);
    }
  };

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const newSession: AttendanceSession = {
      id: `att-${Date.now()}`,
      date: newSessionDate,
      title: newSessionTitle.trim() || 'Club Practice',
      presentMemberIds: [],
    };
    onUpdateAttendance([newSession, ...attendance]);
    setSelectedSessionId(newSession.id);
    setShowNewSessionForm(false);
  };

  const handleDeleteSession = (sessionId: string) => {
    const remaining = attendance.filter((s) => s.id !== sessionId);
    onUpdateAttendance(remaining);
    if (selectedSessionId === sessionId) {
      setSelectedSessionId(remaining[0]?.id || '');
    }
  };

  const openAddMember = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingMember(null);
    setFormSchoolId('');
    setFormName('');
    setFormPhoto('');
    setFormGrade(10);
    setFormSkill('Intermediate');
    setFormDupr('');
    setFormPaddle('');
    setFormJoinDate(new Date().toISOString().slice(0, 10));
    setFormElo(0);
    setFormMonthStartElo(0);
    setFormWins(0);
    setFormLosses(0);
    setFormPointsFor(0);
    setFormPointsAgainst(0);
    setFormStreak(0);
    setFormUnlockedAchievementIds([]);
    setFormRevokedAchievementIds([]);
    setIsAddingMember(true);
  };

  const openEditMember = (m: Member) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingMember(m);
    setFormSchoolId('');
    setFormName(m.name);
    setFormPhoto(m.photoUrl || '');
    setFormGrade(m.grade);
    setFormSkill(m.skillLevel);
    setFormDupr(m.duprRating || '');
    setFormPaddle(m.paddleNotes);
    setFormJoinDate(m.joinDate);
    setFormElo(m.elo);
    setFormMonthStartElo(m.monthStartElo ?? m.elo);
    setFormWins(m.wins);
    setFormLosses(m.losses);
    setFormPointsFor(m.pointsFor ?? 0);
    setFormPointsAgainst(m.pointsAgainst ?? 0);
    setFormStreak(m.streak);
    setFormUnlockedAchievementIds(m.unlockedAchievementIds || []);
    setFormRevokedAchievementIds(m.revokedAchievementIds || []);
    setIsAddingMember(true);
  };

  const handleRecalculateFormStats = () => {
    if (!editingMember) return;
    const recomputed = recalculateMemberStatsFromHistory(
      editingMember,
      matches
    );
    setFormElo(recomputed.elo);
    setFormWins(recomputed.wins);
    setFormLosses(recomputed.losses);
    setFormPointsFor(recomputed.pointsFor);
    setFormPointsAgainst(recomputed.pointsAgainst);
    setFormStreak(recomputed.streak);
  };

  const handleToggleFormBadgeOverride = (
    badgeId: string,
    targetMode: 'granted' | 'revoked' | 'auto'
  ) => {
    const nextUnlocked = formUnlockedAchievementIds.filter(
      (id) => id !== badgeId
    );
    const nextRevoked = formRevokedAchievementIds.filter(
      (id) => id !== badgeId
    );
    if (targetMode === 'granted') {
      nextUnlocked.push(badgeId);
    } else if (targetMode === 'revoked') {
      nextRevoked.push(badgeId);
    }
    setFormUnlockedAchievementIds(nextUnlocked);
    setFormRevokedAchievementIds(nextRevoked);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    const cleanedSchoolId = formSchoolId.trim() || undefined;

    if (editingMember) {
      onUpdateMembers(
        members.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                schoolId: cleanedSchoolId || m.schoolId,
                name: formName.trim(),
                photoUrl: formPhoto.trim() || undefined,
                grade: formGrade,
                skillLevel: formSkill,
                duprRating: formDupr.trim() || undefined,
                paddleNotes: formPaddle.trim() || 'Club Loaner Paddle',
                joinDate: formJoinDate,
                elo: Math.max(0, Math.round(Number(formElo) || 0)),
                monthStartElo: Math.max(
                  0,
                  Math.round(Number(formMonthStartElo) || 0)
                ),
                wins: Math.max(0, Math.round(Number(formWins) || 0)),
                losses: Math.max(0, Math.round(Number(formLosses) || 0)),
                pointsFor: Math.max(0, Math.round(Number(formPointsFor) || 0)),
                pointsAgainst: Math.max(
                  0,
                  Math.round(Number(formPointsAgainst) || 0)
                ),
                streak: Math.round(Number(formStreak) || 0),
                unlockedAchievementIds: formUnlockedAchievementIds,
                revokedAchievementIds: formRevokedAchievementIds,
              }
            : m
        )
      );
    } else {
      const newMember: Member = {
        id: `mem-${Date.now()}`,
        schoolId: cleanedSchoolId,
        photoUrl: formPhoto.trim() || undefined,
        name: formName.trim(),
        grade: formGrade,
        skillLevel: formSkill,
        duprRating: formDupr.trim() || undefined,
        paddleNotes: formPaddle.trim() || 'Personal Paddle',
        joinDate: formJoinDate,
        elo: 0,
        monthStartElo: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        streak: 0,
        duesPaid: false,
        duesAmount: 25,
      };
      onUpdateMembers([...members, newMember]);
    }
    setIsAddingMember(false);
    setEditingMember(null);
  };

  const handleDeleteMember = (id: string) => {
    onUpdateMembers(members.filter((m) => m.id !== id));
  };

  const parsedCsvRows = useMemo<ParsedCsvMemberRow[]>(() => {
    if (!csvText.trim()) return [];
    const existingNames = new Set(
      members.map((m) => m.name.trim().toLowerCase())
    );
    const seenInBatch = new Set<string>();

    const lines = csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const rows: ParsedCsvMemberRow[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const cols = (
        line.includes('\t') ? line.split('\t') : line.split(',')
      ).map((c) => c.replace(/^["']|["']$/g, '').trim());
      if (cols.length === 0 || !cols[0]) continue;

      if (
        i === 0 &&
        /^(name|full\s*name|student|member|player)$/i.test(cols[0])
      ) {
        continue;
      }

      const name = cols[0];
      const grade = cols[1] ? normalizeGrade(cols[1]) : 10;
      const skillLevel = cols[2] ? normalizeSkill(cols[2]) : 'Intermediate';
      const duprRaw = cols[3] || '';
      const duprRating =
        duprRaw && /^[2-6](\.\d{1,3})?$/.test(duprRaw) ? duprRaw : undefined;
      const paddleNotes =
        cols[4] ||
        (duprRating ? 'Personal Paddle' : cols[3] || 'Personal Paddle');

      const nameKey = name.toLowerCase();
      const isDuplicate =
        existingNames.has(nameKey) || seenInBatch.has(nameKey);
      seenInBatch.add(nameKey);

      rows.push({
        name,
        grade,
        skillLevel,
        duprRating,
        paddleNotes,
        isDuplicate,
      });
    }

    return rows;
  }, [csvText, members]);

  const validNewCsvRows = useMemo(
    () => parsedCsvRows.filter((r) => !r.isDuplicate),
    [parsedCsvRows]
  );

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadSampleCsv = () => {
    setCsvText(
      [
        'Name, Grade, Skill Level, DUPR, Paddle',
        'Ethan Carter, 12, Advanced, 4.15, JOOLA Perseus 16mm',
        'Maya Lin, 11, Advanced, 3.90, Vatic Pro Prism Flash',
        'Lucas Brooks, 10, Intermediate, 3.45, Selkirk Vanguard Control',
        'Sophia Patel, 11, Intermediate, 3.35, Six Zero Double Black Diamond',
        'Noah Ramirez, 9, Beginner, 2.85, Club Loaner Paddle',
        'Chloe Nguyen, 12, Advanced, 3.80, CRBN 1X Power 16mm',
      ].join('\n')
    );
  };

  const handleCommitBulkImport = () => {
    if (validNewCsvRows.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const baseTs = Date.now();
    const createdMembers: Member[] = validNewCsvRows.map((row, idx) => ({
      id: `mem-${baseTs}-${idx + 1}`,
      name: row.name,
      grade: row.grade,
      skillLevel: row.skillLevel,
      duprRating: row.duprRating,
      paddleNotes: row.paddleNotes || 'Personal Paddle',
      joinDate: today,
      elo: 0,
      monthStartElo: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
      duesPaid: false,
      duesAmount: 25,
    }));

    onUpdateMembers([...members, ...createdMembers]);
    setCsvText('');
    setShowBulkImport(false);
  };

  const filteredMembers = members.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.paddleNotes.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.duprRating && m.duprRating.includes(searchQuery));
    const matchesGrade = gradeFilter === 'all' || m.grade === gradeFilter;
    const matchesSkill = skillFilter === 'all' || m.skillLevel === skillFilter;
    return matchesSearch && matchesGrade && matchesSkill;
  });

  return (
    <div className="space-y-6">
      {/* Practice Attendance & Member Roster Control Header */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Practice Attendance & Member Roster
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manage club members, School IDs, attendance sessions & bulk CSV
              roster import
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onNavigateToMultiCourt && (
              <button
                type="button"
                onClick={onNavigateToMultiCourt}
                className="min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold bg-amber-400 hover:bg-amber-300 text-slate-950 whitespace-nowrap cursor-pointer"
              >
                Smart Court Generator
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowNewSessionForm(!showNewSessionForm)}
              className="min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white whitespace-nowrap cursor-pointer"
            >
              + New Practice Date
            </button>

            {isOfficer && (
              <button
                type="button"
                onClick={() => setShowBulkImport(!showBulkImport)}
                className="min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white whitespace-nowrap cursor-pointer"
              >
                Bulk CSV Import
              </button>
            )}

            <button
              type="button"
              onClick={openAddMember}
              className="min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap cursor-pointer"
            >
              + Add Member
            </button>
          </div>
        </div>

        {/* New Practice Session Form */}
        {showNewSessionForm && (
          <form
            onSubmit={handleCreateSession}
            className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Practice Date
              </label>
              <input
                type="date"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
                required
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Session Title
              </label>
              <input
                type="text"
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="e.g. Thursday Ladder & Drills"
                required
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Create Session
              </button>
              <button
                type="button"
                onClick={() => setShowNewSessionForm(false)}
                className="min-h-[38px] px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Active Practice Session Selector */}
        <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Active Check-In Date:
            </span>
            {sortedSessions.length > 0 ? (
              <select
                value={activeSession?.id || ''}
                onChange={(e) => setSelectedSessionId(e.target.value)}
                aria-label="Select Practice Session"
                className="min-h-[36px] px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                {sortedSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.date} — {s.title} ({s.presentMemberIds.length}/
                    {members.length} Present)
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs text-slate-500">
                No session yet (Checking in a player will auto-create today&apos;s
                session)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {members.length > 0 && (
              <button
                type="button"
                onClick={handleMarkAllPresent}
                className="min-h-[34px] px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                Mark All Present
              </button>
            )}

            {isOfficer && activeSession && attendance.length > 1 && (
              <button
                type="button"
                onClick={() => handleDeleteSession(activeSession.id)}
                className="p-2 rounded text-slate-400 hover:text-red-600 cursor-pointer"
                title="Delete this attendance session"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* BULK CSV / SPREADSHEET ROSTER IMPORT DRAWER */}
      {showBulkImport && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Bulk CSV & Spreadsheet Roster Import
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Paste rows from Google Sheets or Excel, or upload a CSV file.
                Format: <strong>Name, Grade, Skill Level, DUPR, Paddle</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBulkImport(false)}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv,.txt,.tsv"
              onChange={handleCsvFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => csvFileInputRef.current?.click()}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 cursor-pointer"
            >
              Upload .CSV File
            </button>
            <button
              type="button"
              onClick={handleLoadSampleCsv}
              className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 cursor-pointer"
            >
              Load Sample 6-Player Roster
            </button>
            {csvText && (
              <button
                type="button"
                onClick={() => setCsvText('')}
                className="px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`Name, Grade, Skill Level, DUPR, Paddle\nEthan Carter, 12, Advanced, 4.15, JOOLA Perseus 16mm\nMaya Lin, 11, Intermediate, 3.50, Vatic Pro Prism Flash`}
            className="w-full p-3 rounded-md text-xs font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
          />

          {parsedCsvRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Preview ({validNewCsvRows.length} new members ready to import
                  {parsedCsvRows.length - validNewCsvRows.length > 0
                    ? ` · ${
                        parsedCsvRows.length - validNewCsvRows.length
                      } duplicate skipped`
                    : ''}
                  )
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {parsedCsvRows.map((row, idx) => (
                  <div
                    key={`${row.name}-${idx}`}
                    className={`px-3.5 py-2 flex items-center justify-between gap-3 ${
                      row.isDuplicate
                        ? 'opacity-50 bg-slate-50 dark:bg-slate-900'
                        : 'bg-white dark:bg-slate-900'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 dark:text-white">
                      {row.name}{' '}
                      {row.isDuplicate && (
                        <span className="text-[11px] font-normal text-amber-600">
                          (Already on roster — skipped)
                        </span>
                      )}
                    </div>
                    <div className="text-slate-500 font-mono-num">
                      Grade {row.grade} · {row.skillLevel}
                      {row.duprRating ? ` · ${row.duprRating} DUPR` : ''} ·{' '}
                      {row.paddleNotes}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBulkImport(false)}
                  className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={validNewCsvRows.length === 0}
                  onClick={handleCommitBulkImport}
                  className="px-4 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-40 cursor-pointer"
                >
                  Import {validNewCsvRows.length} Member
                  {validNewCsvRows.length === 1 ? '' : 's'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add / Edit Member Modal Drawer */}
      {isAddingMember && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-6">
          <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white mb-4">
            {editingMember
              ? `Edit Member: ${editingMember.name}`
              : 'Add New Club Member'}
          </h3>
          <form
            onSubmit={handleSaveMember}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                School ID
              </label>
              <input
                type="text"
                value={formSchoolId}
                onChange={(e) => setFormSchoolId(e.target.value)}
                placeholder="e.g. 204819"
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Jordan Alvarez"
                required
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Grade Level
              </label>
              <select
                value={formGrade}
                onChange={(e) =>
                  setFormGrade(Number(e.target.value) as GradeLevel)
                }
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value={9}>Grade 9 (Freshman)</option>
                <option value={10}>Grade 10 (Sophomore)</option>
                <option value={11}>Grade 11 (Junior)</option>
                <option value={12}>Grade 12 (Senior)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Skill Tier
              </label>
              <select
                value={formSkill}
                onChange={(e) => setFormSkill(e.target.value as SkillLevel)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                DUPR Rating (Optional)
              </label>
              <input
                type="text"
                value={formDupr}
                onChange={(e) => setFormDupr(e.target.value)}
                placeholder="e.g. 3.65"
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Paddle & Equipment Notes
              </label>
              <input
                type="text"
                value={formPaddle}
                onChange={(e) => setFormPaddle(e.target.value)}
                placeholder="e.g. Vatic Pro Prism Flash 16mm"
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                Join Date
              </label>
              <input
                type="date"
                value={formJoinDate}
                onChange={(e) => setFormJoinDate(e.target.value)}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            {/* Profile Photo Uploader */}
            <div className="sm:col-span-2 lg:col-span-3 p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="relative w-11 h-11 rounded-md overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700">
                  {formPhoto ? (
                    <img
                      src={formPhoto}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Camera className="w-4 h-4 text-slate-400" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900 dark:text-white">
                    {formPhoto ? 'Photo Attached' : 'Member Profile Photo'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {formPhotoUploading
                      ? 'Processing...'
                      : 'Upload player avatar photo (Optional)'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <label className="min-h-[34px] px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center cursor-pointer hover:bg-slate-100 transition-colors">
                  <span>{formPhoto ? 'Change Photo' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          setFormPhotoUploading(true);
                          const dataUrl = await processImageFileToDataUrl(file);
                          setFormPhoto(dataUrl);
                        } catch (err) {
                          console.error('Error processing image:', err);
                        } finally {
                          setFormPhotoUploading(false);
                        }
                      }
                    }}
                  />
                </label>
                {formPhoto && (
                  <button
                    type="button"
                    onClick={() => setFormPhoto('')}
                    className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-red-500 font-semibold cursor-pointer"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            {/* Officer Stats & Achievement Badges Editor (when editing an existing member) */}
            {editingMember && isOfficer && (
              <div className="sm:col-span-2 lg:col-span-3 p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="font-display text-base font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                      Officer Stats & Club Achievement Overrides
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Adjust Elo, Wins/Losses, Points & Streak, or manually grant/revoke any of the 10 achievement badges
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRecalculateFormStats}
                    className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                  >
                    Recalculate from Match History
                  </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Elo Rating
                    </label>
                    <input
                      type="number"
                      value={formElo}
                      onChange={(e) => setFormElo(Number(e.target.value))}
                      className="w-full min-h-[36px] px-2.5 py-1 rounded-md text-xs font-mono-num font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Month Start Elo
                    </label>
                    <input
                      type="number"
                      value={formMonthStartElo}
                      onChange={(e) =>
                        setFormMonthStartElo(Number(e.target.value))
                      }
                      className="w-full min-h-[36px] px-2.5 py-1 rounded-md text-xs font-mono-num font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-1">
                      Wins (W)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formWins}
                      onChange={(e) => setFormWins(Number(e.target.value))}
                      className="w-full min-h-[36px] px-2.5 py-1 rounded-md text-xs font-mono-num font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-red-500 mb-1">
                      Losses (L)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formLosses}
                      onChange={(e) => setFormLosses(Number(e.target.value))}
                      className="w-full min-h-[36px] px-2.5 py-1 rounded-md text-xs font-mono-num font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Points For (PF)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formPointsFor}
                      onChange={(e) => setFormPointsFor(Number(e.target.value))}
                      className="w-full min-h-[36px] px-2.5 py-1 rounded-md text-xs font-mono-num font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Points Against (PA)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formPointsAgainst}
                      onChange={(e) =>
                        setFormPointsAgainst(Number(e.target.value))
                      }
                      className="w-full min-h-[36px] px-2.5 py-1 rounded-md text-xs font-mono-num font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                      Streak (+/-)
                    </label>
                    <input
                      type="number"
                      value={formStreak}
                      onChange={(e) => setFormStreak(Number(e.target.value))}
                      className="w-full min-h-[36px] px-2.5 py-1 rounded-md text-xs font-mono-num font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Achievement Badges Override Grid */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Club Achievement Badges (Grant / Lock / Auto)
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setFormUnlockedAchievementIds(
                            ALL_ACHIEVEMENT_DEFINITIONS.map((b) => b.id)
                          );
                          setFormRevokedAchievementIds([]);
                        }}
                        className="px-2.5 py-1 rounded text-[11px] font-bold bg-emerald-600 text-white cursor-pointer"
                      >
                        Unlock All 10
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormUnlockedAchievementIds([]);
                          setFormRevokedAchievementIds([]);
                        }}
                        className="px-2.5 py-1 rounded text-[11px] font-bold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 cursor-pointer"
                      >
                        Reset All to Auto
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                    {computeMemberAchievements(
                      {
                        ...editingMember,
                        elo: formElo,
                        wins: formWins,
                        losses: formLosses,
                        streak: formStreak,
                        unlockedAchievementIds: formUnlockedAchievementIds,
                        revokedAchievementIds: formRevokedAchievementIds,
                      },
                      matches,
                      attendance,
                      challenges
                    ).map((badge) => (
                      <div
                        key={badge.id}
                        className={`p-2.5 rounded-md border flex flex-col justify-between gap-2 text-xs ${
                          badge.unlocked
                            ? 'bg-white dark:bg-slate-900 border-emerald-500/70'
                            : 'bg-slate-100/70 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-80'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-slate-900 dark:text-white truncate">
                              {badge.title}
                            </span>
                            <span
                              className={`text-[10px] font-mono-num font-bold uppercase ${
                                badge.unlocked
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {badge.unlocked ? 'UNLOCKED' : 'LOCKED'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {badge.description}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleFormBadgeOverride(badge.id, 'granted')
                            }
                            className={`py-1 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              badge.overrideStatus === 'granted'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            Grant
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleFormBadgeOverride(badge.id, 'revoked')
                            }
                            className={`py-1 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              badge.overrideStatus === 'revoked'
                                ? 'bg-red-600 text-white'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            Lock
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleFormBadgeOverride(badge.id, 'auto')
                            }
                            className={`py-1 rounded text-[10px] font-bold uppercase cursor-pointer ${
                              badge.overrideStatus === 'auto'
                                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            Auto
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingMember(false);
                  setEditingMember(null);
                }}
                className="px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                {editingMember ? 'Save Changes' : 'Add Member to Roster'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Bar + Roster Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name, paddle, or DUPR..."
              className="w-full min-h-[38px] pl-9 pr-4 py-1.5 rounded-md text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Interactive Grade & Skill Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Grade Filter */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
              {(['all', 9, 10, 11, 12] as const).map((g) => (
                <button
                  key={String(g)}
                  onClick={() => setGradeFilter(g)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                    gradeFilter === g
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {g === 'all' ? 'All Grades' : `${g}th`}
                </button>
              ))}
            </div>

            {/* Skill Filter */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-md">
              {(['all', 'Beginner', 'Intermediate', 'Advanced'] as const).map(
                (sk) => (
                  <button
                    key={sk}
                    onClick={() => setSkillFilter(sk)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors whitespace-nowrap cursor-pointer ${
                      skillFilter === sk
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {sk === 'all' ? 'All Skills' : sk}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Roster List */}
        <div className="overflow-x-auto touch-scroll mt-4">
          <table className="w-full min-w-[720px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono-num uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-3">
                  Check-In ({activeSession?.date || 'Today'})
                </th>
                <th className="py-3 px-3">Member & Join Date</th>
                <th className="py-3 px-3">Grade</th>
                <th className="py-3 px-3">Skill / DUPR</th>
                <th className="py-3 px-3">Paddle & Equipment Notes</th>
                <th className="py-3 px-3 text-right">Attendance %</th>
                {isOfficer && <th className="py-3 pl-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {filteredMembers.map((member) => {
                const isPresent =
                  activeSession?.presentMemberIds.includes(member.id) ?? false;
                const att = getMemberAttendanceStats(member.id);

                return (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pr-3">
                      <button
                        onClick={() => handleToggleAttendance(member.id)}
                        className={`min-h-[34px] px-3 py-1.5 rounded-md text-xs font-mono-num font-bold transition-colors whitespace-nowrap cursor-pointer ${
                          isPresent
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {isPresent ? 'PRESENT' : 'Check In'}
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={member.name}
                            className="w-8 h-8 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 border border-slate-200 dark:border-slate-700 text-[11px]">
                            {member.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                            <span>{member.name}</span>
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num tabular-nums">
                            Joined {member.joinDate} · {member.elo} Elo
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {member.grade}th
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-700 dark:text-slate-300">
                      <span>{member.skillLevel}</span>
                      {member.duprRating && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono-num font-semibold text-slate-900 dark:text-white">
                            {member.duprRating} DUPR
                          </span>
                        </>
                      )}
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                      {member.paddleNotes}
                    </td>

                    <td className="py-3 px-3 text-right font-mono-num tabular-nums">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {att.pct}%
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {att.attended}/{att.total} practices
                      </div>
                    </td>

                    {isOfficer && (
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditMember(member)}
                            className="p-2 rounded text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit member"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="p-2 rounded text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                            title="Delete member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}

              {filteredMembers.length === 0 && (
                <tr>
                  <td
                    colSpan={isOfficer ? 7 : 6}
                    className="py-10 text-center space-y-2"
                  >
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {members.length === 0
                        ? 'Your Club Roster is Empty'
                        : 'No members match your current search or filter'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {members.length === 0
                        ? 'Click "+ Add Member" or "Bulk CSV Import" above to add club members.'
                        : 'Try clearing the grade or skill filter.'}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
