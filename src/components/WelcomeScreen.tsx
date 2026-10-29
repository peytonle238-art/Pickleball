import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  Award,
  Calendar,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  Hash,
  Home,
  Lock,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Trophy,
  UserCheck,
  UserPlus,
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
  icon: React.ReactNode;
}[] = [
  {
    id: 'home',
    label: 'Member Overview',
    description: 'Welcome to BNHS Pickleball Club',
    icon: <Home className="w-4 h-4" />,
  },
  {
    id: 'activity',
    label: 'My Activity',
    description: 'Your personal match history, attendance log & club tasks',
    icon: <Activity className="w-4 h-4" />,
  },
  {
    id: 'ladder',
    label: 'Standings & Stats',
    description: 'Live Elo rankings, win streaks & match history',
    icon: <Award className="w-4 h-4" />,
  },
  {
    id: 'tournaments',
    label: 'Club Tournaments',
    description: 'In-club brackets, round robins & court schedules',
    icon: <Trophy className="w-4 h-4" />,
  },
  {
    id: 'watch',
    label: 'Outside Watch',
    description: 'Regional tournaments, deadlines & club pairs',
    icon: <Eye className="w-4 h-4" />,
  },
  {
    id: 'calendar',
    label: 'Practice Calendar',
    description: 'Monthly practice schedule & club event dates',
    icon: <Calendar className="w-4 h-4" />,
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col justify-start relative overflow-x-hidden overflow-y-auto transition-colors duration-300">
      {/* Subtle Minimalist Ambient Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-10 dark:opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 0%, var(--club-primary) 0%, transparent 55%)`,
        }}
      />

      {/* Minimalist Top Bar */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-20 max-w-5xl w-full mx-auto px-6 py-5 flex items-center justify-between shrink-0"
      >
        <div className="flex items-center gap-3">
          <div className="bg-white px-2.5 py-1 rounded-xl shadow-xs border border-slate-200/80 flex items-center justify-center">
            <img
              src={BOBCATS_LOGO_URL}
              alt="Byron Nelson Bobcats"
              className="h-7 w-auto object-contain"
            />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">
            {data.settings.clubName}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setAccountTab('officer')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
              accountTab === 'officer'
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                : 'bg-white/80 dark:bg-slate-900/80 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Officer Sign In</span>
          </button>

          <button
            type="button"
            onClick={onToggleDarkMode}
            className="min-h-[38px] w-9 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Toggle theme"
          >
            {darkMode ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </motion.header>

      {/* Center Minimalist Hub */}
      <main className="relative z-20 max-w-xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-8 flex-1 flex flex-col items-center text-center space-y-6">
        {/* Official Bobcats Emblem Showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="bg-white px-6 py-4 rounded-3xl shadow-md border border-slate-200/80 flex items-center justify-center"
        >
          <img
            src={BOBCATS_LOGO_URL}
            alt="Byron Nelson Bobcats Northwest ISD"
            className="h-20 sm:h-24 w-auto object-contain"
          />
        </motion.div>

        {/* Minimalist Title & Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.06, ease: 'easeOut' }}
          className="space-y-2.5"
        >
          <div className="text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            {data.settings.schoolName}
          </div>
          <h1
            className="font-display font-bold tracking-tight text-slate-900 dark:text-white leading-none"
            style={{ fontSize: 'clamp(2.25rem, 5vw, 3.5rem)' }}
          >
            {data.settings.clubName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Continue with your School ID or add yourself to the club database to
            track your personal activity, matches, and standings.
          </p>
        </motion.div>

        {/* Unified Menu & Account Hub Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.12, ease: 'easeOut' }}
          className="w-full rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-5 shadow-lg text-left space-y-4"
        >
          {/* Member & Officer Account Access Section */}
          <div className="rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Member & Officer Sign In
              </div>
              {activeMember && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  ID: {activeMember.schoolId || activeMember.id}
                </span>
              )}
            </div>

            {/* 3-Tab Switcher: School ID Sign-In | Add Yourself | Officer Sign In */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => {
                  setAccountTab('signin');
                  setSignInFeedback(null);
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  accountTab === 'signin'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>School ID</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountTab('register');
                  setRegFeedback(null);
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  accountTab === 'register'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Yourself</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAccountTab('officer');
                  setPinError('');
                }}
                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  accountTab === 'officer'
                    ? 'bg-slate-900 text-amber-400 dark:bg-white dark:text-slate-900 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Officer</span>
              </button>
            </div>

            {/* TAB 1: SCHOOL ID SIGN IN */}
            {accountTab === 'signin' && (
              <div className="space-y-2.5">
                {activeMember ? (
                  <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        {activeMember.photoUrl ? (
                          <img
                            src={activeMember.photoUrl}
                            alt={activeMember.name}
                            className="w-10 h-10 rounded-full object-cover border-2 border-blue-500 shadow-2xs shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 border border-blue-200 dark:border-blue-700 text-xs">
                            {activeMember.name
                              .split(' ')
                              .map((n) => n[0])
                              .join('')
                              .slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {activeMember.name}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            School ID: {activeMember.schoolId || 'Linked'} ·{' '}
                            {activeMember.grade} Grade · {activeMember.elo} Elo
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onSignOutMember}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <LogOut className="w-3 h-3" />
                        <span>Switch</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => onEnterAsMember('activity')}
                      className="w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Continue to My Activity & Stats</span>
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSchoolIdSubmit} className="space-y-2">
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Enter your School ID to sign in to your member account:
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Hash className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="text"
                          value={schoolIdInput}
                          onChange={(e) => {
                            setSignInFeedback(null);
                            setSchoolIdInput(e.target.value);
                          }}
                          placeholder="Enter School ID (e.g. 204819)"
                          className="w-full h-10 pl-8 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                        />
                      </div>
                      <button
                        type="submit"
                        className="h-10 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer shrink-0 transition-colors"
                      >
                        Continue
                      </button>
                    </div>
                  </form>
                )}

                {signInFeedback && (
                  <div
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ${
                      signInFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {signInFeedback.text}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ADD YOURSELF TO CLUB DATABASE */}
            {accountTab === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Add yourself to the club database with your School ID to
                  create your personal account:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={regSchoolId}
                    onChange={(e) => {
                      setRegFeedback(null);
                      setRegSchoolId(e.target.value);
                    }}
                    placeholder="School ID (Required)"
                    className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
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
                    className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={regGrade}
                    onChange={(e) =>
                      setRegGrade(Number(e.target.value) as GradeLevel)
                    }
                    className="h-9 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  >
                    <option value={9}>9th Grade</option>
                    <option value={10}>10th Grade</option>
                    <option value={11}>11th Grade</option>
                    <option value={12}>12th Grade</option>
                  </select>
                  <select
                    value={regSkill}
                    onChange={(e) => setRegSkill(e.target.value as SkillLevel)}
                    className="h-9 px-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
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
                  className="w-full h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />

                {/* Profile Photo Upload Option */}
                <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700">
                  <div className="relative w-12 h-12 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 border border-slate-300 dark:border-slate-600">
                    {regPhoto ? (
                      <img
                        src={regPhoto}
                        alt="Profile Preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Camera className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {regPhoto ? 'Photo Added' : 'Member Profile Photo'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {photoUploading ? 'Processing image...' : 'Upload photo (Optional)'}
                    </div>
                  </div>
                  <label className="min-h-[34px] px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors hover:bg-blue-100">
                    <Camera className="w-3.5 h-3.5" />
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
                      className="text-[11px] text-slate-400 hover:text-red-500 font-semibold cursor-pointer shrink-0"
                    >
                      Remove
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="w-full h-10 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Myself & Continue</span>
                </button>
                {regFeedback && (
                  <div
                    className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg ${
                      regFeedback.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'
                    }`}
                  >
                    {regFeedback.text}
                  </div>
                )}
              </form>
            )}

            {/* TAB 3: OFFICER SIGN IN */}
            {accountTab === 'officer' && (
              <form onSubmit={handleOfficerPinSubmit} className="space-y-2.5">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Enter the 4-digit Officer access code to unlock the Officer
                  Console:
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
                    className="flex-1 h-10 text-center font-mono-num text-lg tracking-[0.4em] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                  />
                  <button
                    type="submit"
                    className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Sign In</span>
                  </button>
                </div>
                {pinError && (
                  <div className="text-[11px] font-semibold text-red-600 dark:text-red-400">
                    {pinError}
                  </div>
                )}
              </form>
            )}
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <span className="font-semibold text-slate-500 dark:text-slate-400">
              Select Destination
            </span>
            <span className="text-slate-400 dark:text-slate-500 font-mono-num">
              {hasScheduledEvents
                ? `Next Event: ${days}d ${hours}h ${minutes}m`
                : `${data.members.length} Members`}
            </span>
          </div>

          {/* Interactive Everything Dropdown with Bobcats Image */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="w-full min-h-[56px] px-4 py-3 rounded-2xl bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/70 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between gap-3 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                  {activeDestObj.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeDestObj.label}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {activeDestObj.description}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
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
                  <motion.div
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="absolute left-0 right-0 mt-2 z-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden p-2 space-y-1.5"
                  >
                    {/* Dropdown Menu Header with Bobcats Image */}
                    <div className="px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <div className="bg-white px-2 py-1 rounded-lg border border-slate-200/80">
                          <img
                            src={BOBCATS_LOGO_URL}
                            alt="Bobcats Logo"
                            className="h-5 w-auto object-contain"
                          />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            Club Navigation Menu
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Activity, Standings, Tournaments & Calendar
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1 pt-1">
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
                            className={`w-full px-3 py-2.5 rounded-xl text-left transition-colors flex items-center justify-between gap-3 cursor-pointer ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <span
                                className={
                                  isSelected
                                    ? 'text-white'
                                    : 'text-blue-600 dark:text-blue-400'
                                }
                              >
                                {opt.icon}
                              </span>
                              <div className="min-w-0">
                                <div className="text-xs font-bold truncate">
                                  {opt.label}
                                </div>
                                <div
                                  className={`text-[11px] truncate ${
                                    isSelected
                                      ? 'text-blue-100'
                                      : 'text-slate-500 dark:text-slate-400'
                                  }`}
                                >
                                  {opt.description}
                                </div>
                              </div>
                            </div>
                            <ArrowRight
                              className={`w-3.5 h-3.5 shrink-0 ${
                                isSelected ? 'text-white' : 'text-slate-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          {/* Primary Launch Button */}
          <motion.button
            whileTap={{ scale: 0.985 }}
            type="button"
            onClick={() => onEnterAsMember(selectedDestination)}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-xs cursor-pointer transition-opacity hover:opacity-95"
            style={{ backgroundColor: 'var(--club-primary)' }}
          >
            <span>Open {activeDestObj.label}</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>

          {/* Minimalist 1-Tap Quick Pills for My Activity, Stats, Tournaments */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => onEnterAsMember('activity')}
              className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>My Activity</span>
            </button>
            <button
              type="button"
              onClick={() => onEnterAsMember('ladder')}
              className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Award className="w-3.5 h-3.5 text-amber-500" />
              <span>Stats</span>
            </button>
            <button
              type="button"
              onClick={() => onEnterAsMember('calendar')}
              className="py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Calendar</span>
            </button>
          </div>
        </motion.div>
      </main>

      {/* Minimalist Footer */}
      <footer className="relative z-20 max-w-5xl w-full mx-auto px-6 py-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-400 dark:text-slate-500">
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {hasScheduledEvents
            ? `Next: ${nextEvent.title} (${nextEvent.date})`
            : `${data.settings.schoolName} · ${data.settings.clubName}`}
        </span>
      </footer>
    </div>
  );
};
