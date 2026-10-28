import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Award,
  Edit3,
  ExternalLink,
  Eye,
  Flame,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  ClubTournament,
  MatchRecord,
  Member,
  OutsideTournament,
} from '../types';
import { getDaysUntil } from '../utils/clubUtils';
import { PracticeCourtSlot } from './LiveScoreKeeper';

interface WatchlistViewProps {
  members: Member[];
  matches: MatchRecord[];
  clubTournaments: ClubTournament[];
  outsideTournaments: OutsideTournament[];
  isOfficer: boolean;
  onUpdateOutsideTournaments: (list: OutsideTournament[]) => void;
  onRequestOfficerUnlock: () => void;
}

type VfxEventType =
  | 'point'
  | 'smash'
  | 'dink'
  | 'ace'
  | 'streak'
  | 'deuce'
  | 'game_point'
  | 'side_out'
  | 'winner';

interface WiiVfxBanner {
  id: number;
  type: VfxEventType;
  headline: string;
  subline: string;
  scoreLeft: number;
  scoreRight: number;
  scoringTeam: 1 | 2;
  teamName: string;
  shotSpeedMph?: number;
  accentFrom: string;
  accentTo: string;
  badgeText: string;
}

interface WatchedCourtItem {
  id: string;
  source: 'multicourt' | 'tournament' | 'showcase';
  courtLabel: string;
  eventTitle: string;
  format: 'singles' | 'doubles';
  team1Name: string;
  team2Name: string;
  team1Score: number;
  team2Score: number;
  targetScore: number;
  servingTeam: 1 | 2;
  streakTeam: 1 | 2 | null;
  streakCount: number;
}

interface ParticlePiece {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  shape: 'circle' | 'rect' | 'star';
}

const MULTICOURT_STORAGE_KEY = 'bnhs_pickleball_multicourt_v1';
const WATCHED_IDS_STORAGE_KEY = 'bnhs_watchlist_pinned_v1';

const PARTICLE_COLORS = [
  '#fbbf24', // Amber
  '#38bdf8', // Sky
  '#34d399', // Emerald
  '#f43f5e', // Rose
  '#a855f7', // Purple
  '#ffffff', // White
];

// Web Audio API Synthesizer for Wii Sports-style chimes & fanfare
function playWiiArcadeSound(type: VfxEventType, enabled: boolean) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (
      freq: number,
      startOffset: number,
      duration: number,
      wave: OscillatorType = 'triangle',
      gainVal = 0.14
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(0.001, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(gainVal, now + startOffset + 0.02);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        now + startOffset + duration
      );
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration + 0.02);
    };

    if (type === 'winner') {
      // Wii Sports Victory Fanfare arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
      const times = [0, 0.1, 0.2, 0.32, 0.48, 0.62];
      const durs = [0.12, 0.12, 0.12, 0.16, 0.12, 0.45];
      notes.forEach((n, i) => playTone(n, times[i], durs[i], 'triangle', 0.18));
    } else if (type === 'game_point' || type === 'deuce') {
      // Dramatic tension chime
      playTone(440, 0, 0.14, 'sawtooth', 0.1);
      playTone(554.37, 0.1, 0.14, 'sawtooth', 0.1);
      playTone(659.25, 0.2, 0.35, 'triangle', 0.16);
    } else if (type === 'smash' || type === 'ace' || type === 'streak') {
      // High-energy power point chime
      playTone(587.33, 0, 0.09, 'square', 0.11);
      playTone(783.99, 0.08, 0.1, 'square', 0.12);
      playTone(1174.66, 0.16, 0.3, 'triangle', 0.18);
    } else if (type === 'side_out') {
      // Two-tone swoosh chime
      playTone(659.25, 0, 0.1, 'sine', 0.12);
      playTone(523.25, 0.1, 0.18, 'sine', 0.12);
    } else {
      // Classic Wii Sports bright point chime
      playTone(523.25, 0, 0.1, 'triangle', 0.15);
      playTone(659.25, 0.08, 0.1, 'triangle', 0.15);
      playTone(783.99, 0.16, 0.26, 'triangle', 0.16);
    }
  } catch {
    // Ignore audio context restrictions
  }
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  members,
  matches,
  clubTournaments,
  outsideTournaments,
  isOfficer,
  onUpdateOutsideTournaments,
  onRequestOfficerUnlock,
}) => {
  // Sound & Auto-Rally Broadcast Controls
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoRallyActive, setAutoRallyActive] = useState(false);

  // Pinned Watchlist IDs
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(WATCHED_IDS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(WATCHED_IDS_STORAGE_KEY, JSON.stringify(pinnedIds));
    } catch {
      // Ignore storage error
    }
  }, [pinnedIds]);

  // Build initial watched courts from Multi-Court storage, Club Tournaments, or Roster
  const buildCourtsFromSources = useCallback((): WatchedCourtItem[] => {
    const list: WatchedCourtItem[] = [];

    // 1. Check Multi-Court Practice slots in localStorage
    try {
      const raw = localStorage.getItem(MULTICOURT_STORAGE_KEY);
      if (raw) {
        const parsed: PracticeCourtSlot[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach((slot) => {
            const getName = (id: string) =>
              members.find((m) => m.id === id)?.name || 'Club Player';
            const t1 = slot.team1Ids.map(getName).join(' / ') || 'Team 1';
            const t2 = slot.team2Ids.map(getName).join(' / ') || 'Team 2';
            list.push({
              id: `mc-${slot.id}`,
              source: 'multicourt',
              courtLabel: `Court ${slot.courtNumber}`,
              eventTitle: 'Live Practice Night Court',
              format: slot.format,
              team1Name: t1,
              team2Name: t2,
              team1Score: slot.team1Score || 0,
              team2Score: slot.team2Score || 0,
              targetScore: slot.targetScore || 11,
              servingTeam: 1,
              streakTeam: null,
              streakCount: 0,
            });
          });
        }
      }
    } catch {
      // Ignore
    }

    // 2. Check Active Club Tournament Matches
    clubTournaments.forEach((tourney) => {
      tourney.matches.slice(0, 4).forEach((m) => {
        list.push({
          id: `ct-${tourney.id}-${m.id}`,
          source: 'tournament',
          courtLabel: m.court || 'Center Court',
          eventTitle: `${tourney.name} · ${m.roundLabel}`,
          format: tourney.playStyle,
          team1Name: m.team1Name,
          team2Name: m.team2Name,
          team1Score: m.score1 ?? 0,
          team2Score: m.score2 ?? 0,
          targetScore: 11,
          servingTeam: 1,
          streakTeam: null,
          streakCount: 0,
        });
      });
    });

    // 3. Always provide Featured Bobcats Showcase Courts if list has fewer than 3 courts
    const m0 = members[0]?.name || 'Alex Rivera';
    const m1 = members[1]?.name || 'Jordan Chen';
    const m2 = members[2]?.name || 'Taylor Brooks';
    const m3 = members[3]?.name || 'Morgan Patel';
    const m4 = members[4]?.name || 'Casey Kim';
    const m5 = members[5]?.name || 'Riley Vance';

    if (list.length === 0) {
      list.push(
        {
          id: 'showcase-1',
          source: 'showcase',
          courtLabel: 'Championship Court 1',
          eventTitle: 'BNHS Bobcats Featured Matchup',
          format: 'doubles',
          team1Name: `${m0.split(' ')[0]} / ${m1.split(' ')[0]}`,
          team2Name: `${m2.split(' ')[0]} / ${m3.split(' ')[0]}`,
          team1Score: 8,
          team2Score: 7,
          targetScore: 11,
          servingTeam: 1,
          streakTeam: 1,
          streakCount: 2,
        },
        {
          id: 'showcase-2',
          source: 'showcase',
          courtLabel: 'Court 2 · Ladder Spotlight',
          eventTitle: 'Top Seed Singles Showdown',
          format: 'singles',
          team1Name: m0,
          team2Name: m4,
          team1Score: 9,
          team2Score: 9,
          targetScore: 11,
          servingTeam: 2,
          streakTeam: null,
          streakCount: 0,
        },
        {
          id: 'showcase-3',
          source: 'showcase',
          courtLabel: 'Court 3 · King of the Court',
          eventTitle: 'Doubles Challenger Series',
          format: 'doubles',
          team1Name: `${m4.split(' ')[0]} / ${m5.split(' ')[0]}`,
          team2Name: `${m1.split(' ')[0]} / ${m3.split(' ')[0]}`,
          team1Score: 6,
          team2Score: 4,
          targetScore: 11,
          servingTeam: 1,
          streakTeam: null,
          streakCount: 0,
        }
      );
    }

    return list;
  }, [members, clubTournaments]);

  const [watchedCourts, setWatchedCourts] = useState<WatchedCourtItem[]>(() =>
    buildCourtsFromSources()
  );
  const [selectedCourtId, setSelectedCourtId] = useState<string>(
    () => buildCourtsFromSources()[0]?.id || 'showcase-1'
  );

  // Active Wii Sports VFX Banner & Particle Burst State
  const [activeVfx, setActiveVfx] = useState<WiiVfxBanner | null>(null);
  const [particles, setParticles] = useState<ParticlePiece[]>([]);
  const [scoreSlamVisible, setScoreSlamVisible] = useState(false);

  // Court Ball & Rally Animation State
  const [rallyState, setRallyState] = useState<{
    inProgress: boolean;
    ballX: number; // percentage 10..90
    ballY: number; // percentage 15..85
    impactX: number | null;
    impactY: number | null;
    lastShotLabel: string;
    hoppingTeam: 1 | 2 | null;
  }>({
    inProgress: false,
    ballX: 25,
    ballY: 65,
    impactX: null,
    impactY: null,
    lastShotLabel: 'Ready to Serve',
    hoppingTeam: null,
  });

  // Live Play-by-Play Ticker Log
  const [playFeed, setPlayFeed] = useState<
    {
      id: number;
      time: string;
      courtLabel: string;
      call: string;
      detail: string;
      scoreText: string;
      highlight: boolean;
    }[]
  >([
    {
      id: 1,
      time: 'Just now',
      courtLabel: 'Championship Court 1',
      call: 'BROADCAST LIVE',
      detail: 'Wii Sports Spectator VFX & Live Rally Tracker active',
      scoreText: 'LIVE',
      highlight: true,
    },
  ]);

  const vfxTimeoutRef = useRef<number | null>(null);

  const activeCourt = useMemo(
    () =>
      watchedCourts.find((c) => c.id === selectedCourtId) || watchedCourts[0],
    [watchedCourts, selectedCourtId]
  );

  // Spawn celebratory particle burst
  const triggerParticles = useCallback((count = 36) => {
    const pieces: ParticlePiece[] = Array.from({ length: count }).map(
      (_, idx) => {
        const angle = (Math.PI * 2 * idx) / count + (Math.random() - 0.5) * 0.4;
        const speed = 40 + Math.random() * 140;
        const shapes: ('circle' | 'rect' | 'star')[] = [
          'circle',
          'rect',
          'star',
        ];
        return {
          id: Date.now() + idx,
          x: 50,
          y: 45,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 30,
          color: PARTICLE_COLORS[idx % PARTICLE_COLORS.length],
          size: 7 + Math.round(Math.random() * 8),
          rotation: Math.round(Math.random() * 360),
          shape: shapes[idx % shapes.length],
        };
      }
    );
    setParticles(pieces);
  }, []);

  // Core function: Trigger a Wii Sports Point / Event on the active court!
  const handleTriggerCourtEvent = useCallback(
    (
      scoringTeam: 1 | 2,
      shotFlavor: 'auto' | 'smash' | 'dink' | 'ace' | 'side_out' = 'auto',
      courtIdOverride?: string
    ) => {
      const targetId = courtIdOverride || activeCourt?.id;
      if (!targetId) return;

      setWatchedCourts((prev) =>
        prev.map((court) => {
          if (court.id !== targetId) return court;

          // Handle side-out (no score increment, just serve switch)
          if (shotFlavor === 'side_out') {
            const nextServer: 1 | 2 = court.servingTeam === 1 ? 2 : 1;
            const banner: WiiVfxBanner = {
              id: Date.now(),
              type: 'side_out',
              headline: 'SIDE OUT!',
              subline: `Serve switches to ${
                nextServer === 1 ? court.team1Name : court.team2Name
              }`,
              scoreLeft: court.team1Score,
              scoreRight: court.team2Score,
              scoringTeam: nextServer,
              teamName: nextServer === 1 ? court.team1Name : court.team2Name,
              accentFrom: '#0284c7',
              accentTo: '#1e3a8a',
              badgeText: 'CHANGE OF SERVE',
            };
            setActiveVfx(banner);
            setScoreSlamVisible(true);
            playWiiArcadeSound('side_out', soundEnabled);
            triggerParticles(18);

            setRallyState((r) => ({
              ...r,
              inProgress: false,
              ballX: nextServer === 1 ? 22 : 78,
              ballY: nextServer === 1 ? 68 : 32,
              impactX: null,
              impactY: null,
              lastShotLabel: 'Side Out · Change of Serve',
              hoppingTeam: nextServer,
            }));

            return {
              ...court,
              servingTeam: nextServer,
            };
          }

          // Calculate new scores
          const nextT1 =
            scoringTeam === 1 ? court.team1Score + 1 : court.team1Score;
          const nextT2 =
            scoringTeam === 2 ? court.team2Score + 1 : court.team2Score;
          const scorerName =
            scoringTeam === 1 ? court.team1Name : court.team2Name;

          const newStreakCount =
            court.streakTeam === scoringTeam ? court.streakCount + 1 : 1;

          // Determine if Game Winner, Game Point, Deuce, Streak, or Shot Type
          const maxScore = Math.max(nextT1, nextT2);
          const minScore = Math.min(nextT1, nextT2);
          const isWinner =
            maxScore >= court.targetScore && maxScore - minScore >= 2;
          const isDeuce =
            nextT1 === nextT2 && nextT1 >= court.targetScore - 1;
          const isGamePoint =
            !isWinner &&
            ((nextT1 >= court.targetScore - 1 && nextT1 - nextT2 >= 1) ||
              (nextT2 >= court.targetScore - 1 && nextT2 - nextT1 >= 1));

          let eventType: VfxEventType = 'point';
          let headline = 'NICE SHOT!';
          let badgeText = 'RALLY POINT';
          let accentFrom = '#2563eb';
          let accentTo = '#1d4ed8';
          let speed = 38 + Math.floor(Math.random() * 18);

          if (isWinner) {
            eventType = 'winner';
            headline = 'GAME, SET & MATCH!';
            badgeText = 'VICTORY FINALE';
            accentFrom = '#f59e0b';
            accentTo = '#b45309';
            speed = 64;
          } else if (isGamePoint) {
            eventType = 'game_point';
            headline = 'MATCH POINT!';
            badgeText = 'CLUTCH SITUATION';
            accentFrom = '#e11d48';
            accentTo = '#9f1239';
            speed = 55;
          } else if (isDeuce) {
            eventType = 'deuce';
            headline = 'DEUCE! TIED UP!';
            badgeText = 'WIN BY 2';
            accentFrom = '#7c3aed';
            accentTo = '#4338ca';
            speed = 49;
          } else if (shotFlavor === 'smash') {
            eventType = 'smash';
            headline = 'POWER SMASH!';
            badgeText = 'OVERHEAD SLAM';
            accentFrom = '#ea580c';
            accentTo = '#c2410c';
            speed = 62 + Math.floor(Math.random() * 12);
          } else if (shotFlavor === 'ace') {
            eventType = 'ace';
            headline = 'ACE SERVE!';
            badgeText = 'UNTOUCHABLE SERVE';
            accentFrom = '#059669';
            accentTo = '#065f46';
            speed = 58 + Math.floor(Math.random() * 10);
          } else if (shotFlavor === 'dink') {
            eventType = 'dink';
            headline = 'KITCHEN DINK!';
            badgeText = 'TOUCH WINNER';
            accentFrom = '#0891b2';
            accentTo = '#155e75';
            speed = 22 + Math.floor(Math.random() * 9);
          } else if (newStreakCount >= 3) {
            eventType = 'streak';
            headline = `ON FIRE! ${newStreakCount}x STREAK!`;
            badgeText = 'UNSTOPPABLE RUN';
            accentFrom = '#f97316';
            accentTo = '#b91c1c';
            speed = 56;
          } else {
            const pointCallouts = [
              'NICE SHOT!',
              'GREAT RALLY!',
              'CROSS-COURT WINNER!',
              'PASSING SHOT!',
              'POINT SCORED!',
            ];
            headline =
              pointCallouts[(nextT1 + nextT2) % pointCallouts.length];
          }

          const subline = isWinner
            ? `${scorerName} takes the game ${nextT1}–${nextT2}!`
            : `${scorerName} scores! (${nextT1} – ${nextT2})`;

          const banner: WiiVfxBanner = {
            id: Date.now(),
            type: eventType,
            headline,
            subline,
            scoreLeft: nextT1,
            scoreRight: nextT2,
            scoringTeam,
            teamName: scorerName,
            shotSpeedMph: speed,
            accentFrom,
            accentTo,
            badgeText,
          };

          setActiveVfx(banner);
          setScoreSlamVisible(true);
          playWiiArcadeSound(eventType, soundEnabled);
          triggerParticles(isWinner ? 65 : newStreakCount >= 3 ? 45 : 30);

          // Set court ball landing spot on opponent's side
          const landX =
            scoringTeam === 1
              ? 66 + Math.floor(Math.random() * 20)
              : 14 + Math.floor(Math.random() * 20);
          const landY = 24 + Math.floor(Math.random() * 52);

          setRallyState({
            inProgress: false,
            ballX: landX,
            ballY: landY,
            impactX: landX,
            impactY: landY,
            lastShotLabel: `${headline} (${speed} MPH)`,
            hoppingTeam: scoringTeam,
          });

          // Add to live play-by-play feed
          const timeStr = new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });
          setPlayFeed((old) => [
            {
              id: Date.now(),
              time: timeStr,
              courtLabel: court.courtLabel,
              call: headline,
              detail: `${scorerName} (${speed} mph)`,
              scoreText: `${nextT1}–${nextT2}`,
              highlight:
                isWinner || isGamePoint || newStreakCount >= 3 || shotFlavor !== 'auto',
            },
            ...old.slice(0, 14),
          ]);

          if (vfxTimeoutRef.current) {
            window.clearTimeout(vfxTimeoutRef.current);
          }
          vfxTimeoutRef.current = window.setTimeout(() => {
            setActiveVfx(null);
          }, 2900);

          return {
            ...court,
            team1Score: nextT1,
            team2Score: nextT2,
            servingTeam: scoringTeam,
            streakTeam: scoringTeam,
            streakCount: newStreakCount,
          };
        })
      );
    },
    [activeCourt, soundEnabled, triggerParticles]
  );

  // Play an animated multi-shot rally across the net before scoring a point!
  const handleSimulateAnimatedRally = useCallback(
    (winnerOverride?: 1 | 2) => {
      if (rallyState.inProgress || !activeCourt) return;

      setActiveVfx(null);
      setScoreSlamVisible(false);
      setRallyState((r) => ({
        ...r,
        inProgress: true,
        impactX: null,
        impactY: null,
        hoppingTeam: null,
        lastShotLabel: 'Rally in progress...',
      }));

      const waypoints = [
        { x: 24, y: 66, label: 'Deep Serve' },
        { x: 76, y: 36, label: 'Third Shot Drop' },
        { x: 38, y: 44, label: 'Kitchen Dink' },
        { x: 62, y: 54, label: 'Cross-Court Dink' },
        { x: 30, y: 30, label: 'Lob Defense' },
      ];

      waypoints.forEach((wp, index) => {
        window.setTimeout(() => {
          setRallyState((prev) => ({
            ...prev,
            ballX: wp.x,
            ballY: wp.y,
            lastShotLabel: wp.label,
          }));
        }, index * 260);
      });

      window.setTimeout(() => {
        const winningTeam: 1 | 2 =
          winnerOverride || (Math.random() > 0.48 ? 1 : 2);
        const flavors: ('auto' | 'smash' | 'dink' | 'ace')[] = [
          'auto',
          'smash',
          'dink',
          'ace',
        ];
        const chosenFlavor =
          flavors[Math.floor(Math.random() * flavors.length)];
        handleTriggerCourtEvent(winningTeam, chosenFlavor);
      }, waypoints.length * 260 + 120);
    },
    [rallyState.inProgress, activeCourt, handleTriggerCourtEvent]
  );

  // Auto-Broadcast Spectator Mode interval
  useEffect(() => {
    if (!autoRallyActive) return;
    const timer = window.setInterval(() => {
      handleSimulateAnimatedRally();
    }, 4500);
    return () => window.clearInterval(timer);
  }, [autoRallyActive, handleSimulateAnimatedRally]);

  // Listen to storage changes or matches updates to trigger VFX automatically
  const prevMatchCountRef = useRef(matches.length);
  useEffect(() => {
    if (matches.length > prevMatchCountRef.current) {
      const newest = matches[0];
      if (newest) {
        handleTriggerCourtEvent(newest.winnerTeam, 'smash');
      }
    }
    prevMatchCountRef.current = matches.length;
  }, [matches, handleTriggerCourtEvent]);

  const handleResetCourtScore = () => {
    if (!activeCourt) return;
    setActiveVfx(null);
    setScoreSlamVisible(false);
    setWatchedCourts((prev) =>
      prev.map((c) =>
        c.id === activeCourt.id
          ? {
              ...c,
              team1Score: 0,
              team2Score: 0,
              streakTeam: null,
              streakCount: 0,
              servingTeam: 1,
            }
          : c
      )
    );
    setRallyState({
      inProgress: false,
      ballX: 22,
      ballY: 65,
      impactX: null,
      impactY: null,
      lastShotLabel: '0 – 0 · Play Ball!',
      hoppingTeam: null,
    });
  };

  const togglePin = (id: string) => {
    setPinnedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // =========================================================================
  // OUTSIDE TOURNAMENT WATCHLIST CRUD STATE
  // =========================================================================
  const [showOutsideForm, setShowOutsideForm] = useState(false);
  const [editingOutside, setEditingOutside] =
    useState<OutsideTournament | null>(null);
  const [outName, setOutName] = useState('');
  const [outDates, setOutDates] = useState('');
  const [outCityVenue, setOutCityVenue] = useState('');
  const [outDivisions, setOutDivisions] = useState('');
  const [outEntryFee, setOutEntryFee] = useState('');
  const [outPrizeMoney, setOutPrizeMoney] = useState('');
  const [outDeadline, setOutDeadline] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [outLink, setOutLink] = useState('https://pickleballbrackets.com');
  const [outStatus, setOutStatus] = useState<'Watching' | 'Registered' | 'Done'>(
    'Watching'
  );

  const [addingPairTourneyId, setAddingPairTourneyId] = useState<string | null>(
    null
  );
  const [pairMember1, setPairMember1] = useState(members[0]?.name || '');
  const [pairMember2, setPairMember2] = useState(members[1]?.name || '');
  const [pairDivision, setPairDivision] = useState('Mixed Doubles Moneyball');

  const openAddOutside = () => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingOutside(null);
    setOutName('');
    setOutDates('');
    setOutCityVenue('');
    setOutDivisions('Mixed Doubles, Men’s & Women’s 3.5 / 4.0');
    setOutEntryFee('$40 entry');
    setOutPrizeMoney('$1,000 Purse');
    setOutDeadline('2026-11-15');
    setOutLink('https://pickleballbrackets.com');
    setOutStatus('Watching');
    setShowOutsideForm(true);
  };

  const openEditOutside = (t: OutsideTournament) => {
    if (!isOfficer) {
      onRequestOfficerUnlock();
      return;
    }
    setEditingOutside(t);
    setOutName(t.name);
    setOutDates(t.dates);
    setOutCityVenue(t.cityVenue);
    setOutDivisions(t.divisions);
    setOutEntryFee(t.entryFee);
    setOutPrizeMoney(t.prizeMoney);
    setOutDeadline(t.registrationDeadline);
    setOutLink(t.link);
    setOutStatus(t.status);
    setShowOutsideForm(true);
  };

  const handleSaveOutsideTournament = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOfficer || !outName.trim()) return;

    if (editingOutside) {
      onUpdateOutsideTournaments(
        outsideTournaments.map((t) =>
          t.id === editingOutside.id
            ? {
                ...t,
                name: outName.trim(),
                dates: outDates.trim(),
                cityVenue: outCityVenue.trim(),
                divisions: outDivisions.trim(),
                entryFee: outEntryFee.trim(),
                prizeMoney: outPrizeMoney.trim(),
                registrationDeadline: outDeadline,
                link: outLink.trim(),
                status: outStatus,
              }
            : t
        )
      );
    } else {
      const created: OutsideTournament = {
        id: `out-${Date.now()}`,
        name: outName.trim(),
        dates: outDates.trim() || 'TBD',
        startDateISO: outDeadline,
        cityVenue: outCityVenue.trim() || 'DFW Metroplex',
        divisions: outDivisions.trim() || 'Open Divisions',
        entryFee: outEntryFee.trim() || '$40 entry',
        prizeMoney: outPrizeMoney.trim() || 'Medals',
        registrationDeadline: outDeadline,
        link: outLink.trim() || 'https://pickleballbrackets.com',
        status: outStatus,
        attendees: [],
      };
      onUpdateOutsideTournaments([created, ...outsideTournaments]);
    }
    setShowOutsideForm(false);
    setEditingOutside(null);
  };

  const handleAddAttendeePair = (tourneyId: string) => {
    if (!isOfficer) return;
    const p1 = pairMember1.trim() || 'Club Player';
    const p2 = pairMember2.trim() || 'Partner';
    onUpdateOutsideTournaments(
      outsideTournaments.map((t) =>
        t.id === tourneyId
          ? {
              ...t,
              attendees: [
                ...t.attendees,
                {
                  id: `att-pair-${Date.now()}`,
                  memberName: p1,
                  partnerName: p2,
                  division: pairDivision.trim() || 'Doubles',
                },
              ],
            }
          : t
      )
    );
    setAddingPairTourneyId(null);

    // Trigger celebratory Wii Sports banner when a pair registers!
    setActiveVfx({
      id: Date.now(),
      type: 'winner',
      headline: 'NEW PAIR LOCKED IN!',
      subline: `${p1} & ${p2} registered for ${pairDivision}`,
      scoreLeft: activeCourt?.team1Score || 0,
      scoreRight: activeCourt?.team2Score || 0,
      scoringTeam: 1,
      teamName: `${p1} & ${p2}`,
      accentFrom: '#10b981',
      accentTo: '#047857',
      badgeText: 'TOURNAMENT WATCHLIST',
    });
    playWiiArcadeSound('winner', soundEnabled);
    triggerParticles(45);
  };

  const handleRemoveAttendeePair = (tourneyId: string, pairId: string) => {
    if (!isOfficer) return;
    onUpdateOutsideTournaments(
      outsideTournaments.map((t) =>
        t.id === tourneyId
          ? {
              ...t,
              attendees: t.attendees.filter((a) => a.id !== pairId),
            }
          : t
      )
    );
  };

  return (
    <div className="space-y-8">
      {/* =================================================================== */}
      {/* 1. WII SPORTS LIVE COURT BROADCAST & SCORING VFX STAGE              */}
      {/* =================================================================== */}
      <div className="rounded-3xl bg-slate-950 text-white border border-slate-800 shadow-2xl overflow-hidden relative">
        {/* Top Broadcast Control Strip */}
        <div className="px-5 sm:px-7 py-4 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shrink-0">
              <Eye className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-sky-400">
                <span>BNHS Live Spectator Watchlist</span>
                <span aria-hidden="true">·</span>
                <span className="text-amber-300">Arcade Broadcast VFX</span>
              </div>
              <h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-white leading-none mt-0.5">
                {activeCourt?.courtLabel} — {activeCourt?.eventTitle}
              </h2>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Auto-Rally Spectator Mode Toggle */}
            <button
              type="button"
              onClick={() => setAutoRallyActive(!autoRallyActive)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer ${
                autoRallyActive
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>
                {autoRallyActive ? 'Auto-Broadcast: ON' : 'Auto-Play Rallies'}
              </span>
            </button>

            {/* Sound FX Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                soundEnabled
                  ? 'bg-blue-600/25 text-blue-300 border border-blue-500/40'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
              title="Toggle Wii Sports Arcade Sound Effects"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Sound FX</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5" />
                  <span>Muted</span>
                </>
              )}
            </button>

            {/* Reset Court Score */}
            <button
              type="button"
              onClick={handleResetCourtScore}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              title="Reset Score to 0-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>

        {/* Watched Courts Selector Strip */}
        <div className="px-5 sm:px-7 py-3 bg-slate-900/50 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-semibold text-slate-400 shrink-0 mr-1">
            Watched Courts:
          </span>
          {watchedCourts.map((court) => {
            const isSelected = court.id === activeCourt?.id;
            const isPinned = pinnedIds.includes(court.id);
            return (
              <div
                key={court.id}
                className={`inline-flex items-center rounded-xl border transition-all shrink-0 ${
                  isSelected
                    ? 'bg-blue-600 border-blue-400 text-white shadow-sm'
                    : 'bg-slate-900/90 border-slate-800 text-slate-300 hover:border-slate-700'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourtId(court.id);
                    setActiveVfx(null);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold flex items-center gap-2 cursor-pointer"
                >
                  <span>{court.courtLabel}</span>
                  <span className="font-mono-num font-bold px-1.5 py-0.5 rounded bg-black/25 text-[11px]">
                    {court.team1Score}–{court.team2Score}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => togglePin(court.id)}
                  className="pr-2.5 pl-1 py-1.5 text-amber-300 hover:scale-110 transition-transform cursor-pointer"
                  title={
                    isPinned ? 'Pinned to Watchlist' : 'Pin court to Watchlist'
                  }
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      isPinned ? 'fill-amber-400 text-amber-400' : 'opacity-40'
                    }`}
                  />
                </button>
              </div>
            );
          })}
        </div>

        {/* Main Broadcast Grid: Court Stage (Left 8 Cols) + Interactive VFX Triggers & Live Feed (Right 4 Cols) */}
        <div className="p-5 sm:p-7 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* LEFT 8 COLS: INTERACTIVE PICKLEBALL COURT + WII SPORTS OVERLAYS */}
          <div className="lg:col-span-8 flex flex-col justify-between gap-5">
            {/* Wii Sports TV Scoreboard Header Bar */}
            {activeCourt && (
              <div className="grid grid-cols-11 items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-2xl p-3 sm:p-4">
                {/* Team 1 Side */}
                <div className="col-span-5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-400">
                      <span>TEAM 1</span>
                      {activeCourt.servingTeam === 1 && (
                        <span className="text-amber-300 font-bold">
                          · SERVING 🎾
                        </span>
                      )}
                      {activeCourt.streakTeam === 1 &&
                        activeCourt.streakCount >= 2 && (
                          <span className="inline-flex items-center gap-0.5 text-orange-400 font-bold">
                            <Flame className="w-3.5 h-3.5 fill-current" />
                            {activeCourt.streakCount}x
                          </span>
                        )}
                    </div>
                    <div className="font-display text-lg sm:text-xl font-bold text-white truncate">
                      {activeCourt.team1Name}
                    </div>
                  </div>
                  <motion.div
                    key={`t1-${activeCourt.team1Score}`}
                    initial={{ scale: 1.35, color: '#38bdf8' }}
                    animate={{ scale: 1, color: '#ffffff' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className="font-mono-num text-3xl sm:text-4xl font-extrabold tabular-nums px-3 py-1 rounded-xl bg-blue-600/20 border border-blue-500/30"
                  >
                    {activeCourt.team1Score}
                  </motion.div>
                </div>

                {/* VS Center */}
                <div className="col-span-1 text-center font-display text-xs font-bold text-slate-500">
                  VS
                </div>

                {/* Team 2 Side */}
                <div className="col-span-5 flex items-center justify-between gap-2">
                  <motion.div
                    key={`t2-${activeCourt.team2Score}`}
                    initial={{ scale: 1.35, color: '#fbbf24' }}
                    animate={{ scale: 1, color: '#ffffff' }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                    className="font-mono-num text-3xl sm:text-4xl font-extrabold tabular-nums px-3 py-1 rounded-xl bg-amber-500/20 border border-amber-500/30"
                  >
                    {activeCourt.team2Score}
                  </motion.div>
                  <div className="min-w-0 text-right">
                    <div className="flex items-center justify-end gap-1.5 text-[11px] font-semibold text-amber-400">
                      {activeCourt.streakTeam === 2 &&
                        activeCourt.streakCount >= 2 && (
                          <span className="inline-flex items-center gap-0.5 text-orange-400 font-bold">
                            <Flame className="w-3.5 h-3.5 fill-current" />
                            {activeCourt.streakCount}x
                          </span>
                        )}
                      {activeCourt.servingTeam === 2 && (
                        <span className="text-amber-300 font-bold">
                          🎾 SERVING ·
                        </span>
                      )}
                      <span>TEAM 2</span>
                    </div>
                    <div className="font-display text-lg sm:text-xl font-bold text-white truncate">
                      {activeCourt.team2Name}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* =============================================================== */}
            {/* THE PICKLEBALL COURT CANVAS + WII SPORTS POPUP STAGE            */}
            {/* =============================================================== */}
            <div className="relative h-72 sm:h-80 rounded-3xl overflow-hidden border-2 border-sky-400/30 bg-gradient-to-b from-[#0c4a6e] via-[#0369a1] to-[#0c4a6e] shadow-inner select-none flex items-center justify-center">
              {/* Outer Stadium Crowd Glow */}
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.18)_0%,rgba(15,23,42,0.65)_100%)] pointer-events-none" />

              {/* Pickleball Court Lines SVG */}
              <svg
                viewBox="0 0 600 320"
                className="w-[92%] h-[86%] drop-shadow-md"
                fill="none"
              >
                {/* Court Surface (Royal Blue Inner Court, Emerald Kitchen) */}
                <rect
                  x="20"
                  y="20"
                  width="560"
                  height="280"
                  rx="8"
                  fill="#1d4ed8"
                  stroke="#ffffff"
                  strokeWidth="4"
                />
                {/* Non-Volley Zone (Kitchen) */}
                <rect
                  x="220"
                  y="20"
                  width="160"
                  height="280"
                  fill="#059669"
                  fillOpacity="0.82"
                  stroke="#ffffff"
                  strokeWidth="3"
                />
                {/* Left & Right Center Service Lines */}
                <line
                  x1="20"
                  y1="160"
                  x2="220"
                  y2="160"
                  stroke="#ffffff"
                  strokeWidth="3"
                />
                <line
                  x1="380"
                  y1="160"
                  x2="580"
                  y2="160"
                  stroke="#ffffff"
                  strokeWidth="3"
                />
                {/* Center Net with Posts */}
                <line
                  x1="300"
                  y1="10"
                  x2="300"
                  y2="310"
                  stroke="#f8fafc"
                  strokeWidth="5"
                  strokeDasharray="6 6"
                />
                <circle cx="300" cy="12" r="5" fill="#fbbf24" />
                <circle cx="300" cy="308" r="5" fill="#fbbf24" />
              </svg>

              {/* Animated Mii-Style Player Avatars on Court */}
              {/* Team 1 Player(s) - Left Side */}
              <motion.div
                animate={
                  rallyState.hoppingTeam === 1
                    ? { y: [0, -16, 0, -12, 0], scale: [1, 1.15, 1] }
                    : { y: 0, scale: 1 }
                }
                transition={{ duration: 0.6 }}
                className="absolute left-[14%] top-[28%] w-10 h-10 rounded-2xl bg-sky-500 border-2 border-white shadow-lg flex items-center justify-center font-display text-xs font-bold text-white"
              >
                T1A
              </motion.div>
              {activeCourt?.format === 'doubles' && (
                <motion.div
                  animate={
                    rallyState.hoppingTeam === 1
                      ? { y: [0, -14, 0, -10, 0], scale: [1, 1.12, 1] }
                      : { y: 0, scale: 1 }
                  }
                  transition={{ duration: 0.6, delay: 0.06 }}
                  className="absolute left-[18%] bottom-[24%] w-10 h-10 rounded-2xl bg-blue-600 border-2 border-white shadow-lg flex items-center justify-center font-display text-xs font-bold text-white"
                >
                  T1B
                </motion.div>
              )}

              {/* Team 2 Player(s) - Right Side */}
              <motion.div
                animate={
                  rallyState.hoppingTeam === 2
                    ? { y: [0, -16, 0, -12, 0], scale: [1, 1.15, 1] }
                    : { y: 0, scale: 1 }
                }
                transition={{ duration: 0.6 }}
                className="absolute right-[14%] top-[28%] w-10 h-10 rounded-2xl bg-amber-500 border-2 border-white shadow-lg flex items-center justify-center font-display text-xs font-bold text-slate-950"
              >
                T2A
              </motion.div>
              {activeCourt?.format === 'doubles' && (
                <motion.div
                  animate={
                    rallyState.hoppingTeam === 2
                      ? { y: [0, -14, 0, -10, 0], scale: [1, 1.12, 1] }
                      : { y: 0, scale: 1 }
                  }
                  transition={{ duration: 0.6, delay: 0.06 }}
                  className="absolute right-[18%] bottom-[24%] w-10 h-10 rounded-2xl bg-orange-500 border-2 border-white shadow-lg flex items-center justify-center font-display text-xs font-bold text-white"
                >
                  T2B
                </motion.div>
              )}

              {/* Impact Ring Ripple Where Point Shot Landed */}
              <AnimatePresence>
                {rallyState.impactX !== null && rallyState.impactY !== null && (
                  <motion.div
                    key={`impact-${rallyState.impactX}-${rallyState.impactY}-${activeVfx?.id}`}
                    initial={{ scale: 0.2, opacity: 1 }}
                    animate={{ scale: 2.8, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.85, ease: 'easeOut' }}
                    style={{
                      left: `${rallyState.impactX}%`,
                      top: `${rallyState.impactY}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full border-4 border-amber-300 pointer-events-none"
                  />
                )}
              </AnimatePresence>

              {/* Animated Pickleball with Neon Trail */}
              <motion.div
                animate={{
                  left: `${rallyState.ballX}%`,
                  top: `${rallyState.ballY}%`,
                  scale: rallyState.inProgress ? [1, 1.35, 1] : 1,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-lime-300 border-2 border-white shadow-[0_0_16px_#a3e635] z-10 pointer-events-none"
              />

              {/* Bottom Status Pill on Court */}
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-xs font-semibold text-white/90 pointer-events-none">
                <span className="bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15">
                  {rallyState.lastShotLabel}
                </span>
                <span className="bg-slate-950/70 backdrop-blur-md px-3 py-1 rounded-xl border border-white/15 font-mono-num">
                  Game to {activeCourt?.targetScore || 11} (Win by 2)
                </span>
              </div>

              {/* ============================================================= */}
              {/* WII SPORTS EXPLOSIVE SCORING CALLOUT BANNER + PARTICLES       */}
              {/* ============================================================= */}
              <AnimatePresence>
                {activeVfx && (
                  <motion.div
                    key={activeVfx.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-slate-950/55 backdrop-blur-[2px] p-4 pointer-events-none"
                  >
                    {/* Bursting Confetti & Star Particles */}
                    {particles.map((p) => (
                      <motion.div
                        key={p.id}
                        initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
                        animate={{
                          x: p.vx,
                          y: p.vy,
                          scale: [0, 1.2, 0.8],
                          rotate: p.rotation + 180,
                          opacity: [1, 1, 0],
                        }}
                        transition={{ duration: 1.15, ease: 'easeOut' }}
                        style={{
                          width: p.size,
                          height: p.size,
                          backgroundColor: p.color,
                          borderRadius:
                            p.shape === 'circle'
                              ? '9999px'
                              : p.shape === 'star'
                              ? '3px'
                              : '2px',
                        }}
                        className="absolute shadow-sm"
                      />
                    ))}

                    {/* Wii Sports Slanted Kinetic Banner */}
                    <motion.div
                      initial={{ scale: 0.3, rotate: -8, y: 30 }}
                      animate={{ scale: 1, rotate: -2, y: 0 }}
                      exit={{ scale: 0.7, opacity: 0, y: -20 }}
                      transition={{
                        type: 'spring',
                        stiffness: 450,
                        damping: 18,
                      }}
                      style={{
                        background: `linear-gradient(135deg, ${activeVfx.accentFrom}, ${activeVfx.accentTo})`,
                      }}
                      className="px-7 py-4 rounded-3xl border-4 border-white shadow-[0_20px_50px_rgba(0,0,0,0.65)] text-center max-w-md w-full"
                    >
                      <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold tracking-widest uppercase text-amber-200 bg-black/30 px-3 py-0.5 rounded-lg mb-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{activeVfx.badgeText}</span>
                        {activeVfx.shotSpeedMph && (
                          <span>· {activeVfx.shotSpeedMph} MPH</span>
                        )}
                      </div>

                      <div className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.35)] leading-none">
                        {activeVfx.headline}
                      </div>

                      <div className="text-xs sm:text-sm font-bold text-white/95 mt-1.5">
                        {activeVfx.subline}
                      </div>

                      {/* Wii Sports Big Post-Point Score Slam */}
                      {scoreSlamVisible && (
                        <motion.div
                          initial={{ scale: 1.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          transition={{
                            delay: 0.12,
                            type: 'spring',
                            stiffness: 400,
                            damping: 20,
                          }}
                          className="mt-3 pt-2.5 border-t border-white/25 flex items-center justify-center gap-4 font-mono-num"
                        >
                          <span
                            className={`text-3xl sm:text-4xl font-extrabold ${
                              activeVfx.scoringTeam === 1
                                ? 'text-amber-300 scale-110'
                                : 'text-white'
                            }`}
                          >
                            {activeVfx.scoreLeft}
                          </span>
                          <span className="text-sm font-bold text-white/70">
                            —
                          </span>
                          <span
                            className={`text-3xl sm:text-4xl font-extrabold ${
                              activeVfx.scoringTeam === 2
                                ? 'text-amber-300 scale-110'
                                : 'text-white'
                            }`}
                          >
                            {activeVfx.scoreRight}
                          </span>
                        </motion.div>
                      )}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* =============================================================== */}
            {/* INTERACTIVE WII SPORTS POINT & SHOT VFX CONSOLE                 */}
            {/* =============================================================== */}
            <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>
                    Interactive Broadcast Scoring & Wii Sports VFX Triggers
                  </span>
                </div>
                <span className="text-[11px] text-slate-400">
                  Click any rally or shot below to trigger live score animations
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  disabled={rallyState.inProgress}
                  onClick={() => handleSimulateAnimatedRally()}
                  className="col-span-2 sm:col-span-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Watch Rally</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => handleTriggerCourtEvent(1, 'auto')}
                  className="py-2.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>+1 Team 1</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => handleTriggerCourtEvent(2, 'auto')}
                  className="py-2.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>+1 Team 2</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() =>
                    handleTriggerCourtEvent(
                      Math.random() > 0.5 ? 1 : 2,
                      'smash'
                    )
                  }
                  className="py-2.5 px-3 rounded-xl bg-orange-600/90 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Smash!</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() =>
                    handleTriggerCourtEvent(Math.random() > 0.5 ? 1 : 2, 'ace')
                  }
                  className="py-2.5 px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ace Serve!</span>
                </motion.button>

                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  onClick={() => handleTriggerCourtEvent(1, 'side_out')}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>Side Out</span>
                </motion.button>
              </div>
            </div>
          </div>

          {/* RIGHT 4 COLS: LIVE PLAY-BY-PLAY FEED & PINNED WATCHLIST */}
          <div className="lg:col-span-4 rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Live Scoring & VFX Feed
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Real-time shot radar & point callouts
                  </p>
                </div>
                <Award className="w-4 h-4 text-amber-400" />
              </div>

              <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                {playFeed.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 14 }}
                    animate={{ opacity: 1, x: 0 }}
                    className={`p-3 rounded-xl border text-xs flex items-start justify-between gap-2 ${
                      item.highlight
                        ? 'bg-blue-950/50 border-blue-500/40 text-white'
                        : 'bg-slate-950/60 border-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-amber-300">
                          {item.call}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          · {item.time}
                        </span>
                      </div>
                      <div className="text-slate-300 truncate">
                        {item.detail}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {item.courtLabel}
                      </div>
                    </div>
                    <span className="font-mono-num font-bold text-sm text-sky-400 shrink-0">
                      {item.scoreText}
                    </span>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>{watchedCourts.length} courts on broadcast radar</span>
              <span>{pinnedIds.length} pinned</span>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. REGIONAL & OUTSIDE TOURNAMENT WATCHLIST                          */}
      {/* =================================================================== */}
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
              Regional Tournament Watchlist ({outsideTournaments.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Upcoming DFW & regional tournaments, registration countdowns, and
              club pairs attending
            </p>
          </div>

          {isOfficer && (
            <button
              type="button"
              onClick={openAddOutside}
              className="min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Add Tournament to Watchlist</span>
            </button>
          )}
        </div>

        {/* Add/Edit Outside Tournament Form */}
        {isOfficer && showOutsideForm && (
          <form
            onSubmit={handleSaveOutsideTournament}
            className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4"
          >
            <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {editingOutside
                ? `Edit Watchlist Event: ${editingOutside.name}`
                : 'Add Tournament to Club Watchlist'}
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Tournament Name
                </label>
                <input
                  type="text"
                  value={outName}
                  onChange={(e) => setOutName(e.target.value)}
                  placeholder="e.g. Texas Pickleball Showdown"
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Dates
                </label>
                <input
                  type="text"
                  value={outDates}
                  onChange={(e) => setOutDates(e.target.value)}
                  placeholder="e.g. December 12–13, 2026"
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  City & Venue
                </label>
                <input
                  type="text"
                  value={outCityVenue}
                  onChange={(e) => setOutCityVenue(e.target.value)}
                  placeholder="e.g. Roanoke, TX · Oasis Pickleball Club"
                  required
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Divisions
                </label>
                <input
                  type="text"
                  value={outDivisions}
                  onChange={(e) => setOutDivisions(e.target.value)}
                  placeholder="e.g. Mixed Doubles Moneyball"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Entry Fee
                </label>
                <input
                  type="text"
                  value={outEntryFee}
                  onChange={(e) => setOutEntryFee(e.target.value)}
                  placeholder="e.g. $40 entry"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Prize Money / Awards
                </label>
                <input
                  type="text"
                  value={outPrizeMoney}
                  onChange={(e) => setOutPrizeMoney(e.target.value)}
                  placeholder="e.g. $2,500 Purse"
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Registration Deadline (Turns Red ≤ 7 Days)
                </label>
                <input
                  type="date"
                  value={outDeadline}
                  onChange={(e) => setOutDeadline(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Registration Link
                </label>
                <input
                  type="url"
                  value={outLink}
                  onChange={(e) => setOutLink(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Club Status
                </label>
                <select
                  value={outStatus}
                  onChange={(e) =>
                    setOutStatus(
                      e.target.value as 'Watching' | 'Registered' | 'Done'
                    )
                  }
                  className="w-full min-h-[40px] px-3 py-2 rounded-lg text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                >
                  <option value="Watching">Watching</option>
                  <option value="Registered">Registered</option>
                  <option value="Done">Done</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowOutsideForm(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-lg text-xs font-bold text-white cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                Save Tournament
              </button>
            </div>
          </form>
        )}

        {/* Outside Tournament Cards */}
        <div className="grid grid-cols-1 gap-6">
          {outsideTournaments.map((t) => {
            const daysLeft = getDaysUntil(t.registrationDeadline);
            const isDeadlineRed = daysLeft <= 7 && t.status !== 'Done';

            return (
              <div
                key={t.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xs"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-900 dark:text-white">
                        Status: {t.status}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{t.dates}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.cityVenue}</span>
                    </div>
                    <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                      {t.name}
                    </h3>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold tabular-nums ${
                        isDeadlineRed
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {isDeadlineRed && (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      )}
                      Deadline: {t.registrationDeadline} (
                      {daysLeft >= 0 ? `${daysLeft}d left` : 'Closed'})
                    </span>

                    <a
                      href={t.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[34px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center gap-1"
                    >
                      Event Page <ExternalLink className="w-3 h-3" />
                    </a>

                    {isOfficer && (
                      <>
                        <button
                          type="button"
                          onClick={() => openEditOutside(t)}
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          title="Edit tournament"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onUpdateOutsideTournaments(
                              outsideTournaments.filter((x) => x.id !== t.id)
                            )
                          }
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 cursor-pointer"
                          title="Delete tournament"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Metadata Line */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-500 block">
                      Divisions & Format
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {t.divisions}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Entry Fee</span>
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {t.entryFee}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">
                      Prize Money / Purse
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {t.prizeMoney}
                    </span>
                  </div>
                </div>

                {/* Club Members Attending & Partners */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-blue-600" />
                      Club Members Attending & Partners ({t.attendees.length}{' '}
                      Pairs)
                    </span>
                    {isOfficer && (
                      <button
                        type="button"
                        onClick={() =>
                          setAddingPairTourneyId(
                            addingPairTourneyId === t.id ? null : t.id
                          )
                        }
                        className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      >
                        + Add Club Pair
                      </button>
                    )}
                  </div>

                  {isOfficer && addingPairTourneyId === t.id && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Player 1
                        </label>
                        {members.length > 0 ? (
                          <select
                            value={pairMember1}
                            onChange={(e) => setPairMember1(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          >
                            {members.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={pairMember1}
                            onChange={(e) => setPairMember1(e.target.value)}
                            placeholder="Player 1 Name"
                            className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Partner
                        </label>
                        {members.length > 0 ? (
                          <select
                            value={pairMember2}
                            onChange={(e) => setPairMember2(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          >
                            <option value="Singles (No Partner)">
                              Singles (No Partner)
                            </option>
                            {members.map((m) => (
                              <option key={m.id} value={m.name}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={pairMember2}
                            onChange={(e) => setPairMember2(e.target.value)}
                            placeholder="Partner Name"
                            className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                          />
                        )}
                      </div>
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Division
                        </label>
                        <input
                          type="text"
                          value={pairDivision}
                          onChange={(e) => setPairDivision(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddAttendeePair(t.id)}
                        className="px-3 py-1.5 rounded text-xs font-bold text-white cursor-pointer"
                        style={{ backgroundColor: 'var(--club-primary)' }}
                      >
                        Add Entry
                      </button>
                    </div>
                  )}

                  {t.attendees.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No club pairs signed up yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {t.attendees.map((pair) => (
                        <div
                          key={pair.id}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">
                              {pair.memberName} & {pair.partnerName}
                            </div>
                            <div className="text-slate-500">
                              {pair.division}
                            </div>
                          </div>
                          {isOfficer && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveAttendeePair(t.id, pair.id)
                              }
                              className="text-slate-400 hover:text-red-500 cursor-pointer"
                              title="Remove pair"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
