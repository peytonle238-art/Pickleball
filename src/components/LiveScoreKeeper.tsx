import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  Grid,
  Lock,
  Minus,
  Plus,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Sparkles,
  Trophy,
  Undo2,
  Users,
  Volume2,
} from 'lucide-react';
import {
  AttendanceSession,
  GameScore,
  MatchRecord,
  Member,
  PendingTournamentScoreContext,
} from '../types';
import { calculateEloDelta } from '../utils/clubUtils';

interface LiveScoreKeeperProps {
  members: Member[];
  attendance?: AttendanceSession[];
  initialScoreMode?: 'single' | 'multicourt';
  isOfficer: boolean;
  pendingTournamentMatch: PendingTournamentScoreContext | null;
  onClearPendingTournamentMatch: () => void;
  onSaveCompletedMatch: (match: MatchRecord) => void;
  onNavigateToLadder: () => void;
  onRequestOfficerUnlock: () => void;
}

interface ScoreSnapshot {
  team1Score: number;
  team2Score: number;
  servingTeam: 1 | 2;
  serverNumber: 1 | 2;
  team1RightPlayerIdx: 0 | 1;
  team2RightPlayerIdx: 0 | 1;
  activeServeSide: 'right' | 'left';
  completedGames: GameScore[];
}

export interface PracticeCourtSlot {
  id: string;
  courtNumber: number;
  format: 'singles' | 'doubles';
  team1Ids: string[];
  team2Ids: string[];
  team1Score: number;
  team2Score: number;
  targetScore: 11 | 15 | 21;
  savedDelta?: number | null;
}

const MULTICOURT_STORAGE_KEY = 'bnhs_pickleball_multicourt_v1';

export const LiveScoreKeeper: React.FC<LiveScoreKeeperProps> = ({
  members,
  attendance = [],
  initialScoreMode = 'single',
  isOfficer,
  pendingTournamentMatch,
  onClearPendingTournamentMatch,
  onSaveCompletedMatch,
  onNavigateToLadder,
  onRequestOfficerUnlock,
}) => {
  const [scoreMode, setScoreMode] = useState<'single' | 'multicourt'>(
    initialScoreMode
  );

  useEffect(() => {
    if (initialScoreMode) {
      setScoreMode(initialScoreMode);
    }
  }, [initialScoreMode]);

  const [format, setFormat] = useState<'singles' | 'doubles'>('doubles');
  const [scoringType, setScoringType] = useState<'sideout' | 'rally'>('sideout');
  const [targetScore, setTargetScore] = useState<11 | 15 | 21>(11);
  const [bestOf, setBestOf] = useState<1 | 3>(1);

  // Roster selections for Single Court
  const [t1P1, setT1P1] = useState<string>(members[0]?.id || '');
  const [t1P2, setT1P2] = useState<string>(members[1]?.id || '');
  const [t2P1, setT2P1] = useState<string>(members[2]?.id || '');
  const [t2P2, setT2P2] = useState<string>(members[3]?.id || '');

  // Live game state for Single Court
  const [state, setState] = useState<ScoreSnapshot>({
    team1Score: 0,
    team2Score: 0,
    servingTeam: 1,
    serverNumber: 2, // Official Pickleball doubles starts at 0-0-2
    team1RightPlayerIdx: 0,
    team2RightPlayerIdx: 0,
    activeServeSide: 'right',
    completedGames: [],
  });

  const [history, setHistory] = useState<ScoreSnapshot[]>([]);
  const [savedMatchSummary, setSavedMatchSummary] = useState<{
    winnerTeam: 1 | 2;
    eloDelta: number;
    games: GameScore[];
  } | null>(null);

  // =========================================================================
  // MULTI-COURT PRACTICE NIGHT & SMART COURT GENERATOR STATE
  // =========================================================================
  const latestAttendanceSession = useMemo(() => {
    if (!attendance || attendance.length === 0) return null;
    return [...attendance].sort((a, b) => b.date.localeCompare(a.date))[0];
  }, [attendance]);

  const presentMembers = useMemo(() => {
    if (!latestAttendanceSession) return [];
    return members.filter((m) =>
      latestAttendanceSession.presentMemberIds.includes(m.id)
    );
  }, [members, latestAttendanceSession]);

  const [generatorPool, setGeneratorPool] = useState<'present' | 'all'>(() =>
    presentMembers.length >= 4 ? 'present' : 'all'
  );
  const [generatorStyle, setGeneratorStyle] = useState<'elo' | 'mixer'>('elo');
  const [generatorFormat, setGeneratorFormat] = useState<'doubles' | 'singles'>(
    'doubles'
  );
  const [generatorCourtsCount, setGeneratorCourtsCount] = useState<number>(4);
  const [generatorTargetScore, setGeneratorTargetScore] = useState<
    11 | 15 | 21
  >(11);

  const [courts, setCourts] = useState<PracticeCourtSlot[]>(() => {
    try {
      const saved = localStorage.getItem(MULTICOURT_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage error
    }
    return [];
  });

  const [waitingQueueIds, setWaitingQueueIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(MULTICOURT_STORAGE_KEY, JSON.stringify(courts));
    } catch {
      // Ignore quota errors
    }
  }, [courts]);

  // Pre-populate if launched from a Club Tournament match
  useEffect(() => {
    if (pendingTournamentMatch) {
      setScoreMode('single');
      setFormat(pendingTournamentMatch.playStyle);
      if (pendingTournamentMatch.team1PlayerIds[0]) {
        setT1P1(pendingTournamentMatch.team1PlayerIds[0]);
      }
      if (pendingTournamentMatch.team1PlayerIds[1]) {
        setT1P2(pendingTournamentMatch.team1PlayerIds[1]);
      }
      if (pendingTournamentMatch.team2PlayerIds[0]) {
        setT2P1(pendingTournamentMatch.team2PlayerIds[0]);
      }
      if (pendingTournamentMatch.team2PlayerIds[1]) {
        setT2P2(pendingTournamentMatch.team2PlayerIds[1]);
      }
      resetScoreboard(pendingTournamentMatch.playStyle);
    }
  }, [pendingTournamentMatch]);

  const resetScoreboard = (nextFormat: 'singles' | 'doubles' = format) => {
    setState({
      team1Score: 0,
      team2Score: 0,
      servingTeam: 1,
      serverNumber: nextFormat === 'doubles' ? 2 : 1,
      team1RightPlayerIdx: 0,
      team2RightPlayerIdx: 0,
      activeServeSide: 'right',
      completedGames: [],
    });
    setHistory([]);
    setSavedMatchSummary(null);
  };

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.name || 'Player';
  const getShortName = (id: string) => {
    const full = getMemberName(id);
    const parts = full.split(' ');
    return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : full;
  };
  const getMemberElo = (id: string) =>
    members.find((m) => m.id === id)?.elo || 1200;

  // =========================================================================
  // SMART COURT GENERATOR HANDLERS
  // =========================================================================
  const handleAutoGenerateCourts = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }

    const sourceList =
      generatorPool === 'present' && presentMembers.length >= 2
        ? [...presentMembers]
        : [...members];

    if (sourceList.length < 2) return;

    const ordered =
      generatorStyle === 'elo'
        ? [...sourceList].sort((a, b) => b.elo - a.elo)
        : [...sourceList].sort(() => Math.random() - 0.5);

    const playersPerCourt = generatorFormat === 'doubles' ? 4 : 2;
    const maxPossibleCourts = Math.min(
      generatorCourtsCount,
      Math.floor(ordered.length / playersPerCourt)
    );

    const nextCourts: PracticeCourtSlot[] = [];
    let usedCount = 0;

    for (let c = 0; c < maxPossibleCourts; c++) {
      const slice = ordered.slice(
        c * playersPerCourt,
        (c + 1) * playersPerCourt
      );
      usedCount += slice.length;

      if (generatorFormat === 'doubles' && slice.length === 4) {
        // Snake balance inside each 4-player pod: (#1 + #4) vs (#2 + #3)
        nextCourts.push({
          id: `court-${Date.now()}-${c + 1}`,
          courtNumber: c + 1,
          format: 'doubles',
          team1Ids: [slice[0].id, slice[3].id],
          team2Ids: [slice[1].id, slice[2].id],
          team1Score: 0,
          team2Score: 0,
          targetScore: generatorTargetScore,
          savedDelta: null,
        });
      } else if (slice.length >= 2) {
        nextCourts.push({
          id: `court-${Date.now()}-${c + 1}`,
          courtNumber: c + 1,
          format: 'singles',
          team1Ids: [slice[0].id],
          team2Ids: [slice[1].id],
          team1Score: 0,
          team2Score: 0,
          targetScore: generatorTargetScore,
          savedDelta: null,
        });
      }
    }

    const leftovers = ordered.slice(usedCount).map((m) => m.id);
    setCourts(nextCourts);
    setWaitingQueueIds(leftovers);
  };

  const handleAddEmptyCourt = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    const nextCourtNum = courts.length + 1;
    const p1 = members[0]?.id || '';
    const p2 = members[1]?.id || p1;
    const p3 = members[2]?.id || p1;
    const p4 = members[3]?.id || p2;

    const newSlot: PracticeCourtSlot = {
      id: `court-${Date.now()}-${nextCourtNum}`,
      courtNumber: nextCourtNum,
      format: generatorFormat,
      team1Ids: generatorFormat === 'doubles' ? [p1, p2] : [p1],
      team2Ids: generatorFormat === 'doubles' ? [p3, p4] : [p2],
      team1Score: 0,
      team2Score: 0,
      targetScore: generatorTargetScore,
      savedDelta: null,
    };
    setCourts((prev) => [...prev, newSlot]);
  };

  const handleUpdateCourtScore = (
    courtId: string,
    team: 1 | 2,
    nextScore: number
  ) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    const clamped = Math.max(0, nextScore);
    setCourts((prev) =>
      prev.map((c) =>
        c.id === courtId
          ? {
              ...c,
              team1Score: team === 1 ? clamped : c.team1Score,
              team2Score: team === 2 ? clamped : c.team2Score,
              savedDelta: null,
            }
          : c
      )
    );
  };

  const handleUpdateCourtPlayer = (
    courtId: string,
    team: 1 | 2,
    slotIdx: number,
    memberId: string
  ) => {
    if (!isOfficer) return;
    setCourts((prev) =>
      prev.map((c) => {
        if (c.id !== courtId) return c;
        if (team === 1) {
          const nextT1 = [...c.team1Ids];
          nextT1[slotIdx] = memberId;
          return { ...c, team1Ids: nextT1, savedDelta: null };
        } else {
          const nextT2 = [...c.team2Ids];
          nextT2[slotIdx] = memberId;
          return { ...c, team2Ids: nextT2, savedDelta: null };
        }
      })
    );
  };

  const handleFinishAndRecordCourtMatch = (court: PracticeCourtSlot) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    if (court.team1Score === court.team2Score) return;

    const winnerTeam: 1 | 2 =
      court.team1Score > court.team2Score ? 1 : 2;
    const t1Elos = court.team1Ids.map(getMemberElo);
    const t2Elos = court.team2Ids.map(getMemberElo);
    const eloDelta = calculateEloDelta(t1Elos, t2Elos, winnerTeam);

    const newMatch: MatchRecord = {
      id: `match-${Date.now()}-c${court.courtNumber}`,
      date: new Date().toISOString().slice(0, 10),
      format: court.format,
      scoringType: 'sideout',
      targetScore: court.targetScore,
      bestOf: 1,
      team1Ids: court.team1Ids,
      team2Ids: court.team2Ids,
      games: [
        {
          team1Score: court.team1Score,
          team2Score: court.team2Score,
        },
      ],
      winnerTeam,
      eloDelta,
    };

    onSaveCompletedMatch(newMatch);

    setCourts((prev) =>
      prev.map((c) =>
        c.id === court.id ? { ...c, savedDelta: eloDelta } : c
      )
    );
  };

  const handleRotateCourtPlayers = (court: PracticeCourtSlot) => {
    if (!isOfficer) return;
    const winners =
      court.team1Score >= court.team2Score ? court.team1Ids : court.team2Ids;
    const outgoing =
      court.team1Score >= court.team2Score ? court.team2Ids : court.team1Ids;

    const neededCount = court.format === 'doubles' ? 2 : 1;
    if (waitingQueueIds.length >= neededCount) {
      const incoming = waitingQueueIds.slice(0, neededCount);
      const nextQueue = [
        ...waitingQueueIds.slice(neededCount),
        ...court.team1Ids.filter((id) => !winners.includes(id)),
        ...court.team2Ids.filter((id) => !winners.includes(id)),
      ];
      setWaitingQueueIds(nextQueue);
      setCourts((prev) =>
        prev.map((c) =>
          c.id === court.id
            ? {
                ...c,
                team1Ids: winners,
                team2Ids: incoming,
                team1Score: 0,
                team2Score: 0,
                savedDelta: null,
              }
            : c
        )
      );
    } else {
      // If no waiting queue, split partners and remix on the same court
      if (court.format === 'doubles' && winners.length === 2 && outgoing.length === 2) {
        setCourts((prev) =>
          prev.map((c) =>
            c.id === court.id
              ? {
                  ...c,
                  team1Ids: [winners[0], outgoing[0]],
                  team2Ids: [winners[1], outgoing[1]],
                  team1Score: 0,
                  team2Score: 0,
                  savedDelta: null,
                }
              : c
          )
        );
      } else {
        setCourts((prev) =>
          prev.map((c) =>
            c.id === court.id
              ? { ...c, team1Score: 0, team2Score: 0, savedDelta: null }
              : c
          )
        );
      }
    }
  };

  const team1Ids = format === 'doubles' ? [t1P1, t1P2] : [t1P1];
  const team2Ids = format === 'doubles' ? [t2P1, t2P2] : [t2P1];

  // Official Callout String: "Server Score, Receiver Score, Server Number"
  const serverScore =
    state.servingTeam === 1 ? state.team1Score : state.team2Score;
  const receiverScore =
    state.servingTeam === 1 ? state.team2Score : state.team1Score;

  const calloutNumbers =
    format === 'doubles' && scoringType === 'sideout'
      ? `${serverScore} - ${receiverScore} - ${state.serverNumber}`
      : `${serverScore} - ${receiverScore}`;

  const calloutWords =
    format === 'doubles' && scoringType === 'sideout'
      ? `Server ${serverScore}, Receiver ${receiverScore}, Server ${state.serverNumber}`
      : `Server ${serverScore}, Receiver ${receiverScore}`;

  const speakScoreCallout = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const text =
        format === 'doubles' && scoringType === 'sideout'
          ? `${serverScore}, ${receiverScore}, ${state.serverNumber}`
          : `${serverScore}, ${receiverScore}`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Determine who is standing where on the court
  const team1RightPlayerId =
    format === 'doubles'
      ? team1Ids[state.team1RightPlayerIdx]
      : state.team1Score % 2 === 0
      ? t1P1
      : null;
  const team1LeftPlayerId =
    format === 'doubles'
      ? team1Ids[state.team1RightPlayerIdx === 0 ? 1 : 0]
      : state.team1Score % 2 === 1
      ? t1P1
      : null;

  const team2RightPlayerId =
    format === 'doubles'
      ? team2Ids[state.team2RightPlayerIdx]
      : state.team2Score % 2 === 0
      ? t2P1
      : null;
  const team2LeftPlayerId =
    format === 'doubles'
      ? team2Ids[state.team2RightPlayerIdx === 0 ? 1 : 0]
      : state.team2Score % 2 === 1
      ? t2P1
      : null;

  const effectiveServeSide: 'right' | 'left' =
    format === 'singles'
      ? serverScore % 2 === 0
        ? 'right'
        : 'left'
      : state.activeServeSide;

  const currentServerId =
    state.servingTeam === 1
      ? effectiveServeSide === 'right'
        ? team1RightPlayerId || t1P1
        : team1LeftPlayerId || t1P1
      : effectiveServeSide === 'right'
      ? team2RightPlayerId || t2P1
      : team2LeftPlayerId || t2P1;

  const currentReceiverId =
    state.servingTeam === 1
      ? effectiveServeSide === 'right'
        ? team2RightPlayerId || t2P1
        : team2LeftPlayerId || t2P1
      : effectiveServeSide === 'right'
      ? team1RightPlayerId || t1P1
      : team1LeftPlayerId || t1P1;

  // Check if a game is won (reach targetScore & win by 2)
  const checkAndHandleGameProgress = (nextSnap: ScoreSnapshot) => {
    const s1 = nextSnap.team1Score;
    const s2 = nextSnap.team2Score;
    const gameWonBy1 = s1 >= targetScore && s1 - s2 >= 2;
    const gameWonBy2 = s2 >= targetScore && s2 - s1 >= 2;

    if (!gameWonBy1 && !gameWonBy2) {
      setState(nextSnap);
      return;
    }

    const updatedGames = [
      ...nextSnap.completedGames,
      { team1Score: s1, team2Score: s2 },
    ];
    const t1Wins = updatedGames.filter(
      (g) => g.team1Score > g.team2Score
    ).length;
    const t2Wins = updatedGames.filter(
      (g) => g.team2Score > g.team1Score
    ).length;
    const neededWins = bestOf === 1 ? 1 : 2;

    if (t1Wins >= neededWins || t2Wins >= neededWins) {
      const winnerTeam: 1 | 2 = t1Wins >= neededWins ? 1 : 2;
      const t1Elos = team1Ids.map(
        (id) => members.find((m) => m.id === id)?.elo || 1200
      );
      const t2Elos = team2Ids.map(
        (id) => members.find((m) => m.id === id)?.elo || 1200
      );
      const eloDelta = calculateEloDelta(t1Elos, t2Elos, winnerTeam);

      const newMatch: MatchRecord = {
        id: `match-${Date.now()}`,
        date: new Date().toISOString().slice(0, 10),
        format,
        scoringType,
        targetScore,
        bestOf,
        team1Ids,
        team2Ids,
        games: updatedGames,
        winnerTeam,
        eloDelta,
        tournamentId: pendingTournamentMatch?.tournamentId,
        tournamentMatchId: pendingTournamentMatch?.matchId,
      };

      setState({
        ...nextSnap,
        completedGames: updatedGames,
      });
      setSavedMatchSummary({
        winnerTeam,
        eloDelta,
        games: updatedGames,
      });
      if (isOfficer) {
        onSaveCompletedMatch(newMatch);
      }
    } else {
      setState({
        team1Score: 0,
        team2Score: 0,
        servingTeam: gameWonBy1 ? 1 : 2,
        serverNumber: format === 'doubles' ? 2 : 1,
        team1RightPlayerIdx: 0,
        team2RightPlayerIdx: 0,
        activeServeSide: 'right',
        completedGames: updatedGames,
      });
    }
  };

  const handleServerPoint = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    if (savedMatchSummary) return;
    setHistory((prev) => [...prev, state]);

    if (state.servingTeam === 1) {
      const nextScore = state.team1Score + 1;
      const nextRightIdx: 0 | 1 = state.team1RightPlayerIdx === 0 ? 1 : 0;
      const nextSide: 'right' | 'left' =
        format === 'singles'
          ? nextScore % 2 === 0
            ? 'right'
            : 'left'
          : state.activeServeSide === 'right'
          ? 'left'
          : 'right';

      checkAndHandleGameProgress({
        ...state,
        team1Score: nextScore,
        team1RightPlayerIdx: nextRightIdx,
        activeServeSide: nextSide,
      });
    } else {
      const nextScore = state.team2Score + 1;
      const nextRightIdx: 0 | 1 = state.team2RightPlayerIdx === 0 ? 1 : 0;
      const nextSide: 'right' | 'left' =
        format === 'singles'
          ? nextScore % 2 === 0
            ? 'right'
            : 'left'
          : state.activeServeSide === 'right'
          ? 'left'
          : 'right';

      checkAndHandleGameProgress({
        ...state,
        team2Score: nextScore,
        team2RightPlayerIdx: nextRightIdx,
        activeServeSide: nextSide,
      });
    }
  };

  const handleSideOutOrSecondServer = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    if (savedMatchSummary) return;
    setHistory((prev) => [...prev, state]);

    if (format === 'doubles' && state.serverNumber === 1) {
      setState({
        ...state,
        serverNumber: 2,
        activeServeSide: state.activeServeSide === 'right' ? 'left' : 'right',
      });
    } else {
      setState({
        ...state,
        servingTeam: state.servingTeam === 1 ? 2 : 1,
        serverNumber: 1,
        activeServeSide: 'right',
      });
    }
  };

  const handleRallyPoint = (winningTeam: 1 | 2) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    if (savedMatchSummary) return;
    setHistory((prev) => [...prev, state]);

    if (winningTeam === 1) {
      const nextScore = state.team1Score + 1;
      const swapSides = state.servingTeam === 1;
      checkAndHandleGameProgress({
        ...state,
        team1Score: nextScore,
        servingTeam: 1,
        serverNumber: 1,
        team1RightPlayerIdx: swapSides
          ? state.team1RightPlayerIdx === 0
            ? 1
            : 0
          : state.team1RightPlayerIdx,
        activeServeSide: nextScore % 2 === 0 ? 'right' : 'left',
      });
    } else {
      const nextScore = state.team2Score + 1;
      const swapSides = state.servingTeam === 2;
      checkAndHandleGameProgress({
        ...state,
        team2Score: nextScore,
        servingTeam: 2,
        serverNumber: 1,
        team2RightPlayerIdx: swapSides
          ? state.team2RightPlayerIdx === 0
            ? 1
            : 0
          : state.team2RightPlayerIdx,
        activeServeSide: nextScore % 2 === 0 ? 'right' : 'left',
      });
    }
  };

  const handleUndo = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    if (history.length === 0 || savedMatchSummary) return;
    const prev = history[history.length - 1];
    setState(prev);
    setHistory((h) => h.slice(0, -1));
  };

  return (
    <div className="space-y-6">
      {/* Top Mode Switcher: Single Court Referee vs Multi-Court Practice Night */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Live Courtside Scorekeeper & Court Rotation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Switch between detailed single-court refereeing and multi-court
            practice night rotations
          </p>
        </div>

        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setScoreMode('single')}
            className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
              scoreMode === 'single'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Single Court Referee</span>
          </button>
          <button
            type="button"
            onClick={() => setScoreMode('multicourt')}
            className={`px-4 py-2 rounded-lg text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer ${
              scoreMode === 'multicourt'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <Grid className="w-3.5 h-3.5 text-amber-500" />
            <span>Multi-Court Practice Night (Courts 1–6)</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* MODE 2: SMART COURT GENERATOR & MULTI-COURT PRACTICE SCOREBOARD   */}
      {/* ================================================================= */}
      {scoreMode === 'multicourt' && (
        <div className="space-y-6">
          {/* Smart Court Generator Control Panel */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-500" />
                  <span>Smart Practice Court Generator</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Auto-assign balanced matchups across Courts 1–6 from checked-in
                  players or your full club roster
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoGenerateCourts}
                  disabled={members.length < 2}
                  className="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2 shadow-xs disabled:opacity-40 cursor-pointer"
                  style={{ backgroundColor: 'var(--club-primary)' }}
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Auto-Assign Courts</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddEmptyCourt}
                  disabled={courts.length >= 6 || members.length < 2}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-40 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Court</span>
                </button>

                {courts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCourts([]);
                      setWaitingQueueIds([]);
                    }}
                    className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-red-600 cursor-pointer"
                  >
                    Clear Courts
                  </button>
                )}
              </div>
            </div>

            {/* Generator Options Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Player Pool
                </label>
                <select
                  value={generatorPool}
                  onChange={(e) =>
                    setGeneratorPool(e.target.value as 'present' | 'all')
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="present">
                    Checked-In Players ({presentMembers.length} present)
                  </option>
                  <option value="all">
                    Full Club Roster ({members.length} members)
                  </option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Matchmaking Strategy
                </label>
                <select
                  value={generatorStyle}
                  onChange={(e) =>
                    setGeneratorStyle(e.target.value as 'elo' | 'mixer')
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="elo">
                    Elo-Balanced Competitive (Pod Snake)
                  </option>
                  <option value="mixer">Social Random Mixer</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Play Format
                </label>
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setGeneratorFormat('doubles')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      generatorFormat === 'doubles'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Doubles (2v2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setGeneratorFormat('singles')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                      generatorFormat === 'singles'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Singles (1v1)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1.5">
                  Courts & Target Score
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={generatorCourtsCount}
                    onChange={(e) =>
                      setGeneratorCourtsCount(Number(e.target.value))
                    }
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n} {n === 1 ? 'Court' : 'Courts'}
                      </option>
                    ))}
                  </select>
                  <select
                    value={generatorTargetScore}
                    onChange={(e) =>
                      setGeneratorTargetScore(
                        Number(e.target.value) as 11 | 15 | 21
                      )
                    }
                    className="min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value={11}>To 11 pts</option>
                    <option value={15}>To 15 pts</option>
                    <option value={21}>To 21 pts</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Next-Up Waiting Queue if any players are waiting for a court */}
            {waitingQueueIds.length > 0 && (
              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200/80 dark:border-amber-800/50 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs">
                  <Users className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="font-bold text-slate-900 dark:text-white">
                    Next Up Waiting Queue ({waitingQueueIds.length}):
                  </span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {waitingQueueIds.map(getMemberName).join(' · ')}
                  </span>
                </div>
                <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  Click "Rotate Players" on any finished court to sub them in
                </span>
              </div>
            )}
          </div>

          {/* Active Multi-Court Scoreboard Grid */}
          {courts.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
              <Grid className="w-8 h-8 text-blue-600 dark:text-blue-400 mx-auto" />
              <div className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                {members.length < 2
                  ? 'Add Club Members to Generate Practice Courts'
                  : 'Ready to Launch Multi-Court Practice Night'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {members.length < 2
                  ? 'Go to Members & Attendance to add or bulk-import your roster first.'
                  : 'Click "Auto-Assign Courts" above to automatically create balanced courts from your checked-in players.'}
              </p>
              {members.length >= 2 && (
                <button
                  type="button"
                  onClick={handleAutoGenerateCourts}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white inline-flex items-center gap-2 cursor-pointer"
                  style={{ backgroundColor: 'var(--club-primary)' }}
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Auto-Assign Courts Now</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {courts.map((court) => {
                const t1AvgElo = Math.round(
                  court.team1Ids.reduce((s, id) => s + getMemberElo(id), 0) /
                    Math.max(1, court.team1Ids.length)
                );
                const t2AvgElo = Math.round(
                  court.team2Ids.reduce((s, id) => s + getMemberElo(id), 0) /
                    Math.max(1, court.team2Ids.length)
                );
                const projectedLeader: 1 | 2 =
                  court.team1Score >= court.team2Score ? 1 : 2;
                const projectedDelta = calculateEloDelta(
                  court.team1Ids.map(getMemberElo),
                  court.team2Ids.map(getMemberElo),
                  projectedLeader
                );

                return (
                  <div
                    key={court.id}
                    className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 flex flex-col justify-between gap-4 shadow-2xs"
                  >
                    {/* Court Top Bar */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-xl font-bold text-slate-900 dark:text-white">
                          Court {court.courtNumber}
                        </span>
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs font-medium text-slate-500 capitalize">
                          {court.format} · To {court.targetScore}
                        </span>
                      </div>

                      <div className="text-xs font-mono-num font-bold text-blue-600 dark:text-blue-400">
                        {court.savedDelta
                          ? `Saved (±${court.savedDelta} Elo) ✓`
                          : `Stakes: ±${projectedDelta} Elo`}
                      </div>
                    </div>

                    {/* Team 1 Row */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Team 1 (Avg {t1AvgElo} Elo)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {court.team1Ids.map((pid, idx) => (
                            <select
                              key={`t1-${idx}`}
                              value={pid}
                              onChange={(e) =>
                                handleUpdateCourtPlayer(
                                  court.id,
                                  1,
                                  idx,
                                  e.target.value
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white truncate"
                            >
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.elo})
                                </option>
                              ))}
                            </select>
                          ))}
                        </div>
                      </div>

                      {/* Team 1 Score Stepper */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCourtScore(
                              court.id,
                              1,
                              court.team1Score - 1
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-12 text-center font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {court.team1Score}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCourtScore(
                              court.id,
                              1,
                              court.team1Score + 1
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Team 2 Row */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-3">
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="text-[11px] font-semibold text-slate-500">
                          Team 2 (Avg {t2AvgElo} Elo)
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {court.team2Ids.map((pid, idx) => (
                            <select
                              key={`t2-${idx}`}
                              value={pid}
                              onChange={(e) =>
                                handleUpdateCourtPlayer(
                                  court.id,
                                  2,
                                  idx,
                                  e.target.value
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white truncate"
                            >
                              {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name} ({m.elo})
                                </option>
                              ))}
                            </select>
                          ))}
                        </div>
                      </div>

                      {/* Team 2 Score Stepper */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCourtScore(
                              court.id,
                              2,
                              court.team2Score - 1
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-12 text-center font-mono-num text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                          {court.team2Score}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateCourtScore(
                              court.id,
                              2,
                              court.team2Score + 1
                            )
                          }
                          className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Court Action Footer */}
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleRotateCourtPlayers(court)}
                        className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Rotate / Next Game</span>
                      </button>

                      <button
                        type="button"
                        disabled={
                          court.team1Score === court.team2Score ||
                          !!court.savedDelta
                        }
                        onClick={() => handleFinishAndRecordCourtMatch(court)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-40 ${
                          court.savedDelta
                            ? 'bg-emerald-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 text-white'
                        }`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>
                          {court.savedDelta
                            ? 'Match Saved ✓'
                            : 'Finish & Record Match'}
                        </span>
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
      {/* MODE 1: SINGLE COURT REFEREE (SIDE-OUT & SERVER TRACKING)         */}
      {/* ================================================================= */}
      {scoreMode === 'single' && (
        <>
          {/* Tournament Match Context Banner if launched from Club Tournaments */}
          {pendingTournamentMatch && (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs text-amber-900 dark:text-amber-200">
                <span className="font-bold">Official Tournament Match:</span>{' '}
                {pendingTournamentMatch.label} — Final score will automatically
                update the tournament bracket and Club Ladder.
              </div>
              <button
                onClick={onClearPendingTournamentMatch}
                className="text-xs font-semibold text-amber-800 dark:text-amber-300 underline cursor-pointer"
              >
                Exit Tournament Mode
              </button>
            </div>
          )}

          {/* Member View-Only Banner */}
          {!isOfficer && (
            <div className="rounded-2xl bg-slate-900 dark:bg-slate-900/90 text-white px-5 py-3.5 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 text-xs">
                <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  <strong>View-Only Scoreboard:</strong> Only Club Officers can
                  score official matches or save results to the Ladder.
                </span>
              </div>
              <button
                type="button"
                onClick={onRequestOfficerUnlock}
                className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold hover:bg-amber-300 cursor-pointer shrink-0"
              >
                Unlock Officer Mode
              </button>
            </div>
          )}

          {/* Match Settings & Player Selection Bar */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Single-Court Referee Setup
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Win by 2 · Automatic server tracking & Elo ladder integration
                </p>
              </div>

              {/* Segmented Match Rules Controls */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    disabled={!isOfficer}
                    onClick={() => {
                      if (!isOfficer) return;
                      setFormat('singles');
                      resetScoreboard('singles');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                      format === 'singles'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Singles
                  </button>
                  <button
                    disabled={!isOfficer}
                    onClick={() => {
                      if (!isOfficer) return;
                      setFormat('doubles');
                      resetScoreboard('doubles');
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                      format === 'doubles'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Doubles
                  </button>
                </div>

                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    disabled={!isOfficer}
                    onClick={() => {
                      if (!isOfficer) return;
                      setScoringType('sideout');
                      resetScoreboard(format);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                      scoringType === 'sideout'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Side-Out
                  </button>
                  <button
                    disabled={!isOfficer}
                    onClick={() => {
                      if (!isOfficer) return;
                      setScoringType('rally');
                      resetScoreboard(format);
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                      scoringType === 'rally'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Rally Scoring
                  </button>
                </div>

                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  {([11, 15, 21] as const).map((pts) => (
                    <button
                      key={pts}
                      disabled={!isOfficer}
                      onClick={() => {
                        if (!isOfficer) return;
                        setTargetScore(pts);
                      }}
                      className={`px-2.5 py-1.5 text-xs font-mono-num font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                        targetScore === pts
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      To {pts}
                    </button>
                  ))}
                </div>

                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    disabled={!isOfficer}
                    onClick={() => {
                      if (!isOfficer) return;
                      setBestOf(1);
                      resetScoreboard(format);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                      bestOf === 1
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Best of 1
                  </button>
                  <button
                    disabled={!isOfficer}
                    onClick={() => {
                      if (!isOfficer) return;
                      setBestOf(3);
                      resetScoreboard(format);
                    }}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${
                      bestOf === 3
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Best of 3
                  </button>
                </div>
              </div>
            </div>

            {/* Roster Player Pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Team 1 (West Court)</span>
                  {state.servingTeam === 1 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Currently Serving
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    disabled={!isOfficer}
                    value={t1P1}
                    onChange={(e) => setT1P1(e.target.value)}
                    aria-label="Team 1 Player 1"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.elo} Elo)
                      </option>
                    ))}
                  </select>
                  {format === 'doubles' && (
                    <select
                      disabled={!isOfficer}
                      value={t1P2}
                      onChange={(e) => setT1P2(e.target.value)}
                      aria-label="Team 1 Player 2"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.elo} Elo)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Team 2 (East Court)</span>
                  {state.servingTeam === 2 && (
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">
                      Currently Serving
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select
                    disabled={!isOfficer}
                    value={t2P1}
                    onChange={(e) => setT2P1(e.target.value)}
                    aria-label="Team 2 Player 1"
                    className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.elo} Elo)
                      </option>
                    ))}
                  </select>
                  {format === 'doubles' && (
                    <select
                      disabled={!isOfficer}
                      value={t2P2}
                      onChange={(e) => setT2P2(e.target.value)}
                      aria-label="Team 2 Player 2"
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.elo} Elo)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Match Saved Banner if Match Complete */}
          {savedMatchSummary && (
            <div className="rounded-2xl bg-emerald-950 text-white p-6 border border-emerald-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4" />
                  Match Automatically Saved to Match History & Club Ladder
                </div>
                <h3 className="font-display text-2xl font-bold">
                  Team {savedMatchSummary.winnerTeam} Wins (
                  {savedMatchSummary.games
                    .map((g) => `${g.team1Score}–${g.team2Score}`)
                    .join(', ')}
                  )
                </h3>
                <p className="text-xs text-emerald-200/80">
                  Ladder rating updated: ±{savedMatchSummary.eloDelta} Elo points
                  applied to participating players.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  onClick={() => resetScoreboard(format)}
                  className="px-4 py-2.5 rounded-xl bg-white text-slate-900 text-xs font-bold hover:bg-emerald-50 cursor-pointer"
                >
                  Play Rematch
                </button>
                <button
                  onClick={onNavigateToLadder}
                  className="px-4 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-600 cursor-pointer"
                >
                  View Updated Ladder
                </button>
              </div>
            </div>
          )}

          {/* Main Scoreboard & Interactive Court Diagram */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
              <div>
                <div className="rounded-xl bg-slate-900 dark:bg-slate-950 text-white p-5">
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                    <span>
                      Official Score Callout (Win by 2 · Target {targetScore})
                    </span>
                    <button
                      onClick={speakScoreCallout}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium cursor-pointer"
                      title="Announce score out loud"
                    >
                      <Volume2 className="w-3.5 h-3.5" /> Call Score
                    </button>
                  </div>

                  <div className="mt-2 flex items-baseline justify-between gap-4">
                    <div
                      className="font-mono-num text-4xl sm:text-5xl font-bold tracking-tight"
                      style={{ color: 'var(--club-secondary)' }}
                    >
                      {calloutNumbers}
                    </div>
                    {format === 'doubles' && scoringType === 'sideout' && (
                      <div className="text-right">
                        <div className="text-[11px] text-slate-400">Server #</div>
                        <div className="font-mono-num text-2xl font-bold text-white">
                          Server {state.serverNumber}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-2 text-xs text-slate-300 font-medium">
                    “{calloutWords}” · Serving:{' '}
                    <strong className="text-white">
                      {getMemberName(currentServerId)}
                    </strong>{' '}
                    ({effectiveServeSide === 'right' ? 'Right/Even' : 'Left/Odd'}{' '}
                    Court)
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 my-5">
                  <div
                    className={`rounded-xl p-4 border transition-colors ${
                      state.servingTeam === 1
                        ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Team 1
                      </span>
                      {state.servingTeam === 1 && (
                        <span className="font-mono-num font-bold text-blue-600 dark:text-blue-400">
                          SERVE {format === 'doubles' && `#${state.serverNumber}`}
                        </span>
                      )}
                    </div>
                    <div className="font-mono-num text-5xl font-bold text-slate-900 dark:text-white my-2">
                      {state.team1Score}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {team1Ids.map(getShortName).join(' / ')}
                    </div>
                  </div>

                  <div
                    className={`rounded-xl p-4 border transition-colors ${
                      state.servingTeam === 2
                        ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Team 2
                      </span>
                      {state.servingTeam === 2 && (
                        <span className="font-mono-num font-bold text-blue-600 dark:text-blue-400">
                          SERVE {format === 'doubles' && `#${state.serverNumber}`}
                        </span>
                      )}
                    </div>
                    <div className="font-mono-num text-5xl font-bold text-slate-900 dark:text-white my-2">
                      {state.team2Score}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      {team2Ids.map(getShortName).join(' / ')}
                    </div>
                  </div>
                </div>

                {state.completedGames.length > 0 && (
                  <div className="mb-4 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                    <span className="font-semibold">Previous Games:</span>
                    {state.completedGames.map((g, idx) => (
                      <span key={idx} className="font-mono-num font-semibold">
                        G{idx + 1}: {g.team1Score}–{g.team2Score}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {isOfficer ? (
                <div className="space-y-3">
                  {scoringType === 'sideout' ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        onClick={handleServerPoint}
                        disabled={!!savedMatchSummary}
                        className="min-h-[60px] px-5 py-4 rounded-xl font-bold text-base text-white flex flex-col items-center justify-center shadow-sm transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                        style={{ backgroundColor: 'var(--club-primary)' }}
                      >
                        <span>+1 Point (Team {state.servingTeam})</span>
                        <span className="text-[11px] font-normal text-white/80 mt-0.5">
                          Server scores & swaps sides
                        </span>
                      </button>

                      <button
                        onClick={handleSideOutOrSecondServer}
                        disabled={!!savedMatchSummary}
                        className="min-h-[60px] px-5 py-4 rounded-xl font-bold text-base bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white flex flex-col items-center justify-center transition-transform active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                      >
                        <span className="flex items-center gap-2">
                          <ArrowRightLeft className="w-4 h-4" />
                          {format === 'doubles' && state.serverNumber === 1
                            ? '2nd Server (Partner)'
                            : 'Side Out'}
                        </span>
                        <span className="text-[11px] font-normal text-slate-300 mt-0.5">
                          {format === 'doubles' && state.serverNumber === 1
                            ? 'Pass serve to Server #2'
                            : `Rotate serve to Team ${
                                state.servingTeam === 1 ? 2 : 1
                              }`}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        onClick={() => handleRallyPoint(1)}
                        disabled={!!savedMatchSummary}
                        className="min-h-[60px] px-4 py-4 rounded-xl font-bold text-base text-white flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
                        style={{ backgroundColor: 'var(--club-primary)' }}
                      >
                        <span>+1 Point Team 1</span>
                        <span className="text-[11px] font-normal text-white/80">
                          Rally Winner
                        </span>
                      </button>
                      <button
                        onClick={() => handleRallyPoint(2)}
                        disabled={!!savedMatchSummary}
                        className="min-h-[60px] px-4 py-4 rounded-xl font-bold text-base bg-slate-900 dark:bg-slate-800 text-white flex flex-col items-center justify-center cursor-pointer disabled:opacity-50"
                      >
                        <span>+1 Point Team 2</span>
                        <span className="text-[11px] font-normal text-slate-300">
                          Rally Winner
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleUndo}
                      disabled={history.length === 0 || !!savedMatchSummary}
                      className="min-h-[48px] px-4 py-2.5 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer"
                    >
                      <Undo2 className="w-4 h-4" />
                      Undo Last Rally ({history.length})
                    </button>

                    <button
                      onClick={() => resetScoreboard(format)}
                      className="min-h-[48px] px-4 py-2.5 rounded-xl font-semibold text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Reset Match
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Match scoring buttons are locked in Member Mode.
                  </div>
                  <button
                    type="button"
                    onClick={onRequestOfficerUnlock}
                    className="px-3.5 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Officer Unlock</span>
                  </button>
                </div>
              )}
            </div>

            {/* Right Column: Live Court Diagram */}
            <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
              <div className="flex items-center justify-between gap-2 mb-4">
                <div>
                  <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Live Court & Service Position Diagram
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Shows who serves from which side (Even/Right vs Odd/Left)
                  </p>
                </div>
                <span className="text-xs font-mono-num font-semibold text-slate-600 dark:text-slate-300">
                  {state.servingTeam === 1 ? 'Team 1' : 'Team 2'} Serve
                </span>
              </div>

              <div className="relative w-full aspect-[16/10] rounded-xl bg-blue-900 p-3 sm:p-4 border-4 border-slate-700 shadow-inner flex items-stretch select-none">
                <div className="w-full h-full border-2 border-white grid grid-cols-12 relative">
                  <div className="col-span-5 grid grid-rows-2 border-r-2 border-white">
                    <div
                      className={`p-2 sm:p-3 border-b border-white/80 flex flex-col justify-between transition-colors ${
                        state.servingTeam === 1 && effectiveServeSide === 'left'
                          ? 'bg-amber-400/30'
                          : 'bg-blue-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-white/80 font-mono-num">
                        <span>T1 LEFT (ODD)</span>
                        {state.servingTeam === 1 &&
                          effectiveServeSide === 'left' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                              SERVER
                            </span>
                          )}
                        {state.servingTeam === 2 &&
                          effectiveServeSide === 'left' && (
                            <span className="px-1.5 py-0.5 rounded bg-white/90 text-slate-950 font-bold">
                              RECEIVER
                            </span>
                          )}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white truncate">
                        {team1LeftPlayerId ? getShortName(team1LeftPlayerId) : '—'}
                      </div>
                    </div>

                    <div
                      className={`p-2 sm:p-3 border-t border-white/80 flex flex-col justify-between transition-colors ${
                        state.servingTeam === 1 && effectiveServeSide === 'right'
                          ? 'bg-amber-400/30'
                          : 'bg-blue-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-white/80 font-mono-num">
                        <span>T1 RIGHT (EVEN)</span>
                        {state.servingTeam === 1 &&
                          effectiveServeSide === 'right' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                              SERVER
                            </span>
                          )}
                        {state.servingTeam === 2 &&
                          effectiveServeSide === 'right' && (
                            <span className="px-1.5 py-0.5 rounded bg-white/90 text-slate-950 font-bold">
                              RECEIVER
                            </span>
                          )}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white truncate">
                        {team1RightPlayerId
                          ? getShortName(team1RightPlayerId)
                          : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2 bg-emerald-800/80 grid grid-cols-2 relative">
                    <div className="border-r-2 border-dashed border-white flex items-center justify-center">
                      <span className="text-[9px] font-bold tracking-widest text-white/75 -rotate-90 whitespace-nowrap">
                        KITCHEN
                      </span>
                    </div>
                    <div className="border-l-2 border-dashed border-white flex items-center justify-center">
                      <span className="text-[9px] font-bold tracking-widest text-white/75 rotate-90 whitespace-nowrap">
                        KITCHEN
                      </span>
                    </div>
                  </div>

                  <div className="col-span-5 grid grid-rows-2 border-l-2 border-white">
                    <div
                      className={`p-2 sm:p-3 border-b border-white/80 flex flex-col justify-between transition-colors ${
                        state.servingTeam === 2 && effectiveServeSide === 'right'
                          ? 'bg-amber-400/30'
                          : 'bg-blue-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-white/80 font-mono-num">
                        <span>T2 RIGHT (EVEN)</span>
                        {state.servingTeam === 2 &&
                          effectiveServeSide === 'right' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                              SERVER
                            </span>
                          )}
                        {state.servingTeam === 1 &&
                          effectiveServeSide === 'right' && (
                            <span className="px-1.5 py-0.5 rounded bg-white/90 text-slate-950 font-bold">
                              RECEIVER
                            </span>
                          )}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white truncate text-right">
                        {team2RightPlayerId
                          ? getShortName(team2RightPlayerId)
                          : '—'}
                      </div>
                    </div>

                    <div
                      className={`p-2 sm:p-3 border-t border-white/80 flex flex-col justify-between transition-colors ${
                        state.servingTeam === 2 && effectiveServeSide === 'left'
                          ? 'bg-amber-400/30'
                          : 'bg-blue-700/60'
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-white/80 font-mono-num">
                        <span>T2 LEFT (ODD)</span>
                        {state.servingTeam === 2 &&
                          effectiveServeSide === 'left' && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                              SERVER
                            </span>
                          )}
                        {state.servingTeam === 1 &&
                          effectiveServeSide === 'left' && (
                            <span className="px-1.5 py-0.5 rounded bg-white/90 text-slate-950 font-bold">
                              RECEIVER
                            </span>
                          )}
                      </div>
                      <div className="text-xs sm:text-sm font-bold text-white truncate text-right">
                        {team2LeftPlayerId ? getShortName(team2LeftPlayerId) : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
                <div>
                  <strong>Active Serve:</strong> {getMemberName(currentServerId)}{' '}
                  serves diagonally to{' '}
                  <strong>{getMemberName(currentReceiverId)}</strong>
                </div>
                <div className="text-slate-500">
                  {effectiveServeSide === 'right'
                    ? 'Right (Even) Cross-Court'
                    : 'Left (Odd) Cross-Court'}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
