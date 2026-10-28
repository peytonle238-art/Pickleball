import React, { useState } from 'react';
import {
  AlertTriangle,
  ExternalLink,
  Play,
  Plus,
  Printer,
  Trash2,
  Trophy,
  Users,
  Edit3,
} from 'lucide-react';
import {
  ClubTournament,
  ClubTournamentParticipant,
  Member,
  OutsideTournament,
  PendingTournamentScoreContext,
} from '../types';
import {
  generateRoundRobinMatches,
  generateSingleEliminationMatches,
  getDaysUntil,
  updateTournamentMatchList,
} from '../utils/clubUtils';

interface TournamentsViewProps {
  activeSubTab: 'tournaments' | 'watch';
  onSwitchSubTab: (sub: 'tournaments' | 'watch') => void;
  clubTournaments: ClubTournament[];
  outsideTournaments: OutsideTournament[];
  members: Member[];
  isOfficer: boolean;
  onUpdateClubTournaments: (list: ClubTournament[]) => void;
  onUpdateOutsideTournaments: (list: OutsideTournament[]) => void;
  onLaunchScoreKeeperForTournament: (ctx: PendingTournamentScoreContext) => void;
  onRequestOfficerUnlock: () => void;
}

export const TournamentsView: React.FC<TournamentsViewProps> = ({
  activeSubTab,
  onSwitchSubTab,
  clubTournaments,
  outsideTournaments,
  members,
  isOfficer,
  onUpdateClubTournaments,
  onUpdateOutsideTournaments,
  onLaunchScoreKeeperForTournament,
  onRequestOfficerUnlock,
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

  // Outside Tournament Watch creation/editing state
  const [showOutsideForm, setShowOutsideForm] = useState(false);
  const [editingOutside, setEditingOutside] = useState<OutsideTournament | null>(
    null
  );
  const [outName, setOutName] = useState('');
  const [outDates, setOutDates] = useState('');
  const [outCityVenue, setOutCityVenue] = useState('');
  const [outDivisions, setOutDivisions] = useState('');
  const [outEntryFee, setOutEntryFee] = useState('');
  const [outPrizeMoney, setOutPrizeMoney] = useState('');
  const [outDeadline, setOutDeadline] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [outLink, setOutLink] = useState('https://pickleballbrackets.com');
  const [outStatus, setOutStatus] = useState<'Watching' | 'Registered' | 'Done'>(
    'Watching'
  );

  // Adding a club pair to an outside tournament
  const [addingPairTourneyId, setAddingPairTourneyId] = useState<string | null>(
    null
  );
  const [pairMember1, setPairMember1] = useState(members[0]?.name || '');
  const [pairMember2, setPairMember2] = useState(members[1]?.name || '');
  const [pairDivision, setPairDivision] = useState('Mixed Doubles Moneyball');

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

  // Outside Tournament handlers
  const openAddOutside = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingOutside(null);
    setOutName('');
    setOutDates('');
    setOutCityVenue('');
    setOutDivisions('Mixed Doubles, Men’s & Women’s 3.5 / 4.0');
    setOutEntryFee('$40 entry');
    setOutPrizeMoney('$1,000 Purse');
    setOutDeadline('2026-11-15');
    setOutLink('https://pickleballbrackets.com');
    setOutStatus('Watching');
    setShowOutsideForm(true);
  };

  const openEditOutside = (t: OutsideTournament) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingOutside(t);
    setOutName(t.name);
    setOutDates(t.dates);
    setOutCityVenue(t.cityVenue);
    setOutDivisions(t.divisions);
    setOutEntryFee(t.entryFee);
    setOutPrizeMoney(t.prizeMoney);
    setOutDeadline(t.registrationDeadline);
    setOutLink(t.link);
    setOutStatus(t.status);
    setShowOutsideForm(true);
  };

  const handleSaveOutsideTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOfficer || !outName.trim()) return;

    if (editingOutside) {
      onUpdateOutsideTournaments(
        outsideTournaments.map((t) =>
          t.id === editingOutside.id
            ? {
                ...t,
                name: outName.trim(),
                dates: outDates.trim(),
                cityVenue: outCityVenue.trim(),
                divisions: outDivisions.trim(),
                entryFee: outEntryFee.trim(),
                prizeMoney: outPrizeMoney.trim(),
                registrationDeadline: outDeadline,
                link: outLink.trim(),
                status: outStatus,
              }
            : t
        )
      );
    } else {
      const created: OutsideTournament = {
        id: `out-${Date.now()}`,
        name: outName.trim(),
        dates: outDates.trim() || 'TBD',
        startDateISO: outDeadline,
        cityVenue: outCityVenue.trim() || 'DFW Metroplex',
        divisions: outDivisions.trim() || 'Open Divisions',
        entryFee: outEntryFee.trim() || '$40 entry',
        prizeMoney: outPrizeMoney.trim() || 'Medals',
        registrationDeadline: outDeadline,
        link: outLink.trim() || 'https://pickleballbrackets.com',
        status: outStatus,
        attendees: [],
      };
      onUpdateOutsideTournaments([created, ...outsideTournaments]);
    }
    setShowOutsideForm(false);
    setEditingOutside(null);
  };

  const handleAddAttendeePair = (tourneyId: string) => {
    if (!isOfficer) return;
    onUpdateOutsideTournaments(
      outsideTournaments.map((t) =>
        t.id === tourneyId
          ? {
              ...t,
              attendees: [
                ...t.attendees,
                {
                  id: `att-pair-${Date.now()}`,
                  memberName: pairMember1,
                  partnerName: pairMember2,
                  division: pairDivision.trim() || 'Doubles',
                },
              ],
            }
          : t
      )
    );
    setAddingPairTourneyId(null);
  };

  const handleRemoveAttendeePair = (tourneyId: string, pairId: string) => {
    if (!isOfficer) return;
    onUpdateOutsideTournaments(
      outsideTournaments.map((t) =>
        t.id === tourneyId
          ? {
              ...t,
              attendees: t.attendees.filter((a) => a.id !== pairId),
            }
          : t
      )
    );
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation switcher: In-Club Tournaments vs Outside Tournament Watch */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center p-1 bg-slate-200/70 dark:bg-slate-800 rounded-xl">
          <button
            onClick={() => onSwitchSubTab('tournaments')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'tournaments'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            In-Club Brackets & Round Robins ({clubTournaments.length})
          </button>
          <button
            onClick={() => onSwitchSubTab('watch')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
              activeSubTab === 'watch'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Outside Tournament Watch ({outsideTournaments.length})
          </button>
        </div>

        {activeSubTab === 'tournaments' ? (
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
        ) : (
          isOfficer && (
            <button
              onClick={openAddOutside}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <Plus className="w-4 h-4" />
              Add Outside Tournament
            </button>
          )
        )}
      </div>

      {/* ================================================================= */}
      {/* TAB 1: IN-CLUB TOURNAMENTS (Round Robin & Single Elimination)     */}
      {/* ================================================================= */}
      {activeSubTab === 'tournaments' && (
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
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: OUTSIDE TOURNAMENT WATCH (Starts with Roanoke Showdown)    */}
      {/* ================================================================= */}
      {activeSubTab === 'watch' && (
        <div className="space-y-6">
          {/* Add/Edit Outside Tournament Form */}
          {isOfficer && showOutsideForm && (
            <form
              onSubmit={handleSaveOutsideTournament}
              className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
            >
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {editingOutside
                  ? `Edit Outside Tournament: ${editingOutside.name}`
                  : 'Add Outside Tournament to Club Watchlist'}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Tournament Name
                  </label>
                  <input
                    type="text"
                    value={outName}
                    onChange={(e) => setOutName(e.target.value)}
                    placeholder="e.g. Texas Pickleball Showdown"
                    required
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Dates
                  </label>
                  <input
                    type="text"
                    value={outDates}
                    onChange={(e) => setOutDates(e.target.value)}
                    placeholder="e.g. December 12–13, 2026"
                    required
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    City & Venue
                  </label>
                  <input
                    type="text"
                    value={outCityVenue}
                    onChange={(e) => setOutCityVenue(e.target.value)}
                    placeholder="e.g. Roanoke, TX · Oasis Pickleball Club"
                    required
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Divisions
                  </label>
                  <input
                    type="text"
                    value={outDivisions}
                    onChange={(e) => setOutDivisions(e.target.value)}
                    placeholder="e.g. Mixed Doubles Moneyball"
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Entry Fee
                  </label>
                  <input
                    type="text"
                    value={outEntryFee}
                    onChange={(e) => setOutEntryFee(e.target.value)}
                    placeholder="e.g. $40 entry"
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Prize Money / Awards
                  </label>
                  <input
                    type="text"
                    value={outPrizeMoney}
                    onChange={(e) => setOutPrizeMoney(e.target.value)}
                    placeholder="e.g. $2,500 Purse"
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Registration Deadline (Turns Red ≤ 7 Days)
                  </label>
                  <input
                    type="date"
                    value={outDeadline}
                    onChange={(e) => setOutDeadline(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Registration Link
                  </label>
                  <input
                    type="url"
                    value={outLink}
                    onChange={(e) => setOutLink(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Club Status
                  </label>
                  <select
                    value={outStatus}
                    onChange={(e) =>
                      setOutStatus(
                        e.target.value as 'Watching' | 'Registered' | 'Done'
                      )
                    }
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                  >
                    <option value="Watching">Watching</option>
                    <option value="Registered">Registered</option>
                    <option value="Done">Done</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowOutsideForm(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--club-primary)' }}
                >
                  Save Tournament
                </button>
              </div>
            </form>
          )}

          {/* Outside Tournament Cards */}
          <div className="grid grid-cols-1 gap-6">
            {outsideTournaments.map((t) => {
              const daysLeft = getDaysUntil(t.registrationDeadline);
              const isDeadlineRed = daysLeft <= 7 && t.status !== 'Done';

              return (
                <div
                  key={t.id}
                  className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className="font-semibold text-slate-900 dark:text-white">
                          Status: {t.status}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{t.dates}</span>
                        <span aria-hidden="true">·</span>
                        <span>{t.cityVenue}</span>
                      </div>
                      <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                        {t.name}
                      </h3>
                    </div>

                    {/* Deadline Badge that turns RED within 7 days */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums ${
                          isDeadlineRed
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {isDeadlineRed && (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        )}
                        Deadline: {t.registrationDeadline} (
                        {daysLeft >= 0 ? `${daysLeft}d left` : 'Closed'})
                      </span>

                      <a
                        href={t.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center gap-1"
                      >
                        Event Page <ExternalLink className="w-3 h-3" />
                      </a>

                      {isOfficer && (
                        <>
                          <button
                            onClick={() => openEditOutside(t)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                            title="Edit tournament"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              onUpdateOutsideTournaments(
                                outsideTournaments.filter((x) => x.id !== t.id)
                              )
                            }
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                            title="Delete tournament"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Metadata Line: Entry Fee, Divisions, Prize Money */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-500 block">
                        Divisions & Format
                      </span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {t.divisions}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Entry Fee</span>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {t.entryFee}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">
                        Prize Money / Purse
                      </span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {t.prizeMoney}
                      </span>
                    </div>
                  </div>

                  {/* Who from the club is going and with which partner */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <Users className="w-4 h-4 text-blue-600" />
                        Club Members Attending & Partners ({t.attendees.length}{' '}
                        Pairs)
                      </span>
                      {isOfficer && (
                        <button
                          onClick={() =>
                            setAddingPairTourneyId(
                              addingPairTourneyId === t.id ? null : t.id
                            )
                          }
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                        >
                          + Add Club Pair
                        </button>
                      )}
                    </div>

                    {isOfficer && addingPairTourneyId === t.id && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Player 1
                          </label>
                          <select
                            value={pairMember1}
                            onChange={(e) => setPairMember1(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          >
                            {members.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Partner
                          </label>
                          <select
                            value={pairMember2}
                            onChange={(e) => setPairMember2(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          >
                            <option value="Singles (No Partner)">
                              Singles (No Partner)
                            </option>
                            {members.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-1">
                            Division
                          </label>
                          <input
                            type="text"
                            value={pairDivision}
                            onChange={(e) => setPairDivision(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddAttendeePair(t.id)}
                          className="px-3 py-1.5 rounded text-xs font-bold text-white cursor-pointer"
                          style={{ backgroundColor: 'var(--club-primary)' }}
                        >
                          Add Entry
                        </button>
                      </div>
                    )}

                    {t.attendees.length === 0 ? (
                      <p className="text-xs text-slate-500">
                        No club pairs signed up yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                        {t.attendees.map((pair) => (
                          <div
                            key={pair.id}
                            className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white">
                                {pair.memberName} & {pair.partnerName}
                              </div>
                              <div className="text-slate-500">
                                {pair.division}
                              </div>
                            </div>
                            {isOfficer && (
                              <button
                                onClick={() =>
                                  handleRemoveAttendeePair(t.id, pair.id)
                                }
                                className="text-slate-400 hover:text-red-500 cursor-pointer"
                                title="Remove pair"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
