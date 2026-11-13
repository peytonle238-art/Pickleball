import React, { useState, useMemo } from 'react';
import {
  Vote,
  Plus,
  Trash2,
  ArrowUpRight,
} from 'lucide-react';
import {
  Member,
  ClubDataState,
  ReactionKey,
  NavTab,
} from '../types';

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

    matches.slice(0, 5).forEach((m) => {
      const t1Names = m.team1Ids
        .map((id) => getMember(id)?.name.split(' ')[0] || 'Player')
        .join(' & ');
      const t2Names = m.team2Ids
        .map((id) => getMember(id)?.name.split(' ')[0] || 'Player')
        .join(' & ');
      const winners = m.winnerTeam === 1 ? t1Names : t2Names;
      const losers = m.winnerTeam === 1 ? t2Names : t1Names;
      const scoreStr = m.games
        .map((g) => `${g.team1Score}–${g.team2Score}`)
        .join(', ');

      items.push({
        id: `act-m-${m.id}`,
        badge: 'Match',
        badgeColor: 'bg-court text-slate-900',
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
        badge: c.status === 'completed' ? 'Settled' : 'Callout',
        badgeColor:
          c.status === 'completed'
            ? 'bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200'
            : 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300',
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
        badge: 'Practice',
        badgeColor:
          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
        title: `${a.title} (${a.presentMemberIds.length} checked in)`,
        subtitle: 'Practice attendance recorded',
        date: a.date,
        actionTab: 'calendar',
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
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* LEFT (7 COLS): LIVE CLUB ACTIVITY FEED */}
      <div className="lg:col-span-7 rounded-xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="eyebrow mb-1">
              <span className="live-dot" /> Club activity
            </div>
            <h3 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Recent results & check-ins
            </h3>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('ladder')}
            className="pill-btn-ghost !min-h-[34px] !px-3.5 !text-xs"
          >
            <span>Standings</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {activityFeed.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            Completed matches, ladder challenges, and practice check-ins will
            appear here automatically.
          </div>
        ) : (
          <div className="divide-y divide-[var(--hairline)] border-t border-[var(--hairline)]">
            {activityFeed.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.actionTab)}
                className="co-index-row w-full py-3.5 text-left flex items-center justify-between gap-3 cursor-pointer"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-medium shrink-0 ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                    <span className="co-row-shift text-sm font-medium text-slate-900 dark:text-white truncate">
                      {item.title}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate pl-0.5">
                    {item.subtitle}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono-num text-slate-400 tabular-nums">
                    {item.date}
                  </span>
                  <ArrowUpRight className="co-row-arrow w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* RIGHT (5 COLS): PLAYER POLLS */}
      <div className="lg:col-span-5 rounded-xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-sm p-6 sm:p-7 space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="eyebrow mb-1">
              <Vote className="w-3.5 h-3.5 text-olive dark:text-court" /> Community
            </div>
            <h3 className="font-display text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Player polls
            </h3>
          </div>

          {isOfficer && (
            <button
              type="button"
              onClick={() => setShowNewPollForm(!showNewPollForm)}
              className="pill-btn !min-h-[34px] !px-3.5 !text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showNewPollForm ? 'Cancel' : 'New poll'}</span>
            </button>
          )}
        </div>

        {isOfficer && showNewPollForm && (
          <form
            onSubmit={handleCreatePoll}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-[var(--hairline)] space-y-2.5"
          >
            <input
              type="text"
              required
              value={newPollQuestion}
              onChange={(e) => setNewPollQuestion(e.target.value)}
              placeholder="Poll question..."
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              required
              value={newPollOpt1}
              onChange={(e) => setNewPollOpt1(e.target.value)}
              placeholder="Option 1"
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              required
              value={newPollOpt2}
              onChange={(e) => setNewPollOpt2(e.target.value)}
              placeholder="Option 2"
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={newPollOpt3}
              onChange={(e) => setNewPollOpt3(e.target.value)}
              placeholder="Option 3 (Optional)"
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="pill-btn !min-h-[34px] !px-4 !text-xs"
              >
                Post poll
              </button>
            </div>
          </form>
        )}

        {polls.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
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
                  className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-[var(--hairline)] space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900 dark:text-white leading-snug">
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

                  <div className="space-y-2">
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
                          className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs relative overflow-hidden transition-colors cursor-pointer ${
                            votedThis
                              ? 'border-slate-900 dark:border-court bg-white dark:bg-slate-900'
                              : 'border-[var(--hairline)] bg-white/80 dark:bg-slate-900 hover:border-slate-300'
                          }`}
                        >
                          <div
                            className="absolute inset-y-0 left-0 bg-court/60 dark:bg-court/15 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center justify-between gap-2">
                            <span className="font-medium text-slate-900 dark:text-white truncate">
                              {opt.label}
                              {votedThis ? ' · Voted' : ''}
                            </span>
                            <span className="font-mono-num text-[11px] font-medium text-slate-600 dark:text-slate-300 shrink-0 tabular-nums">
                              {pct}% ({votes})
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="text-xs text-slate-500 font-mono-num">
                    {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'} cast
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
