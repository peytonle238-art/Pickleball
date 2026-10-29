import React, { useState } from 'react';
import {
  Play,
  Plus,
  Printer,
  Trash2,
  Trophy,
} from 'lucide-react';
import {
  ClubTournament,
  ClubTournamentParticipant,
  Member,
  NavTab,
  OutsideTournament,
  PendingTournamentScoreContext,
} from '../types';
import {
  generateRoundRobinMatches,
  generateSingleEliminationMatches,
  updateTournamentMatchList,
} from '../utils/clubUtils';

interface TournamentsViewProps {
  clubTournaments: ClubTournament[];
  members: Member[];
  isOfficer: boolean;
  onUpdateClubTournaments: (list: ClubTournament[]) => void;
  onLaunchScoreKeeperForTournament: (ctx: PendingTournamentScoreContext) => void;
  activeSubTab?: NavTab;
  onSwitchSubTab?: (tab: NavTab) => void;
  outsideTournaments?: OutsideTournament[];
  onUpdateOutsideTournaments?: (list: OutsideTournament[]) => void;
  onRequestOfficerUnlock?: () => void;
}

export const TournamentsView: React.FC<TournamentsViewProps> = ({
  clubTournaments,
  members,
  isOfficer,
  onUpdateClubTournaments,
  onLaunchScoreKeeperForTournament,
}) => {
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>(
    clubTournaments[0]?.id || ''
  );
  const [showCreateClubForm, setShowCreateClubForm] = useState(false);

  // Create Club Tournament form state
  const [newTourneyName, setNewTourneyName] = useState('');
  const [newTourneyDate, setNewTourneyDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newTourneyFormat, setNewTourneyFormat] = useState<
    'round_robin' | 'single_elimination'
  >('round_robin');
  const [newTourneyStyle, setNewTourneyStyle] = useState<'singles' | 'doubles'>(
    'doubles'
  );
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>(
    members.slice(0, 4).map((m) => m.id)
  );

  // Manual score edit state inside club tournament
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [manualScore1, setManualScore1] = useState<number>(11);
  const [manualScore2, setManualScore2] = useState<number>(7);

  const activeClubTournament =
    clubTournaments.find((t) => t.id === selectedTournamentId) ||
    clubTournaments[0];

  const togglePlayerSelection = (id: string) => {
    setSelectedPlayerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCreateClubTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOfficer || !newTourneyName.trim()) return;

    const chosenMembers = members.filter((m) => selectedPlayerIds.includes(m.id));
    const participants: ClubTournamentParticipant[] = [];

    if (newTourneyStyle === 'singles') {
      chosenMembers.forEach((m, idx) => {
        participants.push({
          id: `part-${Date.now()}-${idx}`,
          name: m.name,
          playerIds: [m.id],
        });
      });
    } else {
      // Pair up selected players into doubles teams
      for (let i = 0; i < chosenMembers.length; i += 2) {
        const m1 = chosenMembers[i];
        const m2 = chosenMembers[i + 1];
        if (m1 && m2) {
          const short1 = `${m1.name.split(' ')[0]} ${m1.name.split(' ')[1]?.[0] || ''}.`;
          const short2 = `${m2.name.split(' ')[0]} ${m2.name.split(' ')[1]?.[0] || ''}.`;
          participants.push({
            id: `part-${Date.now()}-${i}`,
            name: `${short1} / ${short2}`,
            playerIds: [m1.id, m2.id],
          });
        }
      }
    }

    if (participants.length < 2) return;

    const generatedMatches =
      newTourneyFormat === 'round_robin'
        ? generateRoundRobinMatches(participants)
        : generateSingleEliminationMatches(participants);

    const created: ClubTournament = {
      id: `ct-${Date.now()}`,
      name: newTourneyName.trim(),
      date: newTourneyDate,
      format: newTourneyFormat,
      playStyle: newTourneyStyle,
      status: 'Active',
      participants,
      matches: generatedMatches,
    };

    onUpdateClubTournaments([created, ...clubTournaments]);
    setSelectedTournamentId(created.id);
    setShowCreateClubForm(false);
    setNewTourneyName('');
  };

  const handleSaveManualTournamentScore = (matchId: string) => {
    if (!isOfficer || !activeClubTournament) return;
    const updatedMatches = updateTournamentMatchList(
      activeClubTournament.matches,
      matchId,
      manualScore1,
      manualScore2
    );
    const allDone = updatedMatches.every((m) => m.winner !== null);
    onUpdateClubTournaments(
      clubTournaments.map((t) =>
        t.id === activeClubTournament.id
          ? {
              ...t,
              matches: updatedMatches,
              status: allDone ? 'Completed' : 'Active',
            }
          : t
      )
    );
    setEditingMatchId(null);
  };

  const handleDeleteClubTournament = (id: string) => {
    if (!isOfficer) return;
    const remaining = clubTournaments.filter((t) => t.id !== id);
    onUpdateClubTournaments(remaining);
    if (selectedTournamentId === id) {
      setSelectedTournamentId(remaining[0]?.id || '');
    }
  };

  // Compute live standings for active tournament
  const computeStandings = (tourney: ClubTournament) => {
    return tourney.participants
      .map((p) => {
        let wins = 0;
        let losses = 0;
        let pf = 0;
        let pa = 0;

        for (const m of tourney.matches) {
          if (m.winner === null || m.score1 === null || m.score2 === null) continue;
          if (m.team1Id === p.id) {
            pf += m.score1;
            pa += m.score2;
            if (m.winner === 1) wins++;
            else losses++;
          } else if (m.team2Id === p.id) {
            pf += m.score2;
            pa += m.score1;
            if (m.winner === 2) wins++;
            else losses++;
          }
        }
        return {
          ...p,
          wins,
          losses,
          pf,
          pa,
          diff: pf - pa,
        };
      })
      .sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pf - a.pf);
  };

  return (
    <div className="space-y-6">
      {/* Header for In-Club Tournaments */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            In-Club Brackets & Round Robins ({clubTournaments.length})
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Official club tournament brackets, pools, and court assignments
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {activeClubTournament && (
            <button
              onClick={() => window.print()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Print Bracket
            </button>
          )}
          {isOfficer && (
            <button
              onClick={() => setShowCreateClubForm(!showCreateClubForm)}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <Plus className="w-4 h-4" />
              New Club Tournament
            </button>
          )}
        </div>
      </div>

      {/* IN-CLUB TOURNAMENTS (Round Robin & Single Elimination) */}
      <div className="space-y-6">
          {/* Create Club Tournament Drawer */}
          {isOfficer && showCreateClubForm && (
            <form
              onSubmit={handleCreateClubTournament}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 no-print"
            >
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                Create In-Club Tournament & Auto-Generate Schedule
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Tournament Title
                  </label>
                  <input
                    type="text"
                    value={newTourneyName}
                    onChange={(e) => setNewTourneyName(e.target.value)}
                    placeholder="e.g. November Friday Night King of the Court"
                    required
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={newTourneyDate}
                    onChange={(e) => setNewTourneyDate(e.target.value)}
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Bracket Format
                  </label>
                  <select
                    value={newTourneyFormat}
                    onChange={(e) =>
                      setNewTourneyFormat(
                        e.target.value as 'round_robin' | 'single_elimination'
                      )
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="round_robin">Round Robin Pool</option>
                    <option value="single_elimination">
                      Single Elimination Bracket
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Play Style
                  </label>
                  <select
                    value={newTourneyStyle}
                    onChange={(e) =>
                      setNewTourneyStyle(e.target.value as 'singles' | 'doubles')
                    }
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="singles">Singles (1v1)</option>
                    <option value="doubles">
                      Doubles (Auto-Pairs Selected Players)
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">
                  Select Roster Players ({selectedPlayerIds.length} selected —{' '}
                  {newTourneyStyle === 'doubles'
                    ? `Forms ${Math.floor(selectedPlayerIds.length / 2)} Doubles Pairs`
                    : `${selectedPlayerIds.length} Singles Seeds`}
                  ):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {members.map((m) => {
                    const checked = selectedPlayerIds.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => togglePlayerSelection(m.id)}
                        className={`p-2.5 rounded-lg text-left text-xs border transition-colors cursor-pointer ${
                          checked
                            ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-950/40 text-slate-900 dark:text-white font-semibold'
                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        <div className="truncate">{m.name}</div>
                        <div className="text-[11px] font-mono-num text-slate-500">
                          {m.elo} Elo
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateClubForm(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--club-primary)' }}
                >
                  Generate Bracket & Court Schedule
                </button>
              </div>
            </form>
          )}

          {/* Selector Tabs for Existing Club Tournaments */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            {clubTournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedTournamentId(t.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  activeClubTournament?.id === t.id
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>

          {activeClubTournament && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Schedule / Printable Bracket */}
              <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>
                        {activeClubTournament.format === 'round_robin'
                          ? 'Round Robin Schedule'
                          : 'Single Elimination Bracket'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="capitalize">
                        {activeClubTournament.playStyle}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">
                        {activeClubTournament.date}
                      </span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                      {activeClubTournament.name}
                    </h3>
                  </div>

                  {isOfficer && (
                    <button
                      onClick={() =>
                        handleDeleteClubTournament(activeClubTournament.id)
                      }
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 no-print cursor-pointer"
                      title="Delete Tournament"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Matches Grouped by Round */}
                <div className="mt-4 space-y-5">
                  {Array.from(
                    new Set(activeClubTournament.matches.map((m) => m.round))
                  ).map((roundNum) => {
                    const roundMatches = activeClubTournament.matches.filter(
                      (m) => m.round === roundNum
                    );
                    const roundTitle =
                      roundMatches[0]?.roundLabel || `Round ${roundNum}`;

                    return (
                      <div key={roundNum} className="space-y-2.5">
                        <div className="text-xs font-bold tracking-wide text-slate-500 dark:text-slate-400">
                          {roundTitle}
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                          {roundMatches.map((m) => {
                            const isEditing = editingMatchId === m.id;
                            return (
                              <div
                                key={m.id}
                                className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                              >
                                <div className="space-y-1">
                                  <div className="text-[11px] font-mono-num text-slate-500">
                                    {m.court}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <span
                                      className={
                                        m.winner === 1
                                          ? 'font-bold text-slate-900 dark:text-white'
                                          : 'text-slate-700 dark:text-slate-300'
                                      }
                                    >
                                      {m.team1Name}
                                    </span>
                                    <span className="text-xs text-slate-400">
                                      vs.
                                    </span>
                                    <span
                                      className={
                                        m.winner === 2
                                          ? 'font-bold text-slate-900 dark:text-white'
                                          : 'text-slate-700 dark:text-slate-300'
                                      }
                                    >
                                      {m.team2Name}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {isOfficer && isEditing ? (
                                    <div className="flex items-center gap-1.5 no-print">
                                      <input
                                        type="number"
                                        min={0}
                                        max={30}
                                        value={manualScore1}
                                        onChange={(e) =>
                                          setManualScore1(Number(e.target.value))
                                        }
                                        className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-mono-num bg-slate-50 dark:bg-slate-800"
                                      />
                                      <span className="text-xs">–</span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={30}
                                        value={manualScore2}
                                        onChange={(e) =>
                                          setManualScore2(Number(e.target.value))
                                        }
                                        className="w-14 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-xs font-mono-num bg-slate-50 dark:bg-slate-800"
                                      />
                                      <button
                                        onClick={() =>
                                          handleSaveManualTournamentScore(m.id)
                                        }
                                        className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                                      >
                                        Save
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      {m.score1 !== null && m.score2 !== null ? (
                                        <span className="font-mono-num font-bold text-sm px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white">
                                          {m.score1} – {m.score2}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-slate-400">
                                          Unplayed
                                        </span>
                                      )}

                                      {isOfficer && (
                                        <>
                                          <button
                                            onClick={() => {
                                              setEditingMatchId(m.id);
                                              setManualScore1(m.score1 ?? 11);
                                              setManualScore2(m.score2 ?? 7);
                                            }}
                                            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 no-print cursor-pointer"
                                          >
                                            Enter Score
                                          </button>

                                          {m.team1PlayerIds.length > 0 &&
                                            m.team2PlayerIds.length > 0 && (
                                              <button
                                                onClick={() =>
                                                  onLaunchScoreKeeperForTournament(
                                                    {
                                                      tournamentId:
                                                        activeClubTournament.id,
                                                      matchId: m.id,
                                                      playStyle:
                                                        activeClubTournament.playStyle,
                                                      team1PlayerIds:
                                                        m.team1PlayerIds,
                                                      team2PlayerIds:
                                                        m.team2PlayerIds,
                                                      label: `${activeClubTournament.name}: ${m.team1Name} vs ${m.team2Name}`,
                                                    }
                                                  )
                                                }
                                                className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white inline-flex items-center gap-1 no-print cursor-pointer"
                                                style={{
                                                  backgroundColor:
                                                    'var(--club-primary)',
                                                }}
                                              >
                                                <Play className="w-3 h-3 fill-current" />
                                                Score Live
                                              </button>
                                            )}
                                        </>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 Cols: Live Tournament Standings Table */}
              <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                      Live Standings & Point Differential
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ranked by Wins, then Point Differential (PF–PA)
                    </p>
                  </div>
                  <Trophy className="w-4 h-4 text-amber-500" />
                </div>

                <div className="overflow-x-auto touch-scroll">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500">
                        <th className="py-2 pr-2">#</th>
                        <th className="py-2 px-2">Player / Pair</th>
                        <th className="py-2 px-2 text-right">W–L</th>
                        <th className="py-2 px-2 text-right">PF–PA</th>
                        <th className="py-2 pl-2 text-right">Diff</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {computeStandings(activeClubTournament).map((row, idx) => (
                        <tr key={row.id}>
                          <td className="py-2.5 pr-2 font-mono-num font-bold text-slate-900 dark:text-white">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-2 font-semibold text-slate-900 dark:text-white">
                            {row.name}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-num">
                            {row.wins}–{row.losses}
                          </td>
                          <td className="py-2.5 px-2 text-right font-mono-num text-xs text-slate-500">
                            {row.pf}–{row.pa}
                          </td>
                          <td className="py-2.5 pl-2 text-right font-mono-num font-bold">
                            <span
                              className={
                                row.diff >= 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-red-500'
                              }
                            >
                              {row.diff >= 0 ? `+${row.diff}` : row.diff}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
};
