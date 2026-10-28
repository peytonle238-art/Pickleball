import React, { useState } from 'react';
import {
  Check,
  Edit3,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import {
  AttendanceSession,
  GradeLevel,
  Member,
  SkillLevel,
} from '../types';

interface MembersAttendanceViewProps {
  members: Member[];
  attendance: AttendanceSession[];
  isOfficer: boolean;
  onUpdateMembers: (members: Member[]) => void;
  onUpdateAttendance: (attendance: AttendanceSession[]) => void;
  onRequestOfficerUnlock: () => void;
}

export const MembersAttendanceView: React.FC<MembersAttendanceViewProps> = ({
  members,
  attendance,
  isOfficer,
  onUpdateMembers,
  onUpdateAttendance,
  onRequestOfficerUnlock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'all' | GradeLevel>('all');
  const [skillFilter, setSkillFilter] = useState<'all' | SkillLevel>('all');

  // Active practice session for 1-tap attendance check-in
  const sortedSessions = [...attendance].sort((a, b) =>
    b.date.localeCompare(a.date)
  );
  const [selectedSessionId, setSelectedSessionId] = useState<string>(
    sortedSessions[0]?.id || ''
  );

  // New practice session modal / inline form
  const [showNewSessionForm, setShowNewSessionForm] = useState(false);
  const [newSessionDate, setNewSessionDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newSessionTitle, setNewSessionTitle] = useState(
    'After-School Practice & Ladder'
  );

  // Add / Edit Member modal state
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const [formName, setFormName] = useState('');
  const [formGrade, setFormGrade] = useState<GradeLevel>(10);
  const [formSkill, setFormSkill] = useState<SkillLevel>('Intermediate');
  const [formDupr, setFormDupr] = useState('');
  const [formPaddle, setFormPaddle] = useState('');
  const [formJoinDate, setFormJoinDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

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

  // One-tap attendance toggle per member
  const handleToggleAttendance = (memberId: string) => {
    if (!activeSession) return;
    const exists = activeSession.presentMemberIds.includes(memberId);
    const updatedPresent = exists
      ? activeSession.presentMemberIds.filter((id) => id !== memberId)
      : [...activeSession.presentMemberIds, memberId];

    onUpdateAttendance(
      attendance.map((s) =>
        s.id === activeSession.id
          ? { ...s, presentMemberIds: updatedPresent }
          : s
      )
    );
  };

  const handleMarkAllPresent = () => {
    if (!activeSession) return;
    onUpdateAttendance(
      attendance.map((s) =>
        s.id === activeSession.id
          ? { ...s, presentMemberIds: members.map((m) => m.id) }
          : s
      )
    );
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
    setFormName('');
    setFormGrade(10);
    setFormSkill('Intermediate');
    setFormDupr('3.25');
    setFormPaddle('');
    setFormJoinDate(new Date().toISOString().slice(0, 10));
    setIsAddingMember(true);
  };

  const openEditMember = (m: Member) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingMember(m);
    setFormName(m.name);
    setFormGrade(m.grade);
    setFormSkill(m.skillLevel);
    setFormDupr(m.duprRating || '');
    setFormPaddle(m.paddleNotes);
    setFormJoinDate(m.joinDate);
    setIsAddingMember(true);
  };

  const handleSaveMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;

    if (editingMember) {
      onUpdateMembers(
        members.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                name: formName.trim(),
                grade: formGrade,
                skillLevel: formSkill,
                duprRating: formDupr.trim() || undefined,
                paddleNotes: formPaddle.trim() || 'Club Loaner Paddle',
                joinDate: formJoinDate,
              }
            : m
        )
      );
    } else {
      const newMember: Member = {
        id: `mem-${Date.now()}`,
        name: formName.trim(),
        grade: formGrade,
        skillLevel: formSkill,
        duprRating: formDupr.trim() || undefined,
        paddleNotes: formPaddle.trim() || 'Personal Paddle',
        joinDate: formJoinDate,
        elo: 1200,
        monthStartElo: 1200,
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
      {/* Practice Attendance Check-In Control Header */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Practice Attendance & Member Roster
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              One-tap practice check-in per member · Live attendance percentages
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowNewSessionForm(!showNewSessionForm)}
              className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              New Practice Date
            </button>

            <button
              onClick={openAddMember}
              className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold text-white inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <UserPlus className="w-4 h-4" />
              Add Member
            </button>
          </div>
        </div>

        {/* New Practice Session Form */}
        {showNewSessionForm && (
          <form
            onSubmit={handleCreateSession}
            className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-3">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Practice Date
              </label>
              <input
                type="date"
                value={newSessionDate}
                onChange={(e) => setNewSessionDate(e.target.value)}
                required
                className="w-full min-h-[40px] px-3 py-1.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-6">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Session Title
              </label>
              <input
                type="text"
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
                placeholder="e.g. Thursday Ladder & Drills"
                required
                className="w-full min-h-[40px] px-3 py-1.5 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                className="w-full min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                Create Session
              </button>
              <button
                type="button"
                onClick={() => setShowNewSessionForm(false)}
                className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Active Practice Session Selector Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              Active Check-In Date:
            </span>
            <select
              value={activeSession?.id || ''}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              aria-label="Select Practice Session"
              className="min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            >
              {sortedSessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.date} — {s.title} ({s.presentMemberIds.length}/
                  {members.length} Present)
                </option>
              ))}
            </select>
          </div>

          {activeSession && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                Checked In:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {activeSession.presentMemberIds.length} / {members.length}
                </strong>{' '}
                (
                {Math.round(
                  (activeSession.presentMemberIds.length /
                    Math.max(1, members.length)) *
                    100
                )}
                %)
              </span>
              <button
                onClick={handleMarkAllPresent}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 cursor-pointer"
              >
                Mark All Present
              </button>
              {isOfficer && attendance.length > 1 && (
                <button
                  onClick={() => handleDeleteSession(activeSession.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                  title="Delete this attendance session"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Member Modal Drawer */}
      {isAddingMember && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
          <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white mb-4">
            {editingMember ? `Edit Member: ${editingMember.name}` : 'Add New Club Member'}
          </h3>
          <form
            onSubmit={handleSaveMember}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Jordan Alvarez"
                required
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Grade Level
              </label>
              <select
                value={formGrade}
                onChange={(e) => setFormGrade(Number(e.target.value) as GradeLevel)}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value={9}>Grade 9 (Freshman)</option>
                <option value={10}>Grade 10 (Sophomore)</option>
                <option value={11}>Grade 11 (Junior)</option>
                <option value={12}>Grade 12 (Senior)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Skill Tier
              </label>
              <select
                value={formSkill}
                onChange={(e) => setFormSkill(e.target.value as SkillLevel)}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="Beginner">Beginner</option>
                <option value="Intermediate">Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                DUPR Rating (Optional)
              </label>
              <input
                type="text"
                value={formDupr}
                onChange={(e) => setFormDupr(e.target.value)}
                placeholder="e.g. 3.65"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Paddle & Equipment Notes
              </label>
              <input
                type="text"
                value={formPaddle}
                onChange={(e) => setFormPaddle(e.target.value)}
                placeholder="e.g. Vatic Pro Prism Flash 16mm"
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Join Date
              </label>
              <input
                type="date"
                value={formJoinDate}
                onChange={(e) => setFormJoinDate(e.target.value)}
                className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3 flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAddingMember(false);
                  setEditingMember(null);
                }}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                {editingMember ? 'Save Changes' : 'Add Member to Roster'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Filter Bar + Roster Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100 dark:border-slate-800">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search member name, paddle, or DUPR..."
              className="w-full min-h-[42px] pl-10 pr-4 py-2 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            />
          </div>

          {/* Interactive Grade & Skill Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Grade Filter */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['all', 9, 10, 11, 12] as const).map((g) => (
                <button
                  key={String(g)}
                  onClick={() => setGradeFilter(g)}
                  className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                    gradeFilter === g
                      ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {g === 'all' ? 'All Grades' : `${g}th`}
                </button>
              ))}
            </div>

            {/* Skill Filter */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {(['all', 'Beginner', 'Intermediate', 'Advanced'] as const).map(
                (sk) => (
                  <button
                    key={sk}
                    onClick={() => setSkillFilter(sk)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                      skillFilter === sk
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
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
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-3">1-Tap Check-In ({activeSession?.date})</th>
                <th className="py-3 px-3">Member & Join Date</th>
                <th className="py-3 px-3">Grade</th>
                <th className="py-3 px-3">Skill / DUPR</th>
                <th className="py-3 px-3">Paddle & Equipment Notes</th>
                <th className="py-3 px-3 text-right">Attendance %</th>
                {isOfficer && <th className="py-3 pl-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
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
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
                          isPresent
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        {isPresent ? 'Present' : 'Check In'}
                      </button>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {member.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        Joined {member.joinDate} · {member.elo} Elo
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

                    <td className="py-3 px-3 text-right">
                      <div className="font-mono-num font-bold text-slate-900 dark:text-white">
                        {att.pct}%
                      </div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {att.attended}/{att.total} practices
                      </div>
                    </td>

                    {isOfficer && (
                      <td className="py-3 pl-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            onClick={() => openEditMember(member)}
                            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Edit member"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteMember(member.id)}
                            className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
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
                    className="py-8 text-center text-sm text-slate-500"
                  >
                    No members match your current search or filter criteria.
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
