import {
  CalendarEvent,
  ClubSettings,
  ClubTournamentMatch,
  ClubTournamentParticipant,
  GameScore,
  Member,
} from '../types';

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
 * Applies a finished match to the members array and returns the updated members array.
 */
export function applyMatchToMembers(
  members: Member[],
  team1Ids: string[],
  team2Ids: string[],
  games: GameScore[],
  winnerTeam: 1 | 2,
  eloDelta: number
): Member[] {
  const totalT1Points = games.reduce((sum, g) => sum + g.team1Score, 0);
  const totalT2Points = games.reduce((sum, g) => sum + g.team2Score, 0);

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
      elo: won ? m.elo + eloDelta : Math.max(800, m.elo - eloDelta),
      wins: won ? m.wins + 1 : m.wins,
      losses: won ? m.losses : m.losses + 1,
      pointsFor: m.pointsFor + pf,
      pointsAgainst: m.pointsAgainst + pa,
      streak: nextStreak,
    };
  });
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
