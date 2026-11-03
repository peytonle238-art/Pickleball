import React, { useMemo, useRef, useState } from 'react';
import {
  Flame,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from 'lucide-react';
import {
  AttendanceSession,
  LadderChallenge,
  MatchRecord,
  Member,
} from '../types';
import {
  MemberAchievement,
  buildPlayerEloHistoryPoints,
  computeMemberAchievements,
  getEloTierInfo,
} from '../utils/clubUtils';

interface VarsityPlayerCardProps {
  member: Member;
  allMembers: Member[];
  matches: MatchRecord[];
  attendance?: AttendanceSession[];
  challenges?: LadderChallenge[];
  compact?: boolean;
}

function renderCardBadgeIcon(ach: MemberAchievement) {
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

export const VarsityPlayerCard: React.FC<VarsityPlayerCardProps> = ({
  member,
  allMembers,
  matches,
  attendance = [],
  challenges = [],
  compact = false,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState<{
    rotateX: number;
    rotateY: number;
    glareX: number;
    glareY: number;
    isHovering: boolean;
  }>({
    rotateX: 0,
    rotateY: 0,
    glareX: 50,
    glareY: 30,
    isHovering: false,
  });

  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedSparkIdx, setSelectedSparkIdx] = useState<number | null>(null);

  const rankedList = useMemo(
    () => [...allMembers].sort((a, b) => b.elo - a.elo),
    [allMembers]
  );
  const ladderRank = useMemo(() => {
    const idx = rankedList.findIndex((m) => m.id === member.id);
    return idx >= 0 ? idx + 1 : 1;
  }, [rankedList, member.id]);

  const tierInfo = useMemo(() => getEloTierInfo(member.elo), [member.elo]);

  const achievements = useMemo(
    () =>
      computeMemberAchievements(member, matches, attendance, challenges),
    [member, matches, attendance, challenges]
  );

  const unlockedBadges = useMemo(
    () => achievements.filter((a) => a.unlocked),
    [achievements]
  );

  const showcaseBadges = useMemo(() => {
    if (unlockedBadges.length >= 3) return unlockedBadges.slice(0, 3);
    const remaining = achievements.filter((a) => !a.unlocked);
    return [...unlockedBadges, ...remaining].slice(0, 3);
  }, [unlockedBadges, achievements]);

  const eloHistory = useMemo(
    () => buildPlayerEloHistoryPoints(member, matches, allMembers),
    [member, matches, allMembers]
  );

  const activeSparkPoint = useMemo(() => {
    if (eloHistory.length === 0) return null;
    if (
      selectedSparkIdx !== null &&
      selectedSparkIdx >= 0 &&
      selectedSparkIdx < eloHistory.length
    ) {
      return eloHistory[selectedSparkIdx];
    }
    return eloHistory[eloHistory.length - 1];
  }, [eloHistory, selectedSparkIdx]);

  // Recent 5-match form strip (oldest -> newest of last 5)
  const recentForm = useMemo(() => {
    return matches
      .filter(
        (m) => m.team1Ids.includes(member.id) || m.team2Ids.includes(member.id)
      )
      .slice(0, 5)
      .reverse()
      .map((m) => {
        const inT1 = m.team1Ids.includes(member.id);
        const won =
          (inT1 && m.winnerTeam === 1) || (!inT1 && m.winnerTeam === 2);
        return { id: m.id, won, date: m.date };
      });
  }, [matches, member.id]);

  const totalGames = member.wins + member.losses;
  const winPct =
    totalGames > 0 ? Math.round((member.wins / totalGames) * 100) : 0;
  const monthDelta = member.elo - (member.monthStartElo || 1200);
  const ptDiff = (member.pointsFor || 0) - (member.pointsAgainst || 0);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pctX = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const pctY = Math.max(0, Math.min(100, (y / rect.height) * 100));

    const rotateY = ((pctX - 50) / 50) * 8;
    const rotateX = ((50 - pctY) / 50) * 7;

    setTilt({
      rotateX,
      rotateY,
      glareX: pctX,
      glareY: pctY,
      isHovering: true,
    });
  };

  const handlePointerLeave = () => {
    setTilt({
      rotateX: 0,
      rotateY: 0,
      glareX: 50,
      glareY: 30,
      isHovering: false,
    });
  };

  // Compute SVG coordinates for the interactive Elo sparkline
  const sparkCoords = useMemo(() => {
    if (eloHistory.length === 0) return [];
    const elos = eloHistory.map((p) => p.eloAfter);
    const minElo = Math.min(...elos, 1150) - 15;
    const maxElo = Math.max(...elos, 1250) + 15;
    const span = Math.max(30, maxElo - minElo);

    return eloHistory.map((pt, idx) => {
      const x =
        eloHistory.length === 1
          ? 140
          : 16 + (idx / (eloHistory.length - 1)) * 248;
      const y = 76 - ((pt.eloAfter - minElo) / span) * 60;
      return { ...pt, x, y, idx };
    });
  }, [eloHistory]);

  const sparkPolyline = useMemo(
    () => sparkCoords.map((c) => `${c.x},${c.y}`).join(' '),
    [sparkCoords]
  );

  return (
    <div className="w-full select-none">
      <div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        style={{
          transform: `perspective(1100px) rotateX(${tilt.rotateX}deg) rotateY(${tilt.rotateY}deg)`,
          transition: tilt.isHovering
            ? 'transform 60ms linear'
            : 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="relative rounded-xl bg-slate-950 text-white border border-slate-800 overflow-hidden shadow-lg"
      >
        {/* Dynamic Varsity Foil Specular Sheen */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-200"
          style={{
            opacity: tilt.isHovering ? 1 : 0.35,
            background: `radial-gradient(circle at ${tilt.glareX}% ${tilt.glareY}%, rgba(255,255,255,0.14) 0%, rgba(59,130,246,0.07) 38%, transparent 70%)`,
          }}
        />

        {/* Subtle Top-Down Court Geometry Lines */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 court-arena-surface opacity-70"
        />

        {/* Top Broadcast Header Strip */}
        <div className="relative z-20 px-4 sm:px-5 py-3 border-b border-slate-800/90 bg-slate-900/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono-num font-bold uppercase tracking-wider shrink-0 ${tierInfo.badgeBgClass}`}
            >
              {tierInfo.shortCode}
            </span>
            <span className="text-xs font-semibold text-slate-300 truncate">
              {tierInfo.name}
            </span>
            <span aria-hidden="true" className="text-slate-600">
              ·
            </span>
            <span className="font-mono-num text-xs font-bold text-amber-400 shrink-0">
              RANK #{ladderRank}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsFlipped((prev) => !prev);
            }}
            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-semibold text-slate-200 inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0"
          >
            <RotateCw className="w-3 h-3 text-amber-400" />
            <span>{isFlipped ? 'Card Front' : 'Elo Telemetry'}</span>
          </button>
        </div>

        {/* CARD BODY: FRONT VS BACK */}
        {!isFlipped ? (
          <div
            className={`relative z-20 ${
              compact ? 'p-4 space-y-3.5' : 'p-4 sm:p-6 space-y-4 sm:space-y-5'
            }`}
          >
            {/* Athlete Identity + Big Tabular Elo */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                {member.photoUrl ? (
                  <img
                    src={member.photoUrl}
                    alt={member.name}
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg object-cover border-2 border-amber-400/70 shrink-0"
                  />
                ) : (
                  <div
                    className="w-14 h-14 sm:w-16 sm:h-16 rounded-lg font-display text-xl sm:text-2xl font-bold flex items-center justify-center shrink-0 border-2 border-amber-400/60 text-white"
                    style={{ backgroundColor: 'var(--club-primary)' }}
                  >
                    {member.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                )}

                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono-num uppercase tracking-widest text-slate-400">
                      BNHS VARSITY CARD
                    </span>
                    {member.streak >= 3 && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono-num font-bold">
                        <Flame className="w-3 h-3" /> W{member.streak} STREAK
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-bold uppercase tracking-tight text-white truncate">
                    {member.name}
                  </h3>
                  <div className="text-xs text-slate-300 font-mono-num">
                    Grade {member.grade} · {member.skillLevel}
                    {member.paddleNotes ? ` · ${member.paddleNotes}` : ''}
                  </div>
                </div>
              </div>

              {/* Elo Rating Display Box */}
              <div className="px-4 py-2.5 rounded-lg bg-slate-900/95 border border-slate-800 text-right shrink-0">
                <div className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                  Official Club Elo
                </div>
                <div className="font-mono-num text-3xl sm:text-4xl font-bold text-white tabular-nums leading-none mt-0.5">
                  {member.elo}
                </div>
                <div
                  className={`text-[11px] font-mono-num font-semibold mt-1 tabular-nums ${
                    monthDelta >= 0 ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {monthDelta >= 0 ? `+${monthDelta}` : monthDelta} this month
                </div>
              </div>
            </div>

            {/* Elo Tier Progression Bar */}
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800/90 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-mono-num">
                <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Tier Progress: {tierInfo.name}</span>
                </span>
                <span className="text-slate-400 tabular-nums">
                  {tierInfo.nextTierElo
                    ? `${member.elo} / ${tierInfo.nextTierElo} Elo to ${tierInfo.nextTierName}`
                    : 'MAX TIER UNLOCKED'}
                </span>
              </div>
              <div className="h-2 w-full rounded-sm bg-slate-800 overflow-hidden">
                <div
                  className="h-full transition-all duration-500"
                  style={{
                    width: `${tierInfo.progressPct}%`,
                    backgroundColor: tierInfo.accentColor,
                  }}
                />
              </div>
            </div>

            {/* 4-Column Season Telemetry Strip */}
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/90">
                <div className="text-[10px] font-mono-num uppercase text-slate-400">
                  Record
                </div>
                <div className="font-mono-num text-base sm:text-lg font-bold text-white tabular-nums mt-0.5">
                  {member.wins}–{member.losses}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/90">
                <div className="text-[10px] font-mono-num uppercase text-slate-400">
                  Win Rate
                </div>
                <div className="font-mono-num text-base sm:text-lg font-bold text-emerald-400 tabular-nums mt-0.5">
                  {winPct}%
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/90">
                <div className="text-[10px] font-mono-num uppercase text-slate-400">
                  Pt Diff
                </div>
                <div
                  className={`font-mono-num text-base sm:text-lg font-bold tabular-nums mt-0.5 ${
                    ptDiff >= 0 ? 'text-blue-400' : 'text-red-400'
                  }`}
                >
                  {ptDiff >= 0 ? `+${ptDiff}` : ptDiff}
                </div>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800/90">
                <div className="text-[10px] font-mono-num uppercase text-slate-400">
                  Badges
                </div>
                <div className="font-mono-num text-base sm:text-lg font-bold text-amber-400 tabular-nums mt-0.5">
                  {unlockedBadges.length}/{achievements.length}
                </div>
              </div>
            </div>

            {/* Pinned Varsity Badges Showcase + Recent Form */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400">
                  Showcase:
                </span>
                {showcaseBadges.map((ach) => (
                  <div
                    key={ach.id}
                    className={`px-2.5 py-1 rounded text-xs font-semibold inline-flex items-center gap-1.5 border ${
                      ach.unlocked
                        ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    {renderCardBadgeIcon(ach)}
                    <span className="truncate max-w-[130px]">{ach.title}</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono-num uppercase tracking-wider text-slate-400 mr-1">
                  Last 5:
                </span>
                {recentForm.length === 0 ? (
                  <span className="text-xs font-mono-num text-slate-500">
                    No games yet
                  </span>
                ) : (
                  recentForm.map((f) => (
                    <span
                      key={f.id}
                      title={`${f.won ? 'Win' : 'Loss'} on ${f.date}`}
                      className={`w-6 h-6 rounded text-[11px] font-mono-num font-bold flex items-center justify-center ${
                        f.won
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {f.won ? 'W' : 'L'}
                    </span>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          /* BACK OF CARD: INTERACTIVE ELO SPARKLINE & MATCH BREAKDOWN */
          <div
            className={`relative z-20 ${
              compact ? 'p-4 space-y-3.5' : 'p-4 sm:p-6 space-y-4'
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-mono-num uppercase tracking-wider text-amber-400 font-semibold">
                  Interactive Elo Rating Trajectory
                </div>
                <h4 className="font-display text-xl font-bold uppercase text-white">
                  {member.name} · Season Rating Curve
                </h4>
              </div>

              {activeSparkPoint && (
                <div className="px-3 py-1.5 rounded bg-slate-900 border border-slate-800 text-right font-mono-num text-xs">
                  <div className="font-bold text-white">
                    {activeSparkPoint.eloAfter} Elo{' '}
                    {activeSparkPoint.eloDelta !== 0 && (
                      <span
                        className={
                          activeSparkPoint.eloDelta > 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }
                      >
                        (
                        {activeSparkPoint.eloDelta > 0
                          ? `+${activeSparkPoint.eloDelta}`
                          : activeSparkPoint.eloDelta}
                        )
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {activeSparkPoint.opponentLabel} ·{' '}
                    {activeSparkPoint.scoreLabel} ({activeSparkPoint.date})
                  </div>
                </div>
              )}
            </div>

            {/* Interactive SVG Elo Curve */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <svg
                viewBox="0 0 280 92"
                className="w-full h-28 overflow-visible"
                role="img"
                aria-label="Interactive Elo rating history chart"
              >
                {/* Horizontal Reference Grid Lines */}
                <line
                  x1="12"
                  y1="20"
                  x2="268"
                  y2="20"
                  stroke="rgba(148,163,184,0.15)"
                  strokeDasharray="3 3"
                />
                <line
                  x1="12"
                  y1="48"
                  x2="268"
                  y2="48"
                  stroke="rgba(148,163,184,0.15)"
                  strokeDasharray="3 3"
                />
                <line
                  x1="12"
                  y1="76"
                  x2="268"
                  y2="76"
                  stroke="rgba(148,163,184,0.15)"
                />

                {sparkCoords.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={sparkPolyline}
                  />
                )}

                {sparkCoords.map((pt) => {
                  const isSelected =
                    (selectedSparkIdx === null &&
                      pt.idx === sparkCoords.length - 1) ||
                    selectedSparkIdx === pt.idx;
                  return (
                    <g
                      key={`${pt.matchId}-${pt.idx}`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSparkIdx(pt.idx);
                      }}
                      onMouseEnter={() => setSelectedSparkIdx(pt.idx)}
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill={
                          pt.idx === 0
                            ? '#94a3b8'
                            : pt.won
                            ? '#10b981'
                            : '#ef4444'
                        }
                        stroke="#090d16"
                        strokeWidth="1.5"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="flex items-center justify-between text-[10px] font-mono-num text-slate-400 pt-1">
                <span>Tap or hover any match node to inspect score & Elo Δ</span>
                <span>
                  Career Points: {member.pointsFor || 0} PF /{' '}
                  {member.pointsAgainst || 0} PA
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>
                Joined {member.joinDate} · School ID:{' '}
                <strong className="text-slate-200 font-mono-num">
                  {member.schoolId || member.id}
                </strong>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFlipped(false);
                }}
                className="text-amber-400 hover:underline font-semibold cursor-pointer"
              >
                ← Flip Back to Front
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
