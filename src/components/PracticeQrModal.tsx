import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  LogIn,
  MapPin,
  Printer,
  QrCode,
  ScanLine,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import { AttendanceSession, CalendarEvent, Member } from '../types';
import { QrCheckinRecord, User } from '../firebase';

export interface PracticeQrTarget {
  eventId: string;
  title: string;
  date: string;
  time: string;
  location: string;
  token: string;
}

export function buildPracticeQrToken(date: string, eventId: string): string {
  const cleanDate = date.replace(/[^0-9]/g, '').slice(0, 8) || '20261029';
  const cleanId =
    eventId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6) || 'COURT1';
  return `BNHS-${cleanDate}-${cleanId}`;
}

export function buildPracticeQrUrl(target: PracticeQrTarget): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('qr_checkin', '1');
  url.searchParams.set('date', target.date);
  url.searchParams.set('title', target.title);
  url.searchParams.set('token', target.token);
  return url.toString();
}

interface PracticeQrModalProps {
  initialMode: 'display' | 'scan';
  target: PracticeQrTarget;
  availablePracticeTargets: PracticeQrTarget[];
  members: Member[];
  attendance: AttendanceSession[];
  currentUser: User | null;
  linkedMemberId: string;
  recentQrCheckins: QrCheckinRecord[];
  onClose: () => void;
  onSelectTarget: (target: PracticeQrTarget) => void;
  onSignInGoogle: () => Promise<void>;
  onCompleteQrCheckin: (params: {
    target: PracticeQrTarget;
    memberId: string;
  }) => Promise<void>;
}

export const PracticeQrModal: React.FC<PracticeQrModalProps> = ({
  initialMode,
  target,
  availablePracticeTargets,
  members,
  attendance,
  currentUser,
  linkedMemberId,
  recentQrCheckins,
  onClose,
  onSelectTarget,
  onSignInGoogle,
  onCompleteQrCheckin,
}) => {
  const [mode, setMode] = useState<'display' | 'scan'>(initialMode);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(
    linkedMemberId || members[0]?.id || ''
  );
  const [manualTokenInput, setManualTokenInput] = useState<string>(
    target.token
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkedInSuccess, setCheckedInSuccess] = useState<{
    memberName: string;
    date: string;
    title: string;
    newPct: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (linkedMemberId) {
      setSelectedMemberId(linkedMemberId);
    }
  }, [linkedMemberId]);

  useEffect(() => {
    setManualTokenInput(target.token);
    setCheckedInSuccess(null);
    setErrorMsg(null);
  }, [target]);

  const qrUrl = buildPracticeQrUrl(target);

  // Find current attendance session for target.date
  const existingSession = attendance.find((s) => s.date === target.date);
  const presentCount = existingSession
    ? existingSession.presentMemberIds.length
    : 0;

  const isSelectedMemberAlreadyPresent =
    existingSession?.presentMemberIds.includes(selectedMemberId) ?? false;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleMatchTokenInput = (val: string) => {
    setManualTokenInput(val);
    setErrorMsg(null);
    const cleaned = val.trim().toUpperCase();
    const matched = availablePracticeTargets.find(
      (t) => t.token.toUpperCase() === cleaned || t.date === val.trim()
    );
    if (matched) {
      onSelectTarget(matched);
    }
  };

  const handleConfirmCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId) return;
    setErrorMsg(null);
    setSubmitting(true);

    try {
      const member = members.find((m) => m.id === selectedMemberId);
      await onCompleteQrCheckin({
        target,
        memberId: selectedMemberId,
      });

      // Compute updated attendance percentage
      const totalSessions = existingSession
        ? attendance.length
        : attendance.length + 1;
      const attendedBefore = attendance.filter((s) =>
        s.presentMemberIds.includes(selectedMemberId)
      ).length;
      const attendedAfter = isSelectedMemberAlreadyPresent
        ? attendedBefore
        : attendedBefore + 1;
      const newPct = Math.round(
        (attendedAfter / Math.max(1, totalSessions)) * 100
      );

      setCheckedInSuccess({
        memberName: member?.name || 'Member',
        date: target.date,
        title: target.title,
        newPct,
      });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Could not complete check-in.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl my-auto">
        {/* Top Modal Header + Mode Switcher */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ backgroundColor: 'var(--club-primary)' }}
            >
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold text-slate-900 dark:text-white leading-tight">
                Practice Event QR Check-In
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Scan courtside QR code to log practice attendance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer no-print"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs: Courtside QR Code vs Member Scan Check-In */}
        <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl no-print">
          <button
            type="button"
            onClick={() => setMode('display')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mode === 'display'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" />
            Event QR Code Pass
          </button>
          <button
            type="button"
            onClick={() => setMode('scan')}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
              mode === 'scan'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5" />
            Member Scan & Check-In
          </button>
        </div>

        {/* Practice Event Selector Strip */}
        <div className="no-print">
          <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
            Select Calendar Practice Event:
          </label>
          <select
            value={`${target.date}::${target.token}`}
            onChange={(e) => {
              const [datePart] = e.target.value.split('::');
              const found = availablePracticeTargets.find(
                (t) => t.date === datePart
              );
              if (found) onSelectTarget(found);
            }}
            className="w-full min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          >
            {availablePracticeTargets.map((item) => (
              <option
                key={`${item.date}::${item.token}`}
                value={`${item.date}::${item.token}`}
              >
                {item.date} — {item.title} ({item.token})
              </option>
            ))}
          </select>
        </div>

        {/* =============================================================== */}
        {/* MODE 1: DISPLAY UNIQUE PRACTICE QR CODE                         */}
        {/* =============================================================== */}
        {mode === 'display' && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center text-center space-y-4">
              <div className="space-y-1">
                <div className="text-xs font-mono-num font-bold text-blue-600 dark:text-blue-400">
                  {target.date} · {target.time}
                </div>
                <h4 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  {target.title}
                </h4>
                <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>{target.location}</span>
                </div>
              </div>

              {/* High-Contrast Scannable SVG QR Code */}
              <div className="p-4 bg-white rounded-2xl border-2 border-slate-900 shadow-sm">
                <QRCodeSVG
                  value={qrUrl}
                  size={208}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div className="space-y-1">
                <div className="text-[11px] text-slate-500">
                  Unique Event Verification Token
                </div>
                <div className="font-mono-num text-sm font-bold tracking-wider px-3 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white inline-block">
                  {target.token}
                </div>
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400">
                Checked In So Far:{' '}
                <strong className="font-mono-num text-slate-900 dark:text-white">
                  {presentCount} / {members.length} Members
                </strong>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 no-print">
              <button
                type="button"
                onClick={handleCopyUrl}
                className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedLink ? 'Link Copied!' : 'Copy QR Link'}
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Print QR Sheet
              </button>

              <button
                type="button"
                onClick={() => setMode('scan')}
                className="min-h-[42px] px-3 py-2 rounded-xl text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 cursor-pointer"
                style={{ backgroundColor: 'var(--club-primary)' }}
              >
                <UserCheck className="w-3.5 h-3.5" />
                Log My Attendance
              </button>
            </div>
          </div>
        )}

        {/* =============================================================== */}
        {/* MODE 2: MEMBER SCAN & INSTANT ATTENDANCE LOGGING                */}
        {/* =============================================================== */}
        {mode === 'scan' && (
          <div className="space-y-4">
            {/* Event Verification Summary */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  Active QR Practice Session
                </span>
                <span className="font-mono-num text-slate-500">
                  {target.token}
                </span>
              </div>
              <div className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {target.title}
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Calendar className="w-3.5 h-3.5" /> {target.date}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {target.time}
                </span>
              </div>
            </div>

            {/* Google Auth Identity Status */}
            <div className="p-3.5 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs">
                <div className="font-semibold text-slate-900 dark:text-white">
                  {currentUser
                    ? `Signed in as ${currentUser.displayName || currentUser.email}`
                    : 'Sign in with Google for Cloud-Verified Check-In'}
                </div>
                <div className="text-slate-500 dark:text-slate-400">
                  {currentUser
                    ? 'Your QR check-in is saved to Firestore & synced across devices.'
                    : 'Or check in directly below to update the club attendance sheet.'}
                </div>
              </div>

              {!currentUser && (
                <button
                  type="button"
                  onClick={onSignInGoogle}
                  className="px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  Google Sign-In
                </button>
              )}
            </div>

            {checkedInSuccess ? (
              <div className="p-5 rounded-2xl bg-emerald-950 text-white border border-emerald-700 space-y-3 text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <div className="space-y-1">
                  <h4 className="font-display text-2xl font-bold">
                    Attendance Logged for {checkedInSuccess.memberName}!
                  </h4>
                  <p className="text-xs text-emerald-200">
                    Checked in to <strong>{checkedInSuccess.title}</strong> (
                    {checkedInSuccess.date})
                  </p>
                </div>
                <div className="py-2 px-4 rounded-xl bg-emerald-900/60 inline-block font-mono-num text-xs font-bold text-emerald-200">
                  Updated Season Attendance Rate: {checkedInSuccess.newPct}%
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full min-h-[42px] rounded-xl bg-white text-slate-900 text-xs font-bold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmCheckin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    1. Verify QR Event Code
                  </label>
                  <input
                    type="text"
                    value={manualTokenInput}
                    onChange={(e) => handleMatchTokenInput(e.target.value)}
                    placeholder="e.g. BNHS-20261029-EV1"
                    className="w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-mono-num bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    2. Select Your Name on the Club Roster
                  </label>
                  <select
                    value={selectedMemberId}
                    onChange={(e) => setSelectedMemberId(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 rounded-xl text-sm font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                  >
                    {members.map((m) => {
                      const alreadyIn =
                        existingSession?.presentMemberIds.includes(m.id) ??
                        false;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.name} (Grade {m.grade}){' '}
                          {alreadyIn ? '— Already Checked In ✓' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-300 text-xs font-semibold">
                    {errorMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[48px] px-5 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: 'var(--club-primary)' }}
                >
                  <UserCheck className="w-4 h-4" />
                  {submitting
                    ? 'Logging Attendance...'
                    : isSelectedMemberAlreadyPresent
                    ? 'Re-Verify QR Check-In ✓'
                    : 'Confirm Practice Attendance Check-In'}
                </button>
              </form>
            )}

            {/* Recent Verified Cloud QR Scans for current user */}
            {recentQrCheckins.length > 0 && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-500">
                  Your Recent Cloud-Verified QR Scans ({recentQrCheckins.length}
                  ):
                </div>
                <div className="max-h-24 overflow-y-auto space-y-1">
                  {recentQrCheckins.slice(0, 3).map((rec) => (
                    <div
                      key={rec.id}
                      className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"
                    >
                      <span>
                        <strong>{rec.memberName}</strong> · {rec.practiceTitle}
                      </span>
                      <span className="font-mono-num text-[11px]">
                        {rec.practiceDate}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
