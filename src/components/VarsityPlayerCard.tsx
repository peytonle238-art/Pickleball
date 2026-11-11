import React, { useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Award,
  TrendingUp,
  Flame,
  Shield,
  Calendar,
} from 'lucide-react';
import {
  Member,
  MatchRecord,
  AttendanceSession,
  LadderChallenge,
} from '../types';
import {
  getEloTierInfo,
  buildPlayerEloHistoryPoints,
  computeMemberAchievements,
} from '../utils/clubUtils';
import { AnimatedNumber, EXPO_OUT } from './MotionPrimitives';

interface VarsityPlayerCardProps {
  member: Member;
  allMembers: Member[];
  matches: MatchRecord[];
  attendance: AttendanceSession[];
  challenges?: LadderChallenge[];
  compact?: boolean;
}

export const VarsityPlayerCard: React.FC<VarsityPlayerCardProps> = ({
  member,
  allMembers,
  matches,
  attendance,
  challenges = [],
  compact = false,
}) => {
  const rankedLadder = useMemo(
    () => [...allMembers].sort((a, b) => b.elo - a.elo),
    [allMembers]
  );

  const rank = useMemo(() => {
    const idx = rankedLadder.findIndex((m) => m.id === member.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [rankedLadder, member.id]);

  const tierInfo = useMemo(() => getEloTierInfo(member.elo), [member.elo]);

  const eloPoints = useMemo(
    () => buildPlayerEloHistoryPoints(member, matches, allMembers),
    [member, matches, allMembers]
  );

  const achievements = useMemo(
    () => computeMemberAchievements(member, matches, attendance, challenges),
    [member, matches, attendance, challenges]
  );

  const unlockedAchievements = useMemo(
    () => achievements.filter((a) => a.unlocked),
    [achievements]
  );

  const totalMatches = member.wins + member.losses;
  const winRate =
    totalMatches > 0 ? Math.round((member.wins / totalMatches) * 100) : 0;
  const pointDiff = member.pointsFor - member.pointsAgainst;
  const monthDelta = member.elo - member.monthStartElo;

  // Build SVG polyline coordinates for Elo sparkline
  const sparklineGeometry = useMemo(() => {
    const width = 280;
    const height = 64;
    const padX = 10;
    const padY = 10;

    if (eloPoints.length === 0) {
      return {
        width,
        height,
        linePath: '',
        areaPath: '',
        dots: [] as { x: number; y: number; elo: number; label: string }[],
        minElo: 0,
        maxElo: 0,
      };
    }

    const values = eloPoints.map((p) => p.eloAfter);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const span = Math.max(24, maxVal - minVal);

    const dots = eloPoints.map((pt, idx) => {
      const x =
        eloPoints.length === 1
          ? width / 2
          : padX + (idx / (eloPoints.length - 1)) * (width - padX * 2);
      const y =
        height -
        padY -
        ((pt.eloAfter - minVal) / span) * (height - padY * 2);
      return { x, y, elo: pt.eloAfter, label: `${pt.date} · ${pt.opponentLabel}` };
    });

    const linePath = dots
      .map((d, i) => `${i === 0 ? 'M' : 'L'} ${d.x.toFixed(1)} ${d.y.toFixed(1)}`)
      .join(' ');

    const areaPath =
      dots.length > 1
        ? `${linePath} L ${dots[dots.length - 1].x.toFixed(1)} ${height} L ${dots[0].x.toFixed(1)} ${height} Z`
        : '';

    return {
      width,
      height,
      linePath,
      areaPath,
      dots,
      minElo: minVal,
      maxElo: maxVal,
    };
  }, [eloPoints]);

  const initials = member.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EXPO_OUT }}
      className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden"
    >
      {/* Top Club Color Accent Bar */}
      <div
        className="h-1.5 w-full"
        style={{ backgroundColor: 'var(--club-primary)' }}
      />

      <div className={compact ? 'p-4 space-y-4' : 'p-5 sm:p-6 space-y-5'}>
        {/* Header Row: Player Avatar, Identity & Primary Elo Rating */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={member.name}
                  className="w-14 h-14 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                />
              ) : (
                <div
                  className="w-14 h-14 rounded-lg flex items-center justify-center font-display text-xl font-bold text-white border border-slate-200 dark:border-slate-700"
                  style={{ backgroundColor: 'var(--club-primary)' }}
                >
                  {initials}
                </div>
              )}
              <span className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-mono-num text-[10px] font-bold">
                #{rank}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                  {member.name}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${tierInfo.badgeBgClass}`}
                >
                  {tierInfo.name}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <span>Grade {member.grade}</span>
                <span aria-hidden="true">·</span>
                <span>{member.skillLevel}</span>
                {member.duprRating && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num font-semibold text-slate-700 dark:text-slate-300">
                      {member.duprRating} DUPR
                    </span>
                  </>
                )}
                {member.schoolId && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono-num">ID {member.schoolId}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Primary Elo Badge */}
          <div className="text-right shrink-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Club Rating
            </div>
            <div className="flex items-baseline justify-end gap-2">
              <span className="font-mono-num text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
                <AnimatedNumber value={member.elo} />
              </span>
              <span
                className={`text-xs font-mono-num font-semibold tabular-nums ${
                  monthDelta >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-red-500'
                }`}
              >
                {monthDelta >= 0 ? `+${monthDelta}` : monthDelta}
              </span>
            </div>
          </div>
        </div>

        {/* Key Performance Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Season Record
            </div>
            <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              {member.wins}W – {member.losses}L
            </div>
          </div>

          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Win Percentage
            </div>
            <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums">
              <AnimatedNumber value={winRate} suffix="%" />
            </div>
          </div>

          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Point Differential
            </div>
            <div
              className={`font-mono-num text-base font-bold mt-0.5 tabular-nums ${
                pointDiff >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-red-500'
              }`}
            >
              {pointDiff >= 0 ? `+${pointDiff}` : pointDiff}{' '}
              <span className="text-xs font-normal text-slate-400">
                ({member.pointsFor}/{member.pointsAgainst})
              </span>
            </div>
          </div>

          <div className="p-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Current Streak
            </div>
            <div className="font-mono-num text-base font-bold text-slate-900 dark:text-white mt-0.5 tabular-nums flex items-center gap-1">
              {member.streak >= 3 && (
                <Flame className="w-4 h-4 text-amber-500 shrink-0" />
              )}
              <span>
                {member.streak > 0
                  ? `W${member.streak}`
                  : member.streak < 0
                  ? `L${Math.abs(member.streak)}`
                  : 'Even'}
              </span>
            </div>
          </div>
        </div>

        {/* Elo Rating Progression & Milestones Row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Rating Trend Sparkline */}
          <div className="md:col-span-7 p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Rating Progression</span>
              </div>
              <span className="text-[11px] font-mono-num text-slate-500 tabular-nums">
                Range: {sparklineGeometry.minElo} – {sparklineGeometry.maxElo} Elo
              </span>
            </div>

            <svg
              viewBox={`0 0 ${sparklineGeometry.width} ${sparklineGeometry.height}`}
              className="w-full h-16 overflow-visible"
              aria-label="Player Elo rating trend chart"
            >
              <defs>
                <linearGradient
                  id={`elo-grad-${member.id}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#2563eb" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#2563eb" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {sparklineGeometry.areaPath && (
                <motion.path
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.15 }}
                  d={sparklineGeometry.areaPath}
                  fill={`url(#elo-grad-${member.id})`}
                />
              )}
              {sparklineGeometry.linePath && (
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.85, ease: EXPO_OUT }}
                  d={sparklineGeometry.linePath}
                  fill="none"
                  stroke="#2563eb"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {sparklineGeometry.dots.map((d, idx) => (
                <circle
                  key={idx}
                  cx={d.x}
                  cy={d.y}
                  r={idx === sparklineGeometry.dots.length - 1 ? 3.8 : 2.5}
                  className={
                    idx === sparklineGeometry.dots.length - 1
                      ? 'fill-blue-600 dark:fill-blue-400 stroke-white dark:stroke-slate-900'
                      : 'fill-blue-500/80'
                  }
                  strokeWidth={idx === sparklineGeometry.dots.length - 1 ? 1.5 : 0}
                >
                  <title>{`${d.label}: ${d.elo} Elo`}</title>
                </circle>
              ))}
            </svg>
          </div>

          {/* Equipment & Earned Badges Summary */}
          <div className="md:col-span-5 p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200/80 dark:border-slate-800 flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  <Award className="w-3.5 h-3.5 text-amber-500" />
                  <span>Unlocked Milestones</span>
                </span>
                <span className="font-mono-num text-slate-500">
                  {unlockedAchievements.length}/{achievements.length}
                </span>
              </div>

              {unlockedAchievements.length === 0 ? (
                <p className="text-xs text-slate-500 mt-1.5">
                  Play ranked matches and attend practices to earn club badges.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {unlockedAchievements.slice(0, 6).map((ach) => (
                    <span
                      key={ach.id}
                      title={ach.description}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] font-medium text-slate-800 dark:text-slate-200"
                    >
                      <Shield className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span className="truncate max-w-[120px]">{ach.title}</span>
                    </span>
                  ))}
                  {unlockedAchievements.length > 6 && (
                    <span className="px-2 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-[11px] font-mono-num text-slate-600 dark:text-slate-300">
                      +{unlockedAchievements.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800/80 flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="truncate">
                Paddle: {member.paddleNotes || 'Club Standard Paddle'}
              </span>
              <span className="inline-flex items-center gap-1 shrink-0 font-mono-num">
                <Calendar className="w-3 h-3" />
                <span>{member.joinDate}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
