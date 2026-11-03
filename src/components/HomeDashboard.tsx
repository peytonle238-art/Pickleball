import React, { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Flame } from 'lucide-react';
import { ClubDataState, Member, NavTab, ReactionKey } from '../types';
import {
  getClubText,
  getDaysUntil,
  getEloTierInfo,
  getNextUpcomingEvent,
} from '../utils/clubUtils';
import { ClubInteractivePulse } from './ClubInteractivePulse';

interface HomeDashboardProps {
  data: ClubDataState;
  activeMember?: Member | null;
  isOfficer: boolean;
  onVoteMvp?: (candidateId: string) => void;
  onResetMvpVotes?: () => void;
  onVotePoll?: (pollId: string, optionId: string) => void;
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
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hasScheduledEvents =
    data.events.length > 0 ||
    (data.settings.recurringPractices.enabled &&
      data.settings.recurringPractices.daysOfWeek.length > 0);

  const { event: nextEvent, targetDate } = getNextUpcomingEvent(
    data.events,
    data.settings,
    now
  );

  const diffMs = Math.max(0, targetDate.getTime() - now.getTime());
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const seconds = Math.floor((diffMs / 1000) % 60);

  const top5Members = [...data.members]
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 5);

  const activeOutsideTournaments = data.outsideTournaments
    .filter((t) => t.status !== 'Done')
    .sort((a, b) =>
      a.registrationDeadline.localeCompare(b.registrationDeadline)
    );

  const featuredOutsideTournament =
    activeOutsideTournaments[0] || data.outsideTournaments[0] || null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Optional President Custom Spotlight Banner */}
      {(data.settings.customText?.homeCustomHeadline?.trim() ||
        data.settings.customText?.homeCustomSubtext?.trim()) && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 space-y-1.5">
          {data.settings.customText?.homeCustomHeadline?.trim() && (
            <h2 className="font-display text-xl sm:text-2xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
              {data.settings.customText.homeCustomHeadline}
            </h2>
          )}
          {data.settings.customText?.homeCustomSubtext?.trim() && (
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {data.settings.customText.homeCustomSubtext}
            </p>
          )}
        </div>
      )}

      {/* 4-Column Flat Editorial Index Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-0 sm:border border-slate-200 dark:border-slate-800 rounded-lg sm:bg-white sm:dark:bg-slate-900 sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800 overflow-hidden">
        <button
          onClick={() => onNavigate('ladder')}
          className="p-3.5 sm:p-4 rounded-lg sm:rounded-none bg-white dark:bg-slate-900 border sm:border-0 border-slate-200 dark:border-slate-800 text-left flex flex-col justify-between gap-1.5 sm:gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>01 · STANDINGS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-display text-base sm:text-lg font-bold uppercase text-slate-900 dark:text-white leading-tight">
              {getClubText(
                data.settings,
                'homeCard1Title',
                'Ladder & Challenges'
              )}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-mono-num truncate">
              {data.members.length} players ·{' '}
              {
                (data.challenges || []).filter(
                  (c) => c.status === 'open' || c.status === 'accepted'
                ).length
              }{' '}
              callouts
            </div>
          </div>
        </button>

        <button
          onClick={() => onNavigate('tournaments')}
          className="p-3.5 sm:p-4 rounded-lg sm:rounded-none bg-white dark:bg-slate-900 border sm:border-0 border-slate-200 dark:border-slate-800 text-left flex flex-col justify-between gap-1.5 sm:gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>02 · BRACKETS</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-display text-base sm:text-lg font-bold uppercase text-slate-900 dark:text-white leading-tight">
              {getClubText(data.settings, 'homeCard2Title', 'Tournaments')}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              In-club pools & watch
            </div>
          </div>
        </button>

        <button
          onClick={() => onNavigate('calendar')}
          className="p-3.5 sm:p-4 rounded-lg sm:rounded-none bg-white dark:bg-slate-900 border sm:border-0 border-slate-200 dark:border-slate-800 text-left flex flex-col justify-between gap-1.5 sm:gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400">
            <span>03 · SCHEDULE</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-display text-base sm:text-lg font-bold uppercase text-slate-900 dark:text-white leading-tight">
              {getClubText(data.settings, 'homeCard3Title', 'Club Calendar')}
            </div>
            <div className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate">
              Practices, dates & courts
            </div>
          </div>
        </button>

        <button
          onClick={() => onNavigate('scorekeeper')}
          className="p-3.5 sm:p-4 rounded-lg sm:rounded-none text-left flex flex-col justify-between gap-1.5 sm:gap-2 text-white transition-opacity hover:opacity-95 cursor-pointer"
          style={{ backgroundColor: 'var(--club-primary)' }}
        >
          <div className="flex items-center justify-between text-[11px] sm:text-xs font-semibold text-white/80">
            <span>04 · COURTSIDE</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="font-display text-base sm:text-lg font-bold uppercase text-white leading-tight">
              {getClubText(data.settings, 'homeCard4Title', 'Score a Match')}
            </div>
            <div className="text-[11px] sm:text-xs text-white/85 truncate">
              Side-out referee & courts
            </div>
          </div>
        </button>
      </div>

      {/* Next Scheduled Session Flat Scoreboard Banner */}
      <div className="rounded-lg bg-slate-900 text-white p-4 sm:p-6 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4 sm:gap-6 court-arena-surface">
        {hasScheduledEvents ? (
          <>
            <div className="space-y-1.5 sm:space-y-2 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-400 uppercase tracking-wider">
                <span>Next {nextEvent.type}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{nextEvent.date}</span>
              </div>

              <h2 className="font-display text-xl sm:text-3xl font-bold uppercase tracking-tight text-white">
                {nextEvent.title}
              </h2>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs sm:text-sm text-slate-300">
                <span className="font-mono-num">{nextEvent.time}</span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span>{nextEvent.location}</span>
              </div>
            </div>

            <div className="grid grid-cols-4 divide-x divide-slate-800 bg-slate-950 border border-slate-800 rounded-md text-center shrink-0">
              <div className="px-3 sm:px-4 py-2 sm:py-2.5">
                <div className="font-mono-num text-lg sm:text-2xl font-bold text-white tabular-nums">
                  {String(days).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Days
                </div>
              </div>
              <div className="px-3 sm:px-4 py-2 sm:py-2.5">
                <div className="font-mono-num text-lg sm:text-2xl font-bold text-white tabular-nums">
                  {String(hours).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Hrs
                </div>
              </div>
              <div className="px-3 sm:px-4 py-2 sm:py-2.5">
                <div className="font-mono-num text-lg sm:text-2xl font-bold text-white tabular-nums">
                  {String(minutes).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Min
                </div>
              </div>
              <div className="px-3 sm:px-4 py-2 sm:py-2.5">
                <div
                  className="font-mono-num text-lg sm:text-2xl font-bold tabular-nums"
                  style={{ color: 'var(--club-secondary)' }}
                >
                  {String(seconds).padStart(2, '0')}
                </div>
                <div className="text-[10px] font-semibold uppercase text-slate-400">
                  Sec
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Schedule & Events
              </div>
              <h2 className="font-display text-xl sm:text-3xl font-bold uppercase tracking-tight text-white">
                No Upcoming Practices or Events Scheduled
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                {isOfficer
                  ? 'Open the Club Calendar to schedule your first practice or enable recurring practice days.'
                  : 'Check the Club Calendar for upcoming practice and tournament dates.'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('calendar')}
              className="min-h-[40px] px-4 py-2 rounded-md bg-white text-slate-950 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer shrink-0 self-start sm:self-center"
            >
              Open Calendar
            </button>
          </div>
        )}
      </div>

      {/* Main Split: Top 5 Ladder Standings + Tournament Watch */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 items-stretch">
        {/* Top 5 Club Ladder (7 cols) */}
        <div className="lg:col-span-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="font-display text-xl font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                  Top 5 Club Ladder
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live Elo standings updated after every match
                </p>
              </div>
              <button
                onClick={() => onNavigate('ladder')}
                className="px-3 py-1.5 rounded-md text-xs font-semibold border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                View All ({data.members.length})
              </button>
            </div>

            {top5Members.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {top5Members.map((member, index) => {
                  const tier = getEloTierInfo(member.elo);
                  return (
                    <div
                      key={member.id}
                      onClick={() => onNavigate('ladder')}
                      className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 px-2 -mx-2 rounded transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 font-mono-num font-bold text-sm text-slate-400">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {member.name}
                            </span>
                            <span
                              className={`text-[9px] font-mono-num uppercase font-bold px-1.5 py-0.5 rounded shrink-0 ${tier.badgeBgClass}`}
                            >
                              {tier.shortCode}
                            </span>
                            {member.streak >= 3 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-mono-num font-bold text-amber-600 dark:text-amber-400 shrink-0">
                                <Flame className="w-3 h-3" />
                                W{member.streak}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            Grade {member.grade} · {member.skillLevel}
                            {member.duprRating
                              ? ` · ${member.duprRating} DUPR`
                              : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 shrink-0 text-right">
                        <div className="text-xs font-mono-num text-slate-500 dark:text-slate-400 tabular-nums">
                          {member.wins}–{member.losses}
                        </div>
                        <div className="font-mono-num font-bold text-base text-slate-900 dark:text-white w-12 tabular-nums">
                          {member.elo}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-10 text-center space-y-1.5">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No members added to the ladder yet.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isOfficer
                    ? 'Go to Roster & Attendance to add your first club members.'
                    : 'Members will appear here once added to the roster.'}
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="font-mono-num">{data.matches.length} club matches recorded</span>
            <button
              onClick={() => onNavigate('ladder')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Full Standings & Leaderboards →
            </button>
          </div>
        </div>

        {/* Right 5 cols: Tournament Watch & Active Brackets */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex-1 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Regional Tournament Watch
              </span>
              <button
                onClick={() => onNavigate('watch')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                All Events
              </button>
            </div>

            {featuredOutsideTournament ? (
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-xl font-bold uppercase text-slate-900 dark:text-white">
                      {featuredOutsideTournament.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {featuredOutsideTournament.cityVenue} ·{' '}
                      {featuredOutsideTournament.dates}
                    </div>
                  </div>
                  {(() => {
                    const daysLeft = getDaysUntil(
                      featuredOutsideTournament.registrationDeadline,
                      now
                    );
                    const isUrgent = daysLeft <= 7;
                    return (
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-mono-num font-bold shrink-0 ${
                          isUrgent
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {daysLeft}d left
                      </span>
                    );
                  })()}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300">
                  {featuredOutsideTournament.entryFee} ·{' '}
                  {featuredOutsideTournament.divisions}
                </div>
              </div>
            ) : (
              <div className="py-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  No outside tournaments on the watch list yet.
                </p>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span className="font-mono-num">
                {data.clubTournaments.length} in-club brackets
              </span>
              <button
                onClick={() => onNavigate('tournaments')}
                className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:underline cursor-pointer"
              >
                In-Club Brackets <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex-1 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                In-Club Tournament Brackets
              </span>
              <button
                onClick={() => onNavigate('tournaments')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                All ({data.clubTournaments.length})
              </button>
            </div>

            {data.clubTournaments[0] ? (
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {data.clubTournaments[0].name}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                  {data.clubTournaments[0].format} ·{' '}
                  {data.clubTournaments[0].status}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-2">
                No in-club brackets created yet.
              </p>
            )}

            {data.clubTournaments[0] && (
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1 font-mono-num">
                <span>{data.clubTournaments[0].matches.length} matches</span>
                <span>{data.clubTournaments[0].date}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive Club Pulse: Weekly MVP Fan Vote, Club Polls & Live Activity Feed */}
      {onVoteMvp && onVotePoll && onToggleReaction && (
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
      )}

      {/* Officer-Only Executive Management Strip */}
      {isOfficer && (
        <div className="rounded-lg bg-slate-900 text-white p-6 border border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
              Officer Administration Modules
            </span>
            <span className="text-xs text-slate-400">
              Executive Access
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => onNavigate('members')}
              className="p-3.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left space-y-1 transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-white">Roster & Attendance</div>
              <div className="text-[11px] text-slate-400 font-mono-num">
                {data.members.length} members
              </div>
            </button>

            <button
              onClick={() => onNavigate('officers')}
              className="p-3.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left space-y-1 transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-white">Officers & Tasks</div>
              <div className="text-[11px] text-slate-400 font-mono-num">
                {data.tasks.filter((t) => t.status !== 'Done').length} open tasks
              </div>
            </button>

            <button
              onClick={() => onNavigate('treasury')}
              className="p-3.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left space-y-1 transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-white">Treasury & Dues</div>
              <div className="text-[11px] text-slate-400 font-mono-num">
                $
                {data.transactions.reduce(
                  (acc, t) =>
                    t.type === 'income' ? acc + t.amount : acc - t.amount,
                  0
                )}{' '}
                balance
              </div>
            </button>

            <button
              onClick={() => onNavigate('admin')}
              className="p-3.5 rounded-md bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-left space-y-1 transition-colors cursor-pointer"
            >
              <div className="text-xs font-bold text-amber-400">President Admin</div>
              <div className="text-[11px] text-slate-400">
                Full Club Command
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
