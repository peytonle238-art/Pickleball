import { ClubDataState } from '../types';

export const INITIAL_CLUB_DATA: ClubDataState = {
  settings: {
    clubName: 'BNHS Pickleball Club HQ',
    schoolName: 'Byron Nelson High School',
    primaryColor: '#1d4ed8',
    secondaryColor: '#eab308',
    officerPin: '9002',
    seasonStartDate: new Date().toISOString().slice(0, 10),
    duesAmount: 25,
    recurringPractices: {
      enabled: false,
      daysOfWeek: [],
      timeRange: '3:50 PM – 5:30 PM',
      location: 'BNHS Varsity Courts',
    },
  },
  officers: [],
  tasks: [],
  members: [],
  attendance: [],
  matches: [],
  clubTournaments: [],
  outsideTournaments: [],
  events: [],
  announcements: [],
  transactions: [],
  equipment: [],
  archives: [],
};

// IDs of the original template sample records so any previously cached browser/cloud state is scrubbed clean
export const TEMPLATE_RECORD_IDS = new Set([
  'off-1',
  'off-2',
  'off-3',
  'off-4',
  'off-5',
  'off-6',
  'task-1',
  'task-2',
  'task-3',
  'task-4',
  'task-5',
  'task-6',
  'mem-1',
  'mem-2',
  'mem-3',
  'mem-4',
  'mem-5',
  'mem-6',
  'mem-7',
  'mem-8',
  'mem-9',
  'mem-10',
  'att-1',
  'att-2',
  'att-3',
  'att-4',
  'att-5',
  'match-1',
  'match-2',
  'match-3',
  'match-4',
  'match-5',
  'match-6',
  'ct-1',
  'ct-2',
  'out-1',
  'out-2',
  'out-3',
  'ev-1',
  'ev-2',
  'ev-3',
  'ev-4',
  'ev-5',
  'ann-1',
  'ann-2',
  'ann-3',
  'tx-1',
  'tx-2',
  'tx-3',
  'tx-4',
  'tx-5',
  'tx-6',
  'eq-1',
  'eq-2',
  'eq-3',
  'eq-4',
  'eq-5',
  'eq-6',
  'eq-7',
  'eq-8',
  'eq-9',
  'arch-1',
]);

export function sanitizeAndStripTemplateData(
  state: ClubDataState
): ClubDataState {
  const hadTemplateMembers =
    Array.isArray(state.members) &&
    state.members.some((m) => TEMPLATE_RECORD_IDS.has(m.id));
  const hadTemplateEvents =
    Array.isArray(state.events) &&
    state.events.some((e) => TEMPLATE_RECORD_IDS.has(e.id));

  const nextSettings = {
    ...INITIAL_CLUB_DATA.settings,
    ...(state.settings || {}),
    officerPin:
      !state.settings?.officerPin || state.settings.officerPin === '1234'
        ? '9002'
        : state.settings.officerPin,
    recurringPractices:
      hadTemplateMembers || hadTemplateEvents
        ? {
            enabled: false,
            daysOfWeek: [],
            timeRange:
              state.settings?.recurringPractices?.timeRange ||
              '3:50 PM – 5:30 PM',
            location:
              state.settings?.recurringPractices?.location ||
              'BNHS Varsity Courts',
          }
        : state.settings?.recurringPractices ||
          INITIAL_CLUB_DATA.settings.recurringPractices,
  };

  return {
    settings: nextSettings,
    officers: (state.officers || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    tasks: (state.tasks || []).filter((x) => !TEMPLATE_RECORD_IDS.has(x.id)),
    members: (state.members || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    attendance: (state.attendance || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    matches: (state.matches || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    clubTournaments: (state.clubTournaments || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    outsideTournaments: (state.outsideTournaments || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    events: (state.events || []).filter((x) => !TEMPLATE_RECORD_IDS.has(x.id)),
    announcements: (state.announcements || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    transactions: (state.transactions || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    equipment: (state.equipment || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
    archives: (state.archives || []).filter(
      (x) => !TEMPLATE_RECORD_IDS.has(x.id)
    ),
  };
}
