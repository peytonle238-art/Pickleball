import React, { useState } from 'react';
import {
  Award,
  Flame,
  Plus,
  Trash2,
  TrendingUp,
  Trophy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { MatchRecord, Member, NavTab } from '../types';
import { calculateEloDelta } from '../utils/clubUtils';

interface LadderStatsViewProps {
  members: Member[];
  matches: MatchRecord[];
  isOfficer: boolean;
  onSaveManualMatch: (match: MatchRecord) => void;
  onDeleteMatch: (matchId: string) => void;
  onNavigate: (tab: NavTab) => void;
}

export const LadderStatsView: React.FC<LadderStatsViewProps> = ({
  members,
  matches,
  isOfficer,
  onSaveManualMatch,
  onDeleteMatch,
  onNavigate,
}) => {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [showManualMatchForm, setShowManualMatchForm] = useState(false);

  // Manual Match form state
  const [mFormat, setMFormat] = useState<'singles' | 'doubles'>('singles');
  const [mT1P1, setMT1P1] = useState(members[0]?.id || '');
  const [mT1P2, setMT1P2] = useState(members[1]?.id || '');
  const [mT2P1, setMT2P1] = useState(members[2]?.id || '');
  const [mT2P2, setMT2P2] = useState(members[3]?.id || '');
  const [mScore1, setMScore1] = useState(11);
  const [mScore2, setMScore2] = useState(7);

  // Ranked by Elo rating descending
  const rankedLadder = [...members].sort((a, b) => b.elo - a.elo);

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

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.name || 'Unknown';

  const getPlayerRecentMatches = (memberId: string) => {
    return matches
      .filter(
        (m) => m.team1Ids.includes(memberId) || m.team2Ids.includes(memberId)
      )
      .slice(0, 5);
  };

  const handleManualMatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <div className="space-y-6">
      {/* 3 Leaderboard Cards: Most Wins, Best Win %, Most Improved This Month */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Most Wins */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Leaderboard · Most Wins
            </span>
            <Trophy className="w-4 h-4 text-amber-500" />
          </div>
          <div className="space-y-2.5">
            {mostWinsLeaders.map((m, idx) => (
              <div
                key={m.id}
                className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
              >
                <span className="font-medium text-slate-900 dark:text-white">
                  <strong className="font-mono-num text-slate-400 mr-2">
                    0{idx + 1}
                  </strong>
                  {m.name}
                </span>
                <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                  {m.wins} Wins
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Best Win Percentage */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Leaderboard · Best Win Percentage
            </span>
            <Award className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="space-y-2.5">
            {bestWinPctLeaders.map((m, idx) => {
              const pct = Math.round(
                (m.wins / Math.max(1, m.wins + m.losses)) * 100
              );
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
                >
                  <span className="font-medium text-slate-900 dark:text-white">
                    <strong className="font-mono-num text-slate-400 mr-2">
                      0{idx + 1}
                    </strong>
                    {m.name}
                  </span>
                  <span className="font-mono-num font-bold text-slate-900 dark:text-white">
                    {pct}% ({m.wins}–{m.losses})
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Most Improved This Month */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Leaderboard · Most Improved (Month)
            </span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="space-y-2.5">
            {mostImprovedLeaders.map((m, idx) => {
              const gain = m.elo - m.monthStartElo;
              return (
                <div
                  key={m.id}
                  className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800/60 last:border-none"
                >
                  <span className="font-medium text-slate-900 dark:text-white">
                    <strong className="font-mono-num text-slate-400 mr-2">
                      0{idx + 1}
                    </strong>
                    {m.name}
                  </span>
                  <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                    {gain >= 0 ? `+${gain}` : gain} Elo
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Club Ladder Table */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Official BNHS Elo Club Ladder
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click any player row to expand their recent matches · Ratings update
              automatically after every saved match
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onNavigate('scorekeeper')}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              Score Live Match
            </button>
            {isOfficer && (
              <button
                onClick={() => setShowManualMatchForm(!showManualMatchForm)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Log Quick Result
              </button>
            )}
          </div>
        </div>

        {/* Officer Manual Match Form */}
        {isOfficer && showManualMatchForm && (
          <form
            onSubmit={handleManualMatchSubmit}
            className="mb-6 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Log Completed Match Result (Auto-Updates Ladder)
              </h4>
              <div className="flex items-center gap-2">
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Team 1
                </label>
                <select
                  value={mT1P1}
                  onChange={(e) => setMT1P1(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Team 2
                </label>
                <select
                  value={mT2P1}
                  onChange={(e) => setMT2P1(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
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
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    T1 Score
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={mScore1}
                    onChange={(e) => setMScore1(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    T2 Score
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={mScore2}
                    onChange={(e) => setMScore2(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-xs font-mono-num bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowManualMatchForm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                Save Match & Update Elo
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <th className="py-3 pr-3">Rank</th>
                <th className="py-3 px-3">Player</th>
                <th className="py-3 px-3 text-right">Elo Rating</th>
                <th className="py-3 px-3 text-right">Month Δ</th>
                <th className="py-3 px-3 text-right">W–L Record</th>
                <th className="py-3 px-3 text-right">Win %</th>
                <th className="py-3 px-3 text-right">PF / PA (Diff)</th>
                <th className="py-3 pl-3 text-right">Streak</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
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

                return (
                  <React.Fragment key={member.id}>
                    <tr
                      onClick={() =>
                        setExpandedMemberId(isExpanded ? null : member.id)
                      }
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    >
                      <td className="py-3.5 pr-3 font-mono-num font-bold text-slate-900 dark:text-white">
                        #{index + 1}
                      </td>
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">
                            {member.name}
                          </span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {member.grade}th Grade · {member.skillLevel}
                          {member.duprRating ? ` · ${member.duprRating} DUPR` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono-num font-bold text-base text-slate-900 dark:text-white">
                        {member.elo}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono-num text-xs">
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
                      <td className="py-3.5 px-3 text-right font-mono-num text-slate-800 dark:text-slate-200">
                        {member.wins}–{member.losses}
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono-num text-slate-700 dark:text-slate-300">
                        {winPct}%
                      </td>
                      <td className="py-3.5 px-3 text-right font-mono-num text-xs text-slate-600 dark:text-slate-300">
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
                      <td className="py-3.5 pl-3 text-right font-mono-num text-xs">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            member.streak > 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {member.streak >= 3 && (
                            <Flame className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          {member.streak > 0
                            ? `W${member.streak}`
                            : member.streak < 0
                            ? `L${Math.abs(member.streak)}`
                            : '—'}
                        </span>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-slate-50/70 dark:bg-slate-800/30">
                        <td colSpan={8} className="px-4 py-3 text-xs">
                          <div className="font-semibold text-slate-700 dark:text-slate-300 mb-2">
                            Recent Matches for {member.name}:
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
                                  .map((g) => `${g.team1Score}–${g.team2Score}`)
                                  .join(', ');
                                return (
                                  <div
                                    key={pm.id}
                                    className="flex flex-wrap items-center justify-between gap-2 py-1 border-b border-slate-200/60 dark:border-slate-700/50 last:border-none"
                                  >
                                    <div>
                                      <span
                                        className={`font-bold mr-2 ${
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
                                    <div className="font-mono-num text-slate-600 dark:text-slate-400">
                                      {scoreStr} · {pm.date} (
                                      {won ? `+${pm.eloDelta}` : `-${pm.eloDelta}`}{' '}
                                      Elo)
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
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
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Club Match History ({matches.length})
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              All completed singles and doubles matches saved from the Score Keeper
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {matches.map((m) => {
            const t1Names = m.team1Ids.map(getMemberName).join(' & ');
            const t2Names = m.team2Ids.map(getMemberName).join(' & ');
            const scoreStr = m.games
              .map((g) => `${g.team1Score}–${g.team2Score}`)
              .join(', ');

            return (
              <div
                key={m.id}
                className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-sm"
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
                    <span className="tabular-nums">{m.date}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-mono-num font-bold text-slate-900 dark:text-white">
                      {scoreStr}
                    </div>
                    <div className="font-mono-num text-xs text-emerald-600 dark:text-emerald-400">
                      ±{m.eloDelta} Elo
                    </div>
                  </div>
                  {isOfficer && (
                    <button
                      onClick={() => onDeleteMatch(m.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
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
