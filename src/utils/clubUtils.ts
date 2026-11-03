import {
  AttendanceSession,
  CalendarEvent,
  ClubDataState,
  ClubSettings,
  ClubTournamentMatch,
  ClubTournamentParticipant,
  GameScore,
  LadderChallenge,
  MatchMode,
  MatchRecord,
  Member,
} from '../types';

export interface MemberAchievement {
  id: string;
  title: string;
  description: string;
  category: 'Attendance' | 'Matches' | 'Streak' | 'Rating' | 'Rivalry';
  current: number;
  target: number;
  pct: number;
  unlocked: boolean;
  autoUnlocked: boolean;
  overrideStatus: 'auto' | 'granted' | 'revoked';
  progressLabel: string;
  accent: 'blue' | 'emerald' | 'amber' | 'indigo';
}

export const ALL_ACHIEVEMENT_DEFINITIONS: {
  id: string;
  title: string;
  category: 'Attendance' | 'Matches' | 'Streak' | 'Rating' | 'Rivalry';
  description: string;
}[] = [
  {
    id: 'first-checkin',
    title: 'First Court Check-In',
    category: 'Attendance',
    description: 'Check in to your first official BNHS practice session',
  },
  {
    id: 'iron-bobcat',
    title: 'Iron Bobcat Attendance',
    category: 'Attendance',
    description: 'Attend 5 or more official club practice sessions',
  },
  {
    id: 'first-win',
    title: 'First Club Victory',
    category: 'Matches',
    description: 'Win your first official ladder or tournament match',
  },
  {
    id: 'hot-streak-3',
    title: '3-Match Hot Streak',
    category: 'Streak',
    description: 'Build an active winning streak of 3 consecutive matches',
  },
  {
    id: 'unstoppable-5',
    title: '5-Match Unstoppable',
    category: 'Streak',
    description: 'Dominate the ladder with 5 consecutive match victories',
  },
  {
    id: 'rivalry-challenger',
    title: 'Rivalry Callout',
    category: 'Rivalry',
    description:
      'Issue or accept an official ladder challenge on the Club Challenge Board',
  },
  {
    id: 'century-scorer',
    title: 'Century Point Club',
    category: 'Matches',
    description: 'Score 100+ total points across official club matches',
  },
  {
    id: 'club-veteran',
    title: 'Club Court Veteran',
    category: 'Matches',
    description: 'Compete in 10 official recorded club matches',
  },
  {
    id: 'varsity-contender',
    title: 'Varsity Contender',
    category: 'Rating',
    description: 'Reach a 1,250+ Club Elo rating on the official ladder',
  },
  {
    id: 'golden-pickle',
    title: 'Dominant Game Win',
    category: 'Matches',
    description: 'Win an official game by 7+ points (e.g., 11–4 or 11–0)',
  },
];

export interface HeadToHeadSummary {
  winProbabilityA: number;
  winProbabilityB: number;
  eloStakeIfAWins: number;
  eloStakeIfBWins: number;
  aWins: number;
  bWins: number;
  totalMatches: number;
  aPoints: number;
  bPoints: number;
  pointDiffA: number;
  sharedMatches: MatchRecord[];
}

export function buildMemberPersonalQrToken(member: {
  id: string;
  name: string;
}): string {
  return `BNHS-MEMBER|${member.id}|${member.name}`;
}

export function parseMemberPersonalQrToken(
  raw: string
): { memberId: string; memberName: string } | null {
  const trimmed = raw.trim();
  if (!trimmed.toUpperCase().startsWith('BNHS-MEMBER|')) return null;
  const parts = trimmed.split('|');
  if (parts.length < 2 || !parts[1]) return null;
  return {
    memberId: parts[1].trim(),
    memberName: (parts[2] || '').trim(),
  };
}

export function computeMemberAchievements(
  member: Member | null,
  matches: MatchRecord[],
  attendance: AttendanceSession[],
  challenges: LadderChallenge[] = []
): MemberAchievement[] {
  if (!member) return [];

  const memberMatches = matches.filter(
    (m) => m.team1Ids.includes(member.id) || m.team2Ids.includes(member.id)
  );
  const totalMatches = Math.max(
    member.wins + member.losses,
    memberMatches.length
  );
  const totalWins = member.wins;
  const currentWinStreak = Math.max(0, member.streak);

  const attendedCount = attendance.filter((s) =>
    s.presentMemberIds.includes(member.id)
  ).length;

  // Check if member has won any game by 7+ points (or 11-0)
  let maxWinMargin = 0;
  for (const m of memberMatches) {
    const inT1 = m.team1Ids.includes(member.id);
    for (const g of m.games) {
      const myScore = inT1 ? g.team1Score : g.team2Score;
      const oppScore = inT1 ? g.team2Score : g.team1Score;
      if (myScore > oppScore) {
        maxWinMargin = Math.max(maxWinMargin, myScore - oppScore);
      }
    }
  }

  const memberChallengesCount = challenges.filter(
    (c) =>
      (c.challengerId === member.id || c.opponentId === member.id) &&
      c.status !== 'declined'
  ).length;

  const careerPointsScored = Math.max(0, member.pointsFor || 0);

  const eloProgress = Math.max(0, member.elo - 1150);
  const eloTarget = 100; // 1150 -> 1250

  const grantedSet = new Set(member.unlockedAchievementIds || []);
  const revokedSet = new Set(member.revokedAchievementIds || []);

  const rawList: Omit<
    MemberAchievement,
    'unlocked' | 'autoUnlocked' | 'overrideStatus'
  >[] = [
    {
      id: 'first-checkin',
      title: 'First Court Check-In',
      description: 'Check in to your first official BNHS practice session',
      category: 'Attendance',
      current: Math.min(1, attendedCount),
      target: 1,
      pct: attendedCount >= 1 ? 100 : 0,
      progressLabel: `${Math.min(1, attendedCount)} / 1 session`,
      accent: 'emerald',
    },
    {
      id: 'iron-bobcat',
      title: 'Iron Bobcat Attendance',
      description: 'Attend 5 or more official club practice sessions',
      category: 'Attendance',
      current: Math.min(5, attendedCount),
      target: 5,
      pct: Math.min(100, Math.round((attendedCount / 5) * 100)),
      progressLabel: `${attendedCount} / 5 sessions`,
      accent: 'emerald',
    },
    {
      id: 'first-win',
      title: 'First Club Victory',
      description: 'Win your first official ladder or tournament match',
      category: 'Matches',
      current: Math.min(1, totalWins),
      target: 1,
      pct: totalWins >= 1 ? 100 : 0,
      progressLabel: `${Math.min(1, totalWins)} / 1 win`,
      accent: 'blue',
    },
    {
      id: 'hot-streak-3',
      title: '3-Match Hot Streak',
      description: 'Build an active winning streak of 3 consecutive matches',
      category: 'Streak',
      current: Math.min(3, currentWinStreak),
      target: 3,
      pct: Math.min(100, Math.round((currentWinStreak / 3) * 100)),
      progressLabel: `${currentWinStreak} / 3 streak`,
      accent: 'amber',
    },
    {
      id: 'unstoppable-5',
      title: '5-Match Unstoppable',
      description: 'Dominate the ladder with 5 consecutive match victories',
      category: 'Streak',
      current: Math.min(5, currentWinStreak),
      target: 5,
      pct: Math.min(100, Math.round((currentWinStreak / 5) * 100)),
      progressLabel: `${currentWinStreak} / 5 streak`,
      accent: 'amber',
    },
    {
      id: 'rivalry-challenger',
      title: 'Rivalry Callout',
      description:
        'Issue or accept an official ladder challenge on the Club Challenge Board',
      category: 'Rivalry',
      current: Math.min(1, memberChallengesCount),
      target: 1,
      pct: memberChallengesCount >= 1 ? 100 : 0,
      progressLabel: `${Math.min(1, memberChallengesCount)} / 1 challenge`,
      accent: 'blue',
    },
    {
      id: 'century-scorer',
      title: 'Century Point Club',
      description: 'Score 100+ total points across official club matches',
      category: 'Matches',
      current: Math.min(100, careerPointsScored),
      target: 100,
      pct: Math.min(100, Math.round((careerPointsScored / 100) * 100)),
      progressLabel: `${careerPointsScored} / 100 pts`,
      accent: 'indigo',
    },
    {
      id: 'club-veteran',
      title: 'Club Court Veteran',
      description: 'Compete in 10 official recorded club matches',
      category: 'Matches',
      current: Math.min(10, totalMatches),
      target: 10,
      pct: Math.min(100, Math.round((totalMatches / 10) * 100)),
      progressLabel: `${totalMatches} / 10 matches`,
      accent: 'indigo',
    },
    {
      id: 'varsity-contender',
      title: 'Varsity Contender',
      description: 'Reach a 1,250+ Club Elo rating on the official ladder',
      category: 'Rating',
      current: member.elo,
      target: 1250,
      pct:
        member.elo >= 1250
          ? 100
          : Math.min(100, Math.round((eloProgress / eloTarget) * 100)),
      progressLabel: `${member.elo} / 1250 Elo`,
      accent: 'blue',
    },
    {
      id: 'golden-pickle',
      title: 'Dominant Game Win',
      description: 'Win an official game by 7+ points (e.g., 11–4 or 11–0)',
      category: 'Matches',
      current: Math.min(7, maxWinMargin),
      target: 7,
      pct: Math.min(100, Math.round((maxWinMargin / 7) * 100)),
      progressLabel:
        maxWinMargin >= 7
          ? `+${maxWinMargin} pt margin achieved`
          : `Best margin: +${maxWinMargin} / +7 pts`,
      accent: 'amber',
    },
  ];

  return rawList.map((item) => {
    const autoUnlocked = item.pct >= 100;
    const isRevoked = revokedSet.has(item.id);
    const isGranted = grantedSet.has(item.id);

    const unlocked = isRevoked ? false : isGranted ? true : autoUnlocked;
    const overrideStatus: 'auto' | 'granted' | 'revoked' = isRevoked
      ? 'revoked'
      : isGranted
      ? 'granted'
      : 'auto';

    return {
      ...item,
      autoUnlocked,
      unlocked,
      overrideStatus,
      pct: isGranted && !isRevoked ? 100 : item.pct,
      progressLabel:
        isGranted && !isRevoked && !autoUnlocked
          ? 'Awarded by Club Officer'
          : isRevoked
          ? 'Locked by Club Officer'
          : item.progressLabel,
    };
  });
}

/**
 * Calculates the Elo rating delta using standard K=32 formula
 * based on average team Elo ratings.
 */
export function calculateEloDelta(
  team1Elos: number[],
  team2Elos: number[],
  winnerTeam: 1 | 2
): number {
  const avg1 =
    team1Elos.reduce((acc, v) => acc + v, 0) / Math.max(1, team1Elos.length);
  const avg2 =
    team2Elos.reduce((acc, v) => acc + v, 0) / Math.max(1, team2Elos.length);
  const expected1 = 1 / (1 + Math.pow(10, (avg2 - avg1) / 400));
  const actual1 = winnerTeam === 1 ? 1 : 0;
  const kFactor = 32;
  const delta = Math.round(kFactor * (actual1 - expected1));
  return Math.max(4, Math.abs(delta));
}

/**
 * Computes head-to-head rivalry statistics, logistic Elo win probability,
 * and K=32 Elo rating stakes between two club members.
 */
export function computeHeadToHeadSummary(
  playerA: Member,
  playerB: Member,
  matches: MatchRecord[]
): HeadToHeadSummary {
  const expectedA = 1 / (1 + Math.pow(10, (playerB.elo - playerA.elo) / 400));
  const winProbabilityA = Math.min(99, Math.max(1, Math.round(expectedA * 100)));
  const winProbabilityB = 100 - winProbabilityA;

  const eloStakeIfAWins = calculateEloDelta([playerA.elo], [playerB.elo], 1);
  const eloStakeIfBWins = calculateEloDelta([playerA.elo], [playerB.elo], 2);

  let aWins = 0;
  let bWins = 0;
  let aPoints = 0;
  let bPoints = 0;
  const sharedMatches: MatchRecord[] = [];

  for (const m of matches) {
    const aInT1 = m.team1Ids.includes(playerA.id);
    const aInT2 = m.team2Ids.includes(playerA.id);
    const bInT1 = m.team1Ids.includes(playerB.id);
    const bInT2 = m.team2Ids.includes(playerB.id);

    const opposed = (aInT1 && bInT2) || (aInT2 && bInT1);
    if (!opposed) continue;

    sharedMatches.push(m);
    const aWon = (aInT1 && m.winnerTeam === 1) || (aInT2 && m.winnerTeam === 2);
    if (aWon) {
      aWins += 1;
    } else {
      bWins += 1;
    }

    for (const g of m.games) {
      if (aInT1) {
        aPoints += g.team1Score;
        bPoints += g.team2Score;
      } else {
        aPoints += g.team2Score;
        bPoints += g.team1Score;
      }
    }
  }

  return {
    winProbabilityA,
    winProbabilityB,
    eloStakeIfAWins,
    eloStakeIfBWins,
    aWins,
    bWins,
    totalMatches: sharedMatches.length,
    aPoints,
    bPoints,
    pointDiffA: aPoints - bPoints,
    sharedMatches,
  };
}

/**
 * Resolves the effective MatchMode for a MatchRecord.
 */
export function getEffectiveMatchMode(match: MatchRecord): MatchMode {
  if (match.matchMode) return match.matchMode;
  if (match.isFriendly || match.eloDelta === 0) return 'friendly_wl';
  return 'ranked';
}

/**
 * Applies a finished match to the members array and returns the updated members array.
 * Supports:
 * - 'ranked': updates Elo, Wins/Losses, Points For/Against, and Streak
 * - 'friendly_wl': keeps Elo unchanged (0 Elo delta), updates Wins/Losses, Points For/Against, and Streak
 * - 'practice_history': records match in history only without altering Elo or W/L record
 */
export function applyMatchToMembers(
  members: Member[],
  team1Ids: string[],
  team2Ids: string[],
  games: GameScore[],
  winnerTeam: 1 | 2,
  eloDelta: number,
  matchMode: MatchMode = 'ranked'
): Member[] {
  if (matchMode === 'practice_history') {
    return members;
  }

  const totalT1Points = games.reduce((sum, g) => sum + g.team1Score, 0);
  const totalT2Points = games.reduce((sum, g) => sum + g.team2Score, 0);
  const effectiveEloDelta = matchMode === 'friendly_wl' ? 0 : eloDelta;

  return members.map((m) => {
    const inT1 = team1Ids.includes(m.id);
    const inT2 = team2Ids.includes(m.id);
    if (!inT1 && !inT2) return m;

    const won = (inT1 && winnerTeam === 1) || (inT2 && winnerTeam === 2);
    const pf = inT1 ? totalT1Points : totalT2Points;
    const pa = inT1 ? totalT2Points : totalT1Points;

    const nextStreak = won
      ? m.streak > 0
        ? m.streak + 1
        : 1
      : m.streak < 0
      ? m.streak - 1
      : -1;

    return {
      ...m,
      elo:
        effectiveEloDelta === 0
          ? m.elo
          : won
          ? m.elo + effectiveEloDelta
          : Math.max(800, m.elo - effectiveEloDelta),
      wins: won ? m.wins + 1 : m.wins,
      losses: won ? m.losses : m.losses + 1,
      pointsFor: m.pointsFor + pf,
      pointsAgainst: m.pointsAgainst + pa,
      streak: nextStreak,
    };
  });
}

/**
 * Computes a member's current streak from an array of remaining MatchRecords.
 */
function computeStreakFromMatches(
  memberId: string,
  remainingMatches: MatchRecord[]
): number {
  const relevant = remainingMatches.filter(
    (m) =>
      getEffectiveMatchMode(m) !== 'practice_history' &&
      (m.team1Ids.includes(memberId) || m.team2Ids.includes(memberId))
  );
  // Matches are stored newest-first in state.matches; reverse to process oldest -> newest
  const chronological = [...relevant].reverse();
  let streak = 0;
  for (const m of chronological) {
    const inT1 = m.team1Ids.includes(memberId);
    const won = (inT1 && m.winnerTeam === 1) || (!inT1 && m.winnerTeam === 2);
    if (won) {
      streak = streak > 0 ? streak + 1 : 1;
    } else {
      streak = streak < 0 ? streak - 1 : -1;
    }
  }
  return streak;
}

/**
 * Reverts a deleted or voided match from participating members' stats
 * (Elo, Wins, Losses, Points For, Points Against, and Streak).
 */
export function revertMatchFromMembers(
  members: Member[],
  matchToRemove: MatchRecord,
  remainingMatches: MatchRecord[]
): Member[] {
  const mode = getEffectiveMatchMode(matchToRemove);
  if (mode === 'practice_history') {
    return members;
  }

  const totalT1Points = matchToRemove.games.reduce(
    (sum, g) => sum + g.team1Score,
    0
  );
  const totalT2Points = matchToRemove.games.reduce(
    (sum, g) => sum + g.team2Score,
    0
  );
  const effectiveDelta = mode === 'ranked' ? matchToRemove.eloDelta : 0;

  return members.map((m) => {
    const inT1 = matchToRemove.team1Ids.includes(m.id);
    const inT2 = matchToRemove.team2Ids.includes(m.id);
    if (!inT1 && !inT2) return m;

    const won =
      (inT1 && matchToRemove.winnerTeam === 1) ||
      (inT2 && matchToRemove.winnerTeam === 2);
    const pf = inT1 ? totalT1Points : totalT2Points;
    const pa = inT1 ? totalT2Points : totalT1Points;

    const revertedElo =
      effectiveDelta === 0
        ? m.elo
        : won
        ? Math.max(800, m.elo - effectiveDelta)
        : m.elo + effectiveDelta;

    return {
      ...m,
      elo: revertedElo,
      wins: Math.max(0, m.wins - (won ? 1 : 0)),
      losses: Math.max(0, m.losses - (won ? 0 : 1)),
      pointsFor: Math.max(0, (m.pointsFor || 0) - pf),
      pointsAgainst: Math.max(0, (m.pointsAgainst || 0) - pa),
      streak: computeStreakFromMatches(m.id, remainingMatches),
    };
  });
}

/**
 * Recalculates a single member's W-L, PF, PA, Streak, and Elo from scratch
 * using the club's recorded match history.
 */
export function recalculateMemberStatsFromHistory(
  member: Member,
  allMatches: MatchRecord[]
): Member {
  const chronological = [...allMatches].reverse();
  let elo = member.monthStartElo || 1200;
  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  let streak = 0;

  for (const m of chronological) {
    const inT1 = m.team1Ids.includes(member.id);
    const inT2 = m.team2Ids.includes(member.id);
    if (!inT1 && !inT2) continue;

    const mode = getEffectiveMatchMode(m);
    if (mode === 'practice_history') continue;

    const won = (inT1 && m.winnerTeam === 1) || (inT2 && m.winnerTeam === 2);
    const t1Pts = m.games.reduce((s, g) => s + g.team1Score, 0);
    const t2Pts = m.games.reduce((s, g) => s + g.team2Score, 0);
    const pf = inT1 ? t1Pts : t2Pts;
    const pa = inT1 ? t2Pts : t1Pts;

    if (won) {
      wins += 1;
      streak = streak > 0 ? streak + 1 : 1;
      if (mode === 'ranked') elo += m.eloDelta;
    } else {
      losses += 1;
      streak = streak < 0 ? streak - 1 : -1;
      if (mode === 'ranked') elo = Math.max(800, elo - m.eloDelta);
    }

    pointsFor += pf;
    pointsAgainst += pa;
  }

  return {
    ...member,
    elo,
    wins,
    losses,
    pointsFor,
    pointsAgainst,
    streak,
  };
}

/**
 * Generates a Round Robin tournament schedule using the circle rotation algorithm.
 */
export function generateRoundRobinMatches(
  participants: ClubTournamentParticipant[]
): ClubTournamentMatch[] {
  const list = [...participants];
  if (list.length < 2) return [];

  const hasBye = list.length % 2 !== 0;
  if (hasBye) {
    list.push({ id: 'BYE', name: 'BYE', playerIds: [] });
  }

  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;
  const matches: ClubTournamentMatch[] = [];
  let matchCounter = 1;

  const working = [...list];

  for (let r = 1; r <= rounds; r++) {
    let courtNum = 1;
    for (let i = 0; i < half; i++) {
      const t1 = working[i];
      const t2 = working[n - 1 - i];
      if (t1.id !== 'BYE' && t2.id !== 'BYE') {
        matches.push({
          id: `rr-m-${Date.now()}-${matchCounter++}`,
          round: r,
          roundLabel: `Round ${r}`,
          court: `Court ${courtNum++}`,
          team1Id: t1.id,
          team2Id: t2.id,
          team1Name: t1.name,
          team2Name: t2.name,
          team1PlayerIds: t1.playerIds,
          team2PlayerIds: t2.playerIds,
          score1: null,
          score2: null,
          winner: null,
        });
      }
    }
    // Rotate all except the first element
    const last = working.pop()!;
    working.splice(1, 0, last);
  }

  return matches;
}

/**
 * Generates a Single Elimination bracket (supports 2 to 8 participants).
 */
export function generateSingleEliminationMatches(
  participants: ClubTournamentParticipant[]
): ClubTournamentMatch[] {
  const count = participants.length;
  if (count < 2) return [];

  const ts = Date.now();

  if (count <= 4) {
    // 4-slot bracket (Semifinals -> Finals)
    const p1 = participants[0];
    const p2 = participants[1];
    const p3 = participants[2] || null;
    const p4 = participants[3] || null;

    const finalId = `se-final-${ts}`;
    const semi1Id = `se-s1-${ts}`;
    const semi2Id = `se-s2-${ts}`;

    const semi1: ClubTournamentMatch = {
      id: semi1Id,
      round: 1,
      roundLabel: 'Semifinals',
      court: 'Court 1',
      team1Id: p1.id,
      team2Id: p4 ? p4.id : null,
      team1Name: p1.name,
      team2Name: p4 ? p4.name : 'BYE (Auto-Advance)',
      team1PlayerIds: p1.playerIds,
      team2PlayerIds: p4 ? p4.playerIds : [],
      score1: p4 ? null : 11,
      score2: p4 ? null : 0,
      winner: p4 ? null : 1,
      nextMatchId: finalId,
      nextMatchSlot: 1,
    };

    const semi2: ClubTournamentMatch = {
      id: semi2Id,
      round: 1,
      roundLabel: 'Semifinals',
      court: 'Court 2',
      team1Id: p2.id,
      team2Id: p3 ? p3.id : null,
      team1Name: p2.name,
      team2Name: p3 ? p3.name : 'BYE (Auto-Advance)',
      team1PlayerIds: p2.playerIds,
      team2PlayerIds: p3 ? p3.playerIds : [],
      score1: p3 ? null : 11,
      score2: p3 ? null : 0,
      winner: p3 ? null : 1,
      nextMatchId: finalId,
      nextMatchSlot: 2,
    };

    const finalMatch: ClubTournamentMatch = {
      id: finalId,
      round: 2,
      roundLabel: 'Championship Final',
      court: 'Championship Court 1',
      team1Id: semi1.winner === 1 ? p1.id : null,
      team2Id: semi2.winner === 1 ? p2.id : null,
      team1Name: semi1.winner === 1 ? p1.name : 'Winner of Semifinal 1',
      team2Name: semi2.winner === 1 ? p2.name : 'Winner of Semifinal 2',
      team1PlayerIds: semi1.winner === 1 ? p1.playerIds : [],
      team2PlayerIds: semi2.winner === 1 ? p2.playerIds : [],
      score1: null,
      score2: null,
      winner: null,
    };

    return [semi1, semi2, finalMatch];
  }

  // 8-slot bracket (Quarterfinals -> Semifinals -> Finals)
  const finalId = `se-final-${ts}`;
  const semi1Id = `se-s1-${ts}`;
  const semi2Id = `se-s2-${ts}`;

  const qfPairs: [number, number][] = [
    [0, 7],
    [3, 4],
    [1, 6],
    [2, 5],
  ];

  const qfMatches: ClubTournamentMatch[] = qfPairs.map(([idxA, idxB], i) => {
    const pA = participants[idxA];
    const pB = participants[idxB] || null;
    const targetSemi = i < 2 ? semi1Id : semi2Id;
    const targetSlot: 1 | 2 = i % 2 === 0 ? 1 : 2;

    return {
      id: `se-qf-${i + 1}-${ts}`,
      round: 1,
      roundLabel: 'Quarterfinals',
      court: `Court ${i + 1}`,
      team1Id: pA.id,
      team2Id: pB ? pB.id : null,
      team1Name: pA.name,
      team2Name: pB ? pB.name : 'BYE (Auto-Advance)',
      team1PlayerIds: pA.playerIds,
      team2PlayerIds: pB ? pB.playerIds : [],
      score1: pB ? null : 11,
      score2: pB ? null : 0,
      winner: pB ? null : 1,
      nextMatchId: targetSemi,
      nextMatchSlot: targetSlot,
    };
  });

  const semi1: ClubTournamentMatch = {
    id: semi1Id,
    round: 2,
    roundLabel: 'Semifinals',
    court: 'Court 1',
    team1Id: qfMatches[0].winner ? qfMatches[0].team1Id : null,
    team2Id: qfMatches[1].winner ? qfMatches[1].team1Id : null,
    team1Name: qfMatches[0].winner ? qfMatches[0].team1Name : 'Winner QF 1',
    team2Name: qfMatches[1].winner ? qfMatches[1].team1Name : 'Winner QF 2',
    team1PlayerIds: qfMatches[0].winner ? qfMatches[0].team1PlayerIds : [],
    team2PlayerIds: qfMatches[1].winner ? qfMatches[1].team1PlayerIds : [],
    score1: null,
    score2: null,
    winner: null,
    nextMatchId: finalId,
    nextMatchSlot: 1,
  };

  const semi2: ClubTournamentMatch = {
    id: semi2Id,
    round: 2,
    roundLabel: 'Semifinals',
    court: 'Court 2',
    team1Id: qfMatches[2].winner ? qfMatches[2].team1Id : null,
    team2Id: qfMatches[3].winner ? qfMatches[3].team1Id : null,
    team1Name: qfMatches[2].winner ? qfMatches[2].team1Name : 'Winner QF 3',
    team2Name: qfMatches[3].winner ? qfMatches[3].team1Name : 'Winner QF 4',
    team1PlayerIds: qfMatches[2].winner ? qfMatches[2].team1PlayerIds : [],
    team2PlayerIds: qfMatches[3].winner ? qfMatches[3].team1PlayerIds : [],
    score1: null,
    score2: null,
    winner: null,
    nextMatchId: finalId,
    nextMatchSlot: 2,
  };

  const finalMatch: ClubTournamentMatch = {
    id: finalId,
    round: 3,
    roundLabel: 'Championship Final',
    court: 'Championship Court 1',
    team1Id: null,
    team2Id: null,
    team1Name: 'Winner Semifinal 1',
    team2Name: 'Winner Semifinal 2',
    team1PlayerIds: [],
    team2PlayerIds: [],
    score1: null,
    score2: null,
    winner: null,
  };

  return [...qfMatches, semi1, semi2, finalMatch];
}

/**
 * Propagates a match result inside a tournament's match list (including advancing in Single Elimination).
 */
export function updateTournamentMatchList(
  matches: ClubTournamentMatch[],
  matchId: string,
  score1: number,
  score2: number
): ClubTournamentMatch[] {
  const winner: 1 | 2 = score1 >= score2 ? 1 : 2;
  const target = matches.find((m) => m.id === matchId);
  if (!target) return matches;

  const winningTeamId = winner === 1 ? target.team1Id : target.team2Id;
  const winningTeamName = winner === 1 ? target.team1Name : target.team2Name;
  const winningPlayerIds =
    winner === 1 ? target.team1PlayerIds : target.team2PlayerIds;

  return matches.map((m) => {
    if (m.id === matchId) {
      return {
        ...m,
        score1,
        score2,
        winner,
      };
    }
    if (target.nextMatchId && m.id === target.nextMatchId) {
      if (target.nextMatchSlot === 1) {
        return {
          ...m,
          team1Id: winningTeamId,
          team1Name: winningTeamName,
          team1PlayerIds: winningPlayerIds,
        };
      } else if (target.nextMatchSlot === 2) {
        return {
          ...m,
          team2Id: winningTeamId,
          team2Name: winningTeamName,
          team2PlayerIds: winningPlayerIds,
        };
      }
    }
    return m;
  });
}

/**
 * Returns the number of days until a YYYY-MM-DD date string relative to now.
 */
export function getDaysUntil(dateStr: string, now: Date = new Date()): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 999;
  const target = new Date(y, m - 1, d, 23, 59, 59);
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Finds the next upcoming practice or event (combining explicit CalendarEvents and recurring practice days).
 */
export function getNextUpcomingEvent(
  events: CalendarEvent[],
  settings: ClubSettings,
  now: Date = new Date()
): { event: CalendarEvent; targetDate: Date } {
  const candidates: { event: CalendarEvent; targetDate: Date }[] = [];

  for (const ev of events) {
    const [y, m, d] = ev.date.split('-').map(Number);
    if (y && m && d) {
      const target = new Date(y, m - 1, d, 15, 50, 0);
      if (target.getTime() > now.getTime()) {
        candidates.push({ event: ev, targetDate: target });
      }
    }
  }

  // Also check next 14 days for recurring practices
  if (settings.recurringPractices.enabled && settings.recurringPractices.daysOfWeek.length > 0) {
    for (let offset = 0; offset <= 14; offset++) {
      const check = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + offset,
        15,
        50,
        0
      );
      if (
        settings.recurringPractices.daysOfWeek.includes(check.getDay()) &&
        check.getTime() > now.getTime()
      ) {
        const y = check.getFullYear();
        const m = String(check.getMonth() + 1).padStart(2, '0');
        const d = String(check.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        const alreadyExists = candidates.some((c) => c.event.date === dateStr);
        if (!alreadyExists) {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          candidates.push({
            event: {
              id: `rec-${dateStr}`,
              title: `${dayNames[check.getDay()]} Club Practice & Ladder Play`,
              date: dateStr,
              time: settings.recurringPractices.timeRange,
              location: settings.recurringPractices.location,
              type: 'Practice',
              description: 'Recurring after-school club practice, drills, and ladder matches.',
            },
            targetDate: check,
          });
        }
      }
    }
  }

  candidates.sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());

  if (candidates.length > 0) {
    return candidates[0];
  }

  // Fallback to tomorrow 3:50 PM
  const fallbackDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  fallbackDate.setHours(15, 50, 0, 0);
  const fy = fallbackDate.getFullYear();
  const fm = String(fallbackDate.getMonth() + 1).padStart(2, '0');
  const fd = String(fallbackDate.getDate()).padStart(2, '0');
  return {
    event: {
      id: 'fallback-ev',
      title: 'After-School Practice & Open Courts',
      date: `${fy}-${fm}-${fd}`,
      time: settings.recurringPractices.timeRange || '3:50 PM – 5:30 PM',
      location: settings.recurringPractices.location || 'BNHS Varsity Courts',
      type: 'Practice',
      description: 'Open court play and ladder challenges.',
    },
    targetDate: fallbackDate,
  };
}

/**
 * Resizes and compresses an uploaded image file into a compact base64 JPEG data URL
 * suitable for avatar profiles and Firestore storage (<30KB).
 */
export function processImageFileToDataUrl(file: File, maxDim = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(String(e.target?.result || ''));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Failed to load image file'));
      img.src = String(e.target?.result || '');
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export interface EloTierInfo {
  name: string;
  shortCode: string;
  minElo: number;
  nextTierElo: number | null;
  nextTierName: string | null;
  progressPct: number;
  accentColor: string;
  badgeBgClass: string;
}

/**
 * Computes Varsity Elo Tier details and progression toward the next tier threshold.
 */
export function getEloTierInfo(elo: number): EloTierInfo {
  if (elo >= 1450) {
    return {
      name: 'Varsity Legend',
      shortCode: 'LEGEND',
      minElo: 1450,
      nextTierElo: null,
      nextTierName: null,
      progressPct: 100,
      accentColor: '#eab308',
      badgeBgClass: 'bg-amber-400 text-slate-950',
    };
  }
  if (elo >= 1350) {
    return {
      name: 'Varsity Elite',
      shortCode: 'ELITE',
      minElo: 1350,
      nextTierElo: 1450,
      nextTierName: 'Varsity Legend',
      progressPct: Math.min(100, Math.max(0, Math.round(((elo - 1350) / 100) * 100))),
      accentColor: '#38bdf8',
      badgeBgClass: 'bg-sky-400 text-slate-950',
    };
  }
  if (elo >= 1250) {
    return {
      name: 'All-District',
      shortCode: 'DISTRICT',
      minElo: 1250,
      nextTierElo: 1350,
      nextTierName: 'Varsity Elite',
      progressPct: Math.min(100, Math.max(0, Math.round(((elo - 1250) / 100) * 100))),
      accentColor: '#10b981',
      badgeBgClass: 'bg-emerald-500 text-white',
    };
  }
  if (elo >= 1150) {
    return {
      name: 'Varsity Contender',
      shortCode: 'VARSITY',
      minElo: 1150,
      nextTierElo: 1250,
      nextTierName: 'All-District',
      progressPct: Math.min(100, Math.max(0, Math.round(((elo - 1150) / 100) * 100))),
      accentColor: '#3b82f6',
      badgeBgClass: 'bg-blue-600 text-white',
    };
  }
  return {
    name: 'Club Challenger',
    shortCode: 'CHALLENGER',
    minElo: 800,
    nextTierElo: 1150,
    nextTierName: 'Varsity Contender',
    progressPct: Math.min(100, Math.max(5, Math.round(((elo - 950) / 200) * 100))),
    accentColor: '#64748b',
    badgeBgClass: 'bg-slate-700 text-white',
  };
}

/**
 * Calculates real-time live win probability for Team 1 and Team 2 by blending
 * pre-match Elo rating expectation with live scoreboard point differential and leverage.
 */
export function computeLiveMatchWinProbability(
  team1Elos: number[],
  team2Elos: number[],
  score1: number,
  score2: number,
  targetScore: 11 | 15 | 21 = 11
): { team1Pct: number; team2Pct: number; statusLabel: string } {
  const avg1 =
    team1Elos.reduce((s, v) => s + v, 0) / Math.max(1, team1Elos.length);
  const avg2 =
    team2Elos.reduce((s, v) => s + v, 0) / Math.max(1, team2Elos.length);

  // Base Elo log-odds
  const eloLogit = ((avg1 - avg2) / 400) * Math.LN10;

  // Score leverage increases as the game approaches targetScore
  const maxScore = Math.max(score1, score2);
  const progressRatio = Math.min(1.35, maxScore / Math.max(1, targetScore));
  const pointWeight = 0.24 + progressRatio * 0.22;
  const scoreDiff = score1 - score2;

  const combinedLogit = eloLogit * (1 - progressRatio * 0.45) + scoreDiff * pointWeight;
  const rawProb1 = 1 / (1 + Math.exp(-combinedLogit));

  // Check if game is already decided (reached targetScore & win by 2)
  if (score1 >= targetScore && score1 - score2 >= 2) {
    return { team1Pct: 100, team2Pct: 0, statusLabel: 'TEAM 1 VICTORY' };
  }
  if (score2 >= targetScore && score2 - score1 >= 2) {
    return { team1Pct: 0, team2Pct: 100, statusLabel: 'TEAM 2 VICTORY' };
  }

  const team1Pct = Math.min(99, Math.max(1, Math.round(rawProb1 * 100)));
  const team2Pct = 100 - team1Pct;

  let statusLabel = 'EVEN MATCHUP';
  const t1GamePoint = score1 >= targetScore - 1 && score1 - score2 >= 1;
  const t2GamePoint = score2 >= targetScore - 1 && score2 - score1 >= 1;

  if (t1GamePoint) {
    statusLabel = 'GAME POINT · TEAM 1';
  } else if (t2GamePoint) {
    statusLabel = 'GAME POINT · TEAM 2';
  } else if (score1 >= targetScore - 1 && score2 >= targetScore - 1 && score1 === score2) {
    statusLabel = 'DEUCE PRESSURE · WIN BY 2';
  } else if (Math.abs(scoreDiff) >= 5) {
    statusLabel = scoreDiff > 0 ? 'TEAM 1 SURGE' : 'TEAM 2 SURGE';
  } else if (Math.abs(avg1 - avg2) >= 75 && scoreDiff * (avg1 - avg2) < 0) {
    statusLabel = 'UPSET ALERT ON COURT';
  }

  return { team1Pct, team2Pct, statusLabel };
}

export interface PlayerEloHistoryPoint {
  matchId: string;
  date: string;
  eloAfter: number;
  eloDelta: number;
  won: boolean;
  opponentLabel: string;
  scoreLabel: string;
}

/**
 * Builds a chronological Elo trajectory for a player's interactive sparkline.
 */
export function buildPlayerEloHistoryPoints(
  member: Member,
  allMatches: MatchRecord[],
  allMembers: Member[]
): PlayerEloHistoryPoint[] {
  const getShort = (id: string) => {
    const found = allMembers.find((m) => m.id === id);
    if (!found) return 'Player';
    const parts = found.name.split(' ');
    return parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : found.name;
  };

  const playerMatches = allMatches
    .filter(
      (m) => m.team1Ids.includes(member.id) || m.team2Ids.includes(member.id)
    )
    .slice(0, 12)
    .reverse(); // Oldest -> Newest

  if (playerMatches.length === 0) {
    return [
      {
        matchId: 'baseline',
        date: member.joinDate || 'Start',
        eloAfter: member.elo,
        eloDelta: 0,
        won: true,
        opponentLabel: 'Season Baseline',
        scoreLabel: `${member.elo} Elo`,
      },
    ];
  }

  // Reconstruct backwards from current member.elo so the final point matches member.elo
  const points: PlayerEloHistoryPoint[] = [];
  let runningElo = member.elo;

  const newestFirst = [...playerMatches].reverse();
  const reconstructedNewestFirst: PlayerEloHistoryPoint[] = [];

  for (const m of newestFirst) {
    const inT1 = m.team1Ids.includes(member.id);
    const won = (inT1 && m.winnerTeam === 1) || (!inT1 && m.winnerTeam === 2);
    const mode = getEffectiveMatchMode(m);
    const signedDelta =
      mode === 'ranked' ? (won ? m.eloDelta : -m.eloDelta) : 0;
    const oppIds = inT1 ? m.team2Ids : m.team1Ids;
    const scoreStr = m.games
      .map((g) => `${g.team1Score}–${g.team2Score}`)
      .join(', ');

    reconstructedNewestFirst.push({
      matchId: m.id,
      date: m.date,
      eloAfter: runningElo,
      eloDelta: signedDelta,
      won,
      opponentLabel: `vs. ${oppIds.map(getShort).join(' / ')}`,
      scoreLabel: scoreStr,
    });

    runningElo = Math.max(800, runningElo - signedDelta);
  }

  points.push({
    matchId: 'baseline',
    date: 'Start',
    eloAfter: runningElo,
    eloDelta: 0,
    won: true,
    opponentLabel: 'Starting Rating',
    scoreLabel: `${runningElo} Elo`,
  });

  points.push(...reconstructedNewestFirst.reverse());
  return points;
}

export interface SiteTextEntryDefinition {
  key: string;
  section: string;
  label: string;
  defaultValue: string;
  multiline?: boolean;
}

export const DEFAULT_SITE_TEXT_ENTRIES: SiteTextEntryDefinition[] = [
  {
    key: 'welcomeTagline',
    section: 'Welcome Screen',
    label: 'Welcome Hero Description',
    defaultValue:
      'Official varsity & club athlete portal. Sign in with your School ID or register on the club roster to track matches, Elo standings, and practice attendance.',
    multiline: true,
  },
  {
    key: 'welcomeAccessHeading',
    section: 'Welcome Screen',
    label: 'Access Card Heading',
    defaultValue: 'Athlete & Officer Access',
  },
  {
    key: 'welcomeSignInPrompt',
    section: 'Welcome Screen',
    label: 'School ID Sign-In Prompt',
    defaultValue: 'Enter your School ID to load your member profile:',
  },
  {
    key: 'memberPortalSubtitle',
    section: 'Member Portal',
    label: 'Member Portal Header Subtitle',
    defaultValue: 'Member Portal',
  },
  {
    key: 'officerConsoleSubtitle',
    section: 'Officer Console',
    label: 'Officer Console Header Subtitle',
    defaultValue: 'Officer Console',
  },
  {
    key: 'homeCustomHeadline',
    section: 'Home Overview',
    label: 'Custom Spotlight Headline (Optional)',
    defaultValue: '',
  },
  {
    key: 'homeCustomSubtext',
    section: 'Home Overview',
    label: 'Custom Spotlight Body Copy (Optional)',
    defaultValue: '',
    multiline: true,
  },
  {
    key: 'homeCard1Title',
    section: 'Home Overview',
    label: 'Quick Tile 1 Title',
    defaultValue: 'Ladder & Challenges',
  },
  {
    key: 'homeCard2Title',
    section: 'Home Overview',
    label: 'Quick Tile 2 Title',
    defaultValue: 'Tournaments',
  },
  {
    key: 'homeCard3Title',
    section: 'Home Overview',
    label: 'Quick Tile 3 Title',
    defaultValue: 'Club Calendar',
  },
  {
    key: 'homeCard4Title',
    section: 'Home Overview',
    label: 'Quick Tile 4 Title',
    defaultValue: 'Score a Match',
  },
  {
    key: 'pulseMvpHeading',
    section: 'Interactive Pulse',
    label: 'Weekly MVP Card Title',
    defaultValue: 'Athlete of the Week Ballot',
  },
  {
    key: 'pulsePollHeading',
    section: 'Interactive Pulse',
    label: 'Live Club Polls Card Title',
    defaultValue: 'Live Club Polls',
  },
  {
    key: 'pulseFeedHeading',
    section: 'Interactive Pulse',
    label: 'Activity Feed Card Title',
    defaultValue: 'Club Activity & Highlights',
  },
  {
    key: 'clubRulesOrNotes',
    section: 'Club Rules & Info',
    label: 'Custom Club Rules / Footer Note',
    defaultValue: '',
    multiline: true,
  },
];

export function getClubText(
  settings: ClubSettings | undefined,
  key: string,
  defaultValue: string
): string {
  const custom = settings?.customText?.[key];
  if (custom !== undefined && custom.trim() !== '') {
    return custom;
  }
  return defaultValue;
}

const PROTECTED_KEYS = new Set([
  'id',
  'challengerId',
  'opponentId',
  'completedMatchId',
  'winnerMemberId',
  'tournamentId',
  'matchId',
  'checkedOutToMemberId',
  'primaryColor',
  'secondaryColor',
  'photoUrl',
]);

/**
 * Globally searches and replaces text across every string field in ClubDataState
 * (including settings, customText, members, matches, tournaments, events, announcements, etc.).
 */
export function globalReplaceTextInClubState(
  state: ClubDataState,
  findStr: string,
  replaceStr: string,
  caseSensitive = false
): { nextState: ClubDataState; replacementsCount: number } {
  if (!findStr) {
    return { nextState: state, replacementsCount: 0 };
  }

  let replacementsCount = 0;
  const escaped = findStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, caseSensitive ? 'g' : 'gi');

  const transformNode = (node: unknown, keyName?: string): unknown => {
    if (keyName && PROTECTED_KEYS.has(keyName)) {
      return node;
    }
    if (typeof node === 'string') {
      if (node.startsWith('data:image/')) return node;
      const matches = node.match(regex);
      if (matches && matches.length > 0) {
        replacementsCount += matches.length;
        return node.replace(regex, replaceStr);
      }
      return node;
    }
    if (Array.isArray(node)) {
      return node.map((item) => transformNode(item));
    }
    if (node && typeof node === 'object') {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        result[k] = transformNode(v, k);
      }
      return result;
    }
    return node;
  };

  const nextState = transformNode(state) as ClubDataState;
  return { nextState, replacementsCount };
}

