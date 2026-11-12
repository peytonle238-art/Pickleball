import React, { useState, useMemo, useEffect } from 'react';
import {
  Vote,
  Plus,
  Trash2,
  Activity,
  Scale,
} from 'lucide-react';
import {
  Member,
  ClubDataState,
  ReactionKey,
  NavTab,
} from '../types';
import {
  calculateEloDelta,
  computeLiveMatchWinProbability,
} from '../utils/clubUtils';

const LOCAL_POLL_VOTES_KEY = 'bnhs_pickleball_local_poll_votes_v1';

export function getVoterIdentityKey(activeMember: Member | null): string {
  if (activeMember) return `member:${activeMember.id}`;
  try {
    const existing = localStorage.getItem(LOCAL_POLL_VOTES_KEY);
    if (existing) return existing;
    const created = `voter-${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem(LOCAL_POLL_VOTES_KEY, created);
    return created;
  } catch {
    return 'voter-guest';
  }
}

interface ClubInteractivePulseProps {
  data: ClubDataState;
  activeMember: Member | null;
  isOfficer: boolean;
  onVoteMvp?: (candidateId: string) => void;
  onResetMvpVotes?: () => void;
  onVotePoll: (pollId: string, optionId: string) => void;
  onCreatePoll?: (question: string, optionLabels: string[]) => void;
  onDeletePoll?: (pollId: string) => void;
  onToggleReaction?: (feedItemId: string, reaction: ReactionKey) => void;
  onNavigate: (tab: NavTab) => void;
}

export const ClubInteractivePulse: React.FC<ClubInteractivePulseProps> = ({
  data,
  activeMember,
  isOfficer,
  onVotePoll,
  onCreatePoll,
  onDeletePoll,
  onNavigate,
}) => {
  const { members, matches, attendance } = data;
  const challenges = data.challenges || [];
  const polls = data.polls || [];

  const rankedMembers = useMemo(
    () => [...members].sort((a, b) => b.elo - a.elo),
    [members]
  );

  // Matchup Win-Odds Calculator State
  const [simFormat, setSimFormat] = useState<'singles' | 'doubles'>('singles');
  const [simT1P1, setSimT1P1] = useState<string>(rankedMembers[0]?.id || '');
  const [simT1P2, setSimT1P2] = useState<string>(
    rankedMembers[2]?.id || rankedMembers[0]?.id || ''
  );
  const [simT2P1, setSimT2P1] = useState<string>(
    rankedMembers[1]?.id || rankedMembers[0]?.id || ''
  );
  const [simT2P2, setSimT2P2] = useState<string>(
    rankedMembers[3]?.id || rankedMembers[1]?.id || ''
  );

  useEffect(() => {
    if (rankedMembers.length > 0) {
      if (!rankedMembers.some((m) => m.id === simT1P1)) {
        setSimT1P1(rankedMembers[0]?.id || '');
      }
      if (!rankedMembers.some((m) => m.id === simT2P1)) {
        setSimT2P1(rankedMembers[1]?.id || rankedMembers[0]?.id || '');
      }
      if (!rankedMembers.some((m) => m.id === simT1P2)) {
        setSimT1P2(rankedMembers[2]?.id || rankedMembers[0]?.id || '');
      }
      if (!rankedMembers.some((m) => m.id === simT2P2)) {
        setSimT2P2(rankedMembers[3]?.id || rankedMembers[1]?.id || '');
      }
    }
  }, [rankedMembers, simT1P1, simT2P1, simT1P2, simT2P2]);

  const effectiveVoterId = useMemo(
    () => getVoterIdentityKey(activeMember),
    [activeMember]
  );

  // Officer Create Poll State
  const [showNewPollForm, setShowNewPollForm] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOpt1, setNewPollOpt1] = useState('');
  const [newPollOpt2, setNewPollOpt2] = useState('');
  const [newPollOpt3, setNewPollOpt3] = useState('');

  const getMember = (id: string) => members.find((m) => m.id === id);

  // Matchup Simulation Results
  const simStats = useMemo(() => {
    const t1Ids =
      simFormat === 'singles' ? [simT1P1] : [simT1P1, simT1P2].filter(Boolean);
    const t2Ids =
      simFormat === 'singles' ? [simT2P1] : [simT2P1, simT2P2].filter(Boolean);

    const t1Elos = t1Ids.map((id) => getMember(id)?.elo ?? 0);
    const t2Elos = t2Ids.map((id) => getMember(id)?.elo ?? 0);

    const t1Avg =
      t1Elos.length > 0
        ? Math.round(t1Elos.reduce((a, b) => a + b, 0) / t1Elos.length)
        : 0;
    const t2Avg =
      t2Elos.length > 0
        ? Math.round(t2Elos.reduce((a, b) => a + b, 0) / t2Elos.length)
        : 0;

    const winProb = computeLiveMatchWinProbability(t1Elos, t2Elos, 0, 0, 11);
    const deltaIfT1Wins = calculateEloDelta(t1Elos, t2Elos, 1);
    const deltaIfT2Wins = calculateEloDelta(t1Elos, t2Elos, 2);

    const sharedMatches = matches.filter((m) => {
      const hasT1 = t1Ids.every((id) => m.team1Ids.includes(id));
      const hasT2 = t2Ids.every((id) => m.team2Ids.includes(id));
      const revT1 = t1Ids.every((id) => m.team2Ids.includes(id));
      const revT2 = t2Ids.every((id) => m.team1Ids.includes(id));
      return (hasT1 && hasT2) || (revT1 && revT2);
    });

    let t1WinsH2H = 0;
    let t2WinsH2H = 0;
    sharedMatches.forEach((m) => {
      const t1OnSide1 = t1Ids.every((id) => m.team1Ids.includes(id));
      if (
        (t1OnSide1 && m.winnerTeam === 1) ||
        (!t1OnSide1 && m.winnerTeam === 2)
      ) {
        t1WinsH2H += 1;
      } else {
        t2WinsH2H += 1;
      }
    });

    return {
      t1Avg,
      t2Avg,
      t1Pct: winProb.team1Pct,
      t2Pct: winProb.team2Pct,
      deltaIfT1Wins,
      deltaIfT2Wins,
      t1WinsH2H,
      t2WinsH2H,
      totalH2H: sharedMatches.length,
    };
  }, [simFormat, simT1P1, simT1P2, simT2P1, simT2P2, members, matches]);

  // Unified Recent Club Activity Feed
  const activityFeed = useMemo(() => {
    const items: {
      id: string;
      badge: string;
      badgeColor: string;
      title: string;
      subtitle: string;
      date: string;
      actionTab: NavTab;
    }[] = [];

    matches.slice(0, 4).forEach((m) => {
      const t1Names = m.team1Ids
        .map((id) => getMember(id)?.name.split(' ')[0] || 'Player')
        .join(' / ');
      const t2Names = m.team2Ids
        .map((id) => getMember(id)?.name.split(' ')[0] || 'Player')
        .join(' / ');
      const winners = m.winnerTeam === 1 ? t1Names : t2Names;
      const losers = m.winnerTeam === 1 ? t2Names : t1Names;
      const scoreStr = m.games
        .map((g) => `${g.team1Score}–${g.team2Score}`)
        .join(', ');

      items.push({
        id: `act-m-${m.id}`,
        badge: 'MATCH',
        badgeColor:
          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
        title: `${winners} def. ${losers} (${scoreStr})`,
        subtitle:
          m.eloDelta > 0
            ? `Ranked ${m.format} · ±${m.eloDelta} Elo`
            : `Friendly ${m.format} match`,
        date: m.date,
        actionTab: 'ladder',
      });
    });

    challenges.slice(0, 3).forEach((c) => {
      const chName = getMember(c.challengerId)?.name || 'Player';
      const opName = getMember(c.opponentId)?.name || 'Player';
      items.push({
        id: `act-c-${c.id}`,
        badge: c.status === 'completed' ? 'SETTLED' : 'CALLOUT',
        badgeColor:
          c.status === 'completed'
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
        title: `${chName} challenged ${opName}`,
        subtitle:
          c.status === 'completed' && c.scoreSummary
            ? `Result: ${c.scoreSummary}`
            : `${c.format} to ${c.targetScore} pts`,
        date: c.createdAt,
        actionTab: 'ladder',
      });
    });

    attendance.slice(0, 2).forEach((a) => {
      items.push({
        id: `act-a-${a.id}`,
        badge: 'PRACTICE',
        badgeColor:
          'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300',
        title: `${a.title} (${a.presentMemberIds.length} Checked In)`,
        subtitle: 'Official practice attendance recorded',
        date: a.date,
        actionTab: 'members',
      });
    });

    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
  }, [matches, challenges, attendance, members]);

  const handleVoteOnPoll = (pollId: string, optionId: string) => {
    onVotePoll(pollId, optionId);
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPollQuestion.trim() || !newPollOpt1.trim() || !newPollOpt2.trim()) {
      return;
    }

    const opts = [newPollOpt1.trim(), newPollOpt2.trim()];
    if (newPollOpt3.trim()) opts.push(newPollOpt3.trim());

    onCreatePoll?.(newPollQuestion.trim(), opts);
    setNewPollQuestion('');
    setNewPollOpt1('');
    setNewPollOpt2('');
    setNewPollOpt3('');
    setShowNewPollForm(false);
  };

  const handleDeletePoll = (pollId: string) => {
    onDeletePoll?.(pollId);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT (5 COLS): MATCHUP WIN-ODDS & ELO STAKES CALCULATOR */}
        <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Matchup & Elo Calculator
              </h3>
            </div>

            <div className="flex items-center p-0.5 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSimFormat('singles')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                  simFormat === 'singles'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                1v1
              </button>
              <button
                type="button"
                onClick={() => setSimFormat('doubles')}
                className={`px-2.5 py-1 rounded text-xs font-semibold cursor-pointer ${
                  simFormat === 'doubles'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500'
                }`}
              >
                2v2
              </button>
            </div>
          </div>

          {rankedMembers.length < 2 ? (
            <div className="p-6 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-center space-y-2">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Add at least 2 players to preview matchup odds
              </div>
              <p className="text-xs text-slate-500">
                Once players are added to the roster, you can compare win
                probabilities and Elo rating stakes for any matchup.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Team 1 Picker */}
                <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-blue-600 dark:text-blue-400">
                    <span>Team 1</span>
                    <span className="font-mono-num">{simStats.t1Avg} Elo</span>
                  </div>
                  <select
                    value={simT1P1}
                    onChange={(e) => setSimT1P1(e.target.value)}
                    aria-label="Matchup Team 1 Player 1"
                    className="w-full px-2.5 py-1.5 rounded text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {rankedMembers.map((m, idx) => (
                      <option key={m.id} value={m.id}>
                        #{idx + 1} {m.name} ({m.elo})
                      </option>
                    ))}
                  </select>
                  {simFormat === 'doubles' && (
                    <select
                      value={simT1P2}
                      onChange={(e) => setSimT1P2(e.target.value)}
                      aria-label="Matchup Team 1 Player 2"
                      className="w-full px-2.5 py-1.5 rounded text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      {rankedMembers.map((m, idx) => (
                        <option key={m.id} value={m.id}>
                          #{idx + 1} {m.name} ({m.elo})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Team 2 Picker */}
                <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                    <span>Team 2</span>
                    <span className="font-mono-num">{simStats.t2Avg} Elo</span>
                  </div>
                  <select
                    value={simT2P1}
                    onChange={(e) => setSimT2P1(e.target.value)}
                    aria-label="Matchup Team 2 Player 1"
                    className="w-full px-2.5 py-1.5 rounded text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {rankedMembers.map((m, idx) => (
                      <option key={m.id} value={m.id}>
                        #{idx + 1} {m.name} ({m.elo})
                      </option>
                    ))}
                  </select>
                  {simFormat === 'doubles' && (
                    <select
                      value={simT2P2}
                      onChange={(e) => setSimT2P2(e.target.value)}
                      aria-label="Matchup Team 2 Player 2"
                      className="w-full px-2.5 py-1.5 rounded text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                    >
                      {rankedMembers.map((m, idx) => (
                        <option key={m.id} value={m.id}>
                          #{idx + 1} {m.name} ({m.elo})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Win Probability Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-mono-num tabular-nums">
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    Team 1: {simStats.t1Pct}%
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Win Probability
                  </span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    Team 2: {simStats.t2Pct}%
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-amber-500 overflow-hidden flex">
                  <div
                    className="h-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${simStats.t1Pct}%` }}
                  />
                </div>
              </div>

              {/* Elo Rating Stakes */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-medium text-slate-500">
                    If Team 1 Wins
                  </div>
                  <div className="font-mono-num text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    +{simStats.deltaIfT1Wins} Elo
                  </div>
                </div>
                <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-medium text-slate-500">
                    Head-to-Head
                  </div>
                  <div className="font-mono-num text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {simStats.t1WinsH2H}–{simStats.t2WinsH2H}
                  </div>
                </div>
                <div className="p-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="text-[10px] font-medium text-slate-500">
                    If Team 2 Wins
                  </div>
                  <div className="font-mono-num text-sm font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                    +{simStats.deltaIfT2Wins} Elo
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT (7 COLS): CLUB POLLS & RECENT ACTIVITY FEED */}
        <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Interactive Club Polls */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Vote className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Player Polls
                </h3>
              </div>

              {isOfficer && (
                <button
                  type="button"
                  onClick={() => setShowNewPollForm(!showNewPollForm)}
                  className="px-2.5 py-1 rounded-md bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>{showNewPollForm ? 'Cancel' : 'New Poll'}</span>
                </button>
              )}
            </div>

            {isOfficer && showNewPollForm && (
              <form
                onSubmit={handleCreatePoll}
                className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
              >
                <input
                  type="text"
                  required
                  value={newPollQuestion}
                  onChange={(e) => setNewPollQuestion(e.target.value)}
                  placeholder="Poll question..."
                  className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  value={newPollOpt1}
                  onChange={(e) => setNewPollOpt1(e.target.value)}
                  placeholder="Option 1"
                  className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  value={newPollOpt2}
                  onChange={(e) => setNewPollOpt2(e.target.value)}
                  placeholder="Option 2"
                  className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  value={newPollOpt3}
                  onChange={(e) => setNewPollOpt3(e.target.value)}
                  placeholder="Option 3 (Optional)"
                  className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded bg-blue-600 text-white text-xs font-semibold cursor-pointer"
                  >
                    Post Poll
                  </button>
                </div>
              </form>
            )}

            {polls.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No active polls right now.
              </div>
            ) : (
              <div className="space-y-4">
                {polls.slice(0, 2).map((poll) => {
                  const totalVotes = poll.options.reduce(
                    (acc, o) => acc + o.voterIds.length,
                    0
                  );
                  return (
                    <div
                      key={poll.id}
                      className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900 dark:text-white leading-snug">
                          {poll.question}
                        </div>
                        {isOfficer && (
                          <button
                            type="button"
                            onClick={() => handleDeletePoll(poll.id)}
                            className="text-slate-400 hover:text-red-500 p-0.5 cursor-pointer shrink-0"
                            title="Delete poll"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        {poll.options.map((opt) => {
                          const votes = opt.voterIds.length;
                          const pct =
                            totalVotes > 0
                              ? Math.round((votes / totalVotes) * 100)
                              : 0;
                          const votedThis =
                            opt.voterIds.includes(effectiveVoterId);

                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleVoteOnPoll(poll.id, opt.id)}
                              className={`w-full text-left p-2 rounded border text-xs relative overflow-hidden transition-colors cursor-pointer ${
                                votedThis
                                  ? 'border-blue-600 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/30'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                              }`}
                            >
                              <div
                                className="absolute inset-y-0 left-0 bg-blue-500/10 dark:bg-blue-400/15 transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative flex items-center justify-between gap-2">
                                <span className="font-medium text-slate-900 dark:text-white truncate">
                                  {opt.label}
                                  {votedThis ? ' ✓' : ''}
                                </span>
                                <span className="font-mono-num text-[11px] font-semibold text-slate-600 dark:text-slate-300 shrink-0 tabular-nums">
                                  {pct}% ({votes})
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      <div className="text-[11px] text-slate-500 font-mono-num">
                        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} cast
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Club Activity Feed */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Recent Club Activity
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('ladder')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                Full Log →
              </button>
            </div>

            {activityFeed.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Completed matches, ladder challenges, and practice check-ins
                will appear here automatically.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activityFeed.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.actionTab)}
                    className="w-full py-2.5 text-left flex items-start justify-between gap-2 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded px-1 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`px-1.5 py-0.5 rounded font-mono-num text-[9px] font-bold uppercase ${item.badgeColor}`}
                        >
                          {item.badge}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                          {item.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                    <span className="text-[10px] font-mono-num text-slate-400 shrink-0 tabular-nums">
                      {item.date}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
