import React, { useState } from 'react';
import { Search, Trash2 } from 'lucide-react';
import {
  ClubDataState,
  ClubSettings,
  MatchRecord,
  Member,
  Officer,
} from '../types';

interface PresidentAdminViewProps {
  data: ClubDataState;
  isPresident: boolean;
  onUpdateSettings: (settings: ClubSettings) => void;
  onUpdateMembers: (members: Member[]) => void;
  onUpdateOfficers: (officers: Officer[]) => void;
  onUpdateMatches: (matches: MatchRecord[]) => void;
  onVoidMatch: (matchId: string) => void;
  onResetAllElo: () => void;
  onResetAllLiveCourts?: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onResetFactoryData: () => void;
  onRequestPresidentUnlock: () => void;
}

export const PresidentAdminView: React.FC<PresidentAdminViewProps> = ({
  data,
  isPresident,
  onUpdateSettings,
  onUpdateMembers,
  onUpdateOfficers,
  onVoidMatch,
  onResetAllElo,
  onResetAllLiveCourts,
  onExportJSON,
  onImportJSON,
  onResetFactoryData,
  onRequestPresidentUnlock,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<
    'broadcast' | 'security' | 'elo' | 'dues' | 'matches' | 'officers' | 'system'
  >('broadcast');

  // Broadcast Alert state
  const currentBroadcast = data.settings.broadcastNotice || {
    enabled: false,
    text: '',
    level: 'info',
  };
  const [noticeEnabled, setNoticeEnabled] = useState(currentBroadcast.enabled);
  const [noticeText, setNoticeText] = useState(currentBroadcast.text || '');
  const [noticeLevel, setNoticeLevel] = useState<'info' | 'urgent'>(
    currentBroadcast.level || 'info'
  );

  // Security state
  const [newOfficerPin, setNewOfficerPin] = useState(
    data.settings.officerPin || '9002'
  );
  const [newPresPassword, setNewPresPassword] = useState(
    data.settings.presidentPassword || '8855'
  );
  const [regLocked, setRegLocked] = useState(
    !!data.settings.registrationLocked
  );

  // Elo Calibrator search and adjust state
  const [eloSearch, setEloSearch] = useState('');
  const [calibratingMemberId, setCalibratingMemberId] = useState<string | null>(
    null
  );
  const [calibrationEloInput, setCalibrationEloInput] = useState<number>(1200);

  // Dues state
  const [duesAmountInput, setDuesAmountInput] = useState<number>(
    data.settings.duesAmount || 25
  );

  // Modals / Confirmation alerts
  const [confirmResetElo, setConfirmResetElo] = useState(false);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [factoryPasswordInput, setFactoryPasswordInput] = useState('');
  const [factoryResetError, setFactoryResetError] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => {
      setSuccessToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  };

  // If user is not authenticated as President, show lock barrier
  if (!isPresident) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center space-y-5">
        <div className="inline-block px-3 py-1 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-mono-num uppercase tracking-wider font-bold text-slate-600 dark:text-slate-300">
          Executive Authorization Required
        </div>
        <div>
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
            President Administration Console
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
            This executive module is reserved for the Byron Nelson Pickleball
            Club President. Highest administration privileges require the
            President access password.
          </p>
        </div>
        <button
          type="button"
          onClick={onRequestPresidentUnlock}
          className="px-5 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white font-semibold text-xs cursor-pointer transition-colors"
        >
          Enter President Password
        </button>
      </div>
    );
  }

  // Handle saving Broadcast Notice
  const handleSaveBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      ...data.settings,
      broadcastNotice: {
        enabled: noticeEnabled,
        text: noticeText.trim(),
        level: noticeLevel,
      },
    });
    triggerToast(
      noticeEnabled
        ? 'Live Club Broadcast posted successfully.'
        : 'Club Broadcast disabled.'
    );
  };

  // Quick preset notices
  const applyPresetNotice = (text: string, level: 'info' | 'urgent') => {
    setNoticeText(text);
    setNoticeLevel(level);
    setNoticeEnabled(true);
  };

  // Handle saving Security PINs & Lock
  const handleSaveSecurity = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = newOfficerPin.trim();
    const cleanPres = newPresPassword.trim() || '8855';

    if (cleanPin.length < 4) {
      triggerToast('Officer PIN must be at least 4 digits.');
      return;
    }

    onUpdateSettings({
      ...data.settings,
      officerPin: cleanPin,
      presidentPassword: cleanPres,
      registrationLocked: regLocked,
    });
    triggerToast('Security credentials & registration permissions updated.');
  };

  // Handle individual Elo calibration
  const handleSaveEloCalibration = (memberId: string) => {
    onUpdateMembers(
      data.members.map((m) =>
        m.id === memberId
          ? {
              ...m,
              elo: Math.max(100, Math.min(3000, Number(calibrationEloInput))),
            }
          : m
      )
    );
    setCalibratingMemberId(null);
    triggerToast('Player Elo calibrated successfully.');
  };

  // Handle bulk mark dues
  const handleBulkDues = (paid: boolean) => {
    const today = new Date().toISOString().slice(0, 10);
    onUpdateMembers(
      data.members.map((m) => ({
        ...m,
        duesPaid: paid,
        duesAmount: duesAmountInput,
        duesPaidDate: paid ? today : undefined,
      }))
    );
    triggerToast(
      paid
        ? `Marked all ${data.members.length} members as DUES PAID ($${duesAmountInput}).`
        : `Reset all member dues to UNPAID for new season.`
    );
  };

  // Handle toggle member dues
  const handleToggleMemberDues = (memberId: string) => {
    const target = data.members.find((m) => m.id === memberId);
    if (!target) return;
    const nowPaid = !target.duesPaid;
    onUpdateMembers(
      data.members.map((m) =>
        m.id === memberId
          ? {
              ...m,
              duesPaid: nowPaid,
              duesPaidDate: nowPaid
                ? new Date().toISOString().slice(0, 10)
                : undefined,
            }
          : m
      )
    );
    triggerToast(
      `${target.name} dues marked as ${nowPaid ? 'PAID' : 'UNPAID'}.`
    );
  };

  // Handle execute Elo master reset
  const handleExecuteResetElo = () => {
    onResetAllElo();
    setConfirmResetElo(false);
    triggerToast('All member Elo ratings reset to 1200.');
  };

  // Handle factory reset confirmation
  const handleExecuteFactoryReset = () => {
    if (
      factoryPasswordInput !== (data.settings.presidentPassword || '8855')
    ) {
      setFactoryResetError('Incorrect President password. Action blocked.');
      return;
    }
    onResetFactoryData();
    setConfirmFactoryReset(false);
    setFactoryPasswordInput('');
    setFactoryResetError('');
    triggerToast('Club database reset to factory baseline.');
  };

  // Filtered members for Elo calibrator
  const filteredEloMembers = data.members
    .filter(
      (m) =>
        m.name.toLowerCase().includes(eloSearch.toLowerCase()) ||
        (m.schoolId && m.schoolId.includes(eloSearch)) ||
        m.skillLevel.toLowerCase().includes(eloSearch.toLowerCase())
    )
    .sort((a, b) => b.elo - a.elo);

  const duesPaidCount = data.members.filter((m) => m.duesPaid).length;
  const duesTotalCollected = duesPaidCount * (data.settings.duesAmount || 25);
  const duesGoal = data.members.length * (data.settings.duesAmount || 25);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white dark:bg-white dark:text-slate-950 px-4 py-2.5 rounded-md border border-slate-700 shadow-lg text-xs font-semibold">
          {successToast}
        </div>
      )}

      {/* Presidential Authority Header Banner */}
      <div className="rounded-lg bg-slate-900 text-white p-6 sm:p-8 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="text-[11px] font-mono-num uppercase tracking-widest text-amber-400 font-semibold">
              President Executive Administration · Unrestricted Access
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">
              Presidential Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Full administrative authority over {data.settings.clubName}: live
              broadcast alerts, security credentials, roster overrides, financial
              dues, match integrity, and data recovery.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 shrink-0">
            <div className="p-3 rounded-md bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase tracking-wider">
                Members
              </div>
              <div className="text-xl font-bold font-mono-num text-white mt-0.5 tabular-nums">
                {data.members.length}
              </div>
            </div>
            <div className="p-3 rounded-md bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase tracking-wider">
                Treasury
              </div>
              <div className="text-xl font-bold font-mono-num text-emerald-400 mt-0.5 tabular-nums">
                ${duesTotalCollected}
              </div>
            </div>
            <div className="p-3 rounded-md bg-slate-950 border border-slate-800">
              <div className="text-[10px] font-mono-num text-slate-400 uppercase tracking-wider">
                Matches
              </div>
              <div className="text-xl font-bold font-mono-num text-amber-400 mt-0.5 tabular-nums">
                {data.matches.length}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Module Navigation Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 touch-scroll no-scrollbar">
        {[
          { id: 'broadcast', label: 'Broadcast Alert' },
          { id: 'security', label: 'Security & PINs' },
          { id: 'elo', label: 'Elo & Seeding' },
          { id: 'dues', label: 'Dues & Treasury' },
          { id: 'matches', label: 'Match Integrity' },
          { id: 'officers', label: 'Officer Roles' },
          { id: 'system', label: 'Data & Recovery' },
        ].map((tab) => {
          const isSelected = activeAdminTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveAdminTab(tab.id as typeof activeAdminTab)}
              className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 -mb-px whitespace-nowrap transition-colors cursor-pointer shrink-0 ${
                isSelected
                  ? 'border-blue-600 text-blue-600 dark:border-amber-400 dark:text-amber-400'
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ================================================================= */}
      {/* MODULE 1: LIVE BROADCAST ALERT                                   */}
      {/* ================================================================= */}
      {activeAdminTab === 'broadcast' && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Live Club Broadcast Alert
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Pin an urgent emergency or important notice banner at the very top
                of the app for all members and officers to see immediately.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Status:
              </span>
              <button
                type="button"
                onClick={() => setNoticeEnabled(!noticeEnabled)}
                className={`px-3 py-1.5 rounded-md text-xs font-mono-num font-bold cursor-pointer transition-colors ${
                  noticeEnabled
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                }`}
              >
                {noticeEnabled ? 'ACTIVE / LIVE' : 'DISABLED'}
              </button>
            </div>
          </div>

          <form onSubmit={handleSaveBroadcast} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                Broadcast Message
              </label>
              <textarea
                rows={3}
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                placeholder="e.g. Weather Alert: Practice moved to the BNHS Indoor Gym today at 4:15 PM. Bring clean court shoes!"
                className="w-full p-3 rounded-md text-sm bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Severity / Style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNoticeLevel('info')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold cursor-pointer border ${
                      noticeLevel === 'info'
                        ? 'bg-blue-50 dark:bg-blue-950/60 border-blue-600 text-blue-700 dark:text-blue-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Club Update
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoticeLevel('urgent')}
                    className={`py-2 px-3 rounded-md text-xs font-semibold cursor-pointer border ${
                      noticeLevel === 'urgent'
                        ? 'bg-red-50 dark:bg-red-950/60 border-red-600 text-red-700 dark:text-red-300'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Urgent Alert
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Quick Presets
                </label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      applyPresetNotice(
                        'Weather Notice: Rain predicted. Practice relocated to the indoor auxiliary gym.',
                        'urgent'
                      )
                    }
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Rain/Weather Delay
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyPresetNotice(
                        'Club Tournament Bracket matches begin at 4:00 PM on Courts 1–4. Be checked in on time!',
                        'info'
                      )
                    }
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Tournament Start
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      applyPresetNotice(
                        'Fall Semester club dues are due this Friday. Please see the club treasurer or pay online.',
                        'info'
                      )
                    }
                    className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Dues Deadline
                  </button>
                </div>
              </div>
            </div>

            {/* Preview */}
            {noticeEnabled && noticeText.trim() && (
              <div className="pt-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Live Preview of Top Banner:
                </div>
                <div
                  className={`p-3 rounded-md flex items-center justify-between gap-3 text-xs font-semibold ${
                    noticeLevel === 'urgent'
                      ? 'bg-red-600 text-white'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  <span>{noticeText}</span>
                  <span className="text-[10px] uppercase tracking-wider opacity-80 shrink-0 font-mono-num">
                    President Notice
                  </span>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer"
              >
                Save & Publish Broadcast
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 2: SECURITY & PIN GOVERNANCE                               */}
      {/* ================================================================= */}
      {activeAdminTab === 'security' && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Security PINs & Registration Permissions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Control access passwords for President and general Officers, and
              manage whether students can self-register into the database.
            </p>
          </div>

          <form onSubmit={handleSaveSecurity} className="space-y-4 max-w-xl">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                President Master Admin Password
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Grants highest presidential authority across all club operations.
              </p>
              <div className="pt-1">
                <input
                  type="text"
                  value={newPresPassword}
                  onChange={(e) => setNewPresPassword(e.target.value)}
                  placeholder="8855"
                  className="w-full sm:w-48 h-9 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-num text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="text-xs font-bold text-slate-900 dark:text-white">
                General Officer PIN (4-Digit)
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Used by vice presidents, secretaries, and captains to take
                attendance and record match scores.
              </p>
              <div className="pt-1">
                <input
                  type="text"
                  maxLength={6}
                  value={newOfficerPin}
                  onChange={(e) =>
                    setNewOfficerPin(e.target.value.replace(/\D/g, ''))
                  }
                  placeholder="9002"
                  className="w-full sm:w-48 h-9 px-3 rounded-md bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-num text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Lock Member Self-Registration
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  When enabled, students cannot register themselves via &ldquo;Add
                  Yourself&rdquo;. Only Officers can add new members.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRegLocked(!regLocked)}
                className={`px-3.5 py-1.5 rounded-md text-xs font-mono-num font-bold cursor-pointer transition-colors shrink-0 ${
                  regLocked
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {regLocked ? 'LOCKED' : 'OPEN'}
              </button>
            </div>

            <button
              type="submit"
              className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer"
            >
              Save Security Changes
            </button>
          </form>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 3: ELO CALIBRATION & SEEDING OVERRIDE                      */}
      {/* ================================================================= */}
      {activeAdminTab === 'elo' && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Elo Calibration & Seeding Overrides
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Presidential power to adjust player Elo ratings directly for
                tournament seeding or correction.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setConfirmResetElo(true)}
              className="px-3.5 py-1.5 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer"
            >
              Reset Entire Club to 1200 Elo
            </button>
          </div>

          {/* Confirm Reset Elo Modal */}
          {confirmResetElo && (
            <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 space-y-3">
              <div className="text-xs font-bold text-red-700 dark:text-red-300">
                Confirm Elo Reset to 1200 for ALL Members
              </div>
              <p className="text-xs text-red-600 dark:text-red-300">
                This will reset the Elo ratings of all {data.members.length} members
                back to the baseline 1200. This cannot be undone automatically.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExecuteResetElo}
                  className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                >
                  Yes, Reset All to 1200
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmResetElo(false)}
                  className="px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Member Search */}
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={eloSearch}
              onChange={(e) => setEloSearch(e.target.value)}
              placeholder="Search member name, ID, or tier..."
              className="w-full h-9 pl-9 pr-3 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Calibrator Table */}
          <div className="overflow-x-auto touch-scroll">
            <table className="w-full min-w-[620px] text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono-num uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pr-2">Rank</th>
                  <th className="py-2.5 px-3">Player</th>
                  <th className="py-2.5 px-3">Skill Tier</th>
                  <th className="py-2.5 px-3">Current Elo</th>
                  <th className="py-2.5 pl-3 text-right">Calibrate / Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                {filteredEloMembers.map((member, idx) => {
                  const isEditing = calibratingMemberId === member.id;
                  return (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 pr-2 font-mono-num font-bold text-slate-400">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{member.name}</span>
                          {member.schoolId && (
                            <span className="font-mono-num text-[10px] text-blue-600 dark:text-blue-400 font-bold">
                              ({member.schoolId})
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-num">
                          {member.wins}W–{member.losses}L · Grade {member.grade}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-600 dark:text-slate-300">
                        {member.skillLevel}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                        {member.elo}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {isEditing ? (
                          <div className="inline-flex items-center gap-1.5">
                            <input
                              type="number"
                              min={100}
                              max={3000}
                              value={calibrationEloInput}
                              onChange={(e) =>
                                setCalibrationEloInput(Number(e.target.value))
                              }
                              className="w-20 h-8 px-2 rounded bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 font-mono-num text-xs font-bold text-center"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEloCalibration(member.id)}
                              className="px-2.5 py-1.5 rounded bg-emerald-600 text-white font-semibold text-xs cursor-pointer hover:bg-emerald-500"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setCalibratingMemberId(null)}
                              className="px-2 py-1.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCalibratingMemberId(member.id);
                              setCalibrationEloInput(member.elo);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[11px] cursor-pointer"
                          >
                            Adjust
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 4: DUES & TREASURY MASTER CONTROLS                         */}
      {/* ================================================================= */}
      {activeAdminTab === 'dues' && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Financial & Dues Master Administration
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bulk manage semester dues, adjust club dues requirements, and
                track member payment status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBulkDues(true)}
                className="px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold cursor-pointer"
              >
                Mark All as Paid
              </button>
              <button
                type="button"
                onClick={() => handleBulkDues(false)}
                className="px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Reset All to Unpaid
              </button>
            </div>
          </div>

          {/* Dues Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Total Dues Collected
              </div>
              <div className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1 tabular-nums">
                ${duesTotalCollected}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono-num">
                {duesPaidCount} of {data.members.length} members paid
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Pending / Outstanding
              </div>
              <div className="text-2xl font-bold font-mono-num text-amber-600 dark:text-amber-400 mt-1 tabular-nums">
                ${Math.max(0, duesGoal - duesTotalCollected)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5 font-mono-num">
                {data.members.length - duesPaidCount} members pending
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Club Semester Dues Amount ($)
              </div>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={0}
                  value={duesAmountInput}
                  onChange={(e) => setDuesAmountInput(Number(e.target.value))}
                  className="w-24 h-8 px-2.5 rounded bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 font-mono-num text-sm font-bold text-center"
                />
                <button
                  type="button"
                  onClick={() => {
                    onUpdateSettings({
                      ...data.settings,
                      duesAmount: duesAmountInput,
                    });
                    triggerToast(`Club dues amount set to $${duesAmountInput}.`);
                  }}
                  className="px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Member Dues Ledger */}
          <div className="space-y-2 pt-2">
            <h3 className="text-[11px] font-mono-num font-bold text-slate-500 uppercase tracking-wider">
              Member Dues Roster ({data.members.length})
            </h3>
            <div className="overflow-x-auto touch-scroll">
              <table className="w-full min-w-[560px] text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-mono-num uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-2.5 px-3">Member</th>
                    <th className="py-2.5 px-3">School ID</th>
                    <th className="py-2.5 px-3">Grade</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 pl-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
                  {data.members.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                    >
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {member.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-slate-500">
                        {member.schoolId || '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-slate-600 dark:text-slate-300">
                        {member.grade}th
                      </td>
                      <td className="py-2.5 px-3 font-mono-num font-bold">
                        {member.duesPaid ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            PAID ($
                            {member.duesAmount || data.settings.duesAmount})
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">
                            UNPAID
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleToggleMemberDues(member.id)}
                          className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                            member.duesPaid
                              ? 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          }`}
                        >
                          {member.duesPaid ? 'Mark Unpaid' : 'Mark Paid'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 5: MATCH INTEGRITY & VOIDING                               */}
      {/* ================================================================= */}
      {activeAdminTab === 'matches' && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
                Match Integrity & Score Voiding
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Inspect official match records. President can void faulty or test
                matches, which automatically reverts the Elo points for all
                players.
              </p>
            </div>

            {onResetAllLiveCourts && (
              <button
                type="button"
                onClick={() => {
                  onResetAllLiveCourts();
                  triggerToast('All multi-court live scoreboards cleared.');
                }}
                className="px-3.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Reset All Live Court Scoreboards
              </button>
            )}
          </div>

          {data.matches.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No official matches recorded yet this season.
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.matches.map((m) => {
                const team1Names = m.team1Ids
                  .map(
                    (id) =>
                      data.members.find((x) => x.id === id)?.name || 'Player'
                  )
                  .join(' & ');
                const team2Names = m.team2Ids
                  .map(
                    (id) =>
                      data.members.find((x) => x.id === id)?.name || 'Player'
                  )
                  .join(' & ');

                const scoreStr = m.games
                  .map((g) => `${g.team1Score}–${g.team2Score}`)
                  .join(', ');

                return (
                  <div
                    key={m.id}
                    className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-slate-900 dark:text-white">
                          {team1Names} vs {team2Names}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-[11px] font-mono-num uppercase text-slate-500">
                          {m.format}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="text-slate-400 font-mono-num text-[11px]">
                          {m.date}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300">
                        Score:{' '}
                        <span className="font-bold font-mono-num">
                          {scoreStr}
                        </span>{' '}
                        · Winner:{' '}
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Team {m.winnerTeam}
                        </span>{' '}
                        · Elo Delta:{' '}
                        <span className="font-mono-num">±{m.eloDelta}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        onVoidMatch(m.id);
                        triggerToast('Match voided & player Elo reverted.');
                      }}
                      className="px-3 py-1.5 rounded-md bg-red-50 hover:bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Void Match & Revert Elo
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 6: OFFICER ROLES & EXECUTIVE BOARD                         */}
      {/* ================================================================= */}
      {activeAdminTab === 'officers' && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Officer Board Appointments
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Appoint, manage, or modify Byron Nelson Pickleball Club officers
              and leadership positions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.officers.map((off) => (
              <div
                key={off.id}
                className="p-3.5 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-sm">
                      {off.name}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-xs font-mono-num font-bold text-blue-600 dark:text-amber-400">
                      {off.role}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5 font-mono-num">
                    Grade {off.grade} · Contact: {off.contact || 'None'}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onUpdateOfficers(
                      data.officers.filter((o) => o.id !== off.id)
                    );
                    triggerToast(`${off.name} removed from officers.`);
                  }}
                  className="p-1.5 text-slate-400 hover:text-red-500 cursor-pointer"
                  title="Remove officer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* MODULE 7: SYSTEM BACKUP & RECOVERY                                */}
      {/* ================================================================= */}
      {activeAdminTab === 'system' && (
        <div className="rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-6">
          <div className="pb-4 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">
              Club Database Backup & Recovery
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Export full club records to JSON, restore previous club backups,
              or reset to factory initial baseline.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                Full Database Export
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download a complete JSON snapshot of all members, ratings,
                attendance logs, and settings.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onExportJSON}
                  className="px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold cursor-pointer"
                >
                  Download Backup JSON
                </button>
              </div>
            </div>

            <div className="p-4 rounded-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="font-bold text-slate-900 dark:text-white text-sm">
                Restore from Backup JSON
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Upload and restore a previous JSON backup file into the club
                database.
              </p>
              <div className="pt-2">
                <label className="px-3.5 py-2 rounded-md bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-950 text-white text-xs font-semibold inline-flex items-center cursor-pointer">
                  <span>Select JSON File</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        onImportJSON(file);
                        triggerToast('Backup restored successfully.');
                      }
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Danger Zone: Factory Reset */}
          <div className="p-4 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 space-y-3">
            <div className="text-red-700 dark:text-red-300 font-bold text-sm">
              Danger Zone · Factory Reset Club Database
            </div>
            <p className="text-xs text-red-600 dark:text-red-400 max-w-xl">
              Permanently resets all club data to the initial Byron Nelson High
              School baseline. This action requires the President access
              password.
            </p>

            {confirmFactoryReset ? (
              <div className="space-y-2 pt-1 max-w-md">
                <label className="block text-xs font-bold text-red-700 dark:text-red-300">
                  Enter President Password to Confirm:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="password"
                    value={factoryPasswordInput}
                    onChange={(e) => {
                      setFactoryResetError('');
                      setFactoryPasswordInput(e.target.value);
                    }}
                    placeholder="••••"
                    className="flex-1 h-9 px-3 rounded bg-white dark:bg-slate-900 border border-red-300 dark:border-red-700 font-mono-num text-sm"
                  />
                  <button
                    type="button"
                    onClick={handleExecuteFactoryReset}
                    className="px-3 py-2 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
                  >
                    Confirm Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmFactoryReset(false);
                      setFactoryPasswordInput('');
                    }}
                    className="px-3 py-2 rounded bg-slate-200 dark:bg-slate-800 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
                {factoryResetError && (
                  <div className="text-xs font-bold text-red-600">
                    {factoryResetError}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmFactoryReset(true)}
                className="px-3.5 py-2 rounded-md bg-red-600 hover:bg-red-500 text-white text-xs font-semibold cursor-pointer"
              >
                Reset to Factory Default
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
