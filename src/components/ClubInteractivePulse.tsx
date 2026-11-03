import React, { useMemo, useState } from 'react';
import {
  Award,
  Check,
  Crown,
  Flame,
  Plus,
  RotateCcw,
  Swords,
  Trash2,
  Trophy,
  Vote,
  Zap,
} from 'lucide-react';
import {
  ActivityReactionCounts,
  ClubDataState,
  ClubPoll,
  Member,
  NavTab,
  ReactionKey,
} from '../types';
import { getClubText, getEffectiveMatchMode } from '../utils/clubUtils';

interface ClubInteractivePulseProps {
  data: ClubDataState;
  activeMember: Member | null;
  isOfficer: boolean;
  onVoteMvp: (memberId: string) => void;
  onResetMvpVotes?: () => void;
  onVotePoll: (pollId: string, optionId: string) => void;
  onCreatePoll?: (question: string, optionLabels: string[]) => void;
  onDeletePoll?: (pollId: string) => void;
  onToggleReaction: (activityId: string, reaction: ReactionKey) => void;
  onNavigate: (tab: NavTab) => void;
}

const DEVICE_VOTER_KEY = 'bnhs_pickleball_device_voter_id_v1';

export function getVoterIdentityKey(activeMember: Member | null): string {
  if (activeMember) return `mem_${activeMember.id}`;
  if (typeof window === 'undefined') return 'guest_voter';
  try {
    let saved = localStorage.getItem(DEVICE_VOTER_KEY);
    if (!saved) {
      saved = `dev_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(DEVICE_VOTER_KEY, saved);
    }
    return saved;
  } catch {
    return 'guest_voter';
  }
}

interface ClubFeedItem {
  id: string;
  type: 'match' | 'challenge' | 'milestone';
  date: string;
  headline: string;
  subline: string;
  badgeText: string;
  badgeColor: 'emerald' | 'amber' | 'blue';
}

export const ClubInteractivePulse: React.FC<ClubInteractivePulseProps> = ({
  data,
  activeMember,
  isOfficer,
  onVoteMvp,
  onResetMvpVotes,
  onVotePoll,
  onCreatePoll,
  onDeletePoll,
  onToggleReaction,
  onNavigate,
}) => {
  const voterKey = useMemo(
    () => getVoterIdentityKey(activeMember),
    [activeMember]
  );

  const [showNewPollForm, setShowNewPollForm] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOpt1, setPollOpt1] = useState('');
  const [pollOpt2, setPollOpt2] = useState('');
  const [pollOpt3, setPollOpt3] = useState('');

  // Top Weekly MVP Candidates (Top 5 by Elo, Streak, and Wins)
  const mvpCandidates = useMemo(() => {
    return [...data.members]
      .sort(
        (a, b) =>
          b.streak * 25 +
          (b.elo - b.monthStartElo) +
          b.elo * 0.25 -
          (a.streak * 25 + (a.elo - a.monthStartElo) + a.elo * 0.25)
      )
      .slice(0, 5);
  }, [data.members]);

  const mvpVotesMap = data.mvpVotes || {};
  const myMvpChoice = mvpVotesMap[voterKey] || '';

  const mvpVoteTallies = useMemo(() => {
    const counts: Record<string, number> = {};
    let total = 0;
    for (const memId of Object.values(mvpVotesMap)) {
      if (memId) {
        counts[memId] = (counts[memId] || 0) + 1;
        total += 1;
      }
    }
    return { counts, total };
  }, [mvpVotesMap]);

  const polls: ClubPoll[] = data.polls || [];
  const activePoll = polls[0] || null;

  // Synthesize Live Club Activity Feed from matches, challenges, and hot streaks
  const feedItems = useMemo<ClubFeedItem[]>(() => {
    const getMemberName = (id: string) =>
      data.members.find((m) => m.id === id)?.name || 'Club Player';

    const items: ClubFeedItem[] = [];

    // 1. Recent Matches (up to 6)
    for (const m of data.matches.slice(0, 6)) {
      const t1Names = m.team1Ids.map(getMemberName).join(' & ');
      const t2Names = m.team2Ids.map(getMemberName).join(' & ');
      const winners = m.winnerTeam === 1 ? t1Names : t2Names;
      const losers = m.winnerTeam === 1 ? t2Names : t1Names;
      const scoreStr = m.games
        .map((g) => `${g.team1Score}–${g.team2Score}`)
        .join(', ');
      const mode = getEffectiveMatchMode(m);
      const isBigMargin = m.games.some(
        (g) => Math.abs(g.team1Score - g.team2Score) >= 6
      );

      items.push({
        id: `act_match_${m.id}`,
        type: 'match',
        date: m.date,
        headline: `${winners} def. ${losers} (${scoreStr})`,
        subline:
          mode === 'ranked'
            ? `Official Ranked ${m.format} · ±${m.eloDelta} Elo rating swing`
            : mode === 'friendly_wl'
            ? `Friendly ${m.format} match · W/L updated (0 Elo)`
            : `Practice court log · ${m.format}`,
        badgeText: isBigMargin
          ? 'DOMINANT WIN'
          : mode === 'ranked'
          ? `+${m.eloDelta} ELO`
          : 'PRACTICE',
        badgeColor: isBigMargin
          ? 'amber'
          : mode === 'ranked'
          ? 'emerald'
          : 'blue',
      });
    }

    // 2. Open / Accepted Rivalry Challenges (up to 3)
    for (const c of (data.challenges || [])
      .filter((x) => x.status === 'open' || x.status === 'accepted')
      .slice(0, 3)) {
      const challenger = getMemberName(c.challengerId);
      const opponent = getMemberName(c.opponentId);
      items.push({
        id: `act_chal_${c.id}`,
        type: 'challenge',
        date: c.createdAt,
        headline: `${challenger} called out ${opponent} (${c.format} to ${c.targetScore})`,
        subline: c.message || 'Official Club Ladder Rivalry Callout',
        badgeText: c.status === 'accepted' ? 'ON DECK' : 'CALLOUT',
        badgeColor: 'amber',
      });
    }

    // 3. Hot Streak Milestones (players on 3+ win streak)
    for (const mem of data.members.filter((m) => m.streak >= 3).slice(0, 3)) {
      items.push({
        id: `act_streak_${mem.id}_${mem.streak}`,
        type: 'milestone',
        date: 'Active Streak',
        headline: `${mem.name} is on a ${mem.streak}-Match Winning Streak!`,
        subline: `Current Rating: ${mem.elo} Elo · ${mem.wins}W–${mem.losses}L record`,
        badgeText: `W${mem.streak} STREAK`,
        badgeColor: 'amber',
      });
    }

    return items.slice(0, 8);
  }, [data.matches, data.challenges, data.members]);

  const handleCreatePollSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreatePoll || !pollQuestion.trim()) return;
    const opts = [pollOpt1.trim(), pollOpt2.trim(), pollOpt3.trim()].filter(
      Boolean
    );
    if (opts.length < 2) return;
    onCreatePoll(pollQuestion.trim(), opts);
    setPollQuestion('');
    setPollOpt1('');
    setPollOpt2('');
    setPollOpt3('');
    setShowNewPollForm(false);
  };

  const reactionButtons: {
    key: ReactionKey;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { key: 'fire', label: 'Fire', icon: <Flame className="w-3 h-3" /> },
    { key: 'clutch', label: 'Clutch', icon: <Zap className="w-3 h-3" /> },
    { key: 'upset', label: 'Upset', icon: <Swords className="w-3 h-3" /> },
    { key: 'goat', label: 'GOAT', icon: <Crown className="w-3 h-3" /> },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
      {/* ================================================================= */}
      {/* LEFT (5 COLS): WEEKLY MVP VOTING & INTERACTIVE CLUB POLLS         */}
      {/* ================================================================= */}
      <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-6">
        {/* Weekly MVP Voting Card */}
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-[10px] font-mono-num uppercase tracking-wider font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                <span>Player of the Week Fan Vote</span>
              </div>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                {getClubText(
                  data.settings,
                  'pulseMvpHeading',
                  'Athlete of the Week Ballot'
                )}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono-num font-bold text-slate-500 tabular-nums">
                {mvpVoteTallies.total}{' '}
                {mvpVoteTallies.total === 1 ? 'vote' : 'votes'}
              </span>
              {isOfficer && onResetMvpVotes && mvpVoteTallies.total > 0 && (
                <button
                  type="button"
                  onClick={onResetMvpVotes}
                  title="Reset Weekly MVP votes"
                  className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {mvpCandidates.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Add club members to nominate players for Weekly MVP.
            </div>
          ) : (
            <div className="space-y-2">
              {mvpCandidates.map((cand, idx) => {
                const votes = mvpVoteTallies.counts[cand.id] || 0;
                const pct =
                  mvpVoteTallies.total > 0
                    ? Math.round((votes / mvpVoteTallies.total) * 100)
                    : 0;
                const isSelected = myMvpChoice === cand.id;
                const monthGain = cand.elo - (cand.monthStartElo || 1200);

                return (
                  <button
                    key={cand.id}
                    type="button"
                    onClick={() => onVoteMvp(cand.id)}
                    className={`w-full p-2.5 rounded-md border text-left transition-colors cursor-pointer relative overflow-hidden ${
                      isSelected
                        ? 'border-blue-600 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/25'
                        : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className="absolute inset-y-0 left-0 bg-amber-400/15 dark:bg-amber-400/10 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="font-mono-num text-xs font-bold text-slate-400 w-4">
                          0{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                            <span>{cand.name}</span>
                            {isSelected && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-num font-bold text-blue-600 dark:text-blue-400">
                                <Check className="w-3 h-3" /> Voted
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono-num text-slate-500 dark:text-slate-400">
                            {cand.elo} Elo · {cand.wins}W–{cand.losses}L
                            {monthGain > 0 ? ` · +${monthGain} Δ` : ''}
                          </div>
                        </div>
                      </div>

                      <div className="text-right font-mono-num shrink-0 tabular-nums">
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          {pct}%
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {votes} {votes === 1 ? 'vote' : 'votes'}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Interactive Club Poll Card */}
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-3.5 flex-1 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="text-[10px] font-mono-num uppercase tracking-wider font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                  <Vote className="w-3.5 h-3.5" />
                  <span>Live Club Poll</span>
                </div>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                  {getClubText(
                    data.settings,
                    'pulsePollHeading',
                    'Live Club Polls'
                  )}
                </h3>
              </div>

              {isOfficer && onCreatePoll && (
                <button
                  type="button"
                  onClick={() => setShowNewPollForm(!showNewPollForm)}
                  className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{showNewPollForm ? 'Cancel' : 'New Poll'}</span>
                </button>
              )}
            </div>

            {isOfficer && showNewPollForm && onCreatePoll && (
              <form
                onSubmit={handleCreatePollSubmit}
                className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 text-xs"
              >
                <div className="font-bold text-slate-900 dark:text-white">
                  Publish New Club Poll
                </div>
                <input
                  type="text"
                  required
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Poll question (e.g. Friday Practice Drill Focus?)"
                  className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                />
                <div className="grid grid-cols-1 gap-1.5">
                  <input
                    type="text"
                    required
                    value={pollOpt1}
                    onChange={(e) => setPollOpt1(e.target.value)}
                    placeholder="Option 1 *"
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                  <input
                    type="text"
                    required
                    value={pollOpt2}
                    onChange={(e) => setPollOpt2(e.target.value)}
                    placeholder="Option 2 *"
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                  <input
                    type="text"
                    value={pollOpt3}
                    onChange={(e) => setPollOpt3(e.target.value)}
                    placeholder="Option 3 (Optional)"
                    className="w-full px-2.5 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                >
                  Publish Poll
                </button>
              </form>
            )}

            {activePoll ? (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white leading-snug">
                    {activePoll.question}
                  </p>
                  {isOfficer && onDeletePoll && (
                    <button
                      type="button"
                      onClick={() => onDeletePoll(activePoll.id)}
                      className="p-1 text-slate-400 hover:text-red-500 cursor-pointer shrink-0"
                      title="Delete poll"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {(() => {
                  const totalPollVotes = activePoll.options.reduce(
                    (sum, o) => sum + (o.voterIds?.length || 0),
                    0
                  );
                  return (
                    <div className="space-y-2">
                      {activePoll.options.map((opt) => {
                        const count = opt.voterIds?.length || 0;
                        const pct =
                          totalPollVotes > 0
                            ? Math.round((count / totalPollVotes) * 100)
                            : 0;
                        const votedThis = (opt.voterIds || []).includes(
                          voterKey
                        );

                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onVotePoll(activePoll.id, opt.id)}
                            className={`w-full p-2.5 rounded-md border text-left transition-colors cursor-pointer relative overflow-hidden ${
                              votedThis
                                ? 'border-blue-600 dark:border-blue-400 bg-blue-50/40 dark:bg-blue-950/25'
                                : 'border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                            }`}
                          >
                            <div
                              aria-hidden="true"
                              className="absolute inset-y-0 left-0 bg-blue-600/15 dark:bg-blue-500/15 transition-all duration-300"
                              style={{ width: `${pct}%` }}
                            />
                            <div className="relative z-10 flex items-center justify-between gap-2 text-xs">
                              <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{opt.label}</span>
                                {votedThis && (
                                  <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
                                )}
                              </span>
                              <span className="font-mono-num font-bold text-slate-700 dark:text-slate-300 shrink-0 tabular-nums">
                                {pct}% ({count})
                              </span>
                            </div>
                          </button>
                        );
                      })}
                      <div className="text-[11px] font-mono-num text-slate-500 pt-0.5 tabular-nums">
                        {totalPollVotes} total club{' '}
                        {totalPollVotes === 1 ? 'response' : 'responses'} · Tap
                        any option to vote
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="py-4 text-xs text-slate-500">
                No active club polls right now.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* RIGHT (7 COLS): LIVE CLUB ACTIVITY FEED WITH PLAYER REACTIONS     */}
      {/* ================================================================= */}
      <div className="lg:col-span-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex flex-col justify-between space-y-4">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <div className="text-[10px] font-mono-num uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
                Real-Time Court Pulse & Highlights
              </div>
              <h3 className="font-display text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                {getClubText(
                  data.settings,
                  'pulseFeedHeading',
                  'Club Activity & Highlights'
                )}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('ladder')}
              className="px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              Match Log →
            </button>
          </div>

          {feedItems.length === 0 ? (
            <div className="py-12 text-center space-y-2 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6">
              <Trophy className="w-6 h-6 text-slate-400 mx-auto" />
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No live court activity recorded yet
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Score a match on the Live Scoreboard or issue a challenge on the
                Club Ladder to light up the activity feed with player reactions!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {feedItems.map((item) => {
                const reactions: ActivityReactionCounts = (data.activityReactions ||
                  {})[item.id] || {
                  fire: [],
                  clutch: [],
                  upset: [],
                  goat: [],
                };

                return (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-mono-num font-bold uppercase ${
                              item.badgeColor === 'emerald'
                                ? 'bg-emerald-600 text-white'
                                : item.badgeColor === 'amber'
                                ? 'bg-amber-400 text-slate-950'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {item.badgeText}
                          </span>
                          <span className="text-sm font-bold text-slate-900 dark:text-white">
                            {item.headline}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {item.subline}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono-num text-slate-400 shrink-0 tabular-nums">
                        {item.date}
                      </span>
                    </div>

                    {/* Interactive Player Reaction Bar */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      {reactionButtons.map((btn) => {
                        const list = reactions[btn.key] || [];
                        const active = list.includes(voterKey);
                        return (
                          <button
                            key={btn.key}
                            type="button"
                            onClick={() => onToggleReaction(item.id, btn.key)}
                            className={`px-2.5 py-1 rounded text-[11px] font-mono-num font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer border ${
                              active
                                ? 'bg-slate-900 text-white border-slate-900 dark:bg-amber-400 dark:text-slate-950 dark:border-amber-400'
                                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {btn.icon}
                            <span>{btn.label}</span>
                            {list.length > 0 && (
                              <span className="font-bold ml-0.5 tabular-nums">
                                {list.length}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Award className="w-3.5 h-3.5 text-amber-500" />
            <span>Reactions & MVP votes sync across all club devices</span>
          </span>
          <button
            type="button"
            onClick={() => onNavigate('scorekeeper')}
            className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          >
            Open Live Scoreboard →
          </button>
        </div>
      </div>
    </div>
  );
};
