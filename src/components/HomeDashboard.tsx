import React, { useMemo, useState, useEffect } from 'react';
import { ArrowUpRight, Pin, Megaphone } from 'lucide-react';
import {
  Member,
  ClubDataState,
  ReactionKey,
  NavTab,
} from '../types';
import {
  getNextUpcomingEvent,
  getDaysUntil,
} from '../utils/clubUtils';
import { ClubInteractivePulse } from './ClubInteractivePulse';
import { AnimatedNumber, MaskedTextReveal } from './MotionPrimitives';
import { RollingNumber } from './EnodePrimitives';

interface HomeDashboardProps {
  data: ClubDataState;
  activeMember?: Member | null;
  isOfficer: boolean;
  onVoteMvp?: (candidateId: string) => void;
  onResetMvpVotes?: () => void;
  onVotePoll: (pollId: string, optionId: string) => void;
  onCreatePoll?: (question: string, optionLabels: string[]) => void;
  onDeletePoll?: (pollId: string) => void;
  onToggleReaction?: (feedItemId: string, reaction: ReactionKey) => void;
  onNavigate: (tab: NavTab) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  data,
  activeMember = null,
  isOfficer,
  onVoteMvp,
  onResetMvpVotes,
  onVotePoll,
  onCreatePoll,
  onDeletePoll,
  onToggleReaction,
  onNavigate,
}) => {
  const {
    members,
    matches,
    events,
    attendance,
    outsideTournaments,
    announcements = [],
    settings,
  } = data;

  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const topFiveMembers = useMemo(
    () => [...members].sort((a, b) => b.elo - a.elo).slice(0, 5),
    [members]
  );

  const recentMatches = useMemo(() => matches.slice(0, 4), [matches]);

  const upcomingEvents = useMemo(
    () =>
      [...events]
        .sort((a, b) => a.date.localeCompare(b.date))
        .filter((e) => getDaysUntil(e.date, now) >= 0)
        .slice(0, 4),
    [events, now]
  );

  const pinnedAnnouncements = useMemo(
    () =>
      [...announcements]
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.date.localeCompare(a.date);
        })
        .slice(0, 2),
    [announcements]
  );

  const nextEventInfo = useMemo(
    () => getNextUpcomingEvent(events, settings, now),
    [events, settings, now]
  );

  const countdown = useMemo(() => {
    const diffMs = Math.max(
      0,
      nextEventInfo.targetDate.getTime() - now.getTime()
    );
    const totalMinutes = Math.floor(diffMs / 60000);
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;
    return { days, hours, minutes };
  }, [nextEventInfo, now]);

  const avgAttendance = useMemo(() => {
    if (attendance.length === 0 || members.length === 0) return 0;
    const totalCheckIns = attendance.reduce(
      (acc, s) => acc + s.presentMemberIds.length,
      0
    );
    return Math.round((totalCheckIns / attendance.length / members.length) * 100);
  }, [attendance, members]);

  const getMemberName = (id: string) =>
    members.find((m) => m.id === id)?.name ?? 'Club Player';

  return (
    <div className="enode-stagger space-y-6">
      {/* Pinned Club Announcements Banner (if any exist) */}
      {pinnedAnnouncements.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
              <Megaphone className="w-4 h-4" />
              <span>Club Announcements</span>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('announcements')}
              className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
            >
              View Bulletin Board →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pinnedAnnouncements.map((ann) => (
              <div
                key={ann.id}
                className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-900 dark:text-white">
                    {ann.pinned && (
                      <Pin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    )}
                    <span>{ann.title}</span>
                  </div>
                  <span className="text-[11px] font-mono-num text-slate-400 shrink-0">
                    {ann.date}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {ann.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hero Section & Next Practice Countdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Main Club Banner (7 cols) */}
        <div className="lg:col-span-7 relative rounded-3xl bg-white/90 dark:bg-slate-900/90 border border-[var(--hairline)] shadow-[0_24px_60px_-30px_rgba(28,27,24,0.12)] overflow-hidden p-6 sm:p-8 flex flex-col justify-between">
          <div className="pointer-events-none absolute inset-0 dot-grid opacity-30" />
          <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-court/35 blur-3xl" />

          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-court/60 dark:bg-court/15 border border-court-deep/20 text-[12px] font-medium text-slate-800 dark:text-court">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{settings.schoolName} · Officer Console</span>
            </div>

            <h2 className="font-display text-2xl sm:text-4xl font-semibold tracking-[-0.03em] leading-[1.08] text-slate-900 dark:text-white">
              <MaskedTextReveal>{settings.clubName}</MaskedTextReveal>
            </h2>

            <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl leading-relaxed">
              Manage official Elo ladder standings, tournament brackets,
              practice check-ins, and live court scores from one calm workspace.
            </p>
          </div>

          <div className="relative pt-6 mt-6 border-t border-[var(--hairline)] flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5 sm:gap-7">
              <div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                  <RollingNumber value={members.length} />
                </div>
                <div className="text-[11px] text-slate-500">Active roster</div>
              </div>
              <div className="h-7 w-px bg-[var(--hairline)]" />
              <div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-slate-900 dark:text-white tabular-nums">
                  <RollingNumber value={matches.length} />
                </div>
                <div className="text-[11px] text-slate-500">Matches logged</div>
              </div>
              <div className="h-7 w-px bg-[var(--hairline)]" />
              <div>
                <div className="font-mono-num text-xl sm:text-2xl font-semibold text-emerald-700 dark:text-court tabular-nums">
                  <RollingNumber value={avgAttendance} suffix="%" />
                </div>
                <div className="text-[11px] text-slate-500">Avg attendance</div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                onClick={() => onNavigate('scorekeeper')}
                className="pill-btn pill-btn-primary text-xs px-4 py-2.5 flex-1 sm:flex-initial justify-center cursor-pointer"
              >
                Live scoreboard
              </button>
              <button
                onClick={() => onNavigate('ladder')}
                className="pill-btn pill-btn-ghost text-xs px-4 py-2.5 flex-1 sm:flex-initial justify-center cursor-pointer"
              >
                View standings
              </button>
            </div>
          </div>
        </div>

        {/* Next Practice / Event Card (5 cols) */}
        <div className="lg:col-span-5 rounded-3xl bg-paper-subtle/90 dark:bg-slate-900/90 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-6 sm:p-7 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-mono-num uppercase tracking-wider text-slate-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Next scheduled session
              </span>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                Full schedule →
              </button>
            </div>

            <div>
              <h3 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-slate-900 dark:text-white leading-snug">
                {nextEventInfo.event.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {nextEventInfo.event.location} · {nextEventInfo.event.time}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="rounded-xl bg-white dark:bg-slate-950 border border-[var(--hairline)] p-2.5 text-center">
                <div className="font-mono-num text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
                  <AnimatedNumber value={countdown.days} />
                </div>
                <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                  Days
                </div>
              </div>
              <div className="rounded-xl bg-white dark:bg-slate-950 border border-[var(--hairline)] p-2.5 text-center">
                <div className="font-mono-num text-xl font-semibold text-slate-900 dark:text-white tabular-nums">
                  <AnimatedNumber value={countdown.hours} />
                </div>
                <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                  Hours
                </div>
              </div>
              <div className="rounded-xl bg-court/45 dark:bg-court/15 border border-court-deep/20 p-2.5 text-center">
                <div className="font-mono-num text-xl font-semibold text-slate-900 dark:text-court tabular-nums">
                  <AnimatedNumber value={countdown.minutes} />
                </div>
                <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-600 dark:text-court/80">
                  Min
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--hairline)] flex items-center justify-between gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 truncate">
              {nextEventInfo.event.description}
            </span>
            <button
              onClick={() => onNavigate('members')}
              className="font-medium text-slate-900 dark:text-court hover:underline shrink-0 cursor-pointer"
            >
              Check in →
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Grid: Standings + Recent Matches / Schedule */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Top 5 Ladder Standings */}
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-5 sm:p-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Club Ladder Leaders
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Top 5 ranked players by official Club Elo rating
              </p>
            </div>
            <button
              onClick={() => onNavigate('ladder')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Full Standings ({members.length}) →
            </button>
          </div>

          {topFiveMembers.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                No Players Ranked Yet
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Add club members in the Roster & Check-In tab to initialize the
                season ladder.
              </p>
            </div>
          ) : (
            <div className="co-index-list divide-y divide-slate-200 dark:divide-slate-800 mt-1">
              {topFiveMembers.map((player, index) => {
                const total = player.wins + player.losses;
                const winRate =
                  total > 0 ? Math.round((player.wins / total) * 100) : 0;
                const eloChange = player.elo - player.monthStartElo;

                return (
                  <div
                    key={player.id}
                    onClick={() => onNavigate('ladder')}
                    className="co-index-row py-3 flex items-center justify-between gap-4 cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 font-mono-num text-sm font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                        #{index + 1}
                      </span>

                      <div className="min-w-0">
                        <div className="co-row-shift font-semibold text-sm text-slate-900 dark:text-white truncate">
                          {player.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Grade {player.grade} · {player.skillLevel}
                          {player.duprRating ? ` · ${player.duprRating} DUPR` : ''}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right hidden sm:block">
                        <div className="font-mono-num text-xs font-semibold text-slate-700 dark:text-slate-300 tabular-nums">
                          {player.wins}W – {player.losses}L ({winRate}%)
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-num tabular-nums">
                          {eloChange >= 0 ? `+${eloChange}` : eloChange} this
                          month
                        </div>
                      </div>

                      <div className="text-right min-w-[60px]">
                        <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white tabular-nums">
                          <AnimatedNumber value={player.elo} />
                        </div>
                        <div className="text-[10px] font-medium uppercase text-slate-400">
                          Elo
                        </div>
                      </div>

                      <ArrowUpRight className="co-row-arrow w-3.5 h-3.5 text-slate-400 hidden sm:block" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 5 Cols: Recent Matches & Upcoming Events */}
        <div className="lg:col-span-5 space-y-6">
          {/* Recent Match Results */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Recent Match Results
              </h3>
              <button
                onClick={() => onNavigate('ladder')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                All Matches →
              </button>
            </div>

            {recentMatches.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No matches recorded yet. Use the Live Scoreboard or Standings
                tab to log official matches.
              </div>
            ) : (
              <div className="co-index-list divide-y divide-slate-200 dark:divide-slate-800 mt-1">
                {recentMatches.map((m) => {
                  const team1Label = m.team1Ids
                    .map((id) => getMemberName(id).split(' ')[0])
                    .join(' / ');
                  const team2Label = m.team2Ids
                    .map((id) => getMemberName(id).split(' ')[0])
                    .join(' / ');
                  const scoreSummary = m.games
                    .map((g) => `${g.team1Score}–${g.team2Score}`)
                    .join(', ');

                  return (
                    <div
                      key={m.id}
                      className="co-index-row py-2.5 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="co-row-shift truncate text-slate-800 dark:text-slate-200">
                          <span
                            className={
                              m.winnerTeam === 1 ? 'font-bold' : 'text-slate-500'
                            }
                          >
                            {team1Label}
                          </span>{' '}
                          <span className="text-slate-400">vs.</span>{' '}
                          <span
                            className={
                              m.winnerTeam === 2 ? 'font-bold' : 'text-slate-500'
                            }
                          >
                            {team2Label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono-num">
                          {m.date} · {m.format}
                        </div>
                      </div>

                      <div className="text-right font-mono-num shrink-0 tabular-nums">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {scoreSummary}
                        </div>
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
                          {m.eloDelta > 0 ? `±${m.eloDelta} Elo` : 'Friendly'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Schedule & Regional Watchlist Summary */}
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[var(--hairline)] shadow-[0_1px_2px_rgba(28,27,24,0.04)] p-5 sm:p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                Upcoming Schedule
              </h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => onNavigate('watch')}
                  className="text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-blue-600 cursor-pointer"
                >
                  Regional Watch ({outsideTournaments.length})
                </button>
                <button
                  onClick={() => onNavigate('calendar')}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                >
                  Calendar →
                </button>
              </div>
            </div>

            {upcomingEvents.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-500">
                No upcoming events on the schedule.
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800 mt-1">
                {upcomingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="py-2.5 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-white truncate">
                        {ev.title}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {ev.location} · {ev.time}
                      </div>
                    </div>
                    <span className="font-mono-num text-[11px] text-slate-500 shrink-0 tabular-nums">
                      {ev.date}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Matchup Win-Probability Calculator, Polls & Activity */}
      <ClubInteractivePulse
        data={data}
        activeMember={activeMember}
        isOfficer={isOfficer}
        onVoteMvp={onVoteMvp}
        onResetMvpVotes={onResetMvpVotes}
        onVotePoll={onVotePoll}
        onCreatePoll={onCreatePoll}
        onDeletePoll={onDeletePoll}
        onToggleReaction={onToggleReaction}
        onNavigate={onNavigate}
      />
    </div>
  );
};
