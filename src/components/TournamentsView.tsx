import React, { useState, useMemo } from 'react';
import {
  Trophy,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  ClubTournament,
  ClubTournamentParticipant,
  ClubTournamentMatch,
  Member,
  PendingTournamentScoreContext,
} from '../types';
import {
  generateRoundRobinMatches,
  generateSingleEliminationMatches,
  updateTournamentMatchList,
} from '../utils/clubUtils';

type ClubTournamentFormat = 'round_robin' | 'single_elimination';

interface TournamentsViewProps {
  clubTournaments: ClubTournament[];
  members: Member[];
  isOfficer: boolean;
  activeMember?: Member | null;
  onUpdateClubTournaments: (next: ClubTournament[]) => void;
  onLaunchScoreKeeperForTournament: (
    ctx: PendingTournamentScoreContext
  ) => void;
  onRequestOfficerUnlock: () => void;
}

export const TournamentsView: React.FC<TournamentsViewProps> = ({
  clubTournaments,
  members,
  isOfficer,
  onUpdateClubTournaments,
  onLaunchScoreKeeperForTournament,
  onRequestOfficerUnlock,
}) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    clubTournaments[0]?.id || ''
  );

  // Create Club Tournament Form State
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDate, setNewDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [newFormat, setNewFormat] = useState<ClubTournamentFormat>(
    'single_elimination'
  );
  const [newPlayType, setNewPlayType] = useState<'singles' | 'doubles'>(
    'doubles'
  );
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>(() =>
    members.slice(0, 8).map((m) => m.id)
  );
  const [createError, setCreateError] = useState<string | null>(null);

  // Inline Score Entry State
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editScore1, setEditScore1] = useState<string>('11');
  const [editScore2, setEditScore2] = useState<string>('8');
  const [scoreError, setScoreError] = useState<string | null>(null);

  const activeTournament = useMemo(
    () =>
      clubTournaments.find((t) => t.id === selectedTournamentId) ||
      clubTournaments[0] ||
      null,
    [clubTournaments, selectedTournamentId]
  );

  const toggleMemberForNewTournament = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGenerateTournament = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError('Please enter a tournament title.');
      return;
    }

    const chosenMembers = members
      .filter((m) => selectedMemberIds.includes(m.id))
      .sort((a, b) => b.elo - a.elo);

    if (newPlayType === 'singles' && chosenMembers.length < 2) {
      setCreateError('Select at least 2 players for a Singles tournament.');
      return;
    }
    if (newPlayType === 'doubles' && chosenMembers.length < 4) {
      setCreateError(
        'Select at least 4 players (2 teams) for a Doubles tournament.'
      );
      return;
    }

    const participants: ClubTournamentParticipant[] = [];

    if (newPlayType === 'singles') {
      chosenMembers.forEach((m) => {
        participants.push({
          id: `part-${m.id}`,
          name: m.name,
          playerIds: [m.id],
        });
      });
    } else {
      const pairCount = Math.floor(chosenMembers.length / 2);
      for (let i = 0; i < pairCount; i++) {
        const highSeed = chosenMembers[i];
        const partner = chosenMembers[chosenMembers.length - 1 - i];
        participants.push({
          id: `pair-${highSeed.id}-${partner.id}`,
          name: `${highSeed.name.split(' ')[0]} / ${partner.name.split(' ')[0]}`,
          playerIds: [highSeed.id, partner.id],
        });
      }
    }

    const generatedMatches: ClubTournamentMatch[] =
      newFormat === 'round_robin'
        ? generateRoundRobinMatches(participants)
        : generateSingleEliminationMatches(participants);

    const created: ClubTournament = {
      id: `ct-${Date.now()}`,
      name: newName.trim(),
      date: newDate,
      format: newFormat,
      playStyle: newPlayType,
      status: 'Active',
      participants,
      matches: generatedMatches,
    };

    onUpdateClubTournaments([created, ...clubTournaments]);
    setSelectedTournamentId(created.id);
    setNewName('');
    setIsCreating(false);
  };

  const handleSaveInlineMatchScore = (matchId: string) => {
    if (!activeTournament) return;
    const s1 = parseInt(editScore1, 10);
    const s2 = parseInt(editScore2, 10);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setScoreError('Enter valid non-negative scores.');
      return;
    }
    if (s1 === s2) {
      setScoreError('Pickleball matches cannot end in a tie.');
      return;
    }

    setScoreError(null);
    const updatedMatches = updateTournamentMatchList(
      activeTournament.matches,
      matchId,
      s1,
      s2
    );

    const allFinished = updatedMatches.every((m) => m.winner !== null);

    const updatedTournament: ClubTournament = {
      ...activeTournament,
      status: allFinished ? 'Completed' : 'Active',
      matches: updatedMatches,
    };

    onUpdateClubTournaments(
      clubTournaments.map((t) =>
        t.id === activeTournament.id ? updatedTournament : t
      )
    );
    setEditingMatchId(null);
  };

  const handleDeleteClubTournament = (id: string) => {
    const remaining = clubTournaments.filter((t) => t.id !== id);
    onUpdateClubTournaments(remaining);
    if (selectedTournamentId === id && remaining.length > 0) {
      setSelectedTournamentId(remaining[0].id);
    }
  };

  // Standings table for Round Robin tournaments
  const roundRobinStandings = useMemo(() => {
    if (!activeTournament || activeTournament.format !== 'round_robin') {
      return [];
    }
    const statsMap = new Map<
      string,
      {
        id: string;
        name: string;
        wins: number;
        losses: number;
        pf: number;
        pa: number;
      }
    >();

    activeTournament.participants.forEach((p) => {
      statsMap.set(p.id, {
        id: p.id,
        name: p.name,
        wins: 0,
        losses: 0,
        pf: 0,
        pa: 0,
      });
    });

    activeTournament.matches.forEach((m) => {
      if (m.winner && m.score1 !== null && m.score2 !== null) {
        const t1 = m.team1Id ? statsMap.get(m.team1Id) : undefined;
        const t2 = m.team2Id ? statsMap.get(m.team2Id) : undefined;
        if (t1) {
          t1.pf += m.score1;
          t1.pa += m.score2;
          if (m.winner === 1) t1.wins += 1;
          else t1.losses += 1;
        }
        if (t2) {
          t2.pf += m.score2;
          t2.pa += m.score1;
          if (m.winner === 2) t2.wins += 1;
          else t2.losses += 1;
        }
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.pf - b.pa - (a.pf - a.pa);
    });
  }, [activeTournament]);

  // Group Single Elimination matches by round number dynamically
  const singleElimRounds = useMemo(() => {
    if (!activeTournament || activeTournament.format !== 'single_elimination') {
      return [];
    }
    const roundMap = new Map<
      number,
      { round: number; label: string; matches: ClubTournamentMatch[] }
    >();
    activeTournament.matches.forEach((m) => {
      const existing = roundMap.get(m.round);
      if (existing) {
        existing.matches.push(m);
      } else {
        roundMap.set(m.round, {
          round: m.round,
          label: m.roundLabel,
          matches: [m],
        });
      }
    });
    return Array.from(roundMap.values()).sort((a, b) => a.round - b.round);
  }, [activeTournament]);

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.name || 'Club Member';

  const renderMatchCard = (m: ClubTournamentMatch) => {
    const isEditing = editingMatchId === m.id;
    const canScoreLive =
      m.team1PlayerIds.length > 0 &&
      m.team2PlayerIds.length > 0 &&
      activeTournament;

    return (
      <div
        key={m.id}
        className={`rounded-md p-3.5 border transition-all ${
          m.winner
            ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
        }`}
      >
        <div className="flex items-center justify-between text-[11px] font-mono-num uppercase text-slate-500 dark:text-slate-400 mb-2">
          <span>{m.court}</span>
          <span>{m.winner ? 'Final' : 'Scheduled'}</span>
        </div>

        {/* Team 1 Row */}
        <div
          className={`flex items-center justify-between py-1.5 px-2.5 rounded ${
            m.winner === 1
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          <span className="text-xs truncate pr-2">{m.team1Name}</span>
          <span className="font-mono-num text-sm font-bold">
            {m.score1 !== null ? m.score1 : '—'}
          </span>
        </div>

        {/* Team 2 Row */}
        <div
          className={`flex items-center justify-between py-1.5 px-2.5 rounded mt-1 ${
            m.winner === 2
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          <span className="text-xs truncate pr-2">{m.team2Name}</span>
          <span className="font-mono-num text-sm font-bold">
            {m.score2 !== null ? m.score2 : '—'}
          </span>
        </div>

        {/* Inline Score Editor */}
        {isEditing ? (
          <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400">
                  Team 1 Score
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={editScore1}
                  onChange={(e) => setEditScore1(e.target.value)}
                  className="w-full px-2 py-1 rounded text-xs font-mono-num bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold uppercase text-slate-400">
                  Team 2 Score
                </label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={editScore2}
                  onChange={(e) => setEditScore2(e.target.value)}
                  className="w-full px-2 py-1 rounded text-xs font-mono-num bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>
            </div>
            {scoreError && (
              <div className="text-[11px] font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{scoreError}</span>
              </div>
            )}
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditingMatchId(null);
                  setScoreError(null);
                }}
                className="px-2 py-1 text-[11px] font-semibold text-slate-500 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveInlineMatchScore(m.id)}
                className="px-2.5 py-1 rounded bg-blue-600 text-white text-[11px] font-semibold cursor-pointer"
              >
                Save Score
              </button>
            </div>
          </div>
        ) : (
          isOfficer &&
          m.team1Id &&
          m.team2Id && (
            <div className="mt-2.5 pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditingMatchId(m.id);
                  setScoreError(null);
                  setEditScore1(m.score1 !== null ? String(m.score1) : '11');
                  setEditScore2(m.score2 !== null ? String(m.score2) : '8');
                }}
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
              >
                {m.winner ? 'Edit Score' : 'Enter Score'}
              </button>

              {canScoreLive && !m.winner && (
                <button
                  type="button"
                  onClick={() =>
                    onLaunchScoreKeeperForTournament({
                      tournamentId: activeTournament.id,
                      matchId: m.id,
                      playStyle: activeTournament.playStyle,
                      team1PlayerIds: m.team1PlayerIds,
                      team2PlayerIds: m.team2PlayerIds,
                      label: `${activeTournament.name} · ${m.roundLabel}`,
                    })
                  }
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Score on Court →
                </button>
              )}
            </div>
          )
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header Bar: In-Club Brackets */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            In-Club Tournament Brackets
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Single Elimination & Round Robin brackets seeded by live Club Ladder Elo
          </p>
        </div>
      </div>

      {/* IN-CLUB TOURNAMENT BRACKETS */}
      <div className="space-y-6">
          {/* Tournament Selector + Create Button */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {clubTournaments.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTournamentId(t.id)}
                  className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    activeTournament?.id === t.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {t.name}
                </button>
              ))}

              {isOfficer && (
                <button
                  onClick={() => {
                    setIsCreating(!isCreating);
                    setCreateError(null);
                  }}
                  className="px-3.5 py-2 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Bracket</span>
                </button>
              )}
            </div>

            {!isOfficer && (
              <button
                type="button"
                onClick={onRequestOfficerUnlock}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Officer Sign-In to Manage Brackets →
              </button>
            )}
          </div>

          {/* Create Club Tournament Modal/Drawer */}
          {isOfficer && isCreating && (
            <form
              onSubmit={handleGenerateTournament}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-6 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Generate New Club Bracket
                </h3>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Tournament Title
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g. Fall Doubles Invitational"
                    required
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Bracket Format
                  </label>
                  <select
                    value={newFormat}
                    onChange={(e) =>
                      setNewFormat(e.target.value as ClubTournamentFormat)
                    }
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="single_elimination">
                      Single Elimination (Up to 16 Seeds)
                    </option>
                    <option value="round_robin">Round Robin Pool Play</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    Play Type
                  </label>
                  <select
                    value={newPlayType}
                    onChange={(e) =>
                      setNewPlayType(e.target.value as 'singles' | 'doubles')
                    }
                    className="w-full min-h-[38px] px-3 py-1.5 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="doubles">
                      Doubles (Auto-Pair by Elo Seed)
                    </option>
                    <option value="singles">Singles (1v1)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Select Participating Members ({selectedMemberIds.length}{' '}
                    selected)
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedMemberIds(members.map((m) => m.id))
                      }
                      className="text-xs font-semibold text-blue-600 dark:text-blue-400 cursor-pointer"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberIds([])}
                      className="text-xs font-semibold text-slate-500 cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  {members.map((m) => {
                    const checked = selectedMemberIds.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => toggleMemberForNewTournament(m.id)}
                        className={`px-2.5 py-1.5 rounded text-xs text-left flex items-center justify-between transition-colors cursor-pointer ${
                          checked
                            ? 'bg-blue-600 text-white font-semibold'
                            : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <span className="truncate">{m.name}</span>
                        <span className="font-mono-num text-[10px] opacity-80 ml-1">
                          {m.elo}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {createError && (
                <div className="text-xs font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                >
                  Generate Bracket & Match Schedule
                </button>
              </div>
            </form>
          )}

          {/* Active Club Tournament Display */}
          {activeTournament ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono-num uppercase font-semibold text-slate-500">
                      {activeTournament.format === 'single_elimination'
                        ? 'Single Elimination Bracket'
                        : 'Round Robin Pool Play'}{' '}
                      · {activeTournament.playStyle.toUpperCase()}
                    </span>
                    <span className="text-xs font-mono-num text-slate-400">
                      · {activeTournament.date}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                    {activeTournament.name}
                  </h3>
                </div>

                {isOfficer && (
                  <button
                    onClick={() =>
                      handleDeleteClubTournament(activeTournament.id)
                    }
                    className="px-3 py-1.5 rounded-md text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Bracket</span>
                  </button>
                )}
              </div>

              {/* SINGLE ELIMINATION BRACKET TREE */}
              {activeTournament.format === 'single_elimination' ? (
                <div
                  className={`grid grid-cols-1 gap-6 ${
                    singleElimRounds.length === 4
                      ? 'lg:grid-cols-4'
                      : singleElimRounds.length === 3
                      ? 'lg:grid-cols-3'
                      : 'lg:grid-cols-2'
                  }`}
                >
                  {singleElimRounds.map((roundGroup) => (
                    <div key={roundGroup.round} className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        {roundGroup.label === 'Championship Final' && (
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                        )}
                        <span>{roundGroup.label}</span>
                      </div>
                      <div className="space-y-3">
                        {roundGroup.matches.map(renderMatchCard)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ROUND ROBIN POOL STANDINGS & SCHEDULE */
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-5 space-y-3">
                    <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Pool Standings
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono-num uppercase text-slate-500">
                            <th className="py-2 pr-2">#</th>
                            <th className="py-2 px-2">Team / Player</th>
                            <th className="py-2 px-2 text-right">W–L</th>
                            <th className="py-2 pl-2 text-right">Diff</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {roundRobinStandings.map((row, idx) => {
                            const diff = row.pf - row.pa;
                            return (
                              <tr key={row.id}>
                                <td className="py-2.5 pr-2 font-mono-num font-bold">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-2 font-semibold text-slate-900 dark:text-white">
                                  {row.name}
                                </td>
                                <td className="py-2.5 px-2 text-right font-mono-num">
                                  {row.wins}–{row.losses}
                                </td>
                                <td
                                  className={`py-2.5 pl-2 text-right font-mono-num font-semibold ${
                                    diff >= 0
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-red-500'
                                  }`}
                                >
                                  {diff >= 0 ? `+${diff}` : diff}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="lg:col-span-7 space-y-3">
                    <h4 className="font-display text-base font-bold text-slate-900 dark:text-white">
                      Round Robin Match Schedule
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {activeTournament.matches.map(renderMatchCard)}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-10 text-center space-y-3">
              <div className="text-base font-bold text-slate-900 dark:text-white">
                No Club Tournament Brackets Created Yet
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {isOfficer
                  ? 'Click "New Bracket" above to generate a Single Elimination or Round Robin tournament seeded by your Club Ladder.'
                  : 'Club Officers have not published a tournament bracket yet.'}
              </p>
            </div>
          )}
        </div>
    </div>
  );
};
