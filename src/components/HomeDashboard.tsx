import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Award,
  Calendar,
  Clock,
  MapPin,
  Package,
  Pin,
  Play,
  QrCode,
  ShieldCheck,
  Trophy,
  Users,
  Wallet,
} from 'lucide-react';
import { ClubDataState, NavTab } from '../types';
import { getDaysUntil, getNextUpcomingEvent } from '../utils/clubUtils';
import {
  PracticeQrTarget,
  buildPracticeQrToken,
} from './PracticeQrModal';

interface HomeDashboardProps {
  data: ClubDataState;
  isOfficer: boolean;
  onNavigate: (tab: NavTab) => void;
  onQuickAddAnnouncement: () => void;
  onOpenPracticeQr: (
    target: PracticeQrTarget,
    mode: 'display' | 'scan'
  ) => void;
}

export const HomeDashboard: React.FC<HomeDashboardProps> = ({
  data,
  isOfficer,
  onNavigate,
  onOpenPracticeQr,
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

  const sortedAnnouncements = [...data.announcements].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.date.localeCompare(a.date);
  });
  const latestAnnouncement = sortedAnnouncements[0] || null;

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

  const nextPracticeQrTarget: PracticeQrTarget = {
    eventId: nextEvent.id,
    title: nextEvent.title,
    date: nextEvent.date,
    time: nextEvent.time,
    location: nextEvent.location,
    token: buildPracticeQrToken(nextEvent.date, nextEvent.id),
  };

  return (
    <div className="space-y-6">
      {/* Minimalist 4-Tile Quick Navigation Row (Stats, Tournaments, Calendar, Score Keeper) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-3.5"
      >
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => onNavigate('ladder')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500/50 text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Ladder & Stats
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {data.members.length} ranked players · Elo
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => onNavigate('tournaments')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-amber-500/50 text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Trophy className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Tournaments
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Club brackets & outside watch
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => onNavigate('calendar')}
          className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/50 text-left flex flex-col justify-between gap-3 transition-colors cursor-pointer shadow-2xs"
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Calendar className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Club Calendar
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Practices, dates & QR passes
            </div>
          </div>
        </motion.button>

        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.985 }}
          onClick={() => onNavigate('scorekeeper')}
          className="p-4 rounded-2xl text-white text-left flex flex-col justify-between gap-3 transition-opacity hover:opacity-95 cursor-pointer shadow-xs"
          style={{ backgroundColor: 'var(--club-primary)' }}
        >
          <div className="flex items-center justify-between">
            <div className="w-9 h-9 rounded-xl bg-white/15 text-white flex items-center justify-center">
              <Play className="w-4 h-4 fill-current" />
            </div>
            <ArrowRight className="w-4 h-4 text-white/80" />
          </div>
          <div>
            <div className="font-display text-lg font-bold text-white">
              Score a Match
            </div>
            <div className="text-xs text-white/80">
              Live side-out or rally scorer
            </div>
          </div>
        </motion.button>
      </motion.div>

      {/* Next Scheduled Session Banner + QR Check-in */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: 'easeOut' }}
        className="rounded-3xl p-6 text-white relative overflow-hidden border border-slate-800/20 flex flex-col lg:flex-row lg:items-center justify-between gap-6"
        style={{
          background: `linear-gradient(135deg, var(--club-primary) 0%, #0f172a 100%)`,
        }}
      >
        {hasScheduledEvents ? (
          <>
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-medium text-white/80">
                <span>Next {nextEvent.type}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono-num">{nextEvent.date}</span>
              </div>

              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                {nextEvent.title}
              </h2>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs sm:text-sm text-white/85">
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

            <div className="flex flex-wrap items-center gap-5">
              {/* Minimalist Countdown */}
              <div className="grid grid-cols-4 gap-3 bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
                <div>
                  <div className="font-mono-num text-xl sm:text-2xl font-bold text-white">
                    {String(days).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-white/70">Days</div>
                </div>
                <div>
                  <div className="font-mono-num text-xl sm:text-2xl font-bold text-white">
                    {String(hours).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-white/70">Hrs</div>
                </div>
                <div>
                  <div className="font-mono-num text-xl sm:text-2xl font-bold text-white">
                    {String(minutes).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-white/70">Min</div>
                </div>
                <div>
                  <div
                    className="font-mono-num text-xl sm:text-2xl font-bold"
                    style={{ color: 'var(--club-secondary)' }}
                  >
                    {String(seconds).padStart(2, '0')}
                  </div>
                  <div className="text-[10px] text-white/70">Sec</div>
                </div>
              </div>

              <button
                onClick={() => onOpenPracticeQr(nextPracticeQrTarget, 'scan')}
                className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0"
              >
                <QrCode className="w-4 h-4 text-blue-600" />
                <span>Practice QR Check-In</span>
              </button>
            </div>
          </>
        ) : (
          <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-white/80">
                Schedule & Events
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
                No Upcoming Practices or Events Scheduled
              </h2>
              <p className="text-xs sm:text-sm text-white/80">
                {isOfficer
                  ? 'Open the Club Calendar to schedule your first practice or enable recurring practice days.'
                  : 'Check the Club Calendar for upcoming practice and tournament dates.'}
              </p>
            </div>
            <button
              onClick={() => onNavigate('calendar')}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer shrink-0 self-start sm:self-center"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Open Calendar</span>
            </button>
          </div>
        )}
      </motion.div>

      {/* Main Split: Top 5 Ladder Standings + Tournament Watch & Announcements */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.1, ease: 'easeOut' }}
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch"
      >
        {/* Top 5 Club Ladder (7 cols) */}
        <div className="lg:col-span-7 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Top 5 Club Ladder
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Live Elo standings updated after every match
                </p>
              </div>
              <button
                onClick={() => onNavigate('ladder')}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-900 dark:text-white whitespace-nowrap shrink-0 cursor-pointer transition-colors"
              >
                View All ({data.members.length})
              </button>
            </div>

            {top5Members.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {top5Members.map((member, index) => (
                  <div
                    key={member.id}
                    className="py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 font-mono-num font-bold text-sm text-slate-400">
                        #{index + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {member.name}
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
                      <div className="text-xs font-mono-num text-slate-500 dark:text-slate-400">
                        {member.wins}–{member.losses}
                      </div>
                      <div className="font-mono-num font-bold text-base text-slate-900 dark:text-white w-12">
                        {member.elo}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center space-y-2">
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  No members added to the ladder yet.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isOfficer
                    ? 'Go to Roster & Attendance to add your first club members.'
                    : 'Members will appear here once added by club officers.'}
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 mt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>{data.matches.length} club matches recorded</span>
            <button
              onClick={() => onNavigate('ladder')}
              className="font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Full Stats & Leaderboards →
            </button>
          </div>
        </div>

        {/* Right 5 cols: Tournament Spotlight + Latest Bulletin */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Tournament Watch Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 flex-1 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Upcoming Tournament Watch
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
                    <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
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
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold tabular-nums shrink-0 ${
                          isUrgent
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {isUrgent && <AlertTriangle className="w-3 h-3" />}
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
              <span>
                {data.clubTournaments.length} in-club brackets created
              </span>
              <button
                onClick={() => onNavigate('tournaments')}
                className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200 hover:underline cursor-pointer"
              >
                In-Club Brackets <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Latest Pinned Announcement Card */}
          <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-6 flex-1 flex flex-col justify-between space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1.5">
                {latestAnnouncement?.pinned && (
                  <Pin className="w-3.5 h-3.5 text-amber-500" />
                )}
                Latest Club Bulletin
              </span>
              <button
                onClick={() => onNavigate('announcements')}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                All ({data.announcements.length})
              </button>
            </div>

            {latestAnnouncement ? (
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {latestAnnouncement.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                  {latestAnnouncement.body}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-2">
                No announcements posted yet.
              </p>
            )}

            {latestAnnouncement && (
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>{latestAnnouncement.author}</span>
                <span className="font-mono-num">{latestAnnouncement.date}</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Officer-Only Executive Management Strip (Hidden in Member Mode) */}
      {isOfficer && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="rounded-3xl bg-slate-900 text-white p-6 border border-slate-800 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Officer Management Modules (Unlocked)</span>
            </div>
            <span className="text-xs text-slate-400">
              Hidden from Member View
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={() => onNavigate('members')}
              className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left space-y-1 transition-colors cursor-pointer"
            >
              <Users className="w-4 h-4 text-blue-400" />
              <div className="text-xs font-bold">Roster & Attendance</div>
              <div className="text-[11px] text-slate-400">
                {data.members.length} members
              </div>
            </button>

            <button
              onClick={() => onNavigate('officers')}
              className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left space-y-1 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <div className="text-xs font-bold">Officers & Tasks</div>
              <div className="text-[11px] text-slate-400">
                {data.tasks.filter((t) => t.status !== 'Done').length} open tasks
              </div>
            </button>

            <button
              onClick={() => onNavigate('treasury')}
              className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left space-y-1 transition-colors cursor-pointer"
            >
              <Wallet className="w-4 h-4 text-emerald-400" />
              <div className="text-xs font-bold">Treasury & Dues</div>
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
              onClick={() => onNavigate('equipment')}
              className="p-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-left space-y-1 transition-colors cursor-pointer"
            >
              <Package className="w-4 h-4 text-purple-400" />
              <div className="text-xs font-bold">Equipment Locker</div>
              <div className="text-[11px] text-slate-400">
                {data.equipment.length} club items
              </div>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
