export type OfficerRole =
  | 'President'
  | 'Vice President'
  | 'Secretary'
  | 'Treasurer'
  | 'Events Coordinator'
  | 'Social Media';

export type GradeLevel = 9 | 10 | 11 | 12;

export type SkillLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface ClubSettings {
  clubName: string;
  schoolName: string;
  primaryColor: string;
  secondaryColor: string;
  officerPin: string;
  seasonStartDate: string;
  duesAmount: number;
  recurringPractices: {
    enabled: boolean;
    daysOfWeek: number[]; // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    timeRange: string;
    location: string;
  };
}

export interface Officer {
  id: string;
  name: string;
  role: OfficerRole;
  grade: GradeLevel;
  contact: string;
  bio?: string;
}

export type TaskStatus = 'To Do' | 'In Progress' | 'Done';

export interface OfficerTask {
  id: string;
  title: string;
  status: TaskStatus;
  assignee: string;
  dueDate: string;
  category: string;
}

export interface Member {
  id: string;
  schoolId?: string;
  photoUrl?: string;
  name: string;
  grade: GradeLevel;
  skillLevel: SkillLevel;
  duprRating?: string;
  paddleNotes: string;
  joinDate: string;
  elo: number;
  monthStartElo: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  streak: number;
  duesPaid: boolean;
  duesAmount: number;
  duesPaidDate?: string;
}

export interface AttendanceSession {
  id: string;
  date: string;
  title: string;
  presentMemberIds: string[];
}

export interface GameScore {
  team1Score: number;
  team2Score: number;
}

export interface MatchRecord {
  id: string;
  date: string;
  format: 'singles' | 'doubles';
  scoringType: 'sideout' | 'rally';
  targetScore: 11 | 15 | 21;
  bestOf: 1 | 3;
  team1Ids: string[];
  team2Ids: string[];
  games: GameScore[];
  winnerTeam: 1 | 2;
  eloDelta: number;
  tournamentId?: string;
  tournamentMatchId?: string;
}

export interface ClubTournamentParticipant {
  id: string;
  name: string;
  playerIds: string[];
}

export interface ClubTournamentMatch {
  id: string;
  round: number;
  roundLabel: string;
  court: string;
  team1Id: string | null;
  team2Id: string | null;
  team1Name: string;
  team2Name: string;
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  score1: number | null;
  score2: number | null;
  winner: 1 | 2 | null;
  nextMatchId?: string;
  nextMatchSlot?: 1 | 2;
}

export interface ClubTournament {
  id: string;
  name: string;
  date: string;
  format: 'round_robin' | 'single_elimination';
  playStyle: 'singles' | 'doubles';
  status: 'Active' | 'Completed';
  participants: ClubTournamentParticipant[];
  matches: ClubTournamentMatch[];
}

export interface OutsideTournamentAttendee {
  id: string;
  memberName: string;
  partnerName: string;
  division: string;
}

export interface OutsideTournament {
  id: string;
  name: string;
  dates: string;
  startDateISO: string;
  cityVenue: string;
  divisions: string;
  entryFee: string;
  prizeMoney: string;
  registrationDeadline: string;
  link: string;
  status: 'Watching' | 'Registered' | 'Done';
  attendees: OutsideTournamentAttendee[];
}

export type EventCategory = 'Practice' | 'Meeting' | 'Tournament' | 'Social';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  type: EventCategory;
  description: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  authorRole: string;
  date: string;
  pinned: boolean;
}

export type TreasuryCategory =
  | 'Fundraiser'
  | 'Dues'
  | 'Balls'
  | 'Paddles'
  | 'Shirts'
  | 'Tournament'
  | 'Other';

export interface TreasuryTransaction {
  id: string;
  date: string;
  description: string;
  category: TreasuryCategory;
  type: 'income' | 'expense';
  amount: number;
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: 'Paddle' | 'Balls' | 'Net';
  code: string;
  condition: 'Mint' | 'Good' | 'Fair';
  checkedOutToMemberId: string | null;
  checkedOutDate: string | null;
  notes: string;
}

export interface SeasonArchive {
  id: string;
  seasonName: string;
  startDate: string;
  endDate: string;
  topPlayers: {
    name: string;
    elo: number;
    wins: number;
    losses: number;
  }[];
  totalMatches: number;
}

export interface ClubDataState {
  settings: ClubSettings;
  officers: Officer[];
  tasks: OfficerTask[];
  members: Member[];
  attendance: AttendanceSession[];
  matches: MatchRecord[];
  clubTournaments: ClubTournament[];
  outsideTournaments: OutsideTournament[];
  events: CalendarEvent[];
  announcements: Announcement[];
  transactions: TreasuryTransaction[];
  equipment: EquipmentItem[];
  archives: SeasonArchive[];
}

export type NavTab =
  | 'home'
  | 'activity'
  | 'scorekeeper'
  | 'ladder'
  | 'members'
  | 'tournaments'
  | 'watch'
  | 'calendar'
  | 'officers'
  | 'announcements'
  | 'treasury'
  | 'equipment'
  | 'settings';

export interface PendingTournamentScoreContext {
  tournamentId: string;
  matchId: string;
  playStyle: 'singles' | 'doubles';
  team1PlayerIds: string[];
  team2PlayerIds: string[];
  label: string;
}
