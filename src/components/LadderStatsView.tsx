import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronUp,
  Flame,
  ShieldCheck,
  Swords,
  Trash2,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  AttendanceSession,
  LadderChallenge,
  MatchRecord,
  Member,
  NavTab,
} from '../types';
import {
  MemberAchievement,
  calculateEloDelta,
  computeHeadToHeadSummary,
  computeMemberAchievements,
} from '../utils/clubUtils';

interface LadderStatsViewProps {
  members: Member[];
  matches: MatchRecord[];
  attendance?: AttendanceSession[];
  challenges?: LadderChallenge[];
  activeMember?: Member | null;
  isOfficer: boolean;
  onSaveManualMatch: (match: MatchRecord) => void;
  onDeleteMatch: (matchId: string) => void;
  onCreateChallenge?: (payload: {
    challengerId: string;
    opponentId: string;
    format: 'singles' | 'doubles';
    targetScore: 11 | 15 | 21;
    message: string;
  }) => void;
  onUpdateChallengeStatus?: (
    challengeId: string,
    status: 'open' | 'accepted' | 'declined',
    remove?: boolean
  ) => void;
  onResolveChallengeMatch?: (
    challengeId: string,
    challengerScore: number,
    opponentScore: number
  ) => void;
  onNavigate: (tab: NavTab) => void;
}

function renderBadgeIcon(ach: MemberAchievement) {
  switch (ach.category) {
    case 'Streak':
      return <Flame className="w-3.5 h-3.5" />;
    case 'Attendance':
      return <ShieldCheck className="w-3.5 h-3.5" />;
    case 'Rating':
      return <Zap className="w-3.5 h-3.5" />;
    case 'Rivalry':
      return <Swords className="w-3.5 h-3.5" />;
    default:
      return <Trophy className="w-3.5 h-3.5" />;
  }
}

export const LadderStatsView: React.FC<LadderStatsViewProps> = ({
  members,
  matches,
  attendance = [],
  challenges = [],
  activeMember = null,
  isOfficer,
  onSaveManualMatch,
  onDeleteMatch,
  onCreateChallenge,
  onUpdateChallengeStatus,
  onResolveChallengeMatch,
  onNavigate,
}) => {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [showManualMatchForm, setShowManualMatchForm] = useState(false);

  // Ranked by Elo rating descending
  const rankedLadder = useMemo(
    () => [...members].sort((a, b) => b.elo - a.elo),
    [members]
  );

  // Manual Match form state
  const [mFormat, setMFormat] = useState<'singles' | 'doubles'>('singles');
  const [mT1P1, setMT1P1] = useState(rankedLadder[0]?.id || '');
  const [mT1P2, setMT1P2] = useState(rankedLadder[1]?.id || '');
  const [mT2P1, setMT2P1] = useState(rankedLadder[2]?.id || '');
  const [mT2P2, setMT2P2] = useState(rankedLadder[3]?.id || '');
  const [mScore1, setMScore1] = useState(11);
  const [mScore2, setMScore2] = useState(7);

  // Head-to-Head Rivalry Calculator state
  const [h2hPlayerAId, setH2hPlayerAId] = useState<string>(
    activeMember?.id || rankedLadder[0]?.id || ''
  );
  const [h2hPlayerBId, setH2hPlayerBId] = useState<string>(() => {
    const defaultA = activeMember?.id || rankedLadder[0]?.id || '';
    const rival = rankedLadder.find((m) => m.id !== defaultA);
    return rival?.id || rankedLadder[1]?.id || '';
  });

  // Challenge Board state
  const [showChallengeForm, setShowChallengeForm] = useState(false);
  const [challengeFilter, setChallengeFilter] = useState<
    'active' | 'completed' | 'all'
  >('active');
  const [challengerId, setChallengerId] = useState<string>(
    activeMember?.id || rankedLadder[0]?.id || ''
  );
  const [opponentId, setOpponentId] = useState<string>(() => {
    const base = activeMember?.id || rankedLadder[0]?.id || '';
    const rival = rankedLadder.find((m) => m.id !== base);
    return rival?.id || '';
  });
  const [challengeFormat, setChallengeFormat] = useState<'singles' | 'doubles'>(
    'singles'
  );
  const [challengeTarget, setChallengeTarget] = useState<11 | 15 | 21>(11);
  const [challengeMessage, setChallengeMessage] = useState('');
  const [challengeError, setChallengeError] = useState('');

  // Officer inline score resolution state for open/accepted challenges
  const [scoringChallengeId, setScoringChallengeId] = useState<string | null>(
    null
  );
  const [cScore1, setCScore1] = useState<number>(11);
  const [cScore2, setCScore2] = useState<number>(8);

  // Keep default player selections valid when roster or activeMember updates
  useEffect(() => {
    if (rankedLadder.length === 0) return;
    if (!rankedLadder.some((m) => m.id === h2hPlayerAId)) {
      const nextA = activeMember?.id || rankedLadder[0].id;
      setH2hPlayerAId(nextA);
    }
    if (
      !rankedLadder.some((m) => m.id === h2hPlayerBId) ||
      (rankedLadder.length > 1 && h2hPlayerBId === h2hPlayerAId)
    ) {
      const rival = rankedLadder.find((m) => m.id !== h2hPlayerAId);
      if (rival) setH2hPlayerBId(rival.id);
    }
  }, [rankedLadder, activeMember, h2hPlayerAId, h2hPlayerBId]);

  useEffect(() => {
    if (activeMember) {
      setChallengerId(activeMember.id);
      if (opponentId === activeMember.id || !opponentId) {
        const rival = rankedLadder.find((m) => m.id !== activeMember.id);
        if (rival) setOpponentId(rival.id);
      }
    } else if (!challengerId && rankedLadder[0]) {
      setChallengerId(rankedLadder[0].id);
      if (rankedLadder[1]) setOpponentId(rankedLadder[1].id);
    }
  }, [activeMember, rankedLadder, challengerId, opponentId]);

  // Leaderboard 1: Most Wins
  const mostWinsLeaders = [...members]
    .sort((a, b) => b.wins - a.wins || b.elo - a.elo)
    .slice(0, 3);

  // Leaderboard 2: Best Win Percentage
  const bestWinPctLeaders = [...members]
    .filter((m) => m.wins + m.losses >= 1)
    .sort((a, b) => {
      const pctA = a.wins / Math.max(1, a.wins + a.losses);
      const pctB = b.wins / Math.max(1, b.wins + b.losses);
      return pctB - pctA || b.wins - a.wins;
    })
    .slice(0, 3);

  // Leaderboard 3: Most Improved This Month (elo - monthStartElo)
  const mostImprovedLeaders = [...members]
    .sort(
      (a, b) =>
        b.elo - b.monthStartElo - (a.elo - a.monthStartElo) || b.elo - a.elo
    )
    .slice(0, 3);

  const getMemberById = (id: string) => members.find((m) => m.id === id);
  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.name || 'Unknown';
  const getMemberRank = (id: string) => {
    const idx = rankedLadder.findIndex((m) => m.id === id);
    return idx >= 0 ? idx + 1 : null;
  };

  const getPlayerRecentMatches = (memberId: string) => {
    return matches
      .filter(
        (m) => m.team1Ids.includes(memberId) || m.team2Ids.includes(memberId)
      )
      .slice(0, 5);
  };

  const playerA = useMemo(
    () => members.find((m) => m.id === h2hPlayerAId) || null,
    [members, h2hPlayerAId]
  );
  const playerB = useMemo(
    () => members.find((m) => m.id === h2hPlayerBId) || null,
    [members, h2hPlayerBId]
  );

  const h2hSummary = useMemo(() => {
    if (!playerA || !playerB || playerA.id === playerB.id) return null;
    return computeHeadToHeadSummary(playerA, playerB, matches);
  }, [playerA, playerB, matches]);

  const filteredChallenges = useMemo(() => {
    const sorted = [...challenges].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt)
    );
    if (challengeFilter === 'active') {
      return sorted.filter(
        (c) => c.status === 'open' || c.status === 'accepted'
      );
    }
    if (challengeFilter === 'completed') {
      return sorted.filter((c) => c.status === 'completed');
    }
    return sorted;
  }, [challenges, challengeFilter]);

  const activeChallengesCount = useMemo(
    () =>
      challenges.filter((c) => c.status === 'open' || c.status === 'accepted')
        .length,
    [challenges]
  );

  const handleManualMatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOfficer) return;
    const team1Ids = mFormat === 'doubles' ? [mT1P1, mT1P2] : [mT1P1];
    const team2Ids = mFormat === 'doubles' ? [mT2P1, mT2P2] : [mT2P1];
    const winnerTeam: 1 | 2 = mScore1 >= mScore2 ? 1 : 2;
    const t1Elos = team1Ids.map(
      (id) => members.find((m) => m.id === id)?.elo || 1200
    );
    const t2Elos = team2Ids.map(
      (id) => members.find((m) => m.id === id)?.elo || 1200
    );
    const eloDelta = calculateEloDelta(t1Elos, t2Elos, winnerTeam);

    const record: MatchRecord = {
      id: `match-${Date.now()}`,
      date: new Date().toISOString().slice(0, 10),
      format: mFormat,
      scoringType: 'sideout',
      targetScore: 11,
      bestOf: 1,
      team1Ids,
      team2Ids,
      games: [{ team1Score: mScore1, team2Score: mScore2 }],
      winnerTeam,
      eloDelta,
    };

    onSaveManualMatch(record);
    setShowManualMatchForm(false);
  };

  const handleIssueChallengeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setChallengeError('');
    if (!onCreateChallenge) return;

    const effectiveChallengerId =
      !isOfficer && activeMember ? activeMember.id : challengerId;

    if (!effectiveChallengerId) {
      setChallengeError(
        'Sign in with your School ID first to issue a personal ladder challenge.'
      );
      return;
    }
    if (!opponentId || effectiveChallengerId === opponentId) {
      setChallengeError('Please select a different rival to challenge.');
      return;
    }

    onCreateChallenge({
      challengerId: effectiveChallengerId,
      opponentId,
      format: challengeFormat,
      targetScore: challengeTarget,
      message:
        challengeMessage.trim() ||
        `Official ${challengeFormat} ladder callout (Game to ${challengeTarget})`,
    });

    setChallengeMessage('');
    setShowChallengeForm(false);
    setChallengeFilter('active');
  };

  const handleOpenChallengeWithRival = (targetOpponentId: string) => {
    const baseChallenger =
      activeMember?.id || h2hPlayerAId || rankedLadder[0]?.id || '';
    if (baseChallenger && baseChallenger !== targetOpponentId) {
      setChallengerId(baseChallenger);
      setOpponentId(targetOpponentId);
    } else if (rankedLadder.length >= 2) {
      const alt = rankedLadder.find((m) => m.id !== targetOpponentId);
      if (alt) setChallengerId(alt.id);
      setOpponentId(targetOpponentId);
    }
    setShowChallengeForm(true);
  };

  return (
    <div className="space-y-6">
      {/* 3 Leaderboard Cards: Most Wins, Best Win %, Most Improved This Month */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Most Wins */}
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-mono-num uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              01 · Most Wins
            </span>
          </div>
          <div className="space-y-2.5">
            {mostWinsLeaders.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                No player records yet.
              </div>
            ) : (
              mostWinsLeaders.map((m, idx) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
                >
                  <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                    <strong className="font-mono-num text-slate-400 mr-0.5 shrink-0">
                      0{idx + 1}
                    </strong>
                    {m.photoUrl ? (
                      <img
                        src={m.photoUrl}
                        alt={m.name}
                        className="w-5 h-5 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 text-[9px]">
                        {m.name.slice(0, 1)}
                      </div>
                    )}
                    <span className="truncate">{m.name}</span>
                  </span>
                  <span className="font-mono-num font-bold text-slate-900 dark:text-white shrink-0 ml-2 tabular-nums">
                    {m.wins} Wins
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Best Win Percentage */}
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-mono-num uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              02 · Best Win Percentage
            </span>
          </div>
          <div className="space-y-2.5">
            {bestWinPctLeaders.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                Complete a match to rank win %.
              </div>
            ) : (
              bestWinPctLeaders.map((m, idx) => {
                const pct = Math.round(
                  (m.wins / Math.max(1, m.wins + m.losses)) * 100
                );
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
                  >
                    <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                      <strong className="font-mono-num text-slate-400 mr-0.5 shrink-0">
                        0{idx + 1}
                      </strong>
                      {m.photoUrl ? (
                        <img
                          src={m.photoUrl}
                          alt={m.name}
                          className="w-5 h-5 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 text-[9px]">
                          {m.name.slice(0, 1)}
                        </div>
                      )}
                      <span className="truncate">{m.name}</span>
                    </span>
                    <span className="font-mono-num font-bold text-slate-900 dark:text-white shrink-0 ml-2 tabular-nums">
                      {pct}% ({m.wins}–{m.losses})
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Most Improved This Month */}
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-slate-800">
            <span className="text-[11px] font-mono-num uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              03 · Most Improved (Month)
            </span>
          </div>
          <div className="space-y-2.5">
            {mostImprovedLeaders.length === 0 ? (
              <div className="text-xs text-slate-500 py-2">
                No monthly Elo gains yet.
              </div>
            ) : (
              mostImprovedLeaders.map((m, idx) => {
                const gain = m.elo - m.monthStartElo;
                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
                  >
                    <span className="font-medium text-slate-900 dark:text-white flex items-center gap-2 min-w-0">
                      <strong className="font-mono-num text-slate-400 mr-0.5 shrink-0">
                        0{idx + 1}
                      </strong>
                      {m.photoUrl ? (
                        <img
                          src={m.photoUrl}
                          alt={m.name}
                          className="w-5 h-5 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold flex items-center justify-center shrink-0 text-[9px]">
                          {m.name.slice(0, 1)}
                        </div>
                      )}
                      <span className="truncate">{m.name}</span>
                    </span>
                    <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400 shrink-0 ml-2 tabular-nums">
                      {gain >= 0 ? `+${gain}` : gain} Elo
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* RIVALRY & COMPETITIVE HUB: H2H CALCULATOR + CHALLENGE BOARD       */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT (6 COLS): HEAD-TO-HEAD RIVALRY & WIN PROBABILITY CALCULATOR */}
        <div className="lg:col-span-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-[11px] font-mono-num uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
                Matchup Scouting & K=32 Elo Stakes
              </div>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                Head-to-Head & Win Probability
              </h3>
            </div>
            {playerA && playerB && playerA.id !== playerB.id && (
              <button
                type="button"
                onClick={() => {
                  const temp = h2hPlayerAId;
                  setH2hPlayerAId(h2hPlayerBId);
                  setH2hPlayerBId(temp);
                }}
                className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                title="Swap players"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>Swap</span>
              </button>
            )}
          </div>

          {rankedLadder.length < 2 ? (
            <div className="py-8 text-center rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
              Add at least 2 club members to compare head-to-head win
              probabilities and Elo stakes.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Dual Player Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400">
                    Player A{' '}
                    {activeMember && h2hPlayerAId === activeMember.id
                      ? '(You)'
                      : ''}
                  </label>
                  <select
                    value={h2hPlayerAId}
                    onChange={(e) => setH2hPlayerAId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {rankedLadder.map((m, idx) => (
                      <option key={m.id} value={m.id}>
                        #{idx + 1} {m.name} ({m.elo} Elo)
                      </option>
                    ))}
                  </select>
                  {playerA && (
                    <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-500 pt-0.5 tabular-nums">
                      <span>
                        Rank #{getMemberRank(playerA.id)} · Gr. {playerA.grade}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {playerA.wins}W–{playerA.losses}L
                      </span>
                    </div>
                  )}
                </div>

                <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5">
                  <label className="block text-[10px] font-mono-num uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400">
                    Player B (Rival)
                  </label>
                  <select
                    value={h2hPlayerBId}
                    onChange={(e) => setH2hPlayerBId(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {rankedLadder.map((m, idx) => (
                      <option key={m.id} value={m.id}>
                        #{idx + 1} {m.name} ({m.elo} Elo)
                      </option>
                    ))}
                  </select>
                  {playerB && (
                    <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-500 pt-0.5 tabular-nums">
                      <span>
                        Rank #{getMemberRank(playerB.id)} · Gr. {playerB.grade}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {playerB.wins}W–{playerB.losses}L
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {playerA && playerB && playerA.id === playerB.id ? (
                <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 text-center">
                  Select two different club players above to calculate win odds
                  and Elo stakes.
                </div>
              ) : (
                playerA &&
                playerB &&
                h2hSummary && (
                  <div className="space-y-4">
                    {/* Win Probability Split Bar */}
                    <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex items-center justify-between text-xs font-mono-num tabular-nums">
                        <div>
                          <span className="font-bold text-blue-600 dark:text-blue-400 text-base">
                            {h2hSummary.winProbabilityA}%
                          </span>{' '}
                          <span className="text-slate-600 dark:text-slate-300 font-semibold">
                            {playerA.name.split(' ')[0]}
                          </span>
                        </div>
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                          Expected Win Probability
                        </span>
                        <div className="text-right">
                          <span className="text-slate-600 dark:text-slate-300 font-semibold">
                            {playerB.name.split(' ')[0]}
                          </span>{' '}
                          <span className="font-bold text-amber-600 dark:text-amber-400 text-base">
                            {h2hSummary.winProbabilityB}%
                          </span>
                        </div>
                      </div>

                      <div className="h-2.5 w-full rounded-sm bg-amber-500 overflow-hidden flex">
                        <div
                          className="h-full bg-blue-600 transition-all duration-300"
                          style={{ width: `${h2hSummary.winProbabilityA}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono-num text-slate-500 dark:text-slate-400 pt-0.5 tabular-nums">
                        <span>
                          If {playerA.name.split(' ')[0]} wins:{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            +{h2hSummary.eloStakeIfAWins} Elo
                          </strong>
                        </span>
                        <span>
                          If {playerB.name.split(' ')[0]} wins:{' '}
                          <strong className="text-emerald-600 dark:text-emerald-400">
                            +{h2hSummary.eloStakeIfBWins} Elo
                          </strong>
                        </span>
                      </div>
                    </div>

                    {/* 3-Column Matchup Telemetry Strip */}
                    <div className="grid grid-cols-3 gap-2.5">
                      <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-500">
                          All-Time H2H
                        </div>
                        <div className="font-mono-num text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                          {h2hSummary.aWins}–{h2hSummary.bWins}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-num tabular-nums">
                          {h2hSummary.totalMatches} shared matches
                        </div>
                      </div>

                      <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-500">
                          H2H Points
                        </div>
                        <div className="font-mono-num text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                          {h2hSummary.aPoints}–{h2hSummary.bPoints}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-num tabular-nums">
                          Diff:{' '}
                          {h2hSummary.pointDiffA >= 0
                            ? `+${h2hSummary.pointDiffA}`
                            : h2hSummary.pointDiffA}
                        </div>
                      </div>

                      <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                        <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-500">
                          Rating Gap
                        </div>
                        <div className="font-mono-num text-lg font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
                          {playerA.elo - playerB.elo >= 0
                            ? `+${playerA.elo - playerB.elo}`
                            : playerA.elo - playerB.elo}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono-num tabular-nums">
                          {playerA.elo} vs {playerB.elo}
                        </div>
                      </div>
                    </div>

                    {/* Recent Head-to-Head Meetings + Callout Action */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        {h2hSummary.sharedMatches.length > 0
                          ? `Last ${Math.min(3, h2hSummary.sharedMatches.length)} Head-to-Head Meetings`
                          : 'Never faced each other in an official match yet'}
                      </span>
                      {onCreateChallenge && (
                        <button
                          type="button"
                          onClick={() =>
                            handleOpenChallengeWithRival(playerB.id)
                          }
                          className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          Call Out {playerB.name.split(' ')[0]} →
                        </button>
                      )}
                    </div>

                    {h2hSummary.sharedMatches.length > 0 && (
                      <div className="divide-y divide-slate-200 dark:divide-slate-800 border-t border-slate-200 dark:border-slate-800 text-xs">
                        {h2hSummary.sharedMatches.slice(0, 3).map((m) => {
                          const aInT1 = m.team1Ids.includes(playerA.id);
                          const aWon =
                            (aInT1 && m.winnerTeam === 1) ||
                            (!aInT1 && m.winnerTeam === 2);
                          const scoreStr = m.games
                            .map((g) => `${g.team1Score}–${g.team2Score}`)
                            .join(', ');
                          return (
                            <div
                              key={m.id}
                              className="py-2 flex items-center justify-between gap-2"
                            >
                              <div>
                                <span
                                  className={`font-mono-num font-bold mr-2 ${
                                    aWon
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-amber-600 dark:text-amber-400'
                                  }`}
                                >
                                  {aWon
                                    ? `${playerA.name.split(' ')[0]} WON`
                                    : `${playerB.name.split(' ')[0]} WON`}
                                </span>
                                <span className="text-slate-600 dark:text-slate-400 capitalize">
                                  {m.format}
                                </span>
                              </div>
                              <div className="font-mono-num text-slate-700 dark:text-slate-300 tabular-nums">
                                {scoreStr} · {m.date} (±{m.eloDelta} Elo)
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        {/* RIGHT (6 COLS): LIVE CLUB RIVALRY CHALLENGE BOARD */}
        <div className="lg:col-span-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-[11px] font-mono-num uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400">
                Official Ladder Callouts · {activeChallengesCount} Active
              </div>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                Player Challenge Board
              </h3>
            </div>

            {onCreateChallenge && rankedLadder.length >= 2 && (
              <button
                type="button"
                onClick={() => setShowChallengeForm(!showChallengeForm)}
                className="min-h-[34px] px-3 py-1.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 text-white text-xs font-semibold cursor-pointer"
              >
                {showChallengeForm ? 'Close Form' : '+ Call Out a Rival'}
              </button>
            )}
          </div>

          {/* Issue Challenge Form */}
          {showChallengeForm && onCreateChallenge && (
            <form
              onSubmit={handleIssueChallengeSubmit}
              className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 dark:text-white">
                  Issue Official Ladder Challenge
                </span>
                <span className="text-[11px] font-mono-num text-slate-500">
                  Synced across all devices
                </span>
              </div>

              {!isOfficer && !activeMember ? (
                <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                  Sign in with your School ID in the top menu first so your
                  challenge is posted under your athlete profile.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono-num uppercase tracking-wider font-semibold text-slate-500 mb-1">
                        Challenger
                      </label>
                      {isOfficer ? (
                        <select
                          value={challengerId}
                          onChange={(e) => setChallengerId(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                        >
                          {rankedLadder.map((m, idx) => (
                            <option key={m.id} value={m.id}>
                              #{idx + 1} {m.name} ({m.elo})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="px-2.5 py-1.5 rounded text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white truncate">
                          {activeMember?.name} ({activeMember?.elo} Elo)
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono-num uppercase tracking-wider font-semibold text-slate-500 mb-1">
                        Challenged Rival
                      </label>
                      <select
                        value={opponentId}
                        onChange={(e) => setOpponentId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        {rankedLadder
                          .filter(
                            (m) =>
                              m.id !==
                              (!isOfficer && activeMember
                                ? activeMember.id
                                : challengerId)
                          )
                          .map((m) => (
                            <option key={m.id} value={m.id}>
                              #{getMemberRank(m.id)} {m.name} ({m.elo} Elo)
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono-num uppercase tracking-wider font-semibold text-slate-500 mb-1">
                        Format
                      </label>
                      <select
                        value={challengeFormat}
                        onChange={(e) =>
                          setChallengeFormat(
                            e.target.value as 'singles' | 'doubles'
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value="singles">Singles (1v1)</option>
                        <option value="doubles">Doubles (Captain Pair)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono-num uppercase tracking-wider font-semibold text-slate-500 mb-1">
                        Target Score
                      </label>
                      <select
                        value={challengeTarget}
                        onChange={(e) =>
                          setChallengeTarget(
                            Number(e.target.value) as 11 | 15 | 21
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                      >
                        <option value={11}>Game to 11 (Win by 2)</option>
                        <option value={15}>Game to 15 (Win by 2)</option>
                        <option value={21}>Game to 21 (Win by 2)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono-num uppercase tracking-wider font-semibold text-slate-500 mb-1">
                      Callout Note / Court Time (Optional)
                    </label>
                    <input
                      type="text"
                      maxLength={120}
                      value={challengeMessage}
                      onChange={(e) => setChallengeMessage(e.target.value)}
                      placeholder="e.g. Court 1 at Thursday practice — coming for your #3 rank!"
                      className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>

                  {challengeError && (
                    <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                      {challengeError}
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowChallengeForm(false)}
                      className="px-3 py-1.5 rounded text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                    >
                      Post Challenge to Board
                    </button>
                  </div>
                </>
              )}
            </form>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-2">
            {(
              [
                {
                  id: 'active',
                  label: `Active Callouts (${activeChallengesCount})`,
                },
                {
                  id: 'completed',
                  label: `Settled (${
                    challenges.filter((c) => c.status === 'completed').length
                  })`,
                },
                { id: 'all', label: `All (${challenges.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setChallengeFilter(tab.id)}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                  challengeFilter === tab.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Challenge List */}
          {filteredChallenges.length === 0 ? (
            <div className="py-8 text-center rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                No {challengeFilter === 'active' ? 'active ' : ''}ladder
                challenges on the board yet.
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                Call out a teammate near your Elo rank to schedule a ladder
                match at the next BNHS practice.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[380px] overflow-y-auto touch-scroll pr-1">
              {filteredChallenges.map((c) => {
                const challenger = getMemberById(c.challengerId);
                const opponent = getMemberById(c.opponentId);
                const cRank = getMemberRank(c.challengerId);
                const oRank = getMemberRank(c.opponentId);

                const stakeIfChallengerWins = calculateEloDelta(
                  [challenger?.elo || 1200],
                  [opponent?.elo || 1200],
                  1
                );
                const stakeIfOpponentWins = calculateEloDelta(
                  [challenger?.elo || 1200],
                  [opponent?.elo || 1200],
                  2
                );

                const isMyIncoming =
                  activeMember && activeMember.id === c.opponentId;
                const isMyOutgoing =
                  activeMember && activeMember.id === c.challengerId;
                const isScoringThis = scoringChallengeId === c.id;

                return (
                  <div
                    key={c.id}
                    className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {challenger?.name || 'Player'}{' '}
                          {cRank ? (
                            <span className="font-mono-num text-slate-400">
                              (#{cRank})
                            </span>
                          ) : null}
                        </span>
                        <span className="font-mono-num font-bold text-amber-600 dark:text-amber-400 uppercase px-1">
                          vs.
                        </span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {opponent?.name || 'Player'}{' '}
                          {oRank ? (
                            <span className="font-mono-num text-slate-400">
                              (#{oRank})
                            </span>
                          ) : null}
                        </span>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded font-mono-num text-[10px] font-bold uppercase tracking-wider ${
                          c.status === 'accepted'
                            ? 'bg-emerald-600 text-white'
                            : c.status === 'open'
                            ? 'bg-amber-500 text-slate-950'
                            : c.status === 'completed'
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                            : 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                        }`}
                      >
                        {c.status === 'accepted'
                          ? 'ACCEPTED · ON DECK'
                          : c.status === 'open'
                          ? 'OPEN CALLOUT'
                          : c.status === 'completed'
                          ? 'SETTLED'
                          : 'DECLINED'}
                      </span>
                    </div>

                    {c.message && (
                      <div className="text-slate-600 dark:text-slate-300 leading-relaxed">
                        “{c.message}”
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/70 dark:border-slate-800/70 text-[11px] text-slate-500 font-mono-num tabular-nums">
                      <div>
                        <span className="capitalize">{c.format}</span> · To{' '}
                        {c.targetScore} · Stakes: +{stakeIfChallengerWins} / +
                        {stakeIfOpponentWins} Elo
                      </div>
                      <div>{c.createdAt}</div>
                    </div>

                    {c.status === 'completed' && c.scoreSummary && (
                      <div className="pt-1 text-xs font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                        Result: {c.scoreSummary}
                      </div>
                    )}

                    {/* Action Controls for Opponent, Challenger, or Officer */}
                    {(c.status === 'open' || c.status === 'accepted') && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {c.status === 'open' &&
                            (isMyIncoming || isOfficer) &&
                            onUpdateChallengeStatus && (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateChallengeStatus(c.id, 'accepted')
                                  }
                                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                                >
                                  Accept Callout
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onUpdateChallengeStatus(c.id, 'declined')
                                  }
                                  className="px-2.5 py-1 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold cursor-pointer"
                                >
                                  Decline
                                </button>
                              </>
                            )}

                          {(isMyOutgoing || isOfficer) &&
                            onUpdateChallengeStatus && (
                              <button
                                type="button"
                                onClick={() =>
                                  onUpdateChallengeStatus(c.id, 'open', true)
                                }
                                className="px-2 py-1 rounded text-slate-500 hover:text-red-600 font-semibold cursor-pointer"
                              >
                                Withdraw
                              </button>
                            )}
                        </div>

                        {isOfficer && onResolveChallengeMatch && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isScoringThis) {
                                setScoringChallengeId(null);
                              } else {
                                setScoringChallengeId(c.id);
                                setCScore1(c.targetScore);
                                setCScore2(Math.max(0, c.targetScore - 3));
                              }
                            }}
                            className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                          >
                            {isScoringThis
                              ? 'Cancel Score'
                              : 'Score & Settle Match'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Officer Inline Score Resolution Box */}
                    {isOfficer && isScoringThis && onResolveChallengeMatch && (
                      <div className="p-3 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 space-y-2.5 mt-2">
                        <div className="text-[11px] font-bold text-slate-900 dark:text-white">
                          Record Official Challenge Result (Updates Ladder Elo)
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono-num uppercase text-slate-500 mb-0.5 truncate">
                              {challenger?.name || 'Challenger'} Score
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={35}
                              value={cScore1}
                              onChange={(e) =>
                                setCScore1(Number(e.target.value))
                              }
                              className="w-full px-2.5 py-1 rounded text-xs font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono-num uppercase text-slate-500 mb-0.5 truncate">
                              {opponent?.name || 'Opponent'} Score
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={35}
                              value={cScore2}
                              onChange={(e) =>
                                setCScore2(Number(e.target.value))
                              }
                              className="w-full px-2.5 py-1 rounded text-xs font-mono-num bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (cScore1 === cScore2) return;
                              onResolveChallengeMatch(c.id, cScore1, cScore2);
                              setScoringChallengeId(null);
                            }}
                            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                          >
                            Save Official Winner & Update Elo
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Main Club Ladder Table */}
      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Official BNHS Elo Club Ladder
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any player row to inspect their unlocked varsity badges,
              streak milestones & recent matches
            </p>
          </div>

          {isOfficer && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onNavigate('scorekeeper')}
                className="min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Score Live Match
              </button>
              <button
                onClick={() => setShowManualMatchForm(!showManualMatchForm)}
                className="min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white cursor-pointer"
              >
                + Log Quick Result
              </button>
            </div>
          )}
        </div>

        {/* Officer Manual Match Form */}
        {isOfficer && showManualMatchForm && (
          <form
            onSubmit={handleManualMatchSubmit}
            className="mb-6 p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Log Completed Match Result (Auto-Updates Ladder)
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setMFormat('singles')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    mFormat === 'singles'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Singles
                </button>
                <button
                  type="button"
                  onClick={() => setMFormat('doubles')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded ${
                    mFormat === 'doubles'
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Doubles
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Team 1
                </label>
                <select
                  value={mT1P1}
                  onChange={(e) => setMT1P1(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.elo})
                    </option>
                  ))}
                </select>
                {mFormat === 'doubles' && (
                  <select
                    value={mT1P2}
                    onChange={(e) => setMT1P2(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.elo})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  Team 2
                </label>
                <select
                  value={mT2P1}
                  onChange={(e) => setMT2P1(e.target.value)}
                  className="w-full px-3 py-2 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.elo})
                    </option>
                  ))}
                </select>
                {mFormat === 'doubles' && (
                  <select
                    value={mT2P2}
                    onChange={(e) => setMT2P2(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.elo})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    T1 Score
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={mScore1}
                    onChange={(e) => setMScore1(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">
                    T2 Score
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={mScore2}
                    onChange={(e) => setMScore2(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-md text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualMatchForm(false)}
                className="px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-md text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
              >
                Save Match & Update Elo
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto touch-scroll">
          <table className="w-full min-w-[680px] text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono-num uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-3">Rank</th>
                <th className="py-3 px-3">Player</th>
                <th className="py-3 px-3 text-right">Elo Rating</th>
                <th className="py-3 px-3 text-right">Month Δ</th>
                <th className="py-3 px-3 text-right">W–L Record</th>
                <th className="py-3 px-3 text-right">Win %</th>
                <th className="py-3 px-3 text-right">PF / PA (Diff)</th>
                <th className="py-3 px-3 text-right">Badges</th>
                <th className="py-3 pl-3 text-right">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
              {rankedLadder.map((member, index) => {
                const totalGames = member.wins + member.losses;
                const winPct =
                  totalGames > 0
                    ? Math.round((member.wins / totalGames) * 100)
                    : 0;
                const monthDiff = member.elo - member.monthStartElo;
                const ptDiff = member.pointsFor - member.pointsAgainst;
                const isExpanded = expandedMemberId === member.id;
                const playerMatches = getPlayerRecentMatches(member.id);
                const memberAchievements = computeMemberAchievements(
                  member,
                  matches,
                  attendance,
                  challenges
                );
                const unlockedBadges = memberAchievements.filter(
                  (a) => a.unlocked
                );

                return (
                  <React.Fragment key={member.id}>
                    <tr
                      onClick={() =>
                        setExpandedMemberId(isExpanded ? null : member.id)
                      }
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3 pr-3 font-mono-num font-bold text-slate-900 dark:text-white tabular-nums">
                        #{index + 1}
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
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-slate-900 dark:text-white truncate">
                                {member.name}
                              </span>
                              {activeMember?.id === member.id && (
                                <span className="text-[10px] font-mono-num uppercase font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white">
                                  YOU
                                </span>
                              )}
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              )}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                              {member.grade}th Grade · {member.skillLevel}
                              {member.duprRating
                                ? ` · ${member.duprRating} DUPR`
                                : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num font-bold text-base text-slate-900 dark:text-white tabular-nums">
                        {member.elo}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-xs tabular-nums">
                        <span
                          className={
                            monthDiff >= 0
                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'text-red-500'
                          }
                        >
                          {monthDiff >= 0 ? `+${monthDiff}` : monthDiff}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-800 dark:text-slate-200 tabular-nums">
                        {member.wins}–{member.losses}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-slate-700 dark:text-slate-300 tabular-nums">
                        {winPct}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-xs text-slate-600 dark:text-slate-300 tabular-nums">
                        {member.pointsFor} / {member.pointsAgainst}{' '}
                        <span
                          className={
                            ptDiff >= 0
                              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                              : 'text-red-500'
                          }
                        >
                          ({ptDiff >= 0 ? `+${ptDiff}` : ptDiff})
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono-num text-xs tabular-nums">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {unlockedBadges.length}/{memberAchievements.length}
                        </span>
                      </td>
                      <td className="py-3 pl-3 text-right font-mono-num text-xs tabular-nums">
                        <span
                          className={`font-bold ${
                            member.streak >= 3
                              ? 'text-amber-600 dark:text-amber-400'
                              : member.streak > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {member.streak > 0
                            ? `W${member.streak}`
                            : member.streak < 0
                            ? `L${Math.abs(member.streak)}`
                            : '—'}
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50 dark:bg-slate-950">
                        <td colSpan={9} className="px-4 py-4 text-xs space-y-4">
                          {/* Player Scouting Header + Quick Actions */}
                          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
                            <div>
                              <span className="font-display text-sm font-bold uppercase text-slate-900 dark:text-white">
                                {member.name} · Athlete Scouting & Milestones
                              </span>
                              <span className="ml-2 font-mono-num text-slate-500">
                                ({unlockedBadges.length} of{' '}
                                {memberAchievements.length} Varsity Badges
                                Unlocked)
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    activeMember &&
                                    activeMember.id !== member.id
                                  ) {
                                    setH2hPlayerAId(activeMember.id);
                                    setH2hPlayerBId(member.id);
                                  } else {
                                    setH2hPlayerBId(member.id);
                                  }
                                }}
                                className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold cursor-pointer hover:bg-slate-100"
                              >
                                Compare H2H
                              </button>
                              {onCreateChallenge &&
                                (!activeMember ||
                                  activeMember.id !== member.id) && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenChallengeWithRival(member.id);
                                    }}
                                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                                  >
                                    Call Out Rival
                                  </button>
                                )}
                            </div>
                          </div>

                          {/* Varsity Achievement Badges Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                            {memberAchievements.map((ach) => (
                              <div
                                key={ach.id}
                                className={`p-2.5 rounded border flex flex-col justify-between gap-1.5 ${
                                  ach.unlocked
                                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 opacity-75'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <div
                                    className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                                      ach.unlocked
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-slate-200 dark:bg-slate-800 text-slate-500'
                                    }`}
                                  >
                                    {renderBadgeIcon(ach)}
                                  </div>
                                  <span
                                    className={`text-[9px] font-mono-num font-bold uppercase ${
                                      ach.unlocked
                                        ? 'text-emerald-700 dark:text-emerald-400'
                                        : 'text-slate-400'
                                    }`}
                                  >
                                    {ach.unlocked ? 'UNLOCKED' : ach.category}
                                  </span>
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-white text-[11px] leading-tight">
                                    {ach.title}
                                  </div>
                                  <div className="text-[10px] font-mono-num text-slate-500 mt-0.5 tabular-nums">
                                    {ach.progressLabel}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Recent Matches Log for Player */}
                          <div>
                            <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                              Recent Official Matches for {member.name}:
                            </div>
                            {playerMatches.length === 0 ? (
                              <div className="text-slate-500">
                                No recorded matches yet this season.
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {playerMatches.map((pm) => {
                                  const inT1 = pm.team1Ids.includes(member.id);
                                  const won =
                                    (inT1 && pm.winnerTeam === 1) ||
                                    (!inT1 && pm.winnerTeam === 2);
                                  const t1Names = pm.team1Ids
                                    .map(getMemberName)
                                    .join(' / ');
                                  const t2Names = pm.team2Ids
                                    .map(getMemberName)
                                    .join(' / ');
                                  const scoreStr = pm.games
                                    .map(
                                      (g) => `${g.team1Score}–${g.team2Score}`
                                    )
                                    .join(', ');
                                  return (
                                    <div
                                      key={pm.id}
                                      className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-slate-200 dark:border-slate-800 last:border-none"
                                    >
                                      <div>
                                        <span
                                          className={`font-mono-num font-bold mr-2 ${
                                            won
                                              ? 'text-emerald-600 dark:text-emerald-400'
                                              : 'text-red-500'
                                          }`}
                                        >
                                          {won ? 'WIN' : 'LOSS'}
                                        </span>
                                        <span className="text-slate-800 dark:text-slate-200">
                                          {t1Names} vs. {t2Names}
                                        </span>
                                      </div>
                                      <div className="font-mono-num text-slate-600 dark:text-slate-400 tabular-nums">
                                        {scoreStr} · {pm.date} (
                                        {won
                                          ? `+${pm.eloDelta}`
                                          : `-${pm.eloDelta}`}{' '}
                                        Elo)
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Match History Log */}
      <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Club Match History ({matches.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All completed singles, doubles, and challenge matches saved from
              the Score Keeper
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {matches.map((m) => {
            const t1Names = m.team1Ids.map(getMemberName).join(' & ');
            const t2Names = m.team2Ids.map(getMemberName).join(' & ');
            const scoreStr = m.games
              .map((g) => `${g.team1Score}–${g.team2Score}`)
              .join(', ');

            return (
              <div
                key={m.id}
                className="py-3 flex flex-wrap items-center justify-between gap-4 text-sm"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        m.winnerTeam === 1
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }
                    >
                      {t1Names}
                    </span>
                    <span className="text-xs text-slate-400">def.</span>
                    <span
                      className={
                        m.winnerTeam === 2
                          ? 'font-bold text-slate-900 dark:text-white'
                          : 'text-slate-600 dark:text-slate-400'
                      }
                    >
                      {t2Names}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span className="capitalize">{m.format}</span>
                    <span aria-hidden="true">·</span>
                    <span className="capitalize">{m.scoringType}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num tabular-nums">{m.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right font-mono-num tabular-nums">
                    <div className="font-bold text-slate-900 dark:text-white">
                      {scoreStr}
                    </div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      ±{m.eloDelta} Elo
                    </div>
                  </div>
                  {isOfficer && (
                    <button
                      onClick={() => onDeleteMatch(m.id)}
                      className="p-2 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                      title="Delete match record"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
