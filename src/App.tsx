import React, { useEffect, useState } from 'react';
import {
  Award,
  Calendar,
  Download,
  Home,
  Lock,
  Megaphone,
  Menu,
  Moon,
  Package,
  Play,
  Settings,
  ShieldCheck,
  Sun,
  Trophy,
  Unlock,
  Upload,
  Users,
  Wallet,
  X,
  Eye,
} from 'lucide-react';
import {
  ClubDataState,
  MatchRecord,
  NavTab,
  PendingTournamentScoreContext,
  SeasonArchive,
} from './types';
import { INITIAL_CLUB_DATA } from './data/initialData';
import {
  applyMatchToMembers,
  updateTournamentMatchList,
} from './utils/clubUtils';
import { HomeDashboard } from './components/HomeDashboard';
import { LiveScoreKeeper } from './components/LiveScoreKeeper';
import { MembersAttendanceView } from './components/MembersAttendanceView';
import { LadderStatsView } from './components/LadderStatsView';
import { TournamentsView } from './components/TournamentsView';
import { OfficersTasksView } from './components/OfficersTasksView';
import { CalendarEventsView } from './components/CalendarEventsView';
import {
  AnnouncementsView,
  EquipmentView,
  SettingsView,
  TreasuryView,
} from './components/ManagementViews';

const STORAGE_KEY = 'bnhs_pickleball_hq_v1';
const THEME_KEY = 'bnhs_pickleball_theme_v1';

export default function App() {
  const [data, setData] = useState<ClubDataState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.members && parsed.settings) {
          return parsed;
        }
      }
    } catch {
      // Fallback to initial data
    }
    return INITIAL_CLUB_DATA;
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem(THEME_KEY) === 'dark';
    } catch {
      return false;
    }
  });

  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isOfficer, setIsOfficer] = useState<boolean>(false);

  // Officer 4-Digit PIN Modal state
  const [showPinModal, setShowPinModal] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Mobile Menu Drawer state
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState<boolean>(false);

  // Context when launching Live Score Keeper from a Club Tournament bracket match
  const [pendingTournamentMatch, setPendingTournamentMatch] =
    useState<PendingTournamentScoreContext | null>(null);

  // Toast status message for Export / Import / Actions
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3000);
  };

  // Persist data to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // Ignore quota errors
    }
  }, [data]);

  // Apply school colors to CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      '--club-primary',
      data.settings.primaryColor || '#1d4ed8'
    );
    root.style.setProperty(
      '--club-secondary',
      data.settings.secondaryColor || '#eab308'
    );
  }, [data.settings.primaryColor, data.settings.secondaryColor]);

  // Apply Dark Mode class
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem(THEME_KEY, 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem(THEME_KEY, 'light');
    }
  }, [darkMode]);

  // Handle Officer PIN Verification
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinInput === data.settings.officerPin) {
      setIsOfficer(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      showToast('Officer Mode unlocked (Full Edit Access)');
    } else {
      setPinError('Incorrect 4-digit PIN. Default PIN is 1234.');
    }
  };

  const handleToggleMode = () => {
    if (isOfficer) {
      setIsOfficer(false);
      showToast('Switched to Member Mode (View Only)');
    } else {
      setPinInput('');
      setPinError('');
      setShowPinModal(true);
    }
  };

  // Save completed match from LiveScoreKeeper or Manual Entry
  const handleSaveCompletedMatch = (newMatch: MatchRecord) => {
    const updatedMembers = applyMatchToMembers(
      data.members,
      newMatch.team1Ids,
      newMatch.team2Ids,
      newMatch.games,
      newMatch.winnerTeam,
      newMatch.eloDelta
    );

    let updatedClubTournaments = data.clubTournaments;
    if (newMatch.tournamentId && newMatch.tournamentMatchId) {
      const lastGame = newMatch.games[newMatch.games.length - 1] || {
        team1Score: 11,
        team2Score: 0,
      };
      updatedClubTournaments = data.clubTournaments.map((t) => {
        if (t.id !== newMatch.tournamentId) return t;
        const nextMatches = updateTournamentMatchList(
          t.matches,
          newMatch.tournamentMatchId!,
          lastGame.team1Score,
          lastGame.team2Score
        );
        return {
          ...t,
          matches: nextMatches,
          status: nextMatches.every((m) => m.winner !== null)
            ? 'Completed'
            : 'Active',
        };
      });
    }

    setData((prev) => ({
      ...prev,
      members: updatedMembers,
      matches: [newMatch, ...prev.matches],
      clubTournaments: updatedClubTournaments,
    }));
    showToast('Match saved! Club Ladder & Elo ratings updated.');
  };

  const handleDeleteMatch = (matchId: string) => {
    setData((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.id !== matchId),
    }));
    showToast('Match removed from history.');
  };

  // JSON Export Backup
  const handleExportJSON = () => {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `bnhs-pickleball-hq-backup-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Club JSON backup exported!');
  };

  // JSON Import Restore
  const handleImportJSON = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(String(event.target?.result || ''));
        if (
          parsed &&
          Array.isArray(parsed.members) &&
          Array.isArray(parsed.officers) &&
          parsed.settings
        ) {
          setData(parsed);
          showToast('Club data successfully restored from JSON backup!');
        } else {
          showToast('Invalid JSON backup file format.');
        }
      } catch {
        showToast('Could not parse JSON file.');
      }
    };
    reader.readAsText(file);
  };

  // Reset Season & Archive Stats
  const handleResetAndArchiveSeason = (seasonLabel: string) => {
    const top3 = [...data.members]
      .sort((a, b) => b.elo - a.elo)
      .slice(0, 3)
      .map((m) => ({
        name: m.name,
        elo: m.elo,
        wins: m.wins,
        losses: m.losses,
      }));

    const archiveEntry: SeasonArchive = {
      id: `arch-${Date.now()}`,
      seasonName: seasonLabel.trim() || 'Archived Season',
      startDate: data.settings.seasonStartDate,
      endDate: new Date().toISOString().slice(0, 10),
      totalMatches: data.matches.length,
      topPlayers: top3,
    };

    const resetMembers = data.members.map((m) => ({
      ...m,
      elo: 1200,
      monthStartElo: 1200,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      streak: 0,
    }));

    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        seasonStartDate: new Date().toISOString().slice(0, 10),
      },
      members: resetMembers,
      matches: [],
      archives: [archiveEntry, ...prev.archives],
    }));

    showToast(`Season archived as "${archiveEntry.seasonName}" & stats reset!`);
  };

  const sidebarItems: { id: NavTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home Dashboard', icon: <Home className="w-4 h-4" /> },
    {
      id: 'scorekeeper',
      label: 'Live Score Keeper',
      icon: <Play className="w-4 h-4" />,
    },
    {
      id: 'ladder',
      label: 'Ladder & Stats',
      icon: <Award className="w-4 h-4" />,
    },
    {
      id: 'members',
      label: 'Members & Attendance',
      icon: <Users className="w-4 h-4" />,
    },
    {
      id: 'tournaments',
      label: 'Club Tournaments',
      icon: <Trophy className="w-4 h-4" />,
    },
    {
      id: 'watch',
      label: 'Tournament Watch',
      icon: <Eye className="w-4 h-4" />,
    },
    {
      id: 'calendar',
      label: 'Calendar & Events',
      icon: <Calendar className="w-4 h-4" />,
    },
    {
      id: 'officers',
      label: 'Officers & Tasks',
      icon: <ShieldCheck className="w-4 h-4" />,
    },
    {
      id: 'announcements',
      label: 'Announcements',
      icon: <Megaphone className="w-4 h-4" />,
    },
    { id: 'treasury', label: 'Treasury & Dues', icon: <Wallet className="w-4 h-4" /> },
    {
      id: 'equipment',
      label: 'Equipment Locker',
      icon: <Package className="w-4 h-4" />,
    },
    { id: 'settings', label: 'Settings & Backup', icon: <Settings className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* ================================================================= */}
      {/* TOP BAR CONTRACT: 3-Zone Header                                   */}
      {/* Zone 1: Single-line Brand Wordmark                                */}
      {/* Zone 2: 5 concise single-line nav links                           */}
      {/* Zone 3: 1 primary action button                                   */}
      {/* ================================================================= */}
      <header className="sticky top-0 z-30 h-14 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 sm:px-6 flex items-center justify-between gap-8 no-print">
        {/* Zone 1: Brand Title (Single text element wordmark) */}
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('home');
          }}
          className="font-display text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
        >
          {data.settings.clubName}
        </a>

        {/* Zone 2: 5 Concise Single-Line Navigation Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <button
            onClick={() => setActiveTab('home')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'home'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab('scorekeeper')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'scorekeeper'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            Score Keeper
          </button>
          <button
            onClick={() => setActiveTab('ladder')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'ladder'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            Ladder
          </button>
          <button
            onClick={() => setActiveTab('tournaments')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'tournaments' || activeTab === 'watch'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            Tournaments
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'members'
                ? 'text-slate-900 dark:text-white font-semibold underline underline-offset-8'
                : ''
            }`}
          >
            Roster
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={handleToggleMode}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 cursor-pointer ${
              isOfficer
                ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900'
            }`}
          >
            {isOfficer ? (
              <>
                <Unlock className="w-3.5 h-3.5" />
                Officer Mode (Edit)
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                Member Mode (Unlock PIN)
              </>
            )}
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* WORKSPACE CANVAS: Desktop Sidebar + Main Viewport                 */}
      {/* ================================================================= */}
      <div className="flex-1 max-w-[1440px] w-full mx-auto flex">
        {/* Desktop Sidebar Navigation (250px) */}
        <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 p-4 no-print">
          <div className="space-y-1">
            <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
              {data.settings.schoolName}
            </div>
            {sidebarItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  style={
                    active
                      ? { backgroundColor: 'var(--club-primary)' }
                      : undefined
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* Sidebar Bottom Backup & Theme Controls */}
          <div className="pt-4 mt-6 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleExportJSON}
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                title="Export all club data as JSON"
              >
                <Download className="w-3.5 h-3.5" />
                Export
              </button>

              <label
                className="min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
                title="Import club JSON backup"
              >
                <Upload className="w-3.5 h-3.5" />
                Import
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportJSON(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-full min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {darkMode ? (
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
                {darkMode ? 'Light Court Theme' : 'Dark Court Theme'}
              </span>
              <span className="text-[11px] text-slate-400">Toggle</span>
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-12 space-y-6">
          {/* Workspace Utility Strip (Mode status, JSON Export/Import, Dark Mode toggle) */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800 no-print">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: 'var(--club-primary)' }}
              />
              <span
                className="w-3 h-3 rounded-sm shrink-0"
                style={{ backgroundColor: 'var(--club-secondary)' }}
              />
              <span className="font-semibold text-slate-900 dark:text-white">
                {data.settings.schoolName}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Access:{' '}
                <strong className="text-slate-900 dark:text-white">
                  {isOfficer
                    ? 'Officer Mode (Full Edit Unlocked)'
                    : 'Member Mode (View Only)'}
                </strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handleExportJSON}
                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Export JSON
              </button>

              <label className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" />
                Import JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleImportJSON(file);
                  }}
                  className="hidden"
                />
              </label>

              <button
                onClick={() => setDarkMode(!darkMode)}
                className="min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
                aria-label="Toggle Dark Mode"
              >
                {darkMode ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    Light
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5" />
                    Dark
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Toast Feedback Banner */}
          {toastMessage && (
            <div className="rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2.5 text-xs font-semibold flex items-center justify-between shadow-sm">
              <span>{toastMessage}</span>
              <button
                onClick={() => setToastMessage(null)}
                className="text-xs opacity-75 hover:opacity-100 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Active View Router */}
          {activeTab === 'home' && (
            <HomeDashboard
              data={data}
              isOfficer={isOfficer}
              onNavigate={(tab) => setActiveTab(tab)}
              onQuickAddAnnouncement={() => {
                if (!isOfficer) {
                  setShowPinModal(true);
                } else {
                  setActiveTab('announcements');
                }
              }}
            />
          )}

          {activeTab === 'scorekeeper' && (
            <LiveScoreKeeper
              members={data.members}
              pendingTournamentMatch={pendingTournamentMatch}
              onClearPendingTournamentMatch={() =>
                setPendingTournamentMatch(null)
              }
              onSaveCompletedMatch={handleSaveCompletedMatch}
              onNavigateToLadder={() => setActiveTab('ladder')}
            />
          )}

          {activeTab === 'ladder' && (
            <LadderStatsView
              members={data.members}
              matches={data.matches}
              isOfficer={isOfficer}
              onSaveManualMatch={handleSaveCompletedMatch}
              onDeleteMatch={handleDeleteMatch}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {activeTab === 'members' && (
            <MembersAttendanceView
              members={data.members}
              attendance={data.attendance}
              isOfficer={isOfficer}
              onUpdateMembers={(members) =>
                setData((prev) => ({ ...prev, members }))
              }
              onUpdateAttendance={(attendance) =>
                setData((prev) => ({ ...prev, attendance }))
              }
              onRequestOfficerUnlock={() => setShowPinModal(true)}
            />
          )}

          {(activeTab === 'tournaments' || activeTab === 'watch') && (
            <TournamentsView
              activeSubTab={activeTab}
              onSwitchSubTab={(sub) => setActiveTab(sub)}
              clubTournaments={data.clubTournaments}
              outsideTournaments={data.outsideTournaments}
              members={data.members}
              isOfficer={isOfficer}
              onUpdateClubTournaments={(clubTournaments) =>
                setData((prev) => ({ ...prev, clubTournaments }))
              }
              onUpdateOutsideTournaments={(outsideTournaments) =>
                setData((prev) => ({ ...prev, outsideTournaments }))
              }
              onLaunchScoreKeeperForTournament={(ctx) => {
                setPendingTournamentMatch(ctx);
                setActiveTab('scorekeeper');
              }}
              onRequestOfficerUnlock={() => setShowPinModal(true)}
            />
          )}

          {activeTab === 'calendar' && (
            <CalendarEventsView
              events={data.events}
              settings={data.settings}
              isOfficer={isOfficer}
              onUpdateEvents={(events) =>
                setData((prev) => ({ ...prev, events }))
              }
              onUpdateSettings={(settings) =>
                setData((prev) => ({ ...prev, settings }))
              }
              onRequestOfficerUnlock={() => setShowPinModal(true)}
            />
          )}

          {activeTab === 'officers' && (
            <OfficersTasksView
              officers={data.officers}
              tasks={data.tasks}
              isOfficer={isOfficer}
              onUpdateOfficers={(officers) =>
                setData((prev) => ({ ...prev, officers }))
              }
              onUpdateTasks={(tasks) => setData((prev) => ({ ...prev, tasks }))}
              onRequestOfficerUnlock={() => setShowPinModal(true)}
            />
          )}

          {activeTab === 'announcements' && (
            <AnnouncementsView
              announcements={data.announcements}
              officers={data.officers}
              isOfficer={isOfficer}
              onUpdateAnnouncements={(announcements) =>
                setData((prev) => ({ ...prev, announcements }))
              }
              onRequestOfficerUnlock={() => setShowPinModal(true)}
            />
          )}

          {activeTab === 'treasury' && (
            <TreasuryView
              members={data.members}
              transactions={data.transactions}
              defaultDuesAmount={data.settings.duesAmount}
              isOfficer={isOfficer}
              onUpdateMembers={(members) =>
                setData((prev) => ({ ...prev, members }))
              }
              onUpdateTransactions={(transactions) =>
                setData((prev) => ({ ...prev, transactions }))
              }
              onRequestOfficerUnlock={() => setShowPinModal(true)}
            />
          )}

          {activeTab === 'equipment' && (
            <EquipmentView
              equipment={data.equipment}
              members={data.members}
              isOfficer={isOfficer}
              onUpdateEquipment={(equipment) =>
                setData((prev) => ({ ...prev, equipment }))
              }
              onRequestOfficerUnlock={() => setShowPinModal(true)}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsView
              settings={data.settings}
              archives={data.archives}
              isOfficer={isOfficer}
              onUpdateSettings={(settings) =>
                setData((prev) => ({ ...prev, settings }))
              }
              onResetAndArchiveSeason={handleResetAndArchiveSeason}
              onExportJSON={handleExportJSON}
              onImportJSON={handleImportJSON}
              onResetFactoryData={() => {
                setData(INITIAL_CLUB_DATA);
                showToast('Restored default BNHS sample dataset!');
              }}
              onRequestOfficerUnlock={() => setShowPinModal(true)}
            />
          )}
        </main>
      </div>

      {/* ================================================================= */}
      {/* MOBILE FIXED BOTTOM TAB BAR (Thumb-Zone Navigation)               */}
      {/* ================================================================= */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center no-print">
        <button
          onClick={() => {
            setActiveTab('home');
            setMobileDrawerOpen(false);
          }}
          className={`flex flex-col items-center justify-center h-full text-[10px] font-semibold cursor-pointer ${
            activeTab === 'home'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="mt-0.5">Home</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('scorekeeper');
            setMobileDrawerOpen(false);
          }}
          className={`flex flex-col items-center justify-center h-full text-[10px] font-semibold cursor-pointer ${
            activeTab === 'scorekeeper'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500'
          }`}
        >
          <Play className="w-5 h-5" />
          <span className="mt-0.5">Score</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('ladder');
            setMobileDrawerOpen(false);
          }}
          className={`flex flex-col items-center justify-center h-full text-[10px] font-semibold cursor-pointer ${
            activeTab === 'ladder'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500'
          }`}
        >
          <Award className="w-5 h-5" />
          <span className="mt-0.5">Ladder</span>
        </button>

        <button
          onClick={() => {
            setActiveTab('members');
            setMobileDrawerOpen(false);
          }}
          className={`flex flex-col items-center justify-center h-full text-[10px] font-semibold cursor-pointer ${
            activeTab === 'members'
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500'
          }`}
        >
          <Users className="w-5 h-5" />
          <span className="mt-0.5">Roster</span>
        </button>

        <button
          onClick={() => setMobileDrawerOpen(!mobileDrawerOpen)}
          className={`flex flex-col items-center justify-center h-full text-[10px] font-semibold cursor-pointer ${
            mobileDrawerOpen
              ? 'text-blue-600 dark:text-blue-400'
              : 'text-slate-500'
          }`}
        >
          {mobileDrawerOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
          <span className="mt-0.5">All Tabs</span>
        </button>
      </nav>

      {/* Mobile Bottom Sheet Drawer for All Club Sections */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-xs flex items-end no-print">
          <div className="w-full rounded-t-3xl bg-white dark:bg-slate-900 p-5 pb-20 space-y-4 max-h-[82vh] overflow-y-auto">
            <div className="w-10 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-bold">
                All Club HQ Sections
              </span>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="p-2 rounded-lg text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {sidebarItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileDrawerOpen(false);
                  }}
                  className={`min-h-[46px] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 ${
                    activeTab === item.id
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* OFFICER 4-DIGIT PIN UNLOCK MODAL                                  */}
      {/* ================================================================= */}
      {showPinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                Unlock Officer Mode
              </h3>
              <button
                onClick={() => setShowPinModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Enter the 4-digit Officer PIN to unlock editing across all roster,
              ladder, tournament, treasury, and equipment sections. (Default
              PIN: <strong className="font-mono-num">{data.settings.officerPin}</strong>)
            </p>

            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinError('');
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                }}
                placeholder="••••"
                className="w-full h-14 text-center font-mono-num text-3xl tracking-[0.5em] rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white"
              />

              {pinError && (
                <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {pinError}
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPinModal(false)}
                  className="flex-1 min-h-[44px] rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Stay in Member View
                </button>
                <button
                  type="submit"
                  className="flex-1 min-h-[44px] rounded-xl text-xs font-bold text-white cursor-pointer"
                  style={{ backgroundColor: 'var(--club-primary)' }}
                >
                  Unlock Officer Mode
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
