import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Megaphone,
  Pin,
  Play,
  Trophy,
  UserCheck,
  ArrowUpRight,
  AlertTriangle,
} from 'lucide-react';
import { ClubDataState, NavTab } from '../types';
import { getDaysUntil, getNextUpcomingEvent } from '../utils/clubUtils';

interface HomeDashboardProps {
  data: ClubDataState;
  isOfficer: boolean;
  onNavigate: (tab: NavTab) => void;
  onQuickAddAnnouncement: () => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  data,
  isOfficer,
  onNavigate,
  onQuickAddAnnouncement,
}) => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  // Latest announcement (prioritize pinned, then newest by date)
  const sortedAnnouncements = [...data.announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });
  const latestAnnouncement = sortedAnnouncements[0] || null;

  // Top 5 of the club ladder
  const top5Members = [...data.members]
    .sort((a, b) => b.elo - a.elo)
    .slice(0, 5);

  // Next upcoming outside tournament (not Done, sorted by registration deadline or start date)
  const activeOutsideTournaments = data.outsideTournaments
    .filter((t) => t.status !== 'Done')
    .sort((a, b) => a.registrationDeadline.localeCompare(b.registrationDeadline));

  // Show the featured Texas Pickleball Showdown + the soonest deadline tournament
  const nextDeadlineTournament =
    activeOutsideTournaments[0] || data.outsideTournaments[0];
  const texasShowdown =
    data.outsideTournaments.find((t) =>
      t.name.toLowerCase().includes('texas pickleball showdown')
    ) || nextDeadlineTournament;

  return (
    <div className="space-y-6">
      {/* Hero Row: Next Practice/Event Countdown + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Next Practice / Event with Live Countdown */}
        <div
          className="lg:col-span-8 rounded-2xl p-6 text-white relative overflow-hidden flex flex-col justify-between border border-slate-800/20"
          style={{
            background: `linear-gradient(135deg, var(--club-primary) 0%, #0f172a 100%)`,
          }}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium tracking-wide text-white/80 flex items-center gap-2">
                <span>Next {nextEvent.type}</span>
                <span aria-hidden="true">·</span>
                <span>{nextEvent.date}</span>
              </div>
              <button
                onClick={() => onNavigate('calendar')}
                className="text-xs font-medium text-white/90 hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
              >
                Full Calendar
              </button>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              {nextEvent.title}
            </h2>

            <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-sm text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="w-4 h-4 shrink-0 text-amber-300" />
                {nextEvent.time}
              </span>
              <span aria-hidden="true" className="text-white/40">
                ·
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-4 h-4 shrink-0 text-amber-300" />
                {nextEvent.location}
              </span>
            </div>
          </div>

          {/* Live Countdown Strip */}
          <div className="mt-6 pt-5 border-t border-white/15 flex flex-wrap items-center justify-between gap-4">
            <div className="grid grid-cols-4 gap-3 sm:gap-5">
              <div>
                <div className="font-mono-num text-2xl sm:text-3xl font-bold text-white">
                  {String(days).padStart(2, '0')}
                </div>
                <div className="text-[11px] text-white/70">Days</div>
              </div>
              <div>
                <div className="font-mono-num text-2xl sm:text-3xl font-bold text-white">
                  {String(hours).padStart(2, '0')}
                </div>
                <div className="text-[11px] text-white/70">Hours</div>
              </div>
              <div>
                <div className="font-mono-num text-2xl sm:text-3xl font-bold text-white">
                  {String(minutes).padStart(2, '0')}
                </div>
                <div className="text-[11px] text-white/70">Minutes</div>
              </div>
              <div>
                <div
                  className="font-mono-num text-2xl sm:text-3xl font-bold"
                  style={{ color: 'var(--club-secondary)' }}
                >
                  {String(seconds).padStart(2, '0')}
                </div>
                <div className="text-[11px] text-white/70">Seconds</div>
              </div>
            </div>

            <div className="text-xs text-white/80 max-w-xs">
              {nextEvent.description}
            </div>
          </div>
        </div>

        {/* Quick Action Buttons Card */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Courtside Quick Actions
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Jump straight to live match scoring, practice check-in, or club updates.
            </p>
          </div>

          <div className="mt-4 space-y-2.5">
            <button
              onClick={() => onNavigate('scorekeeper')}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl font-semibold text-sm text-white flex items-center justify-between transition-opacity hover:opacity-95 cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <Play className="w-4 h-4 fill-current" />
                Start a Match
              </span>
              <span className="text-xs font-normal text-white/80">
                Side-out or Rally
              </span>
            </button>

            <button
              onClick={() => onNavigate('members')}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <UserCheck className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                Take Attendance
              </span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                1-Tap Check-In
              </span>
            </button>

            <button
              onClick={onQuickAddAnnouncement}
              className="w-full min-h-[48px] px-4 py-3 rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white flex items-center justify-between transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2.5 whitespace-nowrap">
                <Megaphone className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                Add Announcement
              </span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                {isOfficer ? 'Officer Post' : 'View / Unlock'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Middle Row: Latest Announcement & Next Upcoming Tournament */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Latest Announcement */}
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-semibold text-slate-900 dark:text-slate-200">
                  Latest Announcement
                </span>
                {latestAnnouncement?.pinned && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                      <Pin className="w-3.5 h-3.5" /> Pinned
                    </span>
                  </>
                )}
              </div>
              <button
                onClick={() => onNavigate('announcements')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                All Announcements ({data.announcements.length})
              </button>
            </div>

            {latestAnnouncement ? (
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {latestAnnouncement.title}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {latestAnnouncement.body}
                </p>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No announcements posted yet.</p>
            )}
          </div>

          {latestAnnouncement && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                Posted by <strong className="text-slate-700 dark:text-slate-200">{latestAnnouncement.author}</strong> ({latestAnnouncement.authorRole})
              </span>
              <span className="tabular-nums">{latestAnnouncement.date}</span>
            </div>
          )}
        </div>

        {/* Next Upcoming Tournament & Registration Deadline */}
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-3">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-200">
                Tournament Watch Spotlight
              </span>
              <button
                onClick={() => onNavigate('watch')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                View All Outside Events
              </button>
            </div>

            {texasShowdown && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      {texasShowdown.name}
                    </h3>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {texasShowdown.cityVenue} · {texasShowdown.dates}
                    </div>
                  </div>
                  {(() => {
                    const daysLeft = getDaysUntil(texasShowdown.registrationDeadline, now);
                    const isUrgent = daysLeft <= 7;
                    return (
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold tabular-nums ${
                          isUrgent
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {isUrgent && <AlertTriangle className="w-3.5 h-3.5" />}
                        Reg. Deadline: {texasShowdown.registrationDeadline} ({daysLeft}d)
                      </span>
                    );
                  })()}
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-medium text-slate-900 dark:text-white">
                    {texasShowdown.entryFee}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{texasShowdown.divisions}</span>
                  <span aria-hidden="true">·</span>
                  <span>{texasShowdown.prizeMoney}</span>
                </div>

                {/* Urgent deadline alert if another tournament closes within 7 days */}
                {nextDeadlineTournament &&
                  nextDeadlineTournament.id !== texasShowdown.id &&
                  getDaysUntil(nextDeadlineTournament.registrationDeadline, now) <= 7 && (
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <span className="text-slate-700 dark:text-slate-300 font-medium truncate">
                        Closing Soon: {nextDeadlineTournament.name}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-red-600 text-white font-semibold tabular-nums whitespace-nowrap shrink-0">
                        Deadline {nextDeadlineTournament.registrationDeadline} (
                        {getDaysUntil(nextDeadlineTournament.registrationDeadline, now)}d left)
                      </span>
                    </div>
                  )}
              </div>
            )}
          </div>

          {texasShowdown && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>
                <strong className="text-slate-800 dark:text-slate-200 tabular-nums">
                  {texasShowdown.attendees.length}
                </strong>{' '}
                BNHS pairs registered ({texasShowdown.attendees.map((a) => a.memberName.split(' ')[0]).join(', ')})
              </span>
              <button
                onClick={() => onNavigate('watch')}
                className="inline-flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200 hover:underline cursor-pointer"
              >
                Manage Roster <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Top 5 Club Ladder + Quick Club Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Top 5 of the Club Ladder */}
        <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Top 5 Club Ladder Standings
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Dynamic Elo rating updated automatically after every saved match
              </p>
            </div>
            <button
              onClick={() => onNavigate('ladder')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              Full Ladder ({data.members.length})
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-3">Rank</th>
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-3">Skill / DUPR</th>
                  <th className="py-2.5 px-3 text-right">W–L</th>
                  <th className="py-2.5 px-3 text-right">Streak</th>
                  <th className="py-2.5 pl-3 text-right">Elo Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-sm">
                {top5Members.map((member, index) => (
                  <tr
                    key={member.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pr-3 font-mono-num font-bold text-slate-900 dark:text-white">
                      #{index + 1}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {member.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Grade {member.grade} · {member.paddleNotes}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-600 dark:text-slate-300">
                      <span>{member.skillLevel}</span>
                      {member.duprRating && (
                        <>
                          <span aria-hidden="true"> · </span>
                          <span className="font-mono-num font-medium">
                            {member.duprRating} DUPR
                          </span>
                        </>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-slate-700 dark:text-slate-300">
                      {member.wins}–{member.losses}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-num text-xs">
                      <span
                        className={
                          member.streak > 0
                            ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                            : 'text-slate-500'
                        }
                      >
                        {member.streak > 0 ? `W${member.streak}` : `L${Math.abs(member.streak)}`}
                      </span>
                    </td>
                    <td className="py-3 pl-3 text-right font-mono-num font-bold text-base text-slate-900 dark:text-white">
                      {member.elo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active In-Club Tournament & Club Pulse Summary */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Club Operations Snapshot
              </h3>
              <Trophy className="w-4 h-4 text-amber-500" />
            </div>

            <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-100 dark:border-slate-800">
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Active Roster
                </div>
                <div className="font-mono-num text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
                  {data.members.length}
                </div>
                <div className="text-[11px] text-slate-500">
                  {data.officers.length} Club Officers
                </div>
              </div>

              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Treasury Balance
                </div>
                <div className="font-mono-num text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  $
                  {data.transactions.reduce(
                    (acc, t) => (t.type === 'income' ? acc + t.amount : acc - t.amount),
                    0
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {data.members.filter((m) => m.duesPaid).length}/{data.members.length} dues paid
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Active Club Brackets</span>
                <button
                  onClick={() => onNavigate('tournaments')}
                  className="font-semibold text-slate-900 dark:text-white hover:underline cursor-pointer"
                >
                  {data.clubTournaments.filter((t) => t.status === 'Active').length} Running →
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Open Officer Tasks</span>
                <button
                  onClick={() => onNavigate('officers')}
                  className="font-semibold text-slate-900 dark:text-white hover:underline cursor-pointer"
                >
                  {data.tasks.filter((t) => t.status !== 'Done').length} Pending →
                </button>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Equipment Checked Out</span>
                <button
                  onClick={() => onNavigate('equipment')}
                  className="font-semibold text-slate-900 dark:text-white hover:underline cursor-pointer"
                >
                  {data.equipment.filter((e) => e.checkedOutToMemberId !== null).length} /{' '}
                  {data.equipment.length} Items →
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Season Start: {data.settings.seasonStartDate}</span>
            <span className="tabular-nums">{data.matches.length} Matches Logged</span>
          </div>
        </div>
      </div>
    </div>
  );
};
