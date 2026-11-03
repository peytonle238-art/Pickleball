import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ChevronDown,
  Moon,
  Sun,
} from 'lucide-react';
import {
  ClubDataState,
  GradeLevel,
  Member,
  NavTab,
  SkillLevel,
} from '../types';
import { getNextUpcomingEvent, processImageFileToDataUrl } from '../utils/clubUtils';

export const BOBCATS_LOGO_URL = '/assets/aistudio/images_25669a2b.png';

interface WelcomeScreenProps {
  data: ClubDataState;
  darkMode: boolean;
  linkedMemberId: string;
  onToggleDarkMode: () => void;
  onEnterAsMember: (targetTab: NavTab) => void;
  onEnterAsOfficer: (pin: string, targetTab: NavTab) => boolean;
  onSignInBySchoolId: (
    schoolId: string
  ) => Promise<Member | null> | Member | null;
  onRegisterMember: (payload: {
    schoolId: string;
    name: string;
    grade: GradeLevel;
    skillLevel: SkillLevel;
    paddleNotes?: string;
    photoUrl?: string;
  }) => Member;
  onSignOutMember: () => void;
}

const MEMBER_DESTINATIONS: {
  id: NavTab;
  label: string;
  description: string;
}[] = [
  {
    id: 'home',
    label: 'Member Overview',
    description: 'Welcome to BNHS Pickleball Club',
  },
  {
    id: 'activity',
    label: 'My Activity',
    description: 'Your personal match history, attendance log & club tasks',
  },
  {
    id: 'ladder',
    label: 'Standings & Stats',
    description: 'Live Elo rankings, win streaks & match history',
  },
  {
    id: 'tournaments',
    label: 'Club Tournaments',
    description: 'In-club brackets, round robins & court schedules',
  },
  {
    id: 'watch',
    label: 'Outside Watch',
    description: 'Regional tournaments, deadlines & club pairs',
  },
  {
    id: 'calendar',
    label: 'Practice Calendar',
    description: 'Monthly practice schedule & club event dates',
  },
];

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  data,
  darkMode,
  linkedMemberId,
  onToggleDarkMode,
  onEnterAsMember,
  onEnterAsOfficer,
  onSignInBySchoolId,
  onRegisterMember,
  onSignOutMember,
}) => {
  const [selectedDestination, setSelectedDestination] =
    useState<NavTab>('home');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [accountTab, setAccountTab] = useState<
    'signin' | 'register' | 'officer'
  >('signin');

  // School ID Sign-In state
  const [schoolIdInput, setSchoolIdInput] = useState('');
  const [signInFeedback, setSignInFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Add Yourself to Database state
  const [regSchoolId, setRegSchoolId] = useState('');
  const [regName, setRegName] = useState('');
  const [regGrade, setRegGrade] = useState<GradeLevel>(10);
  const [regSkill, setRegSkill] = useState<SkillLevel>('Intermediate');
  const [regNotes, setRegNotes] = useState('');
  const [regPhoto, setRegPhoto] = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [regFeedback, setRegFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Officer PIN unlock state (zero hints)
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // Live clock for footer
  const [now, setNow] = useState<Date>(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const activeMember =
    data.members.find(
      (m) =>
        m.id === linkedMemberId ||
        (m.schoolId &&
          m.schoolId.trim().toLowerCase() ===
            linkedMemberId.trim().toLowerCase())
    ) || null;

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

  const activeDestObj =
    MEMBER_DESTINATIONS.find((d) => d.id === selectedDestination) ||
    MEMBER_DESTINATIONS[0];

  const handleSchoolIdSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = schoolIdInput.trim();
    if (!cleaned) {
      setSignInFeedback({
        type: 'error',
        text: 'Please enter your School ID to continue.',
      });
      return;
    }
    const found = await onSignInBySchoolId(cleaned);
    if (found) {
      setSignInFeedback({
        type: 'success',
        text: `Signed in as ${found.name} (ID: ${found.schoolId || found.id})`,
      });
      setSchoolIdInput('');
      onEnterAsMember('activity');
    } else {
      setSignInFeedback({
        type: 'error',
        text: 'No member found with that School ID. Switch to "Add Yourself" to register.',
      });
    }
  };

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = regSchoolId.trim();
    const cleanName = regName.trim();
    if (!cleanId || !cleanName) {
      setRegFeedback({
        type: 'error',
        text: 'Please enter both your School ID and full name.',
      });
      return;
    }
    const created = onRegisterMember({
      schoolId: cleanId,
      name: cleanName,
      grade: regGrade,
      skillLevel: regSkill,
      paddleNotes: regNotes.trim(),
      photoUrl: regPhoto,
    });
    setRegFeedback({
      type: 'success',
      text: `Account ready for ${created.name} (ID: ${created.schoolId})!`,
    });
    setRegSchoolId('');
    setRegName('');
    setRegNotes('');
    setRegPhoto('');
    onEnterAsMember('activity');
  };

  const handleOfficerPinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = onEnterAsOfficer(pinInput, selectedDestination);
    if (!ok) {
      setPinError('Invalid access code.');
      setPinInput('');
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col justify-between overflow-x-hidden overflow-y-auto transition-colors duration-200">
      {/* Top Varsity Masthead Bar */}
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={BOBCATS_LOGO_URL}
              alt="Byron Nelson Bobcats"
              className="h-8 w-auto object-contain"
            />
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800" />
            <span className="font-display text-lg font-bold tracking-tight uppercase">
              {data.settings.clubName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAccountTab('officer')}
              className={`min-h-[36px] px-3.5 py-1.5 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                accountTab === 'officer'
                  ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-950 dark:border-white'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              Officer Sign In
            </button>

            <button
              type="button"
              onClick={onToggleDarkMode}
              className="min-h-[36px] w-9 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Varsity Editorial Split Layout */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-14 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
          {/* Left Column: Editorial Masthead & Identity */}
          <div className="lg:col-span-6 space-y-6 pt-2">
            <div className="inline-flex items-center gap-3">
              <div className="bg-white p-2.5 rounded-md border border-slate-200 dark:border-slate-800">
                <img
                  src={BOBCATS_LOGO_URL}
                  alt="Byron Nelson Bobcats Northwest ISD"
                  className="h-14 sm:h-16 w-auto object-contain"
                />
              </div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                <div>{data.settings.schoolName}</div>
                <div className="font-mono-num text-slate-900 dark:text-white font-bold mt-0.5">
                  {data.members.length} Active Roster Athletes · {data.matches.length} Matches Logged
                </div>
              </div>
            </div>

            <div className="space-y-3 border-t border-slate-200 dark:border-slate-800 pt-5">
              <h1
                className="font-display font-bold tracking-tight text-slate-900 dark:text-white uppercase leading-[0.95]"
                style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)' }}
              >
                {data.settings.clubName}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-md">
                Official varsity & club athlete portal. Sign in with your School ID or register on the club roster to track matches, Elo standings, and practice attendance.
              </p>
            </div>

            {/* Quick Navigation Links */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Direct Portal Sections
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => onEnterAsMember('activity')}
                  className="py-2.5 px-3 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 text-left transition-colors cursor-pointer"
                >
                  My Activity
                </button>
                <button
                  type="button"
                  onClick={() => onEnterAsMember('ladder')}
                  className="py-2.5 px-3 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 text-left transition-colors cursor-pointer"
                >
                  Elo Standings
                </button>
                <button
                  type="button"
                  onClick={() => onEnterAsMember('calendar')}
                  className="py-2.5 px-3 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200 text-left transition-colors cursor-pointer"
                >
                  Calendar
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Flat Single-Elevation Roster Access & Portal Entry */}
          <div className="lg:col-span-6 w-full rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 text-left space-y-5">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="font-display text-lg font-bold uppercase tracking-tight text-slate-900 dark:text-white">
                Athlete & Officer Access
              </div>
              {activeMember && (
                <span className="font-mono-num text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                  ID {activeMember.schoolId || activeMember.id}
                </span>
              )}
            </div>

            {/* 3-Tab Switcher: School ID | Add Yourself | Officer */}
            <div className="grid grid-cols-3 border-b border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAccountTab('signin');
                  setSignInFeedback(null);
                }}
                className={`py-2.5 px-2 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                  accountTab === 'signin'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                School ID
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountTab('register');
                  setRegFeedback(null);
                }}
                className={`py-2.5 px-2 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                  accountTab === 'register'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Add Yourself
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountTab('officer');
                  setPinError('');
                }}
                className={`py-2.5 px-2 text-xs font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                  accountTab === 'officer'
                    ? 'border-slate-900 text-slate-900 dark:border-amber-400 dark:text-amber-400'
                    : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Officer
              </button>
            </div>

            {/* TAB 1: SCHOOL ID SIGN IN */}
            {accountTab === 'signin' && (
              <div className="space-y-3">
                {activeMember ? (
                  <div className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {activeMember.photoUrl ? (
                          <img
                            src={activeMember.photoUrl}
                            alt={activeMember.name}
                            className="w-10 h-10 rounded-md object-cover border border-slate-300 dark:border-slate-700 shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 text-xs">
                            {activeMember.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {activeMember.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-num">
                            ID {activeMember.schoolId || 'Linked'} · Grade {activeMember.grade} · {activeMember.elo} Elo
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onSignOutMember}
                        className="px-2.5 py-1.5 rounded-md bg-white hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer shrink-0"
                      >
                        Switch
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEnterAsMember('activity')}
                      className="w-full py-2.5 px-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-colors"
                    >
                      Continue to My Activity & Stats
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSchoolIdSubmit} className="space-y-2.5">
                    <label className="block text-xs text-slate-600 dark:text-slate-400">
                      Enter your School ID to load your member profile:
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={schoolIdInput}
                        onChange={(e) => {
                          setSignInFeedback(null);
                          setSchoolIdInput(e.target.value);
                        }}
                        placeholder="School ID (e.g. 204819)"
                        className="flex-1 h-10 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono-num text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                      />
                      <button
                        type="submit"
                        className="h-10 px-4 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shrink-0 transition-colors"
                      >
                        Sign In
                      </button>
                    </div>
                  </form>
                )}

                {signInFeedback && (
                  <div
                    className={`text-xs font-medium px-3 py-2 rounded-md border ${
                      signInFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {signInFeedback.text}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ADD YOURSELF TO CLUB DATABASE */}
            {accountTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Register your School ID on the club roster to track matches and standings across all devices:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <input
                    type="text"
                    required
                    value={regSchoolId}
                    onChange={(e) => {
                      setRegFeedback(null);
                      setRegSchoolId(e.target.value);
                    }}
                    placeholder="School ID (Required)"
                    className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs font-mono-num text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  />
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => {
                      setRegFeedback(null);
                      setRegName(e.target.value);
                    }}
                    placeholder="Full Name (First & Last)"
                    className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={regGrade}
                    onChange={(e) =>
                      setRegGrade(Number(e.target.value) as GradeLevel)
                    }
                    className="h-9 px-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  >
                    <option value={9}>9th Grade</option>
                    <option value={10}>10th Grade</option>
                    <option value={11}>11th Grade</option>
                    <option value={12}>12th Grade</option>
                  </select>
                  <select
                    value={regSkill}
                    onChange={(e) => setRegSkill(e.target.value as SkillLevel)}
                    className="h-9 px-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  >
                    <option value="Beginner">Beginner</option>
                    <option value="Intermediate">Intermediate</option>
                    <option value="Advanced">Advanced</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={regNotes}
                  onChange={(e) => setRegNotes(e.target.value)}
                  placeholder="Paddle / Preferred Partner (Optional)"
                  className="w-full h-9 px-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />

                {/* Profile Photo Upload Option */}
                <div className="flex items-center gap-3 p-2.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <div className="relative w-10 h-10 rounded-md overflow-hidden bg-slate-200 dark:bg-slate-800 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-700 text-[10px] font-bold text-slate-500">
                    {regPhoto ? (
                      <img
                        src={regPhoto}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>IMG</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {regPhoto ? 'Photo Added' : 'Athlete Photo'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {photoUploading ? 'Processing image...' : 'Optional roster picture'}
                    </div>
                  </div>
                  <label className="min-h-[32px] px-3 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center cursor-pointer shrink-0 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                    <span>{regPhoto ? 'Change' : 'Upload'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          try {
                            setPhotoUploading(true);
                            const dataUrl = await processImageFileToDataUrl(file);
                            setRegPhoto(dataUrl);
                          } catch (err) {
                            console.error('Error processing image:', err);
                          } finally {
                            setPhotoUploading(false);
                          }
                        }
                      }}
                    />
                  </label>
                  {regPhoto && (
                    <button
                      type="button"
                      onClick={() => setRegPhoto('')}
                      className="text-xs text-slate-400 hover:text-red-600 font-semibold cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full h-10 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer transition-colors"
                >
                  Add Myself & Continue
                </button>
                {regFeedback && (
                  <div
                    className={`text-xs font-medium px-3 py-2 rounded-md border ${
                      regFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}
                  >
                    {regFeedback.text}
                  </div>
                )}
              </form>
            )}

            {/* TAB 3: OFFICER SIGN IN */}
            {accountTab === 'officer' && (
              <form onSubmit={handleOfficerPinSubmit} className="space-y-3">
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Enter your 4-digit Officer PIN or President Password:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => {
                      setPinError('');
                      setPinInput(
                        e.target.value.replace(/\D/g, '').slice(0, 4)
                      );
                    }}
                    placeholder="••••"
                    className="flex-1 h-10 text-center font-mono-num text-lg tracking-[0.4em] rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-md bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 text-xs font-bold cursor-pointer shrink-0"
                  >
                    Unlock
                  </button>
                </div>
                {pinError && (
                  <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                    {pinError}
                  </div>
                )}
              </form>
            )}

            {/* Destination Selector */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-600 dark:text-slate-400">
                  Portal Destination
                </span>
                <span className="text-slate-500 font-mono-num">
                  {hasScheduledEvents
                    ? `Next Session: ${days}d ${hours}h ${minutes}m`
                    : `${data.members.length} Members`}
                </span>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full px-3.5 py-2.5 rounded-md bg-slate-50 hover:bg-slate-100 dark:bg-slate-950 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 transition-colors cursor-pointer"
                >
                  <div className="min-w-0 text-left">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {activeDestObj.label}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {activeDestObj.description}
                    </div>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-150 ${
                      dropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {dropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setDropdownOpen(false)}
                      />
                      <div className="absolute left-0 right-0 mt-1 z-40 rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
                        {MEMBER_DESTINATIONS.map((opt) => {
                          const isSelected = opt.id === selectedDestination;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => {
                                setSelectedDestination(opt.id);
                                setDropdownOpen(false);
                              }}
                              className={`w-full px-3.5 py-2.5 text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                                isSelected
                                  ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate">
                                  {opt.label}
                                </div>
                                <div
                                  className={`text-[11px] truncate ${
                                    isSelected
                                      ? 'text-slate-300 dark:text-slate-600'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {opt.description}
                                </div>
                              </div>
                              <ArrowRight className="w-3.5 h-3.5 shrink-0 opacity-60" />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </AnimatePresence>
              </div>

              <button
                type="button"
                onClick={() => onEnterAsMember(selectedDestination)}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-md font-bold text-xs uppercase tracking-wider text-white flex items-center justify-center gap-2 cursor-pointer transition-opacity hover:opacity-95"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                <span>Enter {activeDestObj.label}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Hairline Footer */}
      <footer className="w-full border-t border-slate-200 dark:border-slate-800 py-4 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-5xl w-full mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>
            {data.settings.schoolName} · {data.settings.clubName}
          </span>
          <span className="font-mono-num">
            {hasScheduledEvents
              ? `Next Session: ${nextEvent.title} · ${nextEvent.date}`
              : 'Official Club Standings & Operations'}
          </span>
        </div>
      </footer>
    </div>
  );
};
