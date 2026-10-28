import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  RotateCcw,
  Trophy,
  Undo2,
  Volume2,
  ArrowRightLeft,
} from 'lucide-react';
import {
  GameScore,
  MatchRecord,
  Member,
  PendingTournamentScoreContext,
} from '../types';
import { calculateEloDelta } from '../utils/clubUtils';

interface LiveScoreKeeperProps {
  members: Member[];
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
  team1RightPlayerIdx: 0 | 1; // Which player in team1Ids is currently standing on Right (Even) court
  team2RightPlayerIdx: 0 | 1; // Which player in team2Ids is currently standing on Right (Even) court
  activeServeSide: 'right' | 'left'; // Right (Even) or Left (Odd) court of serving team
  completedGames: GameScore[];
}

export const LiveScoreKeeper: React.FC<LiveScoreKeeperProps> = ({
  members,
  isOfficer,
  pendingTournamentMatch,
  onClearPendingTournamentMatch,
  onSaveCompletedMatch,
  onNavigateToLadder,
  onRequestOfficerUnlock,
}) => {
  const [format, setFormat] = useState<'singles' | 'doubles'>('doubles');
  const [scoringType, setScoringType] = useState<'sideout' | 'rally'>('sideout');
  const [targetScore, setTargetScore] = useState<11 | 15 | 21>(11);
  const [bestOf, setBestOf] = useState<1 | 3>(1);

  // Roster selections
  const [t1P1, setT1P1] = useState<string>(members[0]?.id || '');
  const [t1P2, setT1P2] = useState<string>(members[1]?.id || '');
  const [t2P1, setT2P1] = useState<string>(members[2]?.id || '');
  const [t2P2, setT2P2] = useState<string>(members[3]?.id || '');

  // Live game state
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

  // Pre-populate if launched from a Club Tournament match
  useEffect(() => {
    if (pendingTournamentMatch) {
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

  // In singles, server side is strictly determined by server's even/odd score
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
    const t1Wins = updatedGames.filter((g) => g.team1Score > g.team2Score).length;
    const t2Wins = updatedGames.filter((g) => g.team2Score > g.team1Score).length;
    const neededWins = bestOf === 1 ? 1 : 2;

    if (t1Wins >= neededWins || t2Wins >= neededWins) {
      // Match finished! Auto-save to Match History
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
      // Advance to next game in Best of 3
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

  // Handler 1: Serving team scores a point (Side-out mode)
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

  // Handler 2: Side Out / Second Server (Side-out mode)
  const handleSideOutOrSecondServer = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    if (savedMatchSummary) return;
    setHistory((prev) => [...prev, state]);

    if (format === 'doubles' && state.serverNumber === 1) {
      // Switch to partner (Server 2) on the opposite court half
      setState({
        ...state,
        serverNumber: 2,
        activeServeSide: state.activeServeSide === 'right' ? 'left' : 'right',
      });
    } else {
      // Side Out to the other team! Server 1always starts from Right (Even) court
      setState({
        ...state,
        servingTeam: state.servingTeam === 1 ? 2 : 1,
        serverNumber: 1,
        activeServeSide: 'right',
      });
    }
  };

  // Handler 3: Rally scoring point for Team 1 or Team 2
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

  // Handler 4: Undo
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
      {/* Tournament Match Context Banner if launched from Club Tournaments */}
      {pendingTournamentMatch && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-amber-900 dark:text-amber-200">
            <span className="font-bold">Official Tournament Match:</span>{' '}
            {pendingTournamentMatch.label} — Final score will automatically update
            the tournament bracket and Club Ladder.
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
              <strong>View-Only Scoreboard:</strong> Only Club Officers can score
              official matches or save results to the Ladder.
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
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Live Courtside Score Keeper
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Win by 2 · Automatic server tracking & Elo ladder integration
            </p>
          </div>

          {/* Segmented Match Rules Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Singles / Doubles */}
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

            {/* Side-Out / Rally */}
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

            {/* Target Score: 11, 15, 21 */}
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

            {/* Best of 1 / Best of 3 */}
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
          {/* Team 1 Selection */}
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

          {/* Team 2 Selection */}
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
              Ladder rating updated: ±{savedMatchSummary.eloDelta} Elo points applied to
              participating players.
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
        {/* Left Column: Big Score Callout + Tap-Friendly Controls */}
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            {/* Official Score Callout Banner */}
            <div className="rounded-xl bg-slate-900 dark:bg-slate-950 text-white p-5">
              <div className="flex items-center justify-between gap-2 text-xs text-slate-400">
                <span>Official Score Callout (Win by 2 · Target {targetScore})</span>
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
                <strong className="text-white">{getMemberName(currentServerId)}</strong>{' '}
                ({effectiveServeSide === 'right' ? 'Right/Even' : 'Left/Odd'} Court)
              </div>
            </div>

            {/* Team Score Cards */}
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

            {/* Completed Games in Best of 3 */}
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

          {/* Big Tap-Friendly Action Buttons (Thumb-Zone Optimized) */}
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
                        : `Rotate serve to Team ${state.servingTeam === 1 ? 2 : 1}`}
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

        {/* Right Column: Live Court Diagram Showing Server & Receiver Positions */}
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

          {/* Pickleball Court Visual Diagram */}
          <div className="relative w-full aspect-[16/10] rounded-xl bg-blue-900 p-3 sm:p-4 border-4 border-slate-700 shadow-inner flex items-stretch select-none">
            <div className="w-full h-full border-2 border-white grid grid-cols-12 relative">
              {/* Team 1 Half (West) - 5 cols service courts + 1 col Kitchen */}
              <div className="col-span-5 grid grid-rows-2 border-r-2 border-white">
                {/* Team 1 Top = Left / Odd Court (looking from West baseline toward Net) */}
                <div
                  className={`p-2 sm:p-3 border-b border-white/80 flex flex-col justify-between transition-colors ${
                    state.servingTeam === 1 && effectiveServeSide === 'left'
                      ? 'bg-amber-400/30'
                      : 'bg-blue-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-white/80 font-mono-num">
                    <span>T1 LEFT (ODD)</span>
                    {state.servingTeam === 1 && effectiveServeSide === 'left' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                        SERVER
                      </span>
                    )}
                    {state.servingTeam === 2 && effectiveServeSide === 'left' && (
                      <span className="px-1.5 py-0.5 rounded bg-white/90 text-slate-950 font-bold">
                        RECEIVER
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate">
                    {team1LeftPlayerId ? getShortName(team1LeftPlayerId) : '—'}
                  </div>
                </div>

                {/* Team 1 Bottom = Right / Even Court */}
                <div
                  className={`p-2 sm:p-3 border-t border-white/80 flex flex-col justify-between transition-colors ${
                    state.servingTeam === 1 && effectiveServeSide === 'right'
                      ? 'bg-amber-400/30'
                      : 'bg-blue-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-white/80 font-mono-num">
                    <span>T1 RIGHT (EVEN)</span>
                    {state.servingTeam === 1 && effectiveServeSide === 'right' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                        SERVER
                      </span>
                    )}
                    {state.servingTeam === 2 && effectiveServeSide === 'right' && (
                      <span className="px-1.5 py-0.5 rounded bg-white/90 text-slate-950 font-bold">
                        RECEIVER
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate">
                    {team1RightPlayerId ? getShortName(team1RightPlayerId) : '—'}
                  </div>
                </div>
              </div>

              {/* Non-Volley Zone (Kitchen) West + Net + East */}
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

              {/* Team 2 Half (East) - 5 cols service courts */}
              <div className="col-span-5 grid grid-rows-2 border-l-2 border-white">
                {/* Team 2 Top = Right / Even Court (looking from East baseline toward Net) */}
                <div
                  className={`p-2 sm:p-3 border-b border-white/80 flex flex-col justify-between transition-colors ${
                    state.servingTeam === 2 && effectiveServeSide === 'right'
                      ? 'bg-amber-400/30'
                      : 'bg-blue-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-white/80 font-mono-num">
                    <span>T2 RIGHT (EVEN)</span>
                    {state.servingTeam === 2 && effectiveServeSide === 'right' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                        SERVER
                      </span>
                    )}
                    {state.servingTeam === 1 && effectiveServeSide === 'right' && (
                      <span className="px-1.5 py-0.5 rounded bg-white/90 text-slate-950 font-bold">
                        RECEIVER
                      </span>
                    )}
                  </div>
                  <div className="text-xs sm:text-sm font-bold text-white truncate text-right">
                    {team2RightPlayerId ? getShortName(team2RightPlayerId) : '—'}
                  </div>
                </div>

                {/* Team 2 Bottom = Left / Odd Court */}
                <div
                  className={`p-2 sm:p-3 border-t border-white/80 flex flex-col justify-between transition-colors ${
                    state.servingTeam === 2 && effectiveServeSide === 'left'
                      ? 'bg-amber-400/30'
                      : 'bg-blue-700/60'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-white/80 font-mono-num">
                    <span>T2 LEFT (ODD)</span>
                    {state.servingTeam === 2 && effectiveServeSide === 'left' && (
                      <span className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-bold">
                        SERVER
                      </span>
                    )}
                    {state.servingTeam === 1 && effectiveServeSide === 'left' && (
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

          {/* Diagonal Serve Callout Footer */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <div>
              <strong>Active Serve:</strong> {getMemberName(currentServerId)} serves
              diagonally to <strong>{getMemberName(currentReceiverId)}</strong>
            </div>
            <div className="text-slate-500">
              {effectiveServeSide === 'right'
                ? 'Right (Even) Cross-Court'
                : 'Left (Odd) Cross-Court'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
